import { describe, expect, it } from 'vitest'
import { MAX_PASTED_NAMES, parseNameList, stripListMarker } from './parseNameList'

describe('stripListMarker', () => {
  it('drops list markers, bullets and extra spaces', () => {
    expect(stripListMarker('1. Sam Jones')).toBe('Sam Jones')
    expect(stripListMarker('2) Tom   Brown')).toBe('Tom Brown')
    expect(stripListMarker('3 - Ali Khan')).toBe('Ali Khan')
    expect(stripListMarker('- Ben Hall')).toBe('Ben Hall')
    expect(stripListMarker('* Raj Patel')).toBe('Raj Patel')
    expect(stripListMarker('• Jo Wu')).toBe('Jo Wu')
  })

  it('leaves a name that merely starts with a digit-free word alone', () => {
    expect(stripListMarker('  Sam Jones ')).toBe('Sam Jones')
  })
})

describe('parseNameList', () => {
  it('takes one name per line in order, dropping blanks and markers, and handles CRLF', () => {
    const result = parseNameList('1. Sam Jones\r\n\r\n2) Tom Brown\n  \n- Ali Khan')
    expect(result.names).toEqual(['Sam Jones', 'Tom Brown', 'Ali Khan'])
    expect(result.truncated).toBe(false)
    expect(result.duplicates).toEqual([])
  })

  it('skips names already on the list and repeats within the paste, without regard to case', () => {
    const result = parseNameList('sam jones\nTom Brown\nTOM BROWN\nAli Khan', ['Sam Jones'])
    expect(result.names).toEqual(['Tom Brown', 'Ali Khan'])
    expect(result.duplicates).toEqual(['sam jones', 'TOM BROWN'])
  })

  it('takes at most 15 new names and says so when more were pasted', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Player ${String.fromCharCode(65 + i)}`).join('\n')
    const result = parseNameList(text)
    expect(MAX_PASTED_NAMES).toBe(15)
    expect(result.names).toHaveLength(15)
    expect(result.truncated).toBe(true)
  })

  it('does not count skipped duplicates towards the cap', () => {
    const existing = ['A One', 'B Two']
    const text = ['A One', 'B Two', ...Array.from({ length: 15 }, (_, i) => `New ${String.fromCharCode(65 + i)}`)].join('\n')
    const result = parseNameList(text, existing)
    expect(result.names).toHaveLength(15)
    expect(result.truncated).toBe(false)
    expect(result.duplicates).toEqual(['A One', 'B Two'])
  })

  it('respects a custom maximum', () => {
    expect(parseNameList('A\nB\nC', [], 2)).toMatchObject({ names: ['A', 'B'], truncated: true })
  })
})
