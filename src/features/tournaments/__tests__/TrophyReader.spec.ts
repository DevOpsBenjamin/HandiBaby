import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import { ParticipantRepository } from '../ParticipantRepository'
import { TournamentRepository } from '../TournamentRepository'
import { TournamentSetup } from '../TournamentSetup'
import { TrophyReader } from '../TrophyReader'
import { buildTeams } from '../domain/draw'

const PASSPHRASE = 'babyfoot du mardi'

let open: HandiBabyDatabase | null = null

/** A pool of six players, shared by every edition in the test database. */
async function pool(db: HandiBabyDatabase): Promise<number[]> {
  const players = new PlayerRepository(db)
  const ids: number[] = []

  for (let index = 0; index < 6; index += 1) {
    const player = await players.create(`Prenom${index}`, `Nom${index}`)
    ids.push(player.id ?? 0)
  }

  return ids
}

/**
 * An edition of the given pairs, every match played and won by the blue side by
 * `loserScore`, so the figures are arithmetic rather than luck.
 */
async function played(
  db: HandiBabyDatabase,
  label: string,
  ids: readonly number[],
  pairs: readonly (readonly [number, number])[],
  loserScore: number,
): Promise<number> {
  const tournament = await new TournamentRepository(db).createDraft({
    label,
    startDate: '2026-08-13',
    passphrase: PASSPHRASE,
  })
  const tournamentId = tournament.id ?? 0
  const participants = new ParticipantRepository(db)

  for (const id of ids) {
    await participants.add(tournamentId, id)
  }

  await new TournamentSetup(db).start(tournamentId, buildTeams(pairs))

  for (const match of await db.matches.where('tournamentId').equals(tournamentId).toArray()) {
    await db.matches.update(match.id ?? 0, {
      winnerTeamId: match.blueTeamId,
      loserScore,
      enteredAt: Date.now(),
    })
  }

  return tournamentId
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('TrophyReader', () => {
  it('names a best defender and a best attacker for the edition', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const ids = await pool(open)
    const tournamentId = await played(
      open,
      'Édition A',
      ids,
      [
        [ids[0] ?? 0, ids[1] ?? 0],
        [ids[2] ?? 0, ids[3] ?? 0],
        [ids[4] ?? 0, ids[5] ?? 0],
      ],
      3,
    )

    const board = await new TrophyReader(open).forEdition(tournamentId)

    expect(board.defender).not.toBeNull()
    expect(board.attacker).not.toBeNull()
    expect(board.defender?.name).not.toBe('—')
    expect(board.players).toHaveLength(6)
  })

  it('counts a player across editions where their partner changed', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const db = open
    const ids = await pool(db)
    const [first, second, third, fourth, fifth, sixth] = ids

    await played(
      db,
      'Édition A',
      ids,
      [
        [first ?? 0, second ?? 0],
        [third ?? 0, fourth ?? 0],
        [fifth ?? 0, sixth ?? 0],
      ],
      3,
    )

    // Same six people, different pairings: this is what makes a player, rather
    // than a pair, measurable at all.
    const editionB = await played(
      db,
      'Édition B',
      ids,
      [
        [first ?? 0, third ?? 0],
        [second ?? 0, fourth ?? 0],
        [fifth ?? 0, sixth ?? 0],
      ],
      3,
    )

    const reader = new TrophyReader(db)
    const single = await reader.forEdition(editionB)
    const both = await reader.cumulative()

    const inOne = single.players.find((player) => player.playerId === first)
    const inBoth = both.players.find((player) => player.playerId === first)

    expect(inOne?.matchesDefended).toBe(4)
    expect(inBoth?.matchesDefended).toBe(8)
    expect(inBoth?.matchesAttacked).toBe(8)
  })

  it('keeps the two scales apart rather than showing one twice', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const db = open
    const ids = await pool(db)
    const pairs = [
      [ids[0] ?? 0, ids[1] ?? 0],
      [ids[2] ?? 0, ids[3] ?? 0],
      [ids[4] ?? 0, ids[5] ?? 0],
    ] as const

    // Wide margins in the first edition, narrow in the second.
    const editionA = await played(db, 'Édition A', ids, pairs, 0)
    await played(db, 'Édition B', ids, pairs, 8)

    const reader = new TrophyReader(db)
    const single = await reader.forEdition(editionA)
    const both = await reader.cumulative()

    const conceded = (board: Awaited<ReturnType<TrophyReader['cumulative']>>, playerId: number) =>
      board.players.find((player) => player.playerId === playerId)?.concededPerMatch

    expect(conceded(single, ids[0] ?? 0)).not.toBe(conceded(both, ids[0] ?? 0))
  })

  it('keeps counting an edition that was abandoned rather than played out', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const db = open
    const ids = await pool(db)
    const pairs = [
      [ids[0] ?? 0, ids[1] ?? 0],
      [ids[2] ?? 0, ids[3] ?? 0],
      [ids[4] ?? 0, ids[5] ?? 0],
    ] as const

    const abandonedId = await played(db, 'Édition abandonnée', ids, pairs, 3)
    const before = await new TrophyReader(db).cumulative()

    await new TournamentRepository(db).abandon(abandonedId)

    const after = await new TrophyReader(db).cumulative()

    // Abandoning gives up on an edition, it does not unplay its matches.
    expect(after.players).toEqual(before.players)
    expect(after.defender?.playerId).toBe(before.defender?.playerId)
  })

  it('reports nothing before anything has been played', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)

    const board = await new TrophyReader(open).cumulative()

    expect(board.players).toEqual([])
    expect(board.defender).toBeNull()
    expect(board.attacker).toBeNull()
  })
})
