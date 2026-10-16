import type { ImportNote } from '../../../../api/resultImportApi'

// docs/specs/104: what `resolve` said about each name (the ranked suggestions for a name it could not place, how a guess was
// matched) has to reach the capture wizard, which is a different page. Nothing on the server holds it (the draft stores
// only the flag and the file's spelling), so the import page leaves it here for the wizard to read: sessionStorage, per
// club and match, so it survives a reload of the wizard and goes when the tab does. Only the notes about names are kept.
// Every access is in a try/catch: unavailable storage just means the chips carry less detail, never an error.
const keyFor = (clubId: string, matchId: string) => `resultImport:notes:${clubId}:${matchId}`

// The notes that are not about a name (no `fileText`): a skipped duplicate row, an award that was not placed and so on. Kept
// apart from the name notes (which the Guess chips use) under a sibling key, for the "draft created" notice.
const otherKeyFor = (clubId: string, matchId: string) => `${keyFor(clubId, matchId)}:other`

export function saveImportNotes(clubId: string, matchId: string, notes: ImportNote[]): void {
  try {
    const names = notes.filter((note) => note.fileText)
    sessionStorage.setItem(keyFor(clubId, matchId), JSON.stringify(names))
    sessionStorage.setItem(otherKeyFor(clubId, matchId), JSON.stringify(notes.filter((note) => !note.fileText)))
  } catch {
    // not fatal
  }
}

export function readImportNotes(clubId: string, matchId: string): ImportNote[] {
  try {
    const raw = sessionStorage.getItem(keyFor(clubId, matchId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ImportNote[]) : []
  } catch {
    return []
  }
}

export function readOtherImportNotes(clubId: string, matchId: string): ImportNote[] {
  try {
    const raw = sessionStorage.getItem(otherKeyFor(clubId, matchId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ImportNote[]) : []
  } catch {
    return []
  }
}
