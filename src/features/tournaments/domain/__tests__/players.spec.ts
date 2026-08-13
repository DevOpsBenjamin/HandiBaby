import { describe, expect, it } from 'vitest'
import { buildNameKey } from '../players'

describe('buildNameKey', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(buildNameKey(' Lucas ', ' MARTIN ')).toBe(buildNameKey('lucas', 'martin'))
  })

  it('collapses inner whitespace', () => {
    expect(buildNameKey('Jean  Marc', 'Le   Guen')).toBe(buildNameKey('Jean Marc', 'Le Guen'))
  })

  it('keeps two people apart when only the last name differs', () => {
    expect(buildNameKey('Lucas', 'Martin')).not.toBe(buildNameKey('Lucas', 'Dubois'))
  })

  it('does not let a swapped first and last name collide', () => {
    expect(buildNameKey('Martin', 'Lucas')).not.toBe(buildNameKey('Lucas', 'Martin'))
  })

  it('keeps accents, which distinguish real names', () => {
    expect(buildNameKey('Renée', 'Lévy')).not.toBe(buildNameKey('Renee', 'Levy'))
  })
})
