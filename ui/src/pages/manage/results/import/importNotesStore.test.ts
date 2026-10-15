import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImportNote } from '../../../../api/resultImportApi'
import { readImportNotes, readOtherImportNotes, saveImportNotes } from './importNotesStore'

const nameNote: ImportNote = { code: 'NAME_INITIALS', severity: 'INFO', section: 'ours', message: 'A name', fileText: 'Hari K' }
const otherNote: ImportNote = { code: 'SUPER_OVER_DROPPED', severity: 'WARNING', section: 'innings', message: 'Super-over rows were dropped.' }

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('importNotesStore', () => {
  it('keeps the name notes and the other notes apart', () => {
    saveImportNotes('club-1', 'match-1', [nameNote, otherNote])
    expect(readImportNotes('club-1', 'match-1')).toEqual([nameNote])
    expect(readOtherImportNotes('club-1', 'match-1')).toEqual([otherNote])
  })

  it('is per club and per match', () => {
    saveImportNotes('club-1', 'match-1', [nameNote])
    expect(readImportNotes('club-1', 'match-2')).toEqual([])
    expect(readImportNotes('club-2', 'match-1')).toEqual([])
  })

  it('reads empty when nothing was saved or the stored value is not a list', () => {
    expect(readImportNotes('club-1', 'match-1')).toEqual([])
    sessionStorage.setItem('resultImport:notes:club-1:match-1', '{"not":"a list"}')
    expect(readImportNotes('club-1', 'match-1')).toEqual([])
    sessionStorage.setItem('resultImport:notes:club-1:match-1', 'not json')
    expect(readImportNotes('club-1', 'match-1')).toEqual([])
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => saveImportNotes('club-1', 'match-1', [nameNote])).not.toThrow()
    expect(readImportNotes('club-1', 'match-1')).toEqual([])
    expect(readOtherImportNotes('club-1', 'match-1')).toEqual([])
  })
})
