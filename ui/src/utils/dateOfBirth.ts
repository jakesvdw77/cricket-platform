// docs/specs/077: the public form asks for the date of birth as three numeric fields and sends it
// as an ISO yyyy-MM-dd string. Pure, so the validation wording is tested once.

export type DateOfBirthResult = { iso: string; error?: undefined } | { iso?: undefined; error: string }

const pad = (value: number, length: number) => String(value).padStart(length, '0')

export function parseDateOfBirth(day: string, month: string, year: string, today: Date = new Date()): DateOfBirthResult {
  const d = day.trim()
  const m = month.trim()
  const y = year.trim()
  if (!d || !m || !y) return { error: 'Enter the day, month and year.' }
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) {
    return { error: 'Use numbers only: day and month with 1 or 2 digits, year with 4.' }
  }
  const dayN = Number(d)
  const monthN = Number(m)
  const yearN = Number(y)
  if (monthN < 1 || monthN > 12) return { error: 'The month must be between 1 and 12.' }
  if (yearN < 1900) return { error: 'Check the year.' }
  const real = new Date(Date.UTC(yearN, monthN - 1, dayN))
  if (dayN < 1 || real.getUTCFullYear() !== yearN || real.getUTCMonth() !== monthN - 1 || real.getUTCDate() !== dayN) {
    return { error: 'That date does not exist. Check the day and month.' }
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  if (real.getTime() > todayUtc) return { error: 'The date of birth cannot be in the future.' }
  return { iso: `${pad(yearN, 4)}-${pad(monthN, 2)}-${pad(dayN, 2)}` }
}
