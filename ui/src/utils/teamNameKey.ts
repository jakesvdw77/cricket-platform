// docs/specs/104-match-results-import-adaptors.md: the same team is written "Northgate U15", "Northgate Under 15" or
// "NORTHGATE UNDER-15" by different scoring systems. This reduces a name to lower case words (accents and the dots and
// apostrophes inside a word dropped) with the age group written one way ("u15"), so two spellings compare equal. Numbers
// stay in the key, so "Northgate 1" and "Northgate 2" are never the same. Mirrors the server's TeamNameForms.
export function teamNameKey(name: string | null | undefined): string {
  if (!name) return ''
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[.'’`‘]/g, '')
    .toLowerCase()
  const raw = plain.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const words: string[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const word = raw[i]
    const glued = /^(?:u|under)(\d{1,2})$/.exec(word)
    if (glued) words.push(`u${glued[1]}`)
    else if ((word === 'u' || word === 'under') && /^\d+$/.test(raw[i + 1] ?? '')) {
      words.push(`u${raw[i + 1]}`)
      i += 1
    } else words.push(word)
  }
  return words.join(' ')
}
