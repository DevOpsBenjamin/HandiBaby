import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { ConnectivityMonitor } from '@/core/network/connectivity'
import { SupabaseGateway } from '@/core/supabase/gateway'
import { SyncEngine } from '@/core/sync/engine'
import { SyncRegistry } from '@/core/sync/registry'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import { GroupPhase } from '../GroupPhase'
import { ParticipantRepository } from '../ParticipantRepository'
import { Playoff, RoundLockedError, RoundNotReadyError } from '../Playoff'
import { ScoreKeeper } from '../ScoreKeeper'
import { StandingsReader } from '../StandingsReader'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import type { PlayoffPhase } from '../domain/bracket'
import { buildTeams } from '../domain/draw'
import type { Tournament } from '../domain/types'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

/** An edition played out and frozen, sitting at the start of its playoff. */
async function intoPlayoff(playerCount = 6) {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const db = open

  const created = await new TournamentRepository(db).createDraft(EDITION)
  const players = new PlayerRepository(db)
  const participants = new ParticipantRepository(db)
  const tournamentId = created.id ?? 0

  const ids: number[] = []
  for (let index = 0; index < playerCount; index += 1) {
    const player = await players.create(`Prenom${index}`, `Nom${index}`)
    const id = player.id ?? 0
    ids.push(id)
    await participants.add(tournamentId, id)
  }

  const pairs: (readonly [number, number])[] = []
  for (let index = 0; index < ids.length; index += 2) {
    pairs.push([ids[index] ?? 0, ids[index + 1] ?? 0])
  }

  await new TournamentSetup(db).start(tournamentId, buildTeams(pairs))

  const engine = new SyncEngine({
    db,
    gateway: new SupabaseGateway(null),
    registry: new SyncRegistry(),
    connectivity: new ConnectivityMonitor(),
    pollIntervalMs: 60_000,
  })

  const keeper = new ScoreKeeper(db, engine)
  const groupPhase = new GroupPhase(db)

  // The lower team id always wins, which separates the table cleanly, and the
  // margins move each team's two configurations apart.
  const scores = [0, 1, 5, 2]
  for (const match of await db.matches.where('tournamentId').equals(tournamentId).toArray()) {
    const stronger = Math.min(match.blueTeamId, match.whiteTeamId)
    await keeper.record(created, match.id ?? 0, {
      winningSide: match.blueTeamId === stronger ? 'blue' : 'white',
      loserScore: scores[(match.rankInDuel ?? 1) - 1] ?? 3,
    })
  }

  const preview = await groupPhase.preview(tournamentId)
  const choices: Record<number, number> = {}
  for (const teamId of preview.awaitingChoice) {
    choices[teamId] =
      preview.configurations.find((row) => row.teamId === teamId)?.configurations[0]?.defenderId ??
      0
  }

  const frozen = await groupPhase.close(created, choices)
  const tournament: Tournament = { ...created, status: 'playoff' }
  const playoff = new Playoff(db, keeper)

  await playoff.ensureRounds(tournament)

  return {
    db,
    engine,
    frozen,
    tournament,
    tournamentId,
    playoff,
    standings: new StandingsReader(db),
    seed: (rank: number) => frozen.standings.find((row) => row.rank === rank)?.teamId ?? 0,
  }
}

/** Wins a round for `teamId`, whichever end it happens to be standing at. */
async function win(
  context: Awaited<ReturnType<typeof intoPlayoff>>,
  phase: PlayoffPhase,
  teamId: number,
  loserScore = 4,
): Promise<void> {
  const state = await context.playoff.read(context.tournamentId)
  const round = state?.rounds.find((candidate) => candidate.phase === phase)

  await context.playoff.enter(context.tournament, phase, {
    winningSide: round?.blueTeamId === teamId ? 'blue' : 'white',
    loserScore,
  })
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('Playoff', () => {
  it('opens the qualification alone for three teams, off the frozen bracket', async () => {
    const context = await intoPlayoff()
    const state = await context.playoff.read(context.tournamentId)

    expect(state?.rounds.map((round) => round.phase)).toEqual([
      'qualification',
      'semi-final',
      'final',
    ])
    expect(state?.rounds.filter((round) => round.matchId !== null)).toHaveLength(1)
    expect(state?.rounds[0]).toMatchObject({
      phase: 'qualification',
      homeTeamId: context.seed(1),
      awayTeamId: context.seed(2),
    })
  })

  it('opens the qualification and the elimination for four teams', async () => {
    const context = await intoPlayoff(8)
    const state = await context.playoff.read(context.tournamentId)

    expect(state?.rounds.map((round) => round.phase)).toEqual([
      'qualification',
      'elimination',
      'semi-final',
      'final',
    ])
    expect(
      state?.rounds.filter((round) => round.matchId !== null).map((round) => round.phase),
    ).toEqual(['qualification', 'elimination'])
  })

  it('stands each team in the configuration frozen at validation', async () => {
    const context = await intoPlayoff()
    const [match] = await context.db.matches.where('phase').equals('qualification').toArray()

    for (const teamId of [match?.blueTeamId, match?.whiteTeamId]) {
      const frozen = context.frozen.configurations.find((row) => row.teamId === teamId)
      const isBlue = teamId === match?.blueTeamId

      expect(isBlue ? match?.blueDefenderId : match?.whiteDefenderId).toBe(frozen?.defenderId)
      expect(isBlue ? match?.blueAttackerId : match?.whiteAttackerId).toBe(frozen?.attackerId)
    }
  })

  it('puts the better ranked team on the end it asks for', async () => {
    const context = await intoPlayoff()
    const first = context.seed(1)

    await context.playoff.chooseEnd(context.tournament, 'qualification', 'white')

    const after = await context.playoff.read(context.tournamentId)
    expect(after?.rounds[0]?.whiteTeamId).toBe(first)
    expect(after?.rounds[0]?.choosesEnd).toBe(first)

    await context.playoff.chooseEnd(context.tournament, 'qualification', 'blue')

    const back = await context.playoff.read(context.tournamentId)
    expect(back?.rounds[0]?.blueTeamId).toBe(first)
  })

  it('opens the round a result feeds, and not before', async () => {
    const context = await intoPlayoff()

    const before = await context.playoff.read(context.tournamentId)
    expect(before?.rounds.find((round) => round.phase === 'semi-final')?.ready).toBe(false)

    await win(context, 'qualification', context.seed(2))

    const after = await context.playoff.read(context.tournamentId)
    const semi = after?.rounds.find((round) => round.phase === 'semi-final')

    // First lost, so first drops into the semi against third: the second life.
    expect(semi?.ready).toBe(true)
    expect(semi?.homeTeamId).toBe(context.seed(1))
    expect(semi?.awayTeamId).toBe(context.seed(3))
    expect(semi?.matchId).not.toBeNull()
  })

  it('refuses a round whose feeder has not been played', async () => {
    const context = await intoPlayoff()

    await expect(
      context.playoff.enter(context.tournament, 'final', { winningSide: 'blue', loserScore: 2 }),
    ).rejects.toBeInstanceOf(RoundNotReadyError)
  })

  it('keeps a result correctable until the round it feeds is entered', async () => {
    const context = await intoPlayoff()

    await win(context, 'qualification', context.seed(2))

    // Still correctable: nothing downstream has been played.
    await win(context, 'qualification', context.seed(1))

    const corrected = await context.playoff.read(context.tournamentId)
    const semi = corrected?.rounds.find((round) => round.phase === 'semi-final')

    // The other team now takes the second life, and the stale semi is gone.
    expect(semi?.homeTeamId).toBe(context.seed(2))
    expect(corrected?.rounds[0]?.locked).toBe(false)

    // The stored row has to be rebuilt too, not just the pairing computed off
    // the bracket: a row left behind would stand the wrong two teams up.
    expect([semi?.blueTeamId, semi?.whiteTeamId].sort()).toEqual(
      [context.seed(2), context.seed(3)].sort(),
    )

    const rows = await context.db.matches.where('phase').equals('semi-final').toArray()
    expect(rows).toHaveLength(1)
  })

  it('locks a result once the round it feeds has been entered', async () => {
    const context = await intoPlayoff()

    await win(context, 'qualification', context.seed(2))
    await win(context, 'semi-final', context.seed(1))

    const state = await context.playoff.read(context.tournamentId)
    expect(state?.rounds.find((round) => round.phase === 'qualification')?.locked).toBe(true)

    await expect(
      context.playoff.enter(context.tournament, 'qualification', {
        winningSide: 'blue',
        loserScore: 9,
      }),
    ).rejects.toBeInstanceOf(RoundLockedError)
  })

  it('runs a whole three-team playoff through to a final', async () => {
    const context = await intoPlayoff()

    await win(context, 'qualification', context.seed(1))
    await win(context, 'semi-final', context.seed(2))

    const state = await context.playoff.read(context.tournamentId)
    const final = state?.rounds.find((round) => round.phase === 'final')

    expect(final?.ready).toBe(true)
    expect([final?.homeTeamId, final?.awayTeamId].sort()).toEqual(
      [context.seed(1), context.seed(2)].sort(),
    )

    await win(context, 'final', context.seed(2))

    const finished = await context.playoff.read(context.tournamentId)
    expect(finished?.rounds.find((round) => round.phase === 'final')?.result).not.toBeNull()
  })

  it('leaves the standings and the configurations untouched by any playoff result', async () => {
    const context = await intoPlayoff()
    const before = await context.standings.read(context.tournamentId)

    await win(context, 'qualification', context.seed(2), 0)
    await win(context, 'semi-final', context.seed(3), 0)

    const after = await context.standings.read(context.tournamentId)

    expect(after.rows).toEqual(before.rows)
    expect(after.configurations).toEqual(before.configurations)
  })

  it('never lets the playoff rewrite the frozen bracket it is played from', async () => {
    const context = await intoPlayoff()

    await win(context, 'qualification', context.seed(2))
    await win(context, 'semi-final', context.seed(1))

    const stored = await context.db.frozenEditions.get(context.tournamentId)
    expect(stored).toEqual(context.frozen)
  })
})
