import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { ConnectivityMonitor } from '@/core/network/connectivity'
import { SupabaseGateway } from '@/core/supabase/gateway'
import { SyncEngine } from '@/core/sync/engine'
import { SyncRegistry } from '@/core/sync/registry'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import {
  ArbitrationPendingError,
  ConfigurationChoiceRequiredError,
  GroupPhase,
  MatchesStillOpenError,
  NotInRoundRobinError,
} from '../GroupPhase'
import { ParticipantRepository } from '../ParticipantRepository'
import { ScheduleReader } from '../ScheduleReader'
import { GroupPhaseClosedError, ScoreKeeper } from '../ScoreKeeper'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { ArbitrationMismatchError } from '../domain/arbitration'
import { buildTeams } from '../domain/draw'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

async function started(playerCount = 6) {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const db = open

  const tournament = await new TournamentRepository(db).createDraft(EDITION)
  const players = new PlayerRepository(db)
  const participants = new ParticipantRepository(db)
  const tournamentId = tournament.id ?? 0

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

  return {
    db,
    tournament,
    tournamentId,
    groupPhase: new GroupPhase(db),
    keeper: new ScoreKeeper(db, engine),
    schedule: new ScheduleReader(db),
  }
}

/**
 * Enters every round-robin match, the lower team id always winning, so the
 * table separates cleanly instead of depending on which index happened to be
 * flipped. `loserScores` is read by position in the duel, which is what moves a
 * team's two configurations apart or leaves them level.
 */
async function enterEverything(
  context: Awaited<ReturnType<typeof started>>,
  loserScores: readonly number[] = [0, 1, 5, 2],
): Promise<void> {
  const matches = await context.db.matches
    .where('tournamentId')
    .equals(context.tournamentId)
    .toArray()

  for (const match of matches) {
    const stronger = Math.min(match.blueTeamId, match.whiteTeamId)

    await context.keeper.record(context.tournament, match.id ?? 0, {
      winningSide: match.blueTeamId === stronger ? 'blue' : 'white',
      loserScore: loserScores[(match.rankInDuel ?? 1) - 1] ?? 3,
    })
  }
}

/**
 * Every match to the blue side by the same margin. The duel pattern gives each
 * team the blue end exactly as often, so this lands every team on the same
 * record: the residual tie the rules hand to the organisers.
 */
async function enterAllToBlue(context: Awaited<ReturnType<typeof started>>): Promise<void> {
  const matches = await context.db.matches
    .where('tournamentId')
    .equals(context.tournamentId)
    .toArray()

  for (const match of matches) {
    await context.keeper.record(context.tournament, match.id ?? 0, {
      winningSide: 'blue',
      loserScore: 3,
    })
  }
}

/** The choice the rules ask of every team whose two configurations are level. */
async function choicesFor(
  context: Awaited<ReturnType<typeof started>>,
): Promise<Record<number, number>> {
  const preview = await context.groupPhase.preview(context.tournamentId)
  const choices: Record<number, number> = {}

  for (const teamId of preview.awaitingChoice) {
    choices[teamId] =
      preview.configurations.find((row) => row.teamId === teamId)?.configurations[0]?.defenderId ??
      0
  }

  return choices
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('GroupPhase', () => {
  it('refuses to close while a single match is still open', async () => {
    const context = await started()
    const [, ...allButOne] = await context.db.matches.toArray()

    for (const match of allButOne) {
      await context.keeper.record(context.tournament, match.id ?? 0, {
        winningSide: 'blue',
        loserScore: 3,
      })
    }

    const preview = await context.groupPhase.preview(context.tournamentId)
    expect(preview.remaining).toBe(1)
    expect(preview.closable).toBe(false)

    await expect(context.groupPhase.close(context.tournament)).rejects.toBeInstanceOf(
      MatchesStillOpenError,
    )
    expect((await context.db.tournaments.get(context.tournamentId))?.status).toBe('round-robin')
  })

  it('stores the standings, the configurations and the bracket as data', async () => {
    const context = await started()
    await enterEverything(context)

    const frozen = await context.groupPhase.close(context.tournament, await choicesFor(context))
    const stored = await context.groupPhase.readFrozen(context.tournamentId)

    expect(stored).toEqual(frozen)
    expect(stored?.standings.map((row) => row.rank)).toEqual([1, 2, 3])
    expect(stored?.configurations).toHaveLength(3)
    expect(stored?.bracket.map((pairing) => pairing.phase)).toEqual([
      'qualification',
      'semi-final',
      'final',
    ])
    expect(stored?.frozenAt).toBeGreaterThan(0)
  })

  it('moves the edition to the playoff', async () => {
    const context = await started()
    await enterEverything(context)

    await context.groupPhase.close(context.tournament, await choicesFor(context))

    expect((await context.db.tournaments.get(context.tournamentId))?.status).toBe('playoff')
  })

  it('gives four teams a bracket with an elimination round', async () => {
    const context = await started(8)
    await enterEverything(context)

    const frozen = await context.groupPhase.close(context.tournament, await choicesFor(context))

    expect(frozen.standings).toHaveLength(4)
    expect(frozen.bracket.map((pairing) => pairing.phase)).toEqual([
      'qualification',
      'elimination',
      'semi-final',
      'final',
    ])
  })

  it('refuses a second close, so the frozen data can only be written once', async () => {
    const context = await started()
    await enterEverything(context)
    const choices = await choicesFor(context)

    await context.groupPhase.close(context.tournament, choices)

    await expect(context.groupPhase.close(context.tournament, choices)).rejects.toBeInstanceOf(
      NotInRoundRobinError,
    )
    expect(await context.db.frozenEditions.count()).toBe(1)
  })

  it('refuses to seed a bracket on a classification nobody could settle', async () => {
    const context = await started()
    await enterAllToBlue(context)

    const preview = await context.groupPhase.preview(context.tournamentId)
    expect(preview.remaining).toBe(0)
    expect(preview.closable).toBe(false)

    await expect(context.groupPhase.close(context.tournament)).rejects.toBeInstanceOf(
      ArbitrationPendingError,
    )
    expect(await context.db.frozenEditions.count()).toBe(0)
  })

  it('asks a team with two level configurations to choose, and refuses without it', async () => {
    const context = await started()
    // A constant margin leaves every team's two configurations exactly level.
    await enterEverything(context, [3, 3, 3, 3])

    const preview = await context.groupPhase.preview(context.tournamentId)

    if (preview.awaitingChoice.length === 0) {
      throw new Error('expected at least one team with level configurations')
    }

    await expect(context.groupPhase.close(context.tournament)).rejects.toBeInstanceOf(
      ConfigurationChoiceRequiredError,
    )
    expect(await context.db.frozenEditions.count()).toBe(0)
  })

  it('freezes the configuration the team picked, not the one the app would have', async () => {
    const context = await started()
    await enterEverything(context, [3, 3, 3, 3])

    const preview = await context.groupPhase.preview(context.tournamentId)
    const choices: Record<number, number> = {}

    for (const teamId of preview.awaitingChoice) {
      const options = preview.configurations.find((row) => row.teamId === teamId)?.configurations
      // Deliberately the second one, so the assertion cannot pass by default.
      choices[teamId] = options?.[1]?.defenderId ?? 0
    }

    const frozen = await context.groupPhase.close(context.tournament, choices)

    for (const teamId of preview.awaitingChoice) {
      const stored = frozen.configurations.find((row) => row.teamId === teamId)
      expect(stored?.defenderId).toBe(choices[teamId])
      expect(stored?.chosen).toBe(true)
    }
  })

  it('locks the round-robin scores once the phase is closed', async () => {
    const context = await started()
    await enterEverything(context)

    await context.groupPhase.close(context.tournament, await choicesFor(context))

    const [match] = await context.db.matches.toArray()
    const before = match?.loserScore

    await expect(
      context.keeper.correct(context.tournament, match?.id ?? 0, {
        winningSide: 'white',
        loserScore: 9,
      }),
    ).rejects.toBeInstanceOf(GroupPhaseClosedError)

    expect((await context.db.matches.get(match?.id ?? 0))?.loserScore).toBe(before)
  })
})

describe('recording the organisers arbitration', () => {
  /** The three teams come out exactly level, which is the case the rules stop on. */
  async function deadlocked() {
    const context = await started()
    await enterAllToBlue(context)
    return context
  }

  it('still refuses to close while nobody has settled the order', async () => {
    const context = await deadlocked()

    await expect(context.groupPhase.close(context.tournament)).rejects.toBeInstanceOf(
      ArbitrationPendingError,
    )
    expect(await context.db.frozenEditions.count()).toBe(0)
  })

  it('names exactly the teams that need arbitrating', async () => {
    const context = await deadlocked()
    const preview = await context.groupPhase.preview(context.tournamentId)
    const teamIds = (await context.db.teams.toArray()).map((team) => team.id ?? 0)

    expect(preview.awaitingArbitration).toHaveLength(1)
    expect(preview.awaitingArbitration[0]?.slice().sort()).toEqual(teamIds.slice().sort())
    expect(preview.closable).toBe(false)
  })

  it('closes on the order the organisers settled, and seeds the bracket from it', async () => {
    const context = await deadlocked()
    const preview = await context.groupPhase.preview(context.tournamentId)
    const group = preview.awaitingArbitration[0] ?? []
    // Deliberately reversed, so the assertion cannot pass on the default order.
    const settled = [...group].reverse()

    const choices: Record<number, number> = {}
    for (const teamId of preview.awaitingChoice) {
      choices[teamId] =
        preview.configurations.find((row) => row.teamId === teamId)?.configurations[0]
          ?.defenderId ?? 0
    }

    const frozen = await context.groupPhase.close(context.tournament, choices, [settled])

    expect(frozen.standings.map((row) => row.teamId)).toEqual(settled)
    expect(frozen.standings.map((row) => row.rank)).toEqual([1, 2, 3])
    expect(frozen.arbitration).toEqual([settled])
    expect((await context.db.tournaments.get(context.tournamentId))?.status).toBe('playoff')
  })

  it('keeps saying the rules separated nobody, even once it is settled', async () => {
    const context = await deadlocked()
    const preview = await context.groupPhase.preview(context.tournamentId)
    const group = preview.awaitingArbitration[0] ?? []

    const choices: Record<number, number> = {}
    for (const teamId of preview.awaitingChoice) {
      choices[teamId] =
        preview.configurations.find((row) => row.teamId === teamId)?.configurations[0]
          ?.defenderId ?? 0
    }

    const frozen = await context.groupPhase.close(context.tournament, choices, [group])

    // The decision is recorded next to the standings, not folded into them.
    expect(frozen.standings.slice(0, 2).every((row) => row.separation === 'unresolved')).toBe(true)
  })

  it('refuses an order that is not the group it claims to settle', async () => {
    const context = await deadlocked()
    const preview = await context.groupPhase.preview(context.tournamentId)
    const group = preview.awaitingArbitration[0] ?? []

    await expect(
      context.groupPhase.close(context.tournament, {}, [group.slice(0, 2)]),
    ).rejects.toBeInstanceOf(ArbitrationMismatchError)
    expect(await context.db.frozenEditions.count()).toBe(0)
  })

  it('changes nothing for an edition the cascade separated on its own', async () => {
    const context = await started()
    await enterEverything(context)

    const preview = await context.groupPhase.preview(context.tournamentId)
    expect(preview.awaitingArbitration).toEqual([])

    const frozen = await context.groupPhase.close(context.tournament, await choicesFor(context))

    expect(frozen.arbitration).toEqual([])
    expect(frozen.standings.map((row) => row.rank)).toEqual([1, 2, 3])
  })
})
