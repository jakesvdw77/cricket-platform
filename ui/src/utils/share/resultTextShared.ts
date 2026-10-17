import type { ShareBattingRow, ShareBowlingRow, ShareInnings, ShareResultModel, ShareTeam } from './shareResultData'

// Small helpers the WhatsApp and Facebook builders share. Pure; names come only from the ShareResultModel.

export const teamsInOrder = (model: ShareResultModel): ShareTeam[] => [model.home, model.away]

// "60 (40)", "30* (30)".
export const battingFigure = (row: ShareBattingRow): string =>
  `${row.runs ?? 0}${row.notOut ? '*' : ''}${row.balls !== null ? ` (${row.balls})` : ''}`

// "3/20 (4.0)".
export const bowlingFigure = (row: ShareBowlingRow): string =>
  `${row.wickets ?? 0}/${row.runs ?? 0}${row.overs ? ` (${row.overs})` : ''}`

// The innings in which `team` batted, and the innings in which its players bowled.
export const battingInningsOf = (model: ShareResultModel, team: ShareTeam): ShareInnings | undefined =>
  model.innings.find((innings) => innings.battingSide === team.side)
export const bowlingInningsOf = (model: ShareResultModel, team: ShareTeam): ShareInnings | undefined =>
  model.innings.find((innings) => innings.battingSide !== team.side)

export const joinNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

// "Riverside CC" -> "RiversideCC"; null when nothing is left.
export function hashtagOf(name: string | null | undefined): string | null {
  const body = (name ?? '').replace(/[^\p{L}\p{N}]+/gu, '')
  return body ? `#${body}` : null
}

// Strips every emoji (and the joiners and selectors that go with them) and tidies the spaces they leave behind.
export function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|‍|️|⃣/gu, '')
    .replace(/^ +/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/ {2,}/g, ' ')
}
