import { describe, expect, it } from 'vitest'
import { buildNameKey, displayName } from '../naming'
import type { Player } from '../types'

function player(firstName: string, lastName: string): Player {
  return { firstName, lastName, nameKey: buildNameKey(firstName, lastName) }
}

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

describe('displayName', () => {
  const lucasMartin = player('Lucas', 'Martin')
  const lucasDubois = player('Lucas', 'Dubois')
  const lucasMercier = player('Lucas', 'Mercier')
  const benjamin = player('Benjamin', 'Ledrappier')

  it('uses the first name alone when nothing else in scope shares it', () => {
    expect(displayName(benjamin, [benjamin, lucasMartin, lucasDubois])).toBe('Benjamin')
  })

  it('adds the last initial when another player shares the first name', () => {
    const scope = [benjamin, lucasMartin, lucasDubois]
    expect(displayName(lucasMartin, scope)).toBe('Lucas M.')
    expect(displayName(lucasDubois, scope)).toBe('Lucas D.')
  })

  it('falls back to the full last name when the initial is ambiguous too', () => {
    const scope = [lucasMartin, lucasMercier]
    expect(displayName(lucasMartin, scope)).toBe('Lucas Martin')
    expect(displayName(lucasMercier, scope)).toBe('Lucas Mercier')
  })

  it('keeps the initial for the player whose initial is free', () => {
    const scope = [lucasMartin, lucasMercier, lucasDubois]
    expect(displayName(lucasDubois, scope)).toBe('Lucas D.')
    expect(displayName(lucasMartin, scope)).toBe('Lucas Martin')
  })

  it('narrows as the scope narrows', () => {
    expect(displayName(lucasMartin, [lucasMartin, benjamin])).toBe('Lucas')
    expect(displayName(lucasMartin, [lucasMartin, lucasDubois])).toBe('Lucas M.')
  })

  it('compares first names regardless of case', () => {
    const shouty = player('LUCAS', 'Dubois')
    expect(displayName(lucasMartin, [lucasMartin, shouty])).toBe('Lucas M.')
  })
})
