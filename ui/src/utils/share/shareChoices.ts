import { MAX_SHARE_SPONSORS } from './logoLayout'
import type { TeamsChoice } from './shareResultData'

// docs/specs/114-share-result.md (Browser storage): the manager's remembered choices, one object per club in
// localStorage under shareChoicesKey. Only the type, the defaults and a pure sanitiser live here; reading and writing go
// through hooks/usePersistedListFilters. Edited WhatsApp and Facebook text is never part of it.

export const shareChoicesKey = (clubId: string): string => `share:choices:${clubId}`

export type ShareFormat = 'PDF' | 'IMAGE' | 'TV' | 'WHATSAPP' | 'FACEBOOK'
export type PdfTemplate = 'CLUB' | 'CLASSIC' | 'COMPACT'
export type ImageTemplate = 'CLUB_GREEN' | 'NIGHT' | 'DAYLIGHT'
export type TvTemplate = 'BROADCAST' | 'CLUB' | 'LIGHT'
export type WhatsAppTemplate = 'SHORT' | 'PERFORMERS' | 'SCORECARD'
export type FacebookTemplate = 'REPORT' | 'CELEBRATION' | 'BRIEF'
export type ImageSize = 'SQUARE' | 'PORTRAIT' | 'STORY'
export type TvPerformers = 2 | 3

export const SHARE_FORMATS: ShareFormat[] = ['PDF', 'IMAGE', 'TV', 'WHATSAPP', 'FACEBOOK']
export const PDF_TEMPLATES: PdfTemplate[] = ['CLUB', 'CLASSIC', 'COMPACT']
export const IMAGE_TEMPLATES: ImageTemplate[] = ['CLUB_GREEN', 'NIGHT', 'DAYLIGHT']
export const TV_TEMPLATES: TvTemplate[] = ['BROADCAST', 'CLUB', 'LIGHT']
export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = ['SHORT', 'PERFORMERS', 'SCORECARD']
export const FACEBOOK_TEMPLATES: FacebookTemplate[] = ['REPORT', 'CELEBRATION', 'BRIEF']
export const IMAGE_SIZES: ImageSize[] = ['SQUARE', 'PORTRAIT', 'STORY']

// A type alias (not an interface) so it satisfies usePersistedListFilters' Record<string, unknown>.
export type ShareChoices = {
  // The last format used (highlighted on opening); null before the first use.
  format: ShareFormat | null
  templates: {
    pdf: PdfTemplate
    image: ImageTemplate
    tv: TvTemplate
    whatsapp: WhatsAppTemplate
    facebook: FacebookTemplate
  }
  teams: TeamsChoice
  imageSize: ImageSize
  tvPerformers: TvPerformers
  include: {
    pdf: { batting: boolean; bowling: boolean; extras: boolean; toss: boolean; playerOfTheMatch: boolean }
    image: { topPerformers: boolean; playerOfTheMatch: boolean; venueAndDate: boolean }
    tv: { batters: boolean; bowlers: boolean; playerOfTheMatchBar: boolean }
    whatsapp: { attachImage: boolean; emoji: boolean }
    facebook: { attachImage: boolean; hashtags: boolean; mentionSponsor: boolean }
  }
  // The Logos group and the Footer line, shared by PDF, Image and TV.
  logos: { club: boolean; team: boolean; league: boolean }
  footerLine: boolean
  // At most MAX_SHARE_SPONSORS ids of the sponsors to show.
  sponsorIds: string[]
  // The user's own First names as initials choice for non-junior matches; null means never chosen (the club default applies).
  initialsOnly: boolean | null
}

export const DEFAULT_SHARE_CHOICES: ShareChoices = {
  format: null,
  templates: { pdf: 'CLUB', image: 'CLUB_GREEN', tv: 'BROADCAST', whatsapp: 'SHORT', facebook: 'REPORT' },
  teams: 'both',
  imageSize: 'SQUARE',
  tvPerformers: 3,
  include: {
    pdf: { batting: true, bowling: true, extras: true, toss: true, playerOfTheMatch: true },
    image: { topPerformers: true, playerOfTheMatch: true, venueAndDate: true },
    tv: { batters: true, bowlers: true, playerOfTheMatchBar: true },
    whatsapp: { attachImage: true, emoji: true },
    facebook: { attachImage: true, hashtags: true, mentionSponsor: false },
  },
  logos: { club: true, team: true, league: true },
  footerLine: true,
  sponsorIds: [],
  initialsOnly: null,
}

// A change to the choices: any nested object may carry just the keys that changed (arrays and primitives replace).
export type ShareChoicesPatch = DeepPartial<ShareChoices>
type DeepPartial<T> = T extends unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

// Every key of `defaults` taken from `value` when it is a boolean, else the default.
function pickBooleans<T extends Record<string, boolean>>(value: unknown, defaults: T): T {
  const source = isRecord(value) ? value : {}
  const result = { ...defaults }
  for (const key of Object.keys(defaults)) {
    if (typeof source[key] === 'boolean') (result as Record<string, boolean>)[key] = source[key]
  }
  return result
}

// Applies a patch onto the LATEST choices, merging nested objects key by key, so two quick changes to different switches
// of the same format cannot overwrite each other with a stale copy of the whole object.
export function mergeShareChoices(previous: ShareChoices, patch: ShareChoicesPatch): ShareChoices {
  const merge = (base: unknown, change: unknown): unknown => {
    if (!isRecord(base) || !isRecord(change)) return change
    const merged: Record<string, unknown> = { ...base }
    for (const key of Object.keys(change)) {
      if (change[key] !== undefined) merged[key] = merge(base[key], change[key])
    }
    return merged
  }
  return merge(previous, patch) as ShareChoices
}

// Anything that came out of storage, made into a valid ShareChoices: a value that is missing or invalid falls back to
// its default, and nothing throws.
export function sanitiseShareChoices(raw: unknown): ShareChoices {
  const d = DEFAULT_SHARE_CHOICES
  if (!isRecord(raw)) return structuredClone(d)
  const templates = isRecord(raw.templates) ? raw.templates : {}
  const include = isRecord(raw.include) ? raw.include : {}
  const sponsorIds = Array.isArray(raw.sponsorIds)
    ? [...new Set(raw.sponsorIds.filter((id): id is string => typeof id === 'string' && id !== ''))].slice(0, MAX_SHARE_SPONSORS)
    : []
  return {
    format: typeof raw.format === 'string' && (SHARE_FORMATS as string[]).includes(raw.format) ? (raw.format as ShareFormat) : null,
    templates: {
      pdf: pickEnum(templates.pdf, PDF_TEMPLATES, d.templates.pdf),
      image: pickEnum(templates.image, IMAGE_TEMPLATES, d.templates.image),
      tv: pickEnum(templates.tv, TV_TEMPLATES, d.templates.tv),
      whatsapp: pickEnum(templates.whatsapp, WHATSAPP_TEMPLATES, d.templates.whatsapp),
      facebook: pickEnum(templates.facebook, FACEBOOK_TEMPLATES, d.templates.facebook),
    },
    teams: pickEnum(raw.teams, ['both', 'ours'] as const, d.teams),
    imageSize: pickEnum(raw.imageSize, IMAGE_SIZES, d.imageSize),
    tvPerformers: raw.tvPerformers === 2 || raw.tvPerformers === 3 ? raw.tvPerformers : d.tvPerformers,
    include: {
      pdf: pickBooleans(include.pdf, d.include.pdf),
      image: pickBooleans(include.image, d.include.image),
      tv: pickBooleans(include.tv, d.include.tv),
      whatsapp: pickBooleans(include.whatsapp, d.include.whatsapp),
      facebook: pickBooleans(include.facebook, d.include.facebook),
    },
    logos: pickBooleans(raw.logos, d.logos),
    footerLine: typeof raw.footerLine === 'boolean' ? raw.footerLine : d.footerLine,
    sponsorIds,
    initialsOnly: typeof raw.initialsOnly === 'boolean' ? raw.initialsOnly : null,
  }
}
