import type { HandiBabyDatabase } from '@/core/db/database'
import { hashPassphrase } from './domain/passphrase'
import { isInProgress, type Tournament } from './domain/types'

export class BlankLabelError extends Error {
  constructor() {
    super('Une édition a besoin d’un libellé')
    this.name = 'BlankLabelError'
  }
}

export interface DraftInput {
  label: string
  startDate: string
  passphrase: string
}

export class TournamentRepository {
  constructor(private readonly db: HandiBabyDatabase) {}

  /**
   * Creates the edition empty. Participants and teams are added while it stays
   * a draft, so a setup interrupted by a meeting resumes where it stopped.
   */
  async createDraft(input: DraftInput): Promise<Tournament> {
    const label = input.label.trim()

    if (label === '') {
      throw new BlankLabelError()
    }

    // Throws on a passphrase the format considers guessable, before anything is written.
    const passphraseHash = await hashPassphrase(input.passphrase)

    const tournament: Tournament = {
      publicId: crypto.randomUUID(),
      label,
      startDate: input.startDate,
      status: 'draft',
      passphraseHash,
      createdAt: Date.now(),
    }

    const id = await this.db.tournaments.add(tournament)
    return { ...tournament, id }
  }

  async findByPublicId(publicId: string): Promise<Tournament | undefined> {
    return this.db.tournaments.where('publicId').equals(publicId).first()
  }

  /** Newest first: the edition someone is looking for is almost always the recent one. */
  async listInProgress(): Promise<Tournament[]> {
    return this.#sorted((tournament) => isInProgress(tournament.status))
  }

  async listFinished(): Promise<Tournament[]> {
    return this.#sorted((tournament) => !isInProgress(tournament.status))
  }

  async #sorted(keep: (tournament: Tournament) => boolean): Promise<Tournament[]> {
    const tournaments = await this.db.tournaments.toArray()
    return tournaments.filter(keep).sort((left, right) => right.createdAt - left.createdAt)
  }
}
