// docs/specs/104-match-results-import-adaptors.md: a guest's written name split into first name(s) and surname, to prefill
// Add player from the scorecard. The surname starts at the first particle word (van, von, de, du, le, la, di, da, vd,
// vander, vanden), otherwise it is the last word; a single word is the surname.
const PARTICLES = new Set(['van', 'von', 'de', 'du', 'le', 'la', 'di', 'da', 'vd', 'vander', 'vanden'])

export function splitGuestName(displayName: string | null | undefined): { firstName: string; lastName: string } {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { firstName: '', lastName: '' }
  if (words.length === 1) return { firstName: '', lastName: words[0] }
  // A particle in the first place would leave no first name, so it only counts from the second word on.
  const particleAt = words.findIndex((word, index) => index > 0 && PARTICLES.has(word.toLowerCase()))
  const start = particleAt > 0 ? particleAt : words.length - 1
  return { firstName: words.slice(0, start).join(' '), lastName: words.slice(start).join(' ') }
}
