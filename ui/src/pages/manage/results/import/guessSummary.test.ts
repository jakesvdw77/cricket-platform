import { describe, expect, it } from 'vitest'
import type { ResultPlayer } from '../../../../api/matchResultApi'
import type { ImportNote } from '../../../../api/resultImportApi'
import { bannerSentence, confirmRuleBased, guessLevelOf, nextToCheck, noteFor, reasonPhrase, summariseGuesses } from './guessSummary'

const player = (key: string, patch: Partial<ResultPlayer> = {}): ResultPlayer => ({
  id: key,
  side: 'HOME',
  playerProfileId: `profile-${key}`,
  displayName: null,
  plannedBattingOrder: null,
  replacedPlayerProfileId: null,
  substitute: false,
  ...patch,
})

const note = (fileText: string, patch: Partial<ImportNote> = {}): ImportNote => ({
  code: 'NAME_INITIALS',
  severity: 'INFO',
  section: 'ours',
  message: 'm',
  fileText,
  ...patch,
})

describe('noteFor and reasonPhrase', () => {
  it('finds the note by the file spelling, ignoring case and spacing', () => {
    const notes = [note('Hari  K')]
    expect(noteFor(notes, ' hari k ')).toBe(notes[0])
    expect(noteFor(notes, 'Someone Else')).toBeUndefined()
    expect(noteFor(notes, null)).toBeUndefined()
  })

  it('words a known reason code and gives nothing for an unknown one', () => {
    expect(reasonPhrase(note('x', { code: 'NAME_SURNAME_PREFIX' }))).toBe('by the start of the surname')
    expect(reasonPhrase(note('x', { code: 'SOMETHING_NEW' }))).toBeNull()
    expect(reasonPhrase(undefined)).toBeNull()
  })
})

describe('guessLevelOf', () => {
  it('is the flag on a linked row of ours', () => {
    expect(guessLevelOf(player('1', { importMatch: 'NORMALISED' }), [])).toBe('NORMALISED')
  })

  it('is UNRESOLVED for our guest whose spelling has an unresolved note', () => {
    const guest = player('2', { playerProfileId: null, displayName: 'Dino V' })
    expect(guessLevelOf(guest, [note('Dino V', { level: 'UNRESOLVED' })])).toBe('UNRESOLVED')
    expect(guessLevelOf(guest, [])).toBeNull()
    expect(guessLevelOf(guest, [note('Dino V', { level: 'EXACT' })])).toBeNull()
  })

  it('is never anything for the opposition', () => {
    expect(guessLevelOf(player('3', { opposition: true, importMatch: 'NORMALISED' }), [])).toBeNull()
  })
})

describe('summariseGuesses', () => {
  it('counts guesses, the rule-based ones among them, and unresolved guests', () => {
    const players = [
      player('1', { importMatch: 'NORMALISED' }),
      player('2', { importMatch: 'NORMALISED' }),
      player('3', { importMatch: 'AI_SUGGESTED' }),
      player('4', { playerProfileId: null, displayName: 'Dino V' }),
      player('5'),
    ]
    expect(summariseGuesses(players, [note('Dino V', { level: 'UNRESOLVED' })])).toEqual({ guesses: 3, ruleBased: 2, unresolved: 1 })
  })

  it('is all zero when nothing needs checking', () => {
    expect(summariseGuesses([player('1')], [])).toEqual({ guesses: 0, ruleBased: 0, unresolved: 0 })
  })
})

describe('nextToCheck', () => {
  const players = [
    player('a', { playerProfileId: null, displayName: 'Dino V' }),
    player('b', { importMatch: 'NORMALISED' }),
    player('c', { side: 'AWAY', importMatch: 'NORMALISED' }),
  ]
  const notes = [note('Dino V', { level: 'UNRESOLVED' })]

  it('offers guesses before unresolved names, each in list order, with the side to show', () => {
    expect(nextToCheck(players, notes)).toEqual({ key: 'b', side: 'HOME' })
    expect(nextToCheck(players, notes, 'b')).toEqual({ key: 'c', side: 'AWAY' })
    expect(nextToCheck(players, notes, 'c')).toEqual({ key: 'a', side: 'HOME' })
  })

  it('wraps round to the first, and is null when nothing is left', () => {
    expect(nextToCheck(players, notes, 'a')).toEqual({ key: 'b', side: 'HOME' })
    expect(nextToCheck([player('z')], [])).toBeNull()
  })
})

describe('confirmRuleBased', () => {
  it('clears the rule-based flag only, never a reserved AI level, and never sets one', () => {
    const result = confirmRuleBased([player('1', { importMatch: 'NORMALISED' }), player('2', { importMatch: 'AI_SUGGESTED' }), player('3')])
    expect(result.map((p) => p.importMatch ?? null)).toEqual([null, 'AI_SUGGESTED', null])
  })
})

describe('bannerSentence', () => {
  it('words guesses, guests and the publish rule', () => {
    expect(bannerSentence('ACMESCORE', { guesses: 2, ruleBased: 2, unresolved: 1 })).toBe(
      'Imported from ACMESCORE. 2 names were matched by a best guess and 1 could not be matched, so it is a guest. A result cannot be published while a guess is unconfirmed.',
    )
  })

  it('leaves out the publish rule when only guests remain, and uses singular for one guess', () => {
    expect(bannerSentence('ACMESCORE', { guesses: 0, ruleBased: 0, unresolved: 2 })).toBe('Imported from ACMESCORE. 2 could not be matched, so they are guests.')
    expect(bannerSentence('ACMESCORE', { guesses: 1, ruleBased: 1, unresolved: 0 })).toContain('1 name was matched by a best guess')
  })
})
