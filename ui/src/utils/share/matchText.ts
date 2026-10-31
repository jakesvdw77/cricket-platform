import { hashtagOf, stripEmoji } from './resultTextShared'
import type { MatchShareLineup, MatchShareModel, MatchSharePlayer } from './shareMatchData'
import type { MatchFacebookTemplate, MatchWhatsAppTemplate } from './matchShareFormats'
import type { PlayingRole } from '../../api/matchSideApi'

// docs/specs/131-match-sharing.md (Control strips): the WhatsApp and Facebook texts of a match, built from the one
// MatchShareModel (names already in the shared form). Pure text; no React. WhatsApp bold is *...*.

export const WHATSAPP_MATCH_TEMPLATES: { value: MatchWhatsAppTemplate; label: string }[] = [
  { value: 'SHORT', label: 'Short' },
  { value: 'WITH_FACTS', label: 'With Facts' },
]
export const FACEBOOK_MATCH_TEMPLATES: { value: MatchFacebookTemplate; label: string }[] = [
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'COUNTDOWN', label: 'Countdown' },
  { value: 'BRIEF', label: 'Brief' },
]

export interface MatchTextOptions {
  emoji: boolean
  // Include the forecast line (only when the model has one).
  weather: boolean
  hashtags?: boolean
  mentionSponsor?: string | null
}

const ROLE_EMOJI: Record<PlayingRole, string> = { BATSMAN: '🏏', BOWLER: '🔴', ALL_ROUNDER: '🏏🔴' }

const bold = (text: string): string => `*${text}*`

function detailLines(model: MatchShareModel, options: MatchTextOptions, withVenue = true): string[] {
  const lines: string[] = []
  const where = [withVenue ? model.venue : null].filter(Boolean)
  lines.push([model.whenLabel, ...where].filter(Boolean).join(' · '))
  const competition = [model.leagueName, model.seasonLabel].filter(Boolean).join(' · ')
  if (competition) lines.push(competition)
  if (options.weather && model.weather) lines.push(`Forecast: ${model.weather.text}`)
  return lines
}

function lineupLines(lineup: MatchShareLineup, options: MatchTextOptions, heading: boolean): string[] {
  const lines: string[] = []
  if (heading) lines.push(bold(`${lineup.teamName} Playing XI`))
  let position = 0
  lineup.players.forEach((player: MatchSharePlayer) => {
    const marks = `${player.captain ? ' (C)' : ''}${player.keeper ? ' (WK)' : ''}`
    const number = player.order != null ? `${(position += 1)}. ` : ''
    const emoji = options.emoji ? `${ROLE_EMOJI[player.role]}${player.keeper ? '🧤' : ''} ` : ''
    lines.push(`${emoji}${number}${player.name}${marks}`)
  })
  if (lineup.players.length === 0) lines.push('Team not yet announced')
  if (lineup.twelfthMan) lines.push(`12th man: ${lineup.twelfthMan}`)
  return lines
}

function bodyOf(model: MatchShareModel, options: MatchTextOptions, withFacts: boolean, headingTeams = true): string[][] {
  const blocks: string[][] = []
  switch (model.content) {
    case 'COUNTDOWN':
      blocks.push([bold(model.countdown ?? model.whenLabel), bold(`${model.homeName} v ${model.awayName}`), ...detailLines(model, options)])
      break
    case 'FIXTURE':
      blocks.push([bold(`${model.homeName} v ${model.awayName}`), ...detailLines(model, options)])
      break
    case 'FUN_FACTS':
      blocks.push([bold(`${model.homeName} v ${model.awayName}`), ...detailLines(model, options, false)])
      blocks.push(model.facts.length > 0 ? model.facts.map((fact) => `- ${fact.text}`) : ['No facts to share yet'])
      break
    case 'TEAM_SELECTION':
    case 'TEAM_SHEET':
      blocks.push([bold(`${model.homeName} v ${model.awayName}`), ...detailLines(model, options)])
      model.lineups.forEach((lineup) => blocks.push(lineupLines(lineup, options, headingTeams)))
      break
  }
  if (withFacts && model.content !== 'FUN_FACTS' && model.facts.length > 0) blocks.push(model.facts.map((fact) => `- ${fact.text}`))
  return blocks
}

const withEmoji = (text: string, options: MatchTextOptions): string => (options.emoji ? text : stripEmoji(text).trim())

export function generateMatchWhatsAppText(model: MatchShareModel, template: MatchWhatsAppTemplate, options: MatchTextOptions): string {
  const blocks = bodyOf(model, options, template === 'WITH_FACTS')
  if (options.emoji && blocks[0]) blocks[0][0] = `🏏 ${blocks[0][0]}`
  return withEmoji(blocks.map((block) => block.join('\n')).join('\n\n'), options)
}

export function generateMatchFacebookText(model: MatchShareModel, template: MatchFacebookTemplate, options: MatchTextOptions): string {
  const lead: string[] = []
  if (template === 'COUNTDOWN' && model.countdown) lead.push(`${model.countdown}!`)
  const blocks = bodyOf(model, options, template === 'ANNOUNCEMENT', true)
  if (template === 'BRIEF') {
    const brief = [`${model.homeName} v ${model.awayName}`, ...detailLines(model, options)].join('\n')
    return finish([brief], options, model)
  }
  if (lead.length > 0) blocks.unshift(lead)
  return finish(blocks.map((block) => block.join('\n')), options, model)
}

function finish(parts: string[], options: MatchTextOptions, model: MatchShareModel): string {
  const extra: string[] = []
  if (options.mentionSponsor) extra.push(`Proudly sponsored by ${options.mentionSponsor}`)
  if (options.hashtags) {
    // Team and league names only, never a player name.
    const tags = [hashtagOf(model.homeName), hashtagOf(model.awayName), hashtagOf(model.leagueName), '#cricket'].filter((tag): tag is string => Boolean(tag))
    extra.push([...new Set(tags)].join(' '))
  }
  return withEmoji([...parts, ...extra].join('\n\n'), options)
}
