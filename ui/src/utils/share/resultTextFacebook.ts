import {
  battingFigure,
  battingInningsOf,
  bowlingFigure,
  bowlingInningsOf,
  hashtagOf,
  joinNames,
  teamsInOrder,
} from './resultTextShared'
import type { ShareBattingRow, ShareBowlingRow, ShareResultModel, ShareTeam } from './shareResultData'

// docs/specs/114-share-result.md (Text content): the Facebook result posts. Pure; no emoji, no bold. Every name comes
// from the ShareResultModel (already in the shared name form), and hashtags never carry a name. It only describes what is
// in the data.

export type FacebookResultTemplate = 'REPORT' | 'CELEBRATION' | 'BRIEF'

export const FACEBOOK_RESULT_TEMPLATES: { value: FacebookResultTemplate; label: string }[] = [
  { value: 'REPORT', label: 'Match report' },
  { value: 'CELEBRATION', label: 'Celebration' },
  { value: 'BRIEF', label: 'Brief' },
]

// Every wording threshold of the Celebration tone, in ONE place for tuning. Each list is read top down and the first row
// whose `min` the figure reaches wins. Nothing here is a fact about a match; it only decides which words describe a figure.
export const CELEBRATION_WORDING = {
  // Needs at least this many balls faced before a strike rate is described at all.
  minBallsForStrikeRate: 10,
  strikeRate: [
    { min: 150, words: 'an outstanding strike rate' },
    { min: 120, words: 'a very good strike rate' },
    { min: 90, words: 'a good strike rate' },
  ],
  battingRuns: [
    { min: 100, words: 'a magnificent century' },
    { min: 50, words: 'a fine half-century' },
  ],
  bowlingWickets: [
    { min: 5, words: 'a superb five-wicket haul' },
    { min: 3, words: 'a fine spell' },
  ],
  // A win by runs; the margin decides how it is described.
  winByRuns: [
    { min: 100, words: 'a commanding win' },
    { min: 50, words: 'a comfortable win' },
    { min: 0, words: '' },
  ],
  closeWinByRuns: 10,
  // A win by wickets; the wickets in hand decide it.
  winByWickets: [
    { min: 7, words: 'a comfortable win' },
    { min: 0, words: '' },
  ],
  closeWinByWickets: 2,
}

// A sentence ending in a name that already ends in a full stop ("M. N.") does not get a second one.
const sentence = (text: string): string => (text.endsWith('.') ? text : `${text}.`)

function describe(table: { min: number; words: string }[], value: number): string | null {
  return table.find((row) => value >= row.min)?.words || null
}

export interface FacebookResultOptions {
  template: FacebookResultTemplate
  hashtags: boolean
  // Names of the sponsors the manager chose; empty means no mention.
  sponsorNames: string[]
}

const scoreSentence = (model: ShareResultModel): string => {
  const teams = teamsInOrder(model)
  const scored = teams.filter((team) => team.scoreText)
  if (scored.length === 2 && model.battingFirst) {
    const [first, second] = model.battingFirst === 'HOME' ? [model.home, model.away] : [model.away, model.home]
    return `${first.name} posted ${first.scoreText} and ${second.name} replied with ${second.scoreText}.`
  }
  return scored.map((team) => `${team.name}: ${team.scoreText}.`).join(' ')
}

const placeLine = (model: ShareResultModel): string => {
  const where = [model.venue ? `at ${model.venue}` : '', model.dateLabel ? `on ${model.dateLabel}` : ''].filter(Boolean)
  return where.length ? `Played ${where.join(' ')}.` : ''
}

function bestOf(model: ShareResultModel, team: ShareTeam): { bat?: ShareBattingRow; ball?: ShareBowlingRow } {
  return { bat: battingInningsOf(model, team)?.topBatters[0], ball: bowlingInningsOf(model, team)?.topBowlers[0] }
}

function reportPerformers(model: ShareResultModel): string[] {
  const lines: string[] = []
  for (const team of teamsInOrder(model)) {
    const { bat, ball } = bestOf(model, team)
    const parts = [
      bat ? `${bat.name} top scored with ${battingFigure(bat)}` : '',
      ball && (ball.wickets ?? 0) > 0 ? `${ball.name} took ${bowlingFigure(ball)}` : '',
    ].filter(Boolean)
    if (parts.length) lines.push(`For ${team.name}, ${parts.join(' and ')}.`)
  }
  return lines
}

// The club's own winning side when it is a clear win for us; used only to decide the celebratory tone.
function celebratedTeam(model: ShareResultModel): ShareTeam | null {
  if (model.perspective !== 'won' || !model.winningSide) return null
  return model.winningSide === 'HOME' ? model.home : model.away
}

function celebrationParagraphs(model: ShareResultModel, team: ShareTeam): string[] {
  const table = CELEBRATION_WORDING
  const paragraphs: string[] = []

  const marginWords =
    model.marginType === 'RUNS' && model.marginValue !== null
      ? model.marginValue <= table.closeWinByRuns
        ? 'a close win'
        : describe(table.winByRuns, model.marginValue)
      : model.marginType === 'WICKETS' && model.marginValue !== null
        ? model.marginValue <= table.closeWinByWickets
          ? 'a close win'
          : describe(table.winByWickets, model.marginValue)
        : null
  const spare = model.oversRemaining ? ` with ${model.oversRemaining} overs to spare` : ''
  paragraphs.push(`Congratulations to ${team.name}! ${model.resultLine}${spare}${marginWords ? `, ${marginWords}` : ''}.`)

  const score = scoreSentence(model)
  if (score) paragraphs.push(score)

  const { bat, ball } = bestOf(model, team)
  const lines: string[] = []
  if (bat) {
    const runWords = describe(table.battingRuns, bat.runs ?? 0)
    const rateWords =
      bat.strikeRate !== null && (bat.balls ?? 0) >= table.minBallsForStrikeRate ? describe(table.strikeRate, bat.strikeRate) : null
    const extras = [runWords, rateWords ? `${rateWords} of ${Math.round(bat.strikeRate as number)}` : ''].filter(Boolean)
    lines.push(`${bat.name} top scored with ${battingFigure(bat)}${extras.length ? `, ${extras.join(' with ')}` : ''}.`)
  }
  if (ball && (ball.wickets ?? 0) > 0) {
    const words = describe(table.bowlingWickets, ball.wickets ?? 0)
    lines.push(`${ball.name} took ${bowlingFigure(ball)}${words ? `, ${words}` : ''}.`)
  }
  if (lines.length) paragraphs.push(lines.join(' '))

  if (model.playerOfTheMatch) paragraphs.push(sentence(`Player of the match: ${model.playerOfTheMatch.name}`))
  paragraphs.push('Thank you to everyone who came out to support the team.')
  return paragraphs
}

// Loss, tie, no result, a derby or a missing winner: no celebration, only what happened.
function neutralParagraphs(model: ShareResultModel): string[] {
  const paragraphs = [`Result: ${model.resultLine}.`]
  const score = scoreSentence(model)
  if (score) paragraphs.push(score)
  const performers = reportPerformers(model)
  if (performers.length) paragraphs.push(performers.join(' '))
  if (model.playerOfTheMatch) paragraphs.push(sentence(`Player of the match: ${model.playerOfTheMatch.name}`))
  paragraphs.push('Thank you to everyone who came out to support the teams.')
  return paragraphs
}

export function generateResultFacebookText(model: ShareResultModel, options: FacebookResultOptions): string {
  let paragraphs: string[]
  if (options.template === 'BRIEF') {
    const scores = teamsInOrder(model)
      .filter((team) => team.scoreText)
      .map((team) => `${team.name} ${team.scoreText}`)
      .join(', ')
    paragraphs = [
      [
        `${model.home.name} v ${model.away.name}: ${model.resultLine}${scores ? ` (${scores})` : ''}.`,
        model.playerOfTheMatch ? sentence(`Player of the match: ${model.playerOfTheMatch.name}`) : '',
      ]
        .filter(Boolean)
        .join(' '),
    ]
  } else if (options.template === 'CELEBRATION') {
    const team = celebratedTeam(model)
    paragraphs = team ? celebrationParagraphs(model, team) : neutralParagraphs(model)
  } else {
    paragraphs = [
      `${model.home.name} v ${model.away.name}: ${model.resultLine}.`,
      [scoreSentence(model), model.toss ? `${model.toss}.` : '', placeLine(model)].filter(Boolean).join(' '),
      ...(reportPerformers(model).length ? [reportPerformers(model).join(' ')] : []),
      ...(model.playerOfTheMatch ? [sentence(`Player of the match: ${model.playerOfTheMatch.name}`)] : []),
    ]
  }

  if (options.sponsorNames.length) {
    paragraphs.push(sentence(`Thanks to our sponsor${options.sponsorNames.length > 1 ? 's' : ''}, ${joinNames(options.sponsorNames)}`))
  }
  if (options.hashtags) {
    const tags = [hashtagOf(model.clubName), hashtagOf(model.leagueName), '#CricketLegend'].filter(Boolean)
    paragraphs.push(tags.join(' '))
  }
  return paragraphs.filter((paragraph) => paragraph.trim() !== '').join('\n\n')
}
