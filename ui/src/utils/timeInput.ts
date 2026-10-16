// 24-hour 'HH:MM' typing helper for components/DateTimeField. Digits only, the colon is inserted
// for you, and an impossible value (hours above 23, minutes above 59) is refused at the keystroke.
// A first digit of 3 to 9 is read as a single-digit hour (9 becomes 09, 930 becomes 09:30).
export function sanitiseTimeText(raw: string): string {
  const out: string[] = []
  for (const char of raw.replace(/\D/g, '')) {
    if (out.length >= 4) break
    const digit = Number(char)
    if (out.length === 0) {
      if (digit > 2) out.push('0', char)
      else out.push(char)
    } else if (out.length === 1) {
      if (out[0] === '2' && digit > 3) continue
      out.push(char)
    } else if (out.length === 2) {
      if (digit > 5) continue
      out.push(char)
    } else {
      out.push(char)
    }
  }
  const digits = out.join('')
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

export function isCompleteTime(text: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text)
}
