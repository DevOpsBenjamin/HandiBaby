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

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('ScheduleReader', () => {
  it.each([
    { players: 6, matches: 12 },
    { players: 8, matches: 24 },
  ])('lists $matches round-robin matches for $players players', async (expected) => {
    const { reader, tournamentId } = await started(expected.players)

    const matches = await reader.listMatches(tournamentId)

    expect(matches).toHaveLength(expected.matches)
    expect(matches.every((match) => match.blue.teamId !== match.white.teamId)).toBe(true)
  })

  it('reads the calendar in one stored order, identical on every device', async () => {
    const { db, reader, tournamentId } = await started(6)

    const first = await reader.listMatches(tournamentId)
    // A second reader over the same rows, insertion order deliberately ignored.
    const second = await new ScheduleReader(db).listMatches(tournamentId)

    expect(second.map((match) => match.id)).toEqual(first.map((match) => match.id))
    expect(first.map((match) => match.order)).toEqual(
      Array.from({ length: first.length }, (_, index) => index),
    )
  })

  it('never puts two matches of the same duel back to back', async () => {
    for (const players of [6, 8]) {
      const { reader, tournamentId } = await started(players)
      const matches = await reader.listMatches(tournamentId)

      for (let index = 1; index < matches.length; index += 1) {
        expect(matches[index]?.duel).not.toBe(matches[index - 1]?.duel)
      }

      await open?.delete()
      open = null
    }
  })

  it('keeps the duel on every row, because the tie-break still reads it', async () => {
    const { reader, tournamentId } = await started(6)

    const matches = await reader.listMatches(tournamentId)
    const byDuel = new Map<number, number>()

    for (const match of matches) {
      byDuel.set(match.duel, (byDuel.get(match.duel) ?? 0) + 1)
    }

    expect(byDuel.size).toBe(3)
    expect([...byDuel.values()].every((count) => count === 4)).toBe(true)
  })

  it('resolves both sides with their positions and their table end', async () => {
    const { reader, tournamentId } = await started(6)

    for (const match of await reader.listMatches(tournamentId)) {
      expect(match.blue.defender).not.toBeNull()
      expect(match.blue.attacker).not.toBeNull()
      expect(match.white.defender).not.toBeNull()
      expect(match.white.attacker).not.toBeNull()
      expect(match.blue.teamLabel).not.toBe('')
      expect(match.played).toBe(false)
    }
  })

  it('counts progress in matches, not in duels', async () => {
    const { db, reader, tournamentId } = await started(6)

    expect(await reader.progress(tournamentId)).toEqual({ playedMatches: 0, totalMatches: 12 })

    const [first, second] = await db.matches.where('tournamentId').equals(tournamentId).toArray()
    for (const match of [first, second]) {
      await db.matches.update(match?.id ?? 0, { winnerTeamId: match?.blueTeamId, loserScore: 3 })
    }

    expect(await reader.progress(tournamentId)).toEqual({ playedMatches: 2, totalMatches: 12 })
  })

  it('reports a played match with its result', async () => {
    const { db, reader, tournamentId } = await started(6)
    const [first] = await db.matches.where('tournamentId').equals(tournamentId).toArray()

    await db.matches.update(first?.id ?? 0, { winnerTeamId: first?.blueTeamId, loserScore: 3 })

    const played = (await reader.listMatches(tournamentId)).find((match) => match.id === first?.id)

    expect(played?.played).toBe(true)
    expect(played?.loserScore).toBe(3)
    expect(played?.winnerTeamId).toBe(first?.blueTeamId)
  })

  it('reads an edition that has not started as empty rather than failing', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const tournament = await new TournamentRepository(open).createDraft(EDITION)
    const reader = new ScheduleReader(open)

    expect(await reader.listMatches(tournament.id ?? 0)).toHaveLength(0)
    expect((await reader.progress(tournament.id ?? 0)).totalMatches).toBe(0)
  })
})
