import type { OutboxEntry } from '@/core/db/types'
import type { Json } from '@/core/supabase/database'
import type { SyncAdapter, SyncContext } from '@/core/sync/types'
import type { FrozenEdition } from '../domain/freeze'
import { generateRoundRobin } from '../domain/schedule'
import type { ScheduleTeam, TableSide, TournamentStatus } from '../domain/types'

export const TOURNAMENT_ADAPTER = 'tournaments'

export class TournamentSyncAdapter implements SyncAdapter {
  readonly name = TOURNAMENT_ADAPTER

  async push(_entry: OutboxEntry, _context: SyncContext): Promise<void> {
    // Operations handled during full sync cycle
  }

  async pull(context: SyncContext): Promise<string | null> {
    await this.#uploadLocalTournaments(context)
    await this.#downloadRemoteTournaments(context)
    return String(Date.now())
  }

  async #uploadLocalTournaments(context: SyncContext): Promise<void> {
    const localTournaments = await context.db.tournaments.toArray()
    if (localTournaments.length === 0) {
      return
    }

    const allPlayers = await context.db.players.toArray()
    const playerMap = new Map<number, (typeof allPlayers)[0]>()
    for (const p of allPlayers) {
      if (p.id !== undefined) playerMap.set(p.id, p)
    }

    for (const tournament of localTournaments) {
      if (tournament.id === undefined) continue

      const tPlayers = await context.db.tournamentPlayers
        .where('tournamentId')
        .equals(tournament.id)
        .toArray()

      const tTeams = await context.db.teams
        .where('tournamentId')
        .equals(tournament.id)
        .toArray()

      const tMatches = await context.db.matches
        .where('tournamentId')
        .equals(tournament.id)
        .toArray()

      const tFrozen = await context.db.frozenEditions.get(tournament.id)

      const playersPayload = allPlayers.map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        name_key: p.nameKey,
      }))

      const tournamentPlayersPayload = tPlayers.map((tp) => {
        const player = playerMap.get(tp.playerId)
        return {
          player_name_key: player?.nameKey ?? '',
        }
      })

      const teamsPayload = tTeams.map((team, index) => {
        const p1 = playerMap.get(team.playerOneId)
        const p2 = playerMap.get(team.playerTwoId)
        return {
          label: team.label,
          player_one_name_key: p1?.nameKey ?? '',
          player_two_name_key: p2?.nameKey ?? '',
          team_index: index + 1,
        }
      })

      const matchesPayload = tMatches.map((m) => {
        let winningSide: string | null = null
        if (m.winnerTeamId !== null) {
          winningSide = m.winnerTeamId === m.blueTeamId ? 'blue' : 'white'
        }
        return {
          phase: m.phase,
          duel: m.duel,
          rank_in_duel: m.rankInDuel,
          winning_side: winningSide,
          loser_score: m.loserScore,
          entered_at: m.enteredAt,
        }
      })

      const frozenPayload = tFrozen
        ? {
            data: tFrozen,
            frozen_at: Date.now(),
          }
        : null

      await context.client.rpc('sync_tournament_bundle', {
        p_tournament: {
          public_id: tournament.publicId,
          label: tournament.label,
          start_date: tournament.startDate,
          status: tournament.status,
          passphrase_hash: tournament.passphraseHash,
          created_at: tournament.createdAt,
        } as unknown as Json,
        p_players: playersPayload as unknown as Json,
        p_tournament_players: tournamentPlayersPayload as unknown as Json,
        p_teams: teamsPayload as unknown as Json,
        p_matches: matchesPayload as unknown as Json,
        p_frozen_edition: (frozenPayload ?? undefined) as unknown as Json,
      })
    }
  }

  async #downloadRemoteTournaments(context: SyncContext): Promise<void> {
    const { data: remoteTournaments } = await context.client
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })

    if (!remoteTournaments || remoteTournaments.length === 0) {
      return
    }

    const { data: remotePlayers } = await context.client.from('players').select('*')
    if (remotePlayers) {
      for (const rp of remotePlayers) {
        const exists = await context.db.players.where('nameKey').equals(rp.name_key).first()
        if (!exists) {
          await context.db.players.add({
            firstName: rp.first_name,
            lastName: rp.last_name,
            nameKey: rp.name_key,
          })
        }
      }
    }

    const localPlayers = await context.db.players.toArray()
    const playerKeyToId = new Map<string, number>()
    for (const p of localPlayers) {
      if (p.id !== undefined) playerKeyToId.set(p.nameKey, p.id)
    }

    const { data: remoteTeams } = await context.client.from('teams').select('*')
    const { data: remoteTP } = await context.client.from('tournament_players').select('*')
    const { data: remoteMatches } = await context.client.from('matches').select('*')
    const { data: remoteFrozen } = await context.client.from('frozen_editions').select('*')

    for (const rt of remoteTournaments) {
      const localTournament = await context.db.tournaments
        .where('publicId')
        .equals(rt.public_id)
        .first()

      let tournamentId = localTournament?.id

      if (localTournament === undefined) {
        tournamentId = await context.db.tournaments.add({
          publicId: rt.public_id,
          label: rt.label,
          startDate: rt.start_date,
          status: rt.status as TournamentStatus,
          passphraseHash: rt.passphrase_hash,
          createdAt: rt.created_at,
        })
      } else if (tournamentId !== undefined && localTournament.status !== rt.status) {
        await context.db.tournaments.update(tournamentId, {
          status: rt.status as TournamentStatus,
          label: rt.label,
        })
      }

      if (tournamentId === undefined) continue

      // Sync tournament players
      if (remoteTP) {
        const tps = remoteTP.filter((tp) => tp.tournament_public_id === rt.public_id)
        for (const tp of tps) {
          const playerId = playerKeyToId.get(tp.player_name_key)
          if (playerId !== undefined) {
            const exists = await context.db.tournamentPlayers
              .where({ tournamentId, playerId })
              .first()
            if (!exists) {
              await context.db.tournamentPlayers.add({ tournamentId, playerId })
            }
          }
        }
      }

      // Sync teams
      if (remoteTeams) {
        const rTeams = remoteTeams
          .filter((team) => team.tournament_public_id === rt.public_id)
          .sort((a, b) => a.team_index - b.team_index)

        const existingTeams = await context.db.teams
          .where('tournamentId')
          .equals(tournamentId)
          .toArray()

        if (existingTeams.length === 0 && rTeams.length > 0) {
          const teamsToInsert = rTeams.map((team) => ({
            tournamentId: tournamentId as number,
            label: team.label,
            playerOneId: playerKeyToId.get(team.player_one_name_key) ?? 0,
            playerTwoId: playerKeyToId.get(team.player_two_name_key) ?? 0,
          }))

          const teamIds = await context.db.teams.bulkAdd(teamsToInsert, { allKeys: true })

          // Generate round robin matches if round-robin or later
          const existingMatches = await context.db.matches
            .where('tournamentId')
            .equals(tournamentId)
            .count()

          if (existingMatches === 0 && teamsToInsert.length >= 3) {
            const scheduleTeams: ScheduleTeam[] = teamsToInsert.map((t, index) => ({
              id: teamIds[index] as number,
              players: [t.playerOneId, t.playerTwoId],
            }))

            const generatedMatches = generateRoundRobin(scheduleTeams).map((m) => ({
              ...m,
              tournamentId: tournamentId as number,
            }))

            await context.db.matches.bulkAdd(generatedMatches)
          }
        }
      }

      // Update match results
      if (remoteMatches) {
        const rMatches = remoteMatches.filter((m) => m.tournament_public_id === rt.public_id)
        for (const rm of rMatches) {
          if (rm.winning_side !== null && rm.loser_score !== null) {
            const match = await context.db.matches
              .where('tournamentId')
              .equals(tournamentId)
              .filter((m) => {
                if (m.phase !== rm.phase) return false
                if (rm.duel !== null && m.duel !== rm.duel) return false
                if (rm.rank_in_duel !== null && m.rankInDuel !== rm.rank_in_duel) return false
                return true
              })
              .first()

            if (match !== undefined && match.id !== undefined) {
              const winningSide = rm.winning_side as TableSide
              const winnerTeamId = winningSide === 'blue' ? match.blueTeamId : match.whiteTeamId
              await context.db.matches.update(match.id, {
                winnerTeamId,
                loserScore: rm.loser_score,
                enteredAt: rm.entered_at,
              })
            }
          }
        }
      }

      // Sync frozen edition
      if (remoteFrozen) {
        const rf = remoteFrozen.find((f) => f.tournament_public_id === rt.public_id)
        if (rf) {
          const exists = await context.db.frozenEditions.get(tournamentId)
          if (!exists) {
            const frozenData = rf.data as unknown as FrozenEdition
            await context.db.frozenEditions.put({
              ...frozenData,
              tournamentId,
            })
          }
        }
      }
    }
  }
}
