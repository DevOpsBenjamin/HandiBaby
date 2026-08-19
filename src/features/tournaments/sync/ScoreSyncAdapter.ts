import type { OutboxEntry } from '@/core/db/types'
import type { Json } from '@/core/supabase/database'
import type { SyncAdapter, SyncContext } from '@/core/sync/types'
import {
  SCORE_ADAPTER,
  SCORE_OPERATIONS,
  type ScoreWritePayload,
} from '../ScoreKeeper'
import type { MatchResult } from '../domain/score'
import type { TableSide } from '../domain/types'

export class ScoreSyncAdapter implements SyncAdapter<ScoreWritePayload> {
  readonly name = SCORE_ADAPTER

  async push(entry: OutboxEntry<ScoreWritePayload>, context: SyncContext): Promise<void> {
    const payload = entry.payload

    if (entry.operation === SCORE_OPERATIONS.record) {
      const { error } = await context.client.rpc('record_score', {
        p_journal_entry_id: payload.journalEntryId,
        p_tournament_public_id: payload.tournamentPublicId,
        p_phase: payload.phase,
        p_duel: payload.duel ?? undefined,
        p_rank_in_duel: payload.rankInDuel ?? undefined,
        p_winning_side: payload.winningSide,
        p_loser_score: payload.loserScore,
        p_written_at: payload.writtenAt,
      })

      if (error) {
        throw new Error(`Failed to record score on server: ${error.message}`)
      }
    } else if (entry.operation === SCORE_OPERATIONS.correct) {
      const { error } = await context.client.rpc('correct_score', {
        p_journal_entry_id: payload.journalEntryId,
        p_tournament_public_id: payload.tournamentPublicId,
        p_phase: payload.phase,
        p_duel: payload.duel ?? undefined,
        p_rank_in_duel: payload.rankInDuel ?? undefined,
        p_winning_side: payload.winningSide,
        p_loser_score: payload.loserScore,
        p_previous: (payload.previous ?? null) as unknown as Json,
        p_written_at: payload.writtenAt,
      })

      if (error) {
        throw new Error(`Failed to correct score on server: ${error.message}`)
      }
    }
  }

  async pull(context: SyncContext): Promise<string | null> {
    const cursorTimestamp = context.cursor ? Number.parseInt(context.cursor, 10) : 0

    let query = context.client
      .from('scores_journal')
      .select('*')
      .order('written_at', { ascending: true })

    if (cursorTimestamp > 0) {
      query = query.gt('written_at', cursorTimestamp)
    }

    const { data: records, error } = await query

    if (error) {
      throw new Error(`Failed to pull scores from server: ${error.message}`)
    }

    if (!records || records.length === 0) {
      return context.cursor
    }

    let latestTimestamp = cursorTimestamp

    for (const record of records) {
      if (record.written_at > latestTimestamp) {
        latestTimestamp = record.written_at
      }

      const existingEntry = await context.db.journal
        .where('entryId')
        .equals(record.entry_id)
        .first()

      if (existingEntry !== undefined) {
        continue
      }

      const tournament = await context.db.tournaments
        .where('publicId')
        .equals(record.tournament_public_id)
        .first()

      if (tournament === undefined || tournament.id === undefined) {
        continue
      }

      const match = await context.db.matches
        .where('tournamentId')
        .equals(tournament.id)
        .filter((m) => {
          if (m.phase !== record.phase) return false
          if (record.duel !== null && m.duel !== record.duel) return false
          if (record.rank_in_duel !== null && m.rankInDuel !== record.rank_in_duel) return false
          return true
        })
        .first()

      if (match !== undefined && match.id !== undefined) {
        const winningSide = record.winning_side as TableSide
        const winnerTeamId = winningSide === 'blue' ? match.blueTeamId : match.whiteTeamId

        await context.db.matches.update(match.id, {
          winnerTeamId,
          loserScore: record.loser_score,
          enteredAt: record.written_at,
        })

        const previousResult = record.previous as MatchResult | null

        await context.db.journal.add({
          entryId: record.entry_id,
          tournamentId: tournament.id,
          matchId: match.id,
          operation: record.operation as 'record' | 'correct',
          previous: previousResult,
          next: { winningSide, loserScore: record.loser_score },
          writtenAt: record.written_at,
        })
      }
    }

    return String(latestTimestamp)
  }
}
