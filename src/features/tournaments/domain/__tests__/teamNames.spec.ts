import { describe, expect, it } from 'vitest'
import {
  DuplicateTeamNameError,
  MAXIMUM_TEAM_NAME_LENGTH,
  resolveRename,
  resolveTeamLabels,
  TeamNameTooLongError,
} from '../teamNames'

const TOO_LONG = 'x'.repeat(MAXIMUM_TEAM_NAME_LENGTH + 1)

describe('resolveTeamLabels', () => {
  it('numbers a team nobody named', () => {
    expect(resolveTeamLabels(['', '  ', ''])).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3'])
  })

  it('keeps the names that were typed, trimmed', () => {
    expect(resolveTeamLabels(['  Les Bras Cassés ', 'Tiki Taka', ''])).toEqual([
      'Les Bras Cassés',
      'Tiki Taka',
      'Équipe 3',
    ])
  })

  it('collapses the spaces a phone keyboard leaves behind', () => {
    expect(resolveTeamLabels(['Les   Bras    Cassés', ''])).toEqual(['Les Bras Cassés', 'Équipe 2'])
  })

  it('refuses a name too long to fit a standings row', () => {
    expect(() => resolveTeamLabels([TOO_LONG, ''])).toThrow(TeamNameTooLongError)
    expect(() => resolveTeamLabels(['x'.repeat(MAXIMUM_TEAM_NAME_LENGTH), ''])).not.toThrow()
  })

  it('refuses two teams answering to the same name', () => {
    expect(() => resolveTeamLabels(['Tiki Taka', 'Tiki Taka'])).toThrow(DuplicateTeamNameError)
  })

  it('treats a name as taken however it was capitalised or spaced', () => {
    expect(() => resolveTeamLabels(['Tiki Taka', '  tiki   taka '])).toThrow(DuplicateTeamNameError)
  })

  it('refuses a typed name that collides with another team default', () => {
    // Naming the first team "Équipe 2" would leave the second unidentifiable.
    expect(() => resolveTeamLabels(['Équipe 2', ''])).toThrow(DuplicateTeamNameError)
  })
})

describe('resolveRename', () => {
  it('takes the new name when nothing else answers to it', () => {
    expect(resolveRename('Les Bras Cassés', 'Équipe 1', ['Tiki Taka'])).toBe('Les Bras Cassés')
  })

  it('falls back to the numbered default when the field is cleared', () => {
    expect(resolveRename('   ', 'Équipe 2', ['Tiki Taka'])).toBe('Équipe 2')
  })

  it('refuses a name another team of the edition already carries', () => {
    expect(() => resolveRename('Tiki Taka', 'Équipe 1', ['Tiki Taka'])).toThrow(
      DuplicateTeamNameError,
    )
  })

  it('refuses a name too long', () => {
    expect(() => resolveRename(TOO_LONG, 'Équipe 1', [])).toThrow(TeamNameTooLongError)
  })

  it('lets a team keep the name it already had', () => {
    // The team's own label is not among the others, so renaming to itself works.
    expect(resolveRename('Tiki Taka', 'Équipe 1', ['Les Bras Cassés'])).toBe('Tiki Taka')
  })
})
