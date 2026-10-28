import { offeredFormats } from './enabledFormats'

// docs/specs/122-league-sharing.md (Step 1 and Step 2): the content-by-format table as ONE data table, never repeated in
// components. Pure; no React.

export type LeagueContent = 'DETAILS' | 'CONDITIONS' | 'TEAMS' | 'SCHEDULE' | 'RESULTS' | 'KEY_DATES'
export type LeagueShareFormat = 'PDF' | 'POSTER' | 'CALENDAR' | 'WHATSAPP' | 'FACEBOOK'

export type LeagueWhatsAppTemplate = 'SHORT' | 'FULL'
export type LeagueFacebookTemplate = 'FULL_POST' | 'BRIEF'

// The order of the list in step 1, and of the sections in a mixed PDF or text.
export const LEAGUE_CONTENTS: LeagueContent[] = ['DETAILS', 'CONDITIONS', 'TEAMS', 'SCHEDULE', 'RESULTS', 'KEY_DATES']
export const LEAGUE_SHARE_FORMATS: LeagueShareFormat[] = ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK']
export const LEAGUE_WHATSAPP_TEMPLATES: LeagueWhatsAppTemplate[] = ['SHORT', 'FULL']
export const LEAGUE_FACEBOOK_TEMPLATES: LeagueFacebookTemplate[] = ['FULL_POST', 'BRIEF']

export const LEAGUE_CONTENT_LABELS: Record<LeagueContent, string> = {
  DETAILS: 'League details',
  CONDITIONS: 'Playing conditions',
  TEAMS: 'Teams',
  SCHEDULE: 'Schedule',
  RESULTS: 'Results',
  KEY_DATES: 'Key dates',
}

export const LEAGUE_SHARE_FORMAT_LABELS: Record<LeagueShareFormat, string> = {
  PDF: 'PDF',
  POSTER: 'Poster',
  CALENDAR: 'Calendar',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
}

const FORMATS_BY_CONTENT: Record<LeagueContent, LeagueShareFormat[]> = {
  DETAILS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  CONDITIONS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  TEAMS: ['PDF', 'POSTER', 'WHATSAPP', 'FACEBOOK'],
  SCHEDULE: ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'],
  RESULTS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  KEY_DATES: ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'],
}

export const supports = (content: LeagueContent, format: LeagueShareFormat): boolean =>
  FORMATS_BY_CONTENT[content].includes(format)

// The ticked contents in the standard order, without repeats or unknown codes.
export const orderedContents = (ticked: readonly string[]): LeagueContent[] =>
  LEAGUE_CONTENTS.filter((content) => ticked.includes(content))

export interface LeagueFormatAvailability {
  // Formats every ticked content supports and the club has on, in the standard order.
  offered: LeagueShareFormat[]
  // Formats the club has on that a ticked content does not support, with the visible reason.
  greyed: { format: LeagueShareFormat; reason: string }[]
  // Formats the club switched off: not shown at all.
  hidden: LeagueShareFormat[]
}

const joinLabels = (labels: string[]): string =>
  labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`

// "Poster is not available for Results", naming every ticked content that cannot do the format.
export function unsupportedReason(format: LeagueShareFormat, ticked: readonly string[]): string | null {
  const blockers = orderedContents(ticked).filter((content) => !supports(content, format))
  if (blockers.length === 0) return null
  return `${LEAGUE_SHARE_FORMAT_LABELS[format]} is not available for ${joinLabels(blockers.map((content) => LEAGUE_CONTENT_LABELS[content]))}`
}

// `clubDisabled` is the share-settings map (`disabledFormats`); undefined offers everything the contents support.
export function availability(
  ticked: readonly string[],
  clubDisabled: Record<string, string[]> | undefined,
): LeagueFormatAvailability {
  const clubOn = offeredFormats<LeagueShareFormat>('LEAGUE', clubDisabled)
  const hidden = LEAGUE_SHARE_FORMATS.filter((format) => !clubOn.includes(format))
  const offered: LeagueShareFormat[] = []
  const greyed: LeagueFormatAvailability['greyed'] = []
  for (const format of clubOn) {
    const reason = unsupportedReason(format, ticked)
    if (reason === null) offered.push(format)
    else greyed.push({ format, reason })
  }
  return { offered, greyed, hidden }
}
