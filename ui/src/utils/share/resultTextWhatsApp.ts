import {
  battingFigure,
  battingInningsOf,
  bowlingFigure,
  bowlingInningsOf,
  stripEmoji,
  teamsInOrder,
} from './resultTextShared'
import type { ShareInnings, ShareResultModel } from './shareResultData'

// docs/specs/114-share-result.md (Text content): the WhatsApp result messages. Pure; WhatsApp bold is *...*. Every
// name comes from the ShareResultModel, so it is already in the shared name form. Mirrors teamSheetWhatsAppText.ts.

export type WhatsAppResultTemplate = 'SHORT' | 'PERFORMERS' | 'SCORECARD'

export const WHATSAPP_RESULT_TEMPLATES: { value: WhatsAppResultTemplate; label: string }[] = [
  { value: 'SHORT', label: 'Short' },
  { value: 'PERFORMERS', label: 'With top performers' },
  { value: 'SCORECARD', label: 'Scorecard text' },
]

export interface WhatsAppResultOptions {
  template: WhatsAppResultTemplate
  // Off removes every emoji from the text.
  emoji: boolean
}

function headerLines(model: ShareResultModel): string[] {
  const where = [model.dateLabel, model.venue].filter(Boolean).join(' · ')
  const lines = [`🏏 *${model.home.name} v ${model.away.name}*`]
  if (where) lines.push(where)
  lines.push(`🏆 *${model.resultLine}*`)
  for (const team of teamsInOrder(model)) {
    if (team.scoreText) lines.push(`${team.name}: ${team.scoreText}`)
  }
  return lines
}

function performerLines(model: ShareResultModel): string[] {
  const lines: string[] = []
  for (const team of teamsInOrder(model)) {
    const bat = battingInningsOf(model, team)?.topBatters[0]
    const ball = bowlingInningsOf(model, team)?.topBowlers[0]
    const parts = [
      bat ? `Bat ${bat.name} ${battingFigure(bat)}` : '',
      ball ? `Ball ${ball.name} ${bowlingFigure(ball)}` : '',
    ].filter(Boolean)
    if (parts.length) lines.push(`*${team.name}*`, parts.join(' | '))
  }
  if (model.playerOfTheMatch) lines.push(`⭐ Player of the match: *${model.playerOfTheMatch.name}*`)
  return lines
}

function scorecardBlock(innings: ShareInnings): string[] {
  const lines = [`*${innings.battingTeam}${innings.scoreText ? ` ${innings.scoreText}` : ''}*`]
  const batted = innings.batting.filter((row) => !row.didNotBat)
  for (const row of batted) {
    lines.push(`${row.name} ${battingFigure(row)}${row.howOut && !row.notOut ? ` ${row.howOut}` : ''}`)
  }
  const didNotBat = innings.batting.filter((row) => row.didNotBat).map((row) => row.name)
  if (didNotBat.length) lines.push(`_Did not bat: ${didNotBat.join(', ')}_`)
  if (innings.extras) lines.push(innings.extras.text)
  if (innings.bowling.length) {
    lines.push(`_Bowling for ${innings.bowlingTeam} (O-M-R-W)_`)
    for (const row of innings.bowling) {
      lines.push(`${row.name} ${row.overs || '0.0'}-${row.maidens ?? 0}-${row.runs ?? 0}-${row.wickets ?? 0}`)
    }
  }
  return lines
}

export function generateResultWhatsAppText(model: ShareResultModel, options: WhatsAppResultOptions): string {
  const blocks: string[][] = [headerLines(model)]
  if (options.template === 'PERFORMERS') {
    const performers = performerLines(model)
    if (performers.length) blocks.push(performers)
  }
  if (options.template === 'SCORECARD') {
    if (model.toss) blocks.push([`_${model.toss}_`])
    for (const innings of model.innings) blocks.push(scorecardBlock(innings))
    if (model.playerOfTheMatch) blocks.push([`⭐ Player of the match: *${model.playerOfTheMatch.name}*`])
  }
  const text = blocks.map((lines) => lines.join('\n')).join('\n\n')
  return options.emoji ? text : stripEmoji(text)
}
