import { leagueTextSections } from './leagueTextShared'
import type { LeagueWhatsAppTemplate } from './leagueShareFormats'
import type { LeagueShareModel } from './shareLeagueData'
import { stripEmoji } from './resultTextShared'

// docs/specs/122-league-sharing.md (Text content): the WhatsApp league message, one section per ticked content in the
// standard order. Pure; WhatsApp bold is *...*. Mirrors resultTextWhatsApp.ts.

export const WHATSAPP_LEAGUE_TEMPLATES: { value: LeagueWhatsAppTemplate; label: string }[] = [
  { value: 'SHORT', label: 'Short' },
  { value: 'FULL', label: 'Full' },
]

export interface WhatsAppLeagueOptions {
  template: LeagueWhatsAppTemplate
  // Off removes every emoji from the text.
  emoji: boolean
  resultLine: boolean
}

// Short lists show this many rows per section.
export const SHORT_LIST_LIMIT = 5

export function generateLeagueWhatsAppText(model: LeagueShareModel, options: WhatsAppLeagueOptions): string {
  const header = [`🏏 *${model.league.name}*`]
  if (model.season) header.push(model.season.label)
  const blocks: string[][] = [header]
  const sections = leagueTextSections(model, {
    resultLine: options.resultLine,
    limit: options.template === 'SHORT' ? SHORT_LIST_LIMIT : undefined,
  })
  for (const section of sections) {
    blocks.push([`*${section.heading}*`, ...section.lines])
  }
  const text = blocks.map((lines) => lines.join('\n')).join('\n\n')
  return options.emoji ? text : stripEmoji(text)
}
