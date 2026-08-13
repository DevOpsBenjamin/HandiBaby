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
import { ScoreKeeper } from '../ScoreKeeper'
import { StandingsReader } from '../StandingsReader'
import { TeamRepository, UnknownTeamError } from '../TeamRepository'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { buildTeams } from '../domain/draw'
import { DuplicateTeamNameError, TeamNameTooLongError } from '../domain/teamNames'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

async function started(names: readonly string[] = []) {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const db = open

  const tournament = await new TournamentRepository(db).createDraft(EDITION)
  const players = new PlayerRepository(db)
  const participants = new ParticipantRepository(db)
  const tournamentId = tournament.id ?? 0

  const ids: number[] = []
  for (let index = 0; index < 6; index += 1) {
    const player = await players.create(`Prenom${index}`, `Nom${index}`)
    const id = player.id ?? 0
    ids.push(id)
    await participants.add(tournamentId, id)
  }

  const pairs: (readonly [number, number])[] = []
  for (let index = 0; index < ids.length; index += 2) {
    pairs.push([ids[index] ?? 0, ids[index + 1] ?? 0])
  }

  const compositions = buildTeams(pairs).map((composition, index) => ({
    ...composition,
    label: names[index] ?? '',
  }))

  await new TournamentSetup(db).start(tournamentId, compositions)

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
    teams: new TeamRepository(db),
    keeper: new ScoreKeeper(db, engine),
    groupPhase: new GroupPhase(db),
    standings: new StandingsReader(db),
  }
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('team names', () => {
  it('stores the names typed on the composition screen', async () => {
    const context = await started(['Les Bras Cassés', 'Tiki Taka', ''])

    expect((await context.teams.list(context.tournamentId)).map((team) => team.label)).toEqual([
      'Les Bras Cassés',
      'Tiki Taka',
      'Équipe 3',
    ])
  })

  it('numbers every team when nobody typed anything, as it always did', async () => {
    const context = await started()

    expect((await context.teams.list(context.tournamentId)).map((team) => team.label)).toEqual([
      'Équipe 1',
      'Équipe 2',
      'Équipe 3',
    ])
  })

  it('refuses to start an edition with two teams under one name', async () => {
    await expect(started(['Tiki Taka', 'Tiki Taka', ''])).rejects.toBeInstanceOf(
      DuplicateTeamNameError,
    )
  })

  it('renames a team once the calendar exists', async () => {
    const context = await started()
    const [first] = await context.teams.list(context.tournamentId)

    await context.teams.rename(context.tournamentId, first?.id ?? 0, '  Les Bras Cassés ')

    const renamed = await context.teams.list(context.tournamentId)
    expect(renamed[0]?.label).toBe('Les Bras Cassés')
    expect(renamed.map((team) => team.label)).toContain('Équipe 2')
  })

  it('refuses a rename onto a name another team already carries', async () => {
    const context = await started(['Les Bras Cassés', 'Tiki Taka', ''])
    const [first] = await context.teams.list(context.tournamentId)

    await expect(
      context.teams.rename(context.tournamentId, first?.id ?? 0, 'Tiki Taka'),
    ).rejects.toBeInstanceOf(DuplicateTeamNameError)

    expect((await context.teams.list(context.tournamentId))[0]?.label).toBe('Les Bras Cassés')
  })

  it('refuses a name too long to read', async () => {
    const context = await started()
    const [first] = await context.teams.list(context.tournamentId)

    await expect(
      context.teams.rename(context.tournamentId, first?.id ?? 0, 'x'.repeat(31)),
    ).rejects.toBeInstanceOf(TeamNameTooLongError)
  })

  it('gives a team back its number when the name is cleared', async () => {
    const context = await started(['Les Bras Cassés', '', ''])
    const [first] = await context.teams.list(context.tournamentId)

    await context.teams.rename(context.tournamentId, first?.id ?? 0, '')

    expect((await context.teams.list(context.tournamentId))[0]?.label).toBe('Équipe 1')
  })

  it('refuses a team that belongs to no edition of this database', async () => {
    const context = await started()

    await expect(
      context.teams.rename(context.tournamentId, 9999, 'Les Bras Cassés'),
    ).rejects.toBeInstanceOf(UnknownTeamError)
  })

  it('prints the name in the standings', async () => {
    const context = await started(['Les Bras Cassés', 'Tiki Taka', 'Les Tontons'])

    const view = await context.standings.read(context.tournamentId)

    expect(view.rows.map((row) => row.teamLabel).sort()).toEqual([
      'Les Bras Cassés',
      'Les Tontons',
      'Tiki Taka',
    ])
  })

  it('moves no standing, no configuration and no bracket when renamed after the freeze', async () => {
    const context = await started(['Les Bras Cassés', 'Tiki Taka', 'Les Tontons'])

    // Play it out: the lower team id always wins, margins vary by rank in duel.
    const scores = [0, 1, 5, 2]
    for (const match of await context.db.matches
      .where('tournamentId')
      .equals(context.tournamentId)
      .toArray()) {
      const stronger = Math.min(match.blueTeamId, match.whiteTeamId)
      await context.keeper.record(context.tournament, match.id ?? 0, {
        winningSide: match.blueTeamId === stronger ? 'blue' : 'white',
        loserScore: scores[(match.rankInDuel ?? 1) - 1] ?? 3,
      })
    }

    const preview = await context.groupPhase.preview(context.tournamentId)
    const choices: Record<number, number> = {}
    for (const teamId of preview.awaitingChoice) {
      choices[teamId] =
        preview.configurations.find((row) => row.teamId === teamId)?.configurations[0]
          ?.defenderId ?? 0
    }

    const frozen = await context.groupPhase.close(context.tournament, choices)
    const [first] = await context.teams.list(context.tournamentId)

    await context.teams.rename(context.tournamentId, first?.id ?? 0, 'Renommée en cours de route')

    // The freeze keys on team ids, so nothing it holds can move.
    expect(await context.groupPhase.readFrozen(context.tournamentId)).toEqual(frozen)

    const view = await context.standings.read(context.tournamentId)
    expect(view.rows.map((row) => row.teamId)).toEqual(frozen.standings.map((row) => row.teamId))
    expect(view.rows.find((row) => row.teamId === (first?.id ?? 0))?.teamLabel).toBe(
      'Renommée en cours de route',
    )
  })
})
