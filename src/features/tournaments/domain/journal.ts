import type { MatchResult } from './score'

export type JournalOperation = 'record' | 'correct'

/**
 * One line of the append-only history of a match's result.
 *
 * It carries no author. Without authentication the server cannot know who
 * wrote, and a self-declared name would read as attribution while proving
 * nothing.
 */
export interface JournalEntry {
  id?: number
  /**
   * Generated on the device that wrote the line, so replaying a queued write
   * appends it once rather than once per attempt.
   */
  entryId: string
  tournamentId: number
  matchId: number
  operation: JournalOperation
  /** What the match read before this line. Null when nothing was there yet. */
  previous: MatchResult | null
  next: MatchResult
  writtenAt: number
}
