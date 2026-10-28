// docs/specs/122-league-sharing.md (Data Model Changes): the club can switch share formats off per content type. One pure
// helper both dialogs read; the format codes per content type are defined here once.

export type ShareContentType = 'RESULT' | 'LEAGUE'

export const RESULT_FORMAT_CODES = ['PDF', 'IMAGE', 'TV', 'WHATSAPP', 'FACEBOOK'] as const
export const LEAGUE_FORMAT_CODES = ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'] as const

export const FORMAT_CODES: Record<ShareContentType, readonly string[]> = {
  RESULT: RESULT_FORMAT_CODES,
  LEAGUE: LEAGUE_FORMAT_CODES,
}

// The formats of a content type the club has not switched off, in the standard order. `disabled` is the settings map; a
// missing map (settings not read yet or the read failed) offers everything.
export function offeredFormats<T extends string = string>(
  contentType: ShareContentType,
  disabled: Record<string, string[]> | undefined,
): T[] {
  const off = new Set(disabled?.[contentType] ?? [])
  return FORMAT_CODES[contentType].filter((code) => !off.has(code)) as T[]
}
