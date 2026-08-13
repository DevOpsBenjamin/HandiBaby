import type { HandiBabyDatabase } from '@/core/db/database'
import type { JournalOperation } from './domain/journal'
import type { MatchResult } from './domain/score'

export interface JournalRecord {
  entryId: string
  operation: JournalOperation
  previous: MatchResult | null
  next: MatchResult
  writtenAt: number
}

/**
 * Reads back what was written to a match and when.
 *
 * Local like everything else, so a correction made with no network shows in the
 * history the moment it is made rather than when it reaches a server.
 */
export class JournalReader {
  constructor(private readonly db: HandiBabyDatabase) {}

  /** Newest first, grouped by match: a disputed result is read from the last write back. */
  async forMatches(matchIds: readonly number[]): Promise<Map<number, JournalRecord[]>> {
    const entries = await this.db.journal
      .where('matchId')
      .anyOf([...matchIds])
      .toArray()

    const byMatch = new Map<number, JournalRecord[]>()

    // Two writes can land in the same millisecond, so insertion order breaks the tie.
    entries.sort(
      (left, right) => right.writtenAt - left.writtenAt || (right.id ?? 0) - (left.id ?? 0),
    )

    for (const entry of entries) {
      byMatch.set(entry.matchId, [
        ...(byMatch.get(entry.matchId) ?? []),
        {
          entryId: entry.entryId,
          operation: entry.operation,
          previous: entry.previous,
          next: entry.next,
          writtenAt: entry.writtenAt,
        },
      ])
    }

    return byMatch
  }
}
