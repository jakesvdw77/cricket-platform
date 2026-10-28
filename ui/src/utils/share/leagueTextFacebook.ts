import { leagueTextSections } from './leagueTextShared'
import type { LeagueFacebookTemplate } from './leagueShareFormats'
import { hashtagOf } from './resultTextShared'
import type { LeagueShareModel } from './shareLeagueData'

// docs/specs/122-league-sharing.md (Text content): the Facebook league post. Pure; no emoji, no bold. "Full post" has a
// section per ticked content, "Brief" one short paragraph. Names come from the LeagueShareModel only, and hashtags never
// carry a person's name.

export const FACEBOOK_LEAGUE_TEMPLATES: { value: LeagueFacebookTemplate; label: string }[] = [
  { value: 'FULL_POST', label: 'Full post' },
  { value: 'BRIEF', label: 'Brief' },
]

export interface FacebookLeagueOptions {
  template: LeagueFacebookTemplate
  hashtags: boolean
  resultLine: boolean
}

const BRIEF_LIST_LIMIT = 3

export function generateLeagueFacebookText(model: LeagueShareModel, options: FacebookLeagueOptions): string {
  const title = model.season ? `${model.league.name}, ${model.season.label}` : model.league.name
  const brief = options.template === 'BRIEF'
  const sections = leagueTextSections(model, {
    resultLine: options.resultLine,
    limit: brief ? BRIEF_LIST_LIMIT : undefined,
  })
  const blocks: string[] = [title]
  if (brief) {
    blocks.push(sections.map((section) => `${section.heading}: ${section.lines.join('; ')}.`).join(' '))
  } else {
    for (const section of sections) blocks.push([`${section.heading}`, ...section.lines].join('\n'))
  }
  if (options.hashtags) {
    const tags = [hashtagOf(model.league.name), hashtagOf(model.clubName)].filter((tag): tag is string => Boolean(tag))
    if (tags.length) blocks.push([...new Set(tags)].join(' '))
  }
  return blocks.filter(Boolean).join('\n\n')
}
