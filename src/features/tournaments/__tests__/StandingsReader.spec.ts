import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { ConnectivityMonitor } from '@/core/network/connectivity'
import { SupabaseGateway } from '@/core/supabase/gateway'
import { SyncEngine } from '@/core/sync/engine'
import { SyncRegistry } from '@/core/sync/registry'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import { ParticipantRepository } from '../ParticipantRepository'
import { ScheduleReader } from '../ScheduleReader'
import { ScoreKeeper } from '../ScoreKeeper'
import { StandingsReader } from '../StandingsReader'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { buildTeams } from '../domain/draw'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

/** A started edition of six players, with the offline engine the app runs today. */
async function started() {
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
    keeper: new ScoreKeeper(db, engine),
    schedule: new ScheduleReader(db),
    standings: new StandingsReader(db),
  }
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('StandingsReader', () => {
  it('starts every team level, with nothing played', async () => {
    const { standings, tournamentId } = await started()

    const view = await standings.read(tournamentId)

    expect(view.rows).toHaveLength(3)
    expect(view.rows.every((row) => row.played === 0 && row.points === 0)).toBe(true)
    expect(view.configurations.every((row) => row.options.length === 0)).toBe(true)
  })

  it('reflects a score the moment it is entered, with no network', async () => {
    const { keeper, schedule, standings, tournament, tournamentId } = await started()
    const detail = await schedule.readDuel(tournamentId, 1)
    const [first] = detail?.matches ?? []

    await keeper.record(tournament, first?.id ?? 0, { winningSide: 'blue', loserScore: 4 })

    const view = await standings.read(tournamentId)
    const winner = view.rows.find((row) => row.teamId === first?.blue.teamId)
    const loser = view.rows.find((row) => row.teamId === first?.white.teamId)

    expect(winner).toMatchObject({ played: 1, wins: 1, points: 3, goalDifference: 6 })
    expect(loser).toMatchObject({ played: 1, losses: 1, points: 0, goalDifference: -6 })
    expect(view.rows[0]?.teamId).toBe(first?.blue.teamId)
  })

  it('follows a correction rather than keeping the first result', async () => {
    const { keeper, schedule, standings, tournament, tournamentId } = await started()
    const detail = await schedule.readDuel(tournamentId, 1)
    const [first] = detail?.matches ?? []
    const matchId = first?.id ?? 0

    await keeper.record(tournament, matchId, { winningSide: 'blue', loserScore: 4 })
    await keeper.correct(tournament, matchId, { winningSide: 'white', loserScore: 0 })

    const view = await standings.read(tournamentId)
    const blue = view.rows.find((row) => row.teamId === first?.blue.teamId)
    const white = view.rows.find((row) => row.teamId === first?.white.teamId)

    expect(blue).toMatchObject({ wins: 0, points: 0, goalDifference: -10 })
    expect(white).toMatchObject({ wins: 1, points: 3, goalDifference: 10 })
  })

  it('names the teams and their players so the table can be read by humans', async () => {
    const { standings, tournamentId } = await started()

    const view = await standings.read(tournamentId)

    expect(view.rows.every((row) => row.teamLabel !== '')).toBe(true)
    expect(view.rows.every((row) => row.players.includes(' et '))).toBe(true)
  })

  it('names the configurations by player once a duel has been played', async () => {
    const { keeper, schedule, standings, tournament, tournamentId } = await started()
    const detail = await schedule.readDuel(tournamentId, 1)

    for (const match of detail?.matches ?? []) {
      await keeper.record(tournament, match.id, { winningSide: 'blue', loserScore: 2 })
    }

    const view = await standings.read(tournamentId)
    const played = view.configurations.filter((row) => row.options.length > 0)

    // The duel pattern gives each team both of its configurations, twice each.
    expect(played).toHaveLength(2)
    expect(played.every((row) => row.options.length === 2)).toBe(true)
    expect(played.every((row) => row.options.every((option) => option.played === 2))).toBe(true)
    expect(played.every((row) => row.options.every((option) => option.defender !== '—'))).toBe(true)
  })
})
