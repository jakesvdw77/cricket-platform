// docs/specs/100-match-results-core.md: the one converter between balls (what the API carries) and the "36.4" overs
// notation a manager types and reads. The digit after the point counts balls of the current over, so it must be below
// the match's balls per over (6 unless the league says otherwise), and "36.4" is 36 x 6 + 4 = 220 balls, never 36.4 of
// anything decimal.

export const DEFAULT_BALLS_PER_OVER = 6

// 220 -> "36.4", 240 -> "40.0". Empty (null) for a missing or negative figure.
export function ballsToOvers(balls: number | null | undefined, ballsPerOver = DEFAULT_BALLS_PER_OVER): string {
  if (balls === null || balls === undefined || !Number.isInteger(balls) || balls < 0) return ''
  return `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`
}

export type OversParse = { ok: true; balls: number } | { ok: false; error: string }

// "36.4" -> 220, "36" -> 216, "36." -> 216. The ball digit must be a single digit below ballsPerOver.
export function parseOvers(text: string, ballsPerOver = DEFAULT_BALLS_PER_OVER): OversParse {
  const value = text.trim()
  if (value === '') return { ok: false, error: 'Enter the overs, for example 36.4' }
  const match = /^(\d+)(?:\.(\d?))?$/.exec(value)
  if (!match) return { ok: false, error: 'Overs look like 36 or 36.4' }
  const overs = Number(match[1])
  const ball = match[2] ? Number(match[2]) : 0
  if (ball >= ballsPerOver) {
    return { ok: false, error: `The ball after the point must be 0 to ${ballsPerOver - 1} (${ballsPerOver} balls to an over)` }
  }
  return { ok: true, balls: overs * ballsPerOver + ball }
}

// The error to show under an overs field, or null when the text is valid.
export function validateOvers(text: string, ballsPerOver = DEFAULT_BALLS_PER_OVER): string | null {
  const parsed = parseOvers(text, ballsPerOver)
  return 'error' in parsed ? parsed.error : null
}
