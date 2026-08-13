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
import {
  InvalidLoserScoreError,
  MatchAlreadyEnteredError,
  RECORD_SCORE_OPERATION,
  SCORE_ADAPTER,
  ScoreEntry,
  UnknownMatchError,
  type RecordScorePayload,
} from '../ScoreEntry'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { buildTeams } from '../domain/draw'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

/**
 * A started edition of six players, with the sync engine the app actually runs
 * today: no Supabase provisioned, so nothing ever drains.
 */
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

  const reader = new ScheduleReader(db)
  const detail = await reader.readDuel(tournamentId, 1)

  return {
    db,
    engine,
    reader,
    tournament,
    tournamentId,
    entry: new ScoreEntry(db, engine),
    matches: detail?.matches ?? [],
  }
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('ScoreEntry', () => {
  it('records the winning side and the loser score on a match that had none', async () => {
    const { entry, reader, tournament, tournamentId, matches } = await started()
    const [first] = matches

    await entry.record(tournament, first?.id ?? 0, { winningSide: 'white', loserScore: 7 })

    const played = (await reader.readDuel(tournamentId, 1))?.matches.find(
      (match) => match.id === first?.id,
    )

    expect(played?.played).toBe(true)
    expect(played?.winnerTeamId).toBe(first?.white.teamId)
    expect(played?.loserScore).toBe(7)
  })

  it.each([-1, 10, 42, 3.5])('refuses a loser score of %s and writes nothing', async (score) => {
    const { db, entry, tournament, matches } = await started()
    const [first] = matches

    await expect(
      entry.record(tournament, first?.id ?? 0, { winningSide: 'blue', loserScore: score }),
    ).rejects.toBeInstanceOf(InvalidLoserScoreError)

    expect((await db.matches.get(first?.id ?? 0))?.winnerTeamId).toBeNull()
    expect(await db.outbox.count()).toBe(0)
  })

  it('refuses a match that already has a result and shows what is stored', async () => {
    const { db, entry, tournament, matches } = await started()
    const [first] = matches
    const matchId = first?.id ?? 0

    await entry.record(tournament, matchId, { winningSide: 'blue', loserScore: 2 })

    const refusal = entry.record(tournament, matchId, { winningSide: 'white', loserScore: 9 })

    await expect(refusal).rejects.toBeInstanceOf(MatchAlreadyEnteredError)
    await expect(refusal).rejects.toMatchObject({
      existing: { winningSide: 'blue', loserScore: 2 },
    })

    const stored = await db.matches.get(matchId)
    expect(stored?.winnerTeamId).toBe(first?.blue.teamId)
    expect(stored?.loserScore).toBe(2)
  })

  it('refuses a match that belongs to another edition', async () => {
    const { db, entry, tournament, matches } = await started()
    const stranger = { ...tournament, id: (tournament.id ?? 0) + 1_000, publicId: 'autre-edition' }

    await expect(
      entry.record(stranger, matches[0]?.id ?? 0, { winningSide: 'blue', loserScore: 1 }),
    ).rejects.toBeInstanceOf(UnknownMatchError)

    expect(await db.outbox.count()).toBe(0)
  })

  it('queues each entry with no server, and says how many are waiting', async () => {
    const { db, engine, entry, tournament, matches } = await started()

    await entry.record(tournament, matches[0]?.id ?? 0, { winningSide: 'blue', loserScore: 4 })
    await entry.record(tournament, matches[1]?.id ?? 0, { winningSide: 'white', loserScore: 0 })

    expect(engine.snapshot.phase).toBe('disabled')
    expect(engine.snapshot.pendingOperations).toBe(2)
    expect(await db.outbox.count()).toBe(2)
  })

  it('queues an entry a server can replay without knowing this device row ids', async () => {
    const { db, entry, tournament, matches } = await started()
    const [first] = matches

    await entry.record(tournament, first?.id ?? 0, { winningSide: 'white', loserScore: 6 })

    const [queued] = await db.outbox.toArray()
    const payload = queued?.payload as RecordScorePayload

    expect(queued?.adapter).toBe(SCORE_ADAPTER)
    expect(queued?.operation).toBe(RECORD_SCORE_OPERATION)
    expect(payload).toMatchObject({
      tournamentPublicId: tournament.publicId,
      phase: 'round-robin',
      duel: 1,
      rankInDuel: first?.rankInDuel,
      winningSide: 'white',
      loserScore: 6,
    })
  })

  it('lets the rest of the duel be entered after one match is refused', async () => {
    const { entry, reader, tournament, tournamentId, matches } = await started()
    const [first, second] = matches

    await entry.record(tournament, first?.id ?? 0, { winningSide: 'blue', loserScore: 3 })
    await expect(
      entry.record(tournament, first?.id ?? 0, { winningSide: 'blue', loserScore: 3 }),
    ).rejects.toBeInstanceOf(MatchAlreadyEnteredError)

    await entry.record(tournament, second?.id ?? 0, { winningSide: 'blue', loserScore: 5 })

    const detail = await reader.readDuel(tournamentId, 1)
    expect(detail?.matches.filter((match) => match.played)).toHaveLength(2)
  })
})
