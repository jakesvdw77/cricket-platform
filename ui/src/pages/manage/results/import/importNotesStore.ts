import type { ImportNote } from '../../../../api/resultImportApi'

// docs/specs/104: what `resolve` said about each name (the ranked suggestions for a name it could not place, how a guess was
// matched) has to reach the capture wizard, which is a different page. Nothing on the server holds it (the draft stores
// only the flag and the file's spelling), so the import page leaves it here for the wizard to read: sessionStorage, per
// club and match, so it survives a reload of the wizard and goes when the tab does. Only the notes about names are kept.
// Every access is in a try/catch: unavailable storage just means the chips carry less detail, never an error.
const keyFor = (clubId: string, matchId: string) => `resultImport:notes:${clubId}:${matchId}`

export function saveImportNotes(clubId: string, matchId: string, notes: ImportNote[]): void {
  try {
    const names = notes.filter((note) => note.fileText)
    sessionStorage.setItem(keyFor(clubId, matchId), JSON.stringify(names))
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
