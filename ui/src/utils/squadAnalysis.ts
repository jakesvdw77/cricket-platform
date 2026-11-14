import type { BattingPosition, BattingStance, BowlingArm, BowlingType } from '../api/playerApi'

// docs/specs/151-server-test-round-one.md, slice B: the shape of a squad, worked out in the browser from the squad list. Pure, so
// every rule can be tested with a table of squads. A player appears in every group that applies.

export interface AnalysisPlayer {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  battingPosition?: BattingPosition | null
  isPartTimeBowler?: boolean
}

export type BowlerKind = 'MAIN' | 'PART_TIME' | 'NONE'

const PACE: BowlingType[] = ['FAST', 'FAST_MEDIUM', 'MEDIUM_FAST']
const SPIN: BowlingType[] = ['OFF_BREAK', 'LEG_BREAK', 'ORTHODOX_SPIN', 'WRIST_SPIN', 'GOOGLY']

/** Part-time wins over a recorded type; a recorded type without the part-time tick is a main bowler. */
export function bowlerKind(player: Pick<AnalysisPlayer, 'bowlingType' | 'isPartTimeBowler'>): BowlerKind {
  if (player.isPartTimeBowler) return 'PART_TIME'
  return player.bowlingType ? 'MAIN' : 'NONE'
}

export const BATTING_POSITIONS: BattingPosition[] = ['OPENER', 'TOP_ORDER', 'MIDDLE_ORDER', 'LOWER_ORDER']

export interface Gap {
  id: string
  tone: 'warning' | 'ok'
  text: string
}

export interface MissingInfo {
  name: string
  missing: string[]
}

export interface SquadAnalysis {
  size: number
  batters: string[]
  mainBowlers: string[]
  partTimeBowlers: string[]
  allRounders: string[]
  keepers: string[]
  battingOrder: Record<BattingPosition, string[]>
  battingNotSet: string[]
  bowling: { pace: string[]; medium: string[]; spin: string[]; partTime: string[] }
  hands: { rightBat: number; leftBat: number; batNotSet: number; rightArm: number; leftArm: number; armNotSet: number }
  experience: { averageAge: number | null; youngest: number | null; oldest: number | null; known: number }
  gaps: Gap[]
  missing: MissingInfo[]
}

const fullName = (player: AnalysisPlayer) => `${player.firstName} ${player.lastName}`.trim()

function ageOn(dateOfBirth: string, today: Date): number {
  const born = new Date(dateOfBirth)
  let age = today.getFullYear() - born.getFullYear()
  const birthdayPassed =
    today.getMonth() > born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate())
  if (!birthdayPassed) age -= 1
  return age
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export const FULL_SIDE = 11
export const BOWLING_OPTIONS_NEEDED = 5

export type NameOf = (player: AnalysisPlayer) => string

/**
 * `nameOf` is how a player is named in the result: the full name on the manager's own page (default), and the shared form
 * (initials for juniors, docs/specs/114) in anything that leaves the app. Sorting always uses the full name.
 */
export function analyseSquad(players: AnalysisPlayer[], today: Date = new Date(), nameOf: NameOf = fullName): SquadAnalysis {
  const byName = [...players].sort((a, b) => fullName(a).localeCompare(fullName(b)))
  const names = (list: AnalysisPlayer[]) => list.map(nameOf)

  const main = byName.filter((player) => bowlerKind(player) === 'MAIN')
  const partTime = byName.filter((player) => bowlerKind(player) === 'PART_TIME')
  const keepers = byName.filter((player) => player.isWicketKeeper)
  const allRounders = main.filter(
    (player) => player.battingPosition === 'OPENER' || player.battingPosition === 'TOP_ORDER' || player.battingPosition === 'MIDDLE_ORDER',
  )
  const batters = byName.filter((player) => bowlerKind(player) !== 'MAIN')

  const battingOrder = Object.fromEntries(
    BATTING_POSITIONS.map((position) => [position, names(byName.filter((player) => player.battingPosition === position))]),
  ) as Record<BattingPosition, string[]>
  const notSet = byName.filter((player) => !player.battingPosition)

  const mainByGroup = (types: BowlingType[]) => main.filter((player) => player.bowlingType && types.includes(player.bowlingType))
  const pace = mainByGroup(PACE)
  const spin = mainByGroup(SPIN)
  const medium = mainByGroup(['MEDIUM'])

  const bowlers = [...main, ...partTime]
  const hands = {
    rightBat: byName.filter((player) => player.battingStance === 'RIGHT_HANDED').length,
    leftBat: byName.filter((player) => player.battingStance === 'LEFT_HANDED').length,
    batNotSet: byName.filter((player) => !player.battingStance).length,
    rightArm: bowlers.filter((player) => player.bowlingArm === 'RIGHT_ARM').length,
    leftArm: bowlers.filter((player) => player.bowlingArm === 'LEFT_ARM').length,
    armNotSet: bowlers.filter((player) => !player.bowlingArm).length,
  }

  const ages = byName.filter((player) => player.dateOfBirth).map((player) => ageOn(player.dateOfBirth as string, today))
  const experience = {
    averageAge: ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null,
    youngest: ages.length > 0 ? Math.min(...ages) : null,
    oldest: ages.length > 0 ? Math.max(...ages) : null,
    known: ages.length,
  }

  const missing: MissingInfo[] = byName
    .map((player) => ({
      name: nameOf(player),
      missing: [
        !player.battingPosition ? 'batting position' : null,
        !player.battingStance ? 'batting stance' : null,
        !player.dateOfBirth ? 'date of birth' : null,
      ].filter((item): item is string => item !== null),
    }))
    .filter((entry) => entry.missing.length > 0)

  const gaps: Gap[] = []
  const warn = (id: string, text: string) => gaps.push({ id, tone: 'warning', text })
  const ok = (id: string, text: string) => gaps.push({ id, tone: 'ok', text })

  if (byName.length > 0) {
    if (keepers.length === 0) warn('keeper', 'No wicketkeeper.')
    else if (keepers.length === 1) warn('keeper', 'Only 1 wicketkeeper. Nobody else has the gloves if he is unavailable.')

    const openers = battingOrder.OPENER.length
    if (openers === 0) warn('openers', 'No opener set.')
    else if (openers === 1) warn('openers', 'Only 1 opener set.')
    else ok('openers', `${openers} openers set.`)

    const options = main.length + partTime.length
    if (options < BOWLING_OPTIONS_NEEDED) {
      warn('bowling', `Only ${plural(options, 'bowling option', 'bowling options')} (main and part-time). A side needs ${BOWLING_OPTIONS_NEEDED} to share the overs.`)
    } else {
      ok('bowling', `${options} bowling options (${main.length} main and ${partTime.length} part-time), enough to share the overs.`)
    }

    if (spin.length === 0) warn('spin', 'No spin bowler.')
    if (hands.leftBat === 0) warn('left-hand', 'No left-hand batter.')
    if (byName.length < FULL_SIDE) warn('size', `The squad has ${byName.length} players, fewer than the ${FULL_SIDE} needed.`)
    if (notSet.length > 0) {
      warn('batting-position', `${plural(notSet.length, 'player has', 'players have')} no batting position set (${names(notSet).join(', ')}).`)
    }
  }

  return {
    size: byName.length,
    batters: names(batters),
    mainBowlers: names(main),
    partTimeBowlers: names(partTime),
    allRounders: names(allRounders),
    keepers: names(keepers),
    battingOrder,
    battingNotSet: names(notSet),
    bowling: { pace: names(pace), medium: names(medium), spin: names(spin), partTime: names(partTime) },
    hands,
    experience,
    gaps,
    missing,
  }
}
