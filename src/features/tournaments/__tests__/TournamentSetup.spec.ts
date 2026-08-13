import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import { ParticipantRepository } from '../ParticipantRepository'
import { TournamentRepository } from '../TournamentRepository'
import {
  CompositionMismatchError,
  NotADraftError,
  ScheduleAlreadyGeneratedError,
  TournamentSetup,
  UnknownTournamentError,
} from '../TournamentSetup'
import { buildTeams, drawTeams } from '../domain/draw'

const EDITION = {
  label: 'Tournoi de printemps',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

/** An edition in draft with `count` participants, ready to be composed. */
async function seed(count: number) {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const db = open

  const tournament = await new TournamentRepository(db).createDraft(EDITION)
  const players = new PlayerRepository(db)
  const participants = new ParticipantRepository(db)
  const tournamentId = tournament.id ?? 0

  const playerIds: number[] = []
  for (let index = 0; index < count; index += 1) {
    const player = await players.create(`Joueur${index}`, `Nom${index}`)
    const id = player.id ?? 0
    playerIds.push(id)
    await participants.add(tournamentId, id)
  }

  return { db, setup: new TournamentSetup(db), tournamentId, playerIds }
}

function pairs(playerIds: readonly number[]): (readonly [number, number])[] {
  const result: (readonly [number, number])[] = []
  for (let index = 0; index < playerIds.length; index += 2) {
    result.push([playerIds[index] ?? 0, playerIds[index + 1] ?? 0])
  }
  return result
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('TournamentSetup', () => {
  it.each([
    { players: 6, teams: 3, matches: 12 },
    { players: 8, teams: 4, matches: 24 },
  ])('writes $teams teams and $matches matches for $players players', async (expected) => {
    const { db, setup, tournamentId, playerIds } = await seed(expected.players)

    await setup.start(tournamentId, buildTeams(pairs(playerIds)))

    expect(await db.teams.where('tournamentId').equals(tournamentId).count()).toBe(expected.teams)
    expect(await db.matches.where('tournamentId').equals(tournamentId).count()).toBe(
      expected.matches,
    )
    expect((await db.tournaments.get(tournamentId))?.status).toBe('round-robin')
  })

  it('points the calendar at the teams it just wrote', async () => {
    const { db, setup, tournamentId, playerIds } = await seed(6)

    await setup.start(tournamentId, buildTeams(pairs(playerIds)))

    const teamIds = new Set((await db.teams.toArray()).map((team) => team.id))
    const matches = await db.matches.toArray()

    expect(matches.every((match) => teamIds.has(match.blueTeamId))).toBe(true)
    expect(matches.every((match) => teamIds.has(match.whiteTeamId))).toBe(true)
    expect(matches.every((match) => match.winnerTeamId === null)).toBe(true)
  })

  it('accepts a random draw as readily as a manual composition', async () => {
    const { db, setup, tournamentId, playerIds } = await seed(8)

    await setup.start(tournamentId, drawTeams(playerIds))

    expect(await db.matches.count()).toBe(24)
  })

  it('refuses to generate a second calendar', async () => {
    const { db, setup, tournamentId, playerIds } = await seed(6)
    const composition = buildTeams(pairs(playerIds))

    await setup.start(tournamentId, composition)

    await expect(setup.start(tournamentId, composition)).rejects.toBeInstanceOf(NotADraftError)
    expect(await db.matches.count()).toBe(12)
    expect(await db.teams.count()).toBe(3)
  })

  it('refuses a calendar on an edition that already has matches', async () => {
    const { db, setup, tournamentId, playerIds } = await seed(6)

    // A draft carrying matches should not exist; if it ever did, refuse anyway.
    await db.matches.add({
      tournamentId,
      phase: 'round-robin',
      duel: 1,
      rankInDuel: 1,
      blueTeamId: 1,
      whiteTeamId: 2,
      blueDefenderId: 1,
      blueAttackerId: 2,
      whiteDefenderId: 3,
      whiteAttackerId: 4,
      winnerTeamId: null,
      loserScore: null,
      enteredAt: null,
    })

    await expect(setup.start(tournamentId, buildTeams(pairs(playerIds)))).rejects.toBeInstanceOf(
      ScheduleAlreadyGeneratedError,
    )
  })

  it('writes nothing at all when the composition does not match the roster', async () => {
    const { db, setup, tournamentId, playerIds } = await seed(6)
    const outsider = 9999

    const wrong = buildTeams(pairs([...playerIds.slice(0, 5), outsider]))

    await expect(setup.start(tournamentId, wrong)).rejects.toBeInstanceOf(CompositionMismatchError)
    expect(await db.teams.count()).toBe(0)
    expect(await db.matches.count()).toBe(0)
    expect((await db.tournaments.get(tournamentId))?.status).toBe('draft')
  })

  it('refuses a composition that leaves a participant out', async () => {
    const { setup, tournamentId, playerIds } = await seed(8)

    const shortOfOne = buildTeams(pairs(playerIds.slice(0, 6)))

    await expect(setup.start(tournamentId, shortOfOne)).rejects.toBeInstanceOf(
      CompositionMismatchError,
    )
  })

  it('refuses an edition it cannot find', async () => {
    const { setup, playerIds } = await seed(6)

    await expect(setup.start(4242, buildTeams(pairs(playerIds)))).rejects.toBeInstanceOf(
      UnknownTournamentError,
    )
  })
})
