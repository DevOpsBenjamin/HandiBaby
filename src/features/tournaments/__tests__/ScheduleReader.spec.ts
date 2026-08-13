import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import { ParticipantRepository } from '../ParticipantRepository'
import { ScheduleReader } from '../ScheduleReader'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { buildTeams } from '../domain/draw'

const EDITION = {
  label: 'HandiTournoi',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

/** A started edition of `count` players, calendar generated. */
async function started(count: number) {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const db = open

  const tournament = await new TournamentRepository(db).createDraft(EDITION)
  const players = new PlayerRepository(db)
  const participants = new ParticipantRepository(db)
  const tournamentId = tournament.id ?? 0

  const ids: number[] = []
  for (let index = 0; index < count; index += 1) {
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

  return { db, reader: new ScheduleReader(db), tournamentId }
}

/** Marks every match of a duel as won by whoever was on blue. */
async function playDuel(db: HandiBabyDatabase, tournamentId: number, duel: number): Promise<void> {
  const matches = await db.matches.where('tournamentId').equals(tournamentId).toArray()

  for (const match of matches.filter((candidate) => candidate.duel === duel)) {
    await db.matches.update(match.id ?? 0, { winnerTeamId: match.blueTeamId, loserScore: 3 })
  }
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('ScheduleReader', () => {
  it.each([
    { players: 6, duels: 3, matches: 12 },
    { players: 8, duels: 6, matches: 24 },
  ])('lists $duels duels for $players players', async (expected) => {
    const { reader, tournamentId } = await started(expected.players)

    const duels = await reader.listDuels(tournamentId)

    expect(duels).toHaveLength(expected.duels)
    expect(duels.map((duel) => duel.duel)).toEqual(
      Array.from({ length: expected.duels }, (_, index) => index + 1),
    )
    expect(duels.every((duel) => duel.totalMatches === 4)).toBe(true)
    expect(duels.reduce((total, duel) => total + duel.totalMatches, 0)).toBe(expected.matches)
  })

  it('names the two teams of a duel by their players', async () => {
    const { reader, tournamentId } = await started(6)

    const [first] = await reader.listDuels(tournamentId)

    expect(first?.teams).toHaveLength(2)
    expect(first?.teams.every((team) => team.players.length === 2)).toBe(true)
    expect(first?.teams.flatMap((team) => team.players.map((player) => player.firstName))).toEqual([
      'Prenom0',
      'Prenom1',
      'Prenom2',
      'Prenom3',
    ])
  })

  it('counts a duel as played only once its four matches are in', async () => {
    const { db, reader, tournamentId } = await started(6)

    expect((await reader.progress(tournamentId)).playedDuels).toBe(0)

    const matches = await db.matches.where('tournamentId').equals(tournamentId).toArray()
    const partial = matches.filter((match) => match.duel === 1).slice(0, 3)
    for (const match of partial) {
      await db.matches.update(match.id ?? 0, { winnerTeamId: match.blueTeamId, loserScore: 5 })
    }

    const midway = await reader.progress(tournamentId)
    expect(midway.playedDuels).toBe(0)
    expect(midway.playedMatches).toBe(3)

    await playDuel(db, tournamentId, 1)

    const after = await reader.progress(tournamentId)
    expect(after.playedDuels).toBe(1)
    expect(after.totalDuels).toBe(3)
  })

  it('reads a duel with its four matches in order, positions and sides resolved', async () => {
    const { reader, tournamentId } = await started(6)

    const detail = await reader.readDuel(tournamentId, 1)

    expect(detail?.matches.map((match) => match.rankInDuel)).toEqual([1, 2, 3, 4])

    for (const match of detail?.matches ?? []) {
      expect(match.blue.defender).not.toBeNull()
      expect(match.blue.attacker).not.toBeNull()
      expect(match.white.defender).not.toBeNull()
      expect(match.white.attacker).not.toBeNull()
      expect(match.blue.teamId).not.toBe(match.white.teamId)
      expect(match.played).toBe(false)
    }
  })

  it('reports a played match with its result', async () => {
    const { db, reader, tournamentId } = await started(6)
    await playDuel(db, tournamentId, 1)

    const detail = await reader.readDuel(tournamentId, 1)

    expect(detail?.matches.every((match) => match.played)).toBe(true)
    expect(detail?.matches.every((match) => match.loserScore === 3)).toBe(true)
  })

  it('returns nothing for a duel that does not exist', async () => {
    const { reader, tournamentId } = await started(6)

    expect(await reader.readDuel(tournamentId, 99)).toBeNull()
  })

  it('reads an edition that has not started as empty rather than failing', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const tournament = await new TournamentRepository(open).createDraft(EDITION)
    const reader = new ScheduleReader(open)

    expect(await reader.listDuels(tournament.id ?? 0)).toHaveLength(0)
    expect((await reader.progress(tournament.id ?? 0)).totalDuels).toBe(0)
  })
})
