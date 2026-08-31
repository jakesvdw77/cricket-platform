// The first two characters of a display name, uppercased — the fallback shown in a RecordCard's
// avatar when there's no photo/logo to render. Deliberately literal (not "first letter of first
// and last word") so it works uniformly across person names ("Jane Smith" -> "JA") and
// organisation/record names ("1st XI" -> "1S", "Acme Cricket Gear" -> "AC").
export function initialsFromName(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}
