// docs/specs/101-match-results-our-side-scorecard.md (Teams, the opposition): turns pasted or typed text into player names,
// one per line. Pure.
//  - one name per line; blank lines are dropped;
//  - a leading list marker is stripped: "1.", "1)", "1 -", "-", "*", a bullet;
//  - at most MAX_PASTED_NAMES are taken at once (`truncated` says more were pasted);
//  - names already on the list (compared without regard to case) and repeats within the paste are skipped (`duplicates`).

export const MAX_PASTED_NAMES = 15

export interface ParsedNames {
  names: string[]
  // True when more than MAX_PASTED_NAMES new names were pasted and the rest were left out.
  truncated: boolean
  // Names skipped because they were already on the list or repeated in the paste.
  duplicates: string[]
}

const MARKER = /^\s*(?:\(?\d{1,3}\s*[.):-]|[-*•·–—])\s*/

export function stripListMarker(line: string): string {
  return line.replace(MARKER, '').trim().replace(/\s+/g, ' ')
}

export function parseNameList(text: string, existing: string[] = [], max = MAX_PASTED_NAMES): ParsedNames {
  const seen = new Set(existing.map((name) => name.trim().toLowerCase()))
  const names: string[] = []
  const duplicates: string[] = []
  let truncated = false
  for (const line of text.split(/\r?\n/)) {
    const name = stripListMarker(line)
    if (name === '') continue
    const key = name.toLowerCase()
    if (seen.has(key)) {
      duplicates.push(name)
      continue
    }
    if (names.length >= max) {
      truncated = true
      continue
    }
    seen.add(key)
    names.push(name)
  }
  return { names, truncated, duplicates }
}
