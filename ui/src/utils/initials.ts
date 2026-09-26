// The initials shown as a RecordCard/PlayerCard/TeamCard avatar's fallback when there's no
// photo/logo to render. First letter of each of the first two words for a multi-word name
// ("Jane Smith" -> "JS", "1st XI" -> "1X"), or the first two characters for a single word
// ("Wanderers" -> "WA") — real user feedback that the previous literal-first-two-characters
// version ("Brain Best" -> "BR") read as a bug for any person name whose first name isn't
// exactly one letter long.
export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return (words[0] ?? '').slice(0, 2).toUpperCase()
}
