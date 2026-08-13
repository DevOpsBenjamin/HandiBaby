/**
 * The pool outlives editions. Mixing pairs from one edition to the next is what
 * makes a player measurable rather than a pair, and that only works if the same
 * person resolves to the same row every time.
 */
export interface Player {
  id?: number
  firstName: string
  lastName: string
  /**
   * Normalised "first last", unique across the pool. Two Lucas are two players;
   * a retyped "lucas martin" resolves to the existing one instead of creating a
   * phantom that would split someone's history in two.
   */
  nameKey: string
}
