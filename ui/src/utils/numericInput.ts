// The ONE place that decides which keystrokes a numeric field accepts (docs/specs/101, input hardening). Invalid input must
// not be possible to type or paste: these return the text the field should show, which is the sanitised new text, or
// `previous` when the keystroke would make the figure invalid (so it is simply ignored). Pure.

export interface IntegerRules {
  // The largest value accepted; a keystroke that would exceed it is ignored.
  max?: number
  // Digits kept at most (default 9).
  maxLength?: number
}

// Digits only: no minus, point, 'e', letters or spaces (a pasted "1,234 runs" becomes "1234"). No leading zeros ("007" is "7").
export function sanitizeInteger(text: string, rules: IntegerRules = {}, previous = ''): string {
  const digits = text.replace(/\D/g, '').slice(0, rules.maxLength ?? 9)
  if (digits === '') return ''
  const trimmed = digits.replace(/^0+(?=\d)/, '')
  if (rules.max !== undefined && Number(trimmed) > rules.max) return previous
  return trimmed
}

export interface OversRules {
  // Digits kept in the overs part (default 3).
  maxOversDigits?: number
  // The largest whole overs accepted; omitted, only the digit limit applies.
  maxOvers?: number
}

// Digits and at most one point; at most one digit after it and that ball digit below balls per over. "-8.9jj" becomes "8.9",
// which is refused (the ball digit 9 is not below 6), so the field keeps `previous`. A lone "." becomes "0.".
export function sanitizeOvers(text: string, ballsPerOver: number, rules: OversRules = {}, previous = ''): string {
  let cleaned = text.replace(/[^\d.]/g, '')
  const firstPoint = cleaned.indexOf('.')
  if (firstPoint >= 0) cleaned = cleaned.slice(0, firstPoint + 1) + cleaned.slice(firstPoint + 1).replace(/\./g, '')
  const [wholeRaw, ballRaw] = cleaned.split('.')
  const whole = (wholeRaw ?? '').slice(0, rules.maxOversDigits ?? 3).replace(/^0+(?=\d)/, '')
  if (rules.maxOvers !== undefined && whole !== '' && Number(whole) > rules.maxOvers) return previous
  if (firstPoint < 0) return whole
  const ball = (ballRaw ?? '').slice(0, 1)
  if (ball !== '' && Number(ball) >= ballsPerOver) return previous
  return `${whole === '' ? '0' : whole}.${ball}`
}
