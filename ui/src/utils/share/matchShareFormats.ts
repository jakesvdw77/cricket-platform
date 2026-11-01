import { offeredFormats } from './enabledFormats'
import type { ShareFormat } from './shareChoices'

// docs/specs/131-match-sharing.md (Content catalogue): the content-by-format table as ONE data table, never repeated in
// components. Pure; no React.

export type MatchContent = 'TEAM_SELECTION' | 'COUNTDOWN' | 'FUN_FACTS' | 'FIXTURE' | 'TEAM_SHEET'
export type MatchSideChoice = 'OURS' | 'OPPOSITION' | 'BOTH'
export type MatchLayout = 'SIDE_BY_SIDE' | 'SEPARATE'
export type MatchWhatsAppTemplate = 'SHORT' | 'WITH_FACTS'
export type MatchFacebookTemplate = 'ANNOUNCEMENT' | 'COUNTDOWN' | 'BRIEF'

// The order of the choices in step 1.
export const MATCH_CONTENTS: MatchContent[] = ['TEAM_SELECTION', 'COUNTDOWN', 'FUN_FACTS', 'FIXTURE', 'TEAM_SHEET']
export const MATCH_SIDE_CHOICES: MatchSideChoice[] = ['OURS', 'OPPOSITION', 'BOTH']
export const MATCH_LAYOUTS: MatchLayout[] = ['SIDE_BY_SIDE', 'SEPARATE']
export const MATCH_WHATSAPP_TEMPLATES: MatchWhatsAppTemplate[] = ['SHORT', 'WITH_FACTS']
export const MATCH_FACEBOOK_TEMPLATES: MatchFacebookTemplate[] = ['ANNOUNCEMENT', 'COUNTDOWN', 'BRIEF']

export const MATCH_CONTENT_LABELS: Record<MatchContent, string> = {
  TEAM_SELECTION: 'Team Selection Poster',
  COUNTDOWN: 'Countdown',
  FUN_FACTS: 'Fun Facts',
  FIXTURE: 'Fixture Card',
  TEAM_SHEET: 'Team Sheet',
}

export const MATCH_CONTENT_DESCRIPTIONS: Record<MatchContent, string> = {
  TEAM_SELECTION: 'A chosen picture beside the XI',
  COUNTDOWN: '"3 days to go" with fixture, venue and weather',
  FUN_FACTS: 'Form and head to head, built from stored results',
  FIXTURE: 'Date, time, venue, teams, league and logos',
  TEAM_SHEET: 'Printable A4 with the XI, roles and blank lines for officials',
}

export const MATCH_SIDE_LABELS: Record<MatchSideChoice, string> = { OURS: 'Our Side', OPPOSITION: 'Opposition', BOTH: 'Both' }
export const MATCH_LAYOUT_LABELS: Record<MatchLayout, string> = { SIDE_BY_SIDE: 'Side By Side', SEPARATE: 'Separate' }

export const MATCH_FORMAT_LABELS: Record<ShareFormat, string> = {
  PDF: 'PDF',
  IMAGE: 'Image',
  TV: 'TV Summary',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
}

const ALL: ShareFormat[] = ['PDF', 'IMAGE', 'TV', 'WHATSAPP', 'FACEBOOK']

const FORMATS_BY_CONTENT: Record<MatchContent, ShareFormat[]> = {
  FIXTURE: ALL,
  TEAM_SELECTION: ALL,
  COUNTDOWN: ALL,
  FUN_FACTS: ['PDF', 'IMAGE', 'WHATSAPP', 'FACEBOOK'],
  TEAM_SHEET: ['PDF', 'WHATSAPP', 'FACEBOOK'],
}

export const supportsFormat = (content: MatchContent, format: ShareFormat): boolean => FORMATS_BY_CONTENT[content].includes(format)

// Contents that carry the lineups: the side choice applies to them (and to team facts).
export const usesLineup = (content: MatchContent): boolean => content === 'TEAM_SELECTION' || content === 'TEAM_SHEET'
// Contents that need a selected XI.
export const needsXi = usesLineup

export const SELECT_FIRST_REASON = 'Select the team first'
export const PAST_MATCH_REASON = 'The match has been played'

export interface MatchShareContext {
  // Our side has a selected XI.
  hasOurXi: boolean
  // The opposition's XI is on the platform and selected.
  hasOppositionXi: boolean
  // The match date has passed.
  past: boolean
}

// Why a content cannot be chosen yet, or null when it can.
export function contentGap(content: MatchContent, context: MatchShareContext): string | null {
  if (needsXi(content) && !context.hasOurXi) return SELECT_FIRST_REASON
  if (content === 'COUNTDOWN' && context.past) return PAST_MATCH_REASON
  return null
}

// Why a side choice is unavailable, or null.
export function sideGap(side: MatchSideChoice, context: MatchShareContext): string | null {
  if (side === 'OURS') return null
  if (!context.hasOppositionXi) return 'Needs the opposition\'s selected XI on the platform'
  return null
}

export interface MatchFormatAvailability {
  offered: ShareFormat[]
  greyed: { format: ShareFormat; reason: string }[]
  hidden: ShareFormat[]
}

const UNSUPPORTED_REASON: Partial<Record<MatchContent, string>> = {
  TEAM_SHEET: 'Team Sheet offers PDF, WhatsApp and Facebook only',
  FUN_FACTS: 'Fun Facts has no TV summary',
}

// `clubDisabled` is the share-settings map (`disabledFormats`); undefined offers everything the content supports.
export function matchFormatAvailability(content: MatchContent, clubDisabled: Record<string, string[]> | undefined): MatchFormatAvailability {
  const clubOn = offeredFormats<ShareFormat>('MATCH', clubDisabled)
  const hidden = ALL.filter((format) => !clubOn.includes(format))
  const offered: ShareFormat[] = []
  const greyed: MatchFormatAvailability['greyed'] = []
  for (const format of clubOn) {
    if (supportsFormat(content, format)) offered.push(format)
    else greyed.push({ format, reason: UNSUPPORTED_REASON[content] ?? 'Not offered for this content' })
  }
  return { offered, greyed, hidden }
}

// docs/specs/131 (Countdown wording): "N days to go", "Tomorrow", "Today" (not started yet), "Match day" (started); null for a past day.
export function countdownWording(daysAway: number, started: boolean): string | null {
  if (!Number.isFinite(daysAway) || daysAway < 0) return null
  if (daysAway === 0) return started ? 'Match day' : 'Today'
  if (daysAway === 1) return 'Tomorrow'
  return `${daysAway} days to go`
}

// Side by side needs the width of Portrait or Landscape; Square and Story fall back to Separate.
export function effectiveLayout(layout: MatchLayout, size: 'SQUARE' | 'PORTRAIT' | 'STORY', tv: boolean): { layout: MatchLayout; fellBack: boolean } {
  if (layout === 'SIDE_BY_SIDE' && !tv && size !== 'PORTRAIT') return { layout: 'SEPARATE', fellBack: true }
  return { layout, fellBack: false }
}
