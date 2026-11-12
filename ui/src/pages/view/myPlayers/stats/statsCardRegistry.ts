import { sortCards } from '../../../../components/StatsCards'
import type { StatsCardDef, StatsPage } from '../../../../components/StatsCards'
import type { MyStanding, MyStatsDto, MyTeamStatsDto } from '../../../../api/meStatsApi'
import { groupsFor } from './statsCardGroups'
import { mineAvailability } from './cards/mine/availability'
import { mineBands } from './cards/mine/bands'
import { mineBowling } from './cards/mine/bowling'
import { mineDismissals } from './cards/mine/dismissals'
import { mineDiscipline } from './cards/mine/discipline'
import { mineFielding } from './cards/mine/fielding'
import { mineFires } from './cards/mine/fires'
import { mineHomeAway } from './cards/mine/homeAway'
import { mineInnings } from './cards/mine/innings'
import { mineInningsNumber } from './cards/mine/inningsNumber'
import { mineMilestone } from './cards/mine/milestone'
import { mineSeason } from './cards/mine/season'
import { mineSeasons } from './cards/mine/seasons'
import { mineWicketsHow } from './cards/mine/wicketsHow'
import { mineWicketsPosition } from './cards/mine/wicketsPosition'
import { mineBattingVenues } from './cards/mine/battingVenues'
import { mineBowlingHomeAway } from './cards/mine/bowlingHomeAway'
import { mineBowlingVenues } from './cards/mine/bowlingVenues'
import { minePositions } from './cards/mine/positions'
import { mineSumBalls } from './cards/mine/sumBalls'
import { mineSumBoundaries } from './cards/mine/sumBoundaries'
import { mineSumFielding } from './cards/mine/sumFielding'
import { mineSumLeagues } from './cards/mine/sumLeagues'
import { mineSumMatches } from './cards/mine/sumMatches'
import { mineSumOvers } from './cards/mine/sumOvers'
import { mineSumRuns } from './cards/mine/sumRuns'
import { mineSumTeams } from './cards/mine/sumTeams'
import { mineSumWickets } from './cards/mine/sumWickets'
import { boardsStanding } from './cards/boards/standing'
import { teamBattingCard } from './cards/team/battingCard'
import { teamBattingFirstChasing } from './cards/team/battingFirstChasing'
import { teamBattingVenues } from './cards/team/battingVenues'
import { teamBoundaries } from './cards/team/boundaries'
import { teamBowlingCard } from './cards/team/bowlingCard'
import { teamBowlingVenues } from './cards/team/bowlingVenues'
import { teamCatchesByFielder } from './cards/team/catchesByFielder'
import { teamCloseGames } from './cards/team/closeGames'
import { teamConcededByMatch } from './cards/team/concededByMatch'
import { teamDismissals } from './cards/team/dismissals'
import { teamExtrasGiven } from './cards/team/extrasGiven'
import { teamFielding } from './cards/team/fielding'
import { teamPositions } from './cards/team/positions'
import { teamRunsFrom } from './cards/team/runsFrom'
import { teamSquad } from './cards/team/squad'
import { teamSumExtras } from './cards/team/sumExtras'
import { teamSumHighest } from './cards/team/sumHighest'
import { teamSumMatches } from './cards/team/sumMatches'
import { teamSumNetRunRate } from './cards/team/sumNetRunRate'
import { teamSumRuns } from './cards/team/sumRuns'
import { teamSumRunsConceded } from './cards/team/sumRunsConceded'
import { teamSumWicketsLost } from './cards/team/sumWicketsLost'
import { teamSumWicketsTaken } from './cards/team/sumWicketsTaken'
import { teamSumWinRate } from './cards/team/sumWinRate'
import { teamTossHeadToHead } from './cards/team/tossHeadToHead'
import { teamTotalsByMatch } from './cards/team/totalsByMatch'
import { teamWicketTypes } from './cards/team/wicketTypes'
import { teamWicketsFrom } from './cards/team/wicketsFrom'

// docs/specs/147 section 3: THE list of cards. A card is one file under ./cards/<page>/ exporting its StatsCardDef; adding it is one import
// and one line in the array of its page below, and nothing else: the pages, StatsCardGrid, StatsCardShell, FlipCard and the endpoint are
// never edited. The pages import `cardsFor` / `placeholdersFor` from here and no individual card (a guard test pins it).
// One line per card. Order within a group is the card's own `order`, not its position here.

export interface StatsPayloads {
  mine: MyStatsDto
  team: MyTeamStatsDto
  boards: MyStanding
}

const MINE_CARDS: StatsCardDef<MyStatsDto>[] = [
  mineSumLeagues,
  mineSumTeams,
  mineSumMatches,
  mineSumRuns,
  mineSumBalls,
  mineSumBoundaries,
  mineSumOvers,
  mineSumFielding,
  mineSumWickets,
  mineSeason,
  minePositions,
  mineBattingVenues,
  mineInnings,
  mineDismissals,
  mineBands,
  mineInningsNumber,
  mineMilestone,
  mineFires,
  mineBowling,
  mineBowlingHomeAway,
  mineBowlingVenues,
  mineWicketsHow,
  mineWicketsPosition,
  mineDiscipline,
  mineFielding,
  mineAvailability,
  mineHomeAway,
  mineSeasons,
]
const TEAM_CARDS: StatsCardDef<MyTeamStatsDto>[] = [
  teamSumMatches,
  teamSumWinRate,
  teamSumNetRunRate,
  teamSumRuns,
  teamSumRunsConceded,
  teamSumWicketsTaken,
  teamSumWicketsLost,
  teamSumHighest,
  teamSumExtras,
  teamBattingCard,
  teamTotalsByMatch,
  teamDismissals,
  teamBattingFirstChasing,
  teamRunsFrom,
  teamPositions,
  teamBoundaries,
  teamBattingVenues,
  teamBowlingCard,
  teamConcededByMatch,
  teamWicketTypes,
  teamWicketsFrom,
  teamExtrasGiven,
  teamBowlingVenues,
  teamFielding,
  teamCatchesByFielder,
  teamSquad,
  teamCloseGames,
  teamTossHeadToHead,
]
const BOARD_CARDS: StatsCardDef<MyStanding>[] = [boardsStanding]

const REGISTRY: { [K in StatsPage]: StatsCardDef<StatsPayloads[K]>[] } = { mine: MINE_CARDS, team: TEAM_CARDS, boards: BOARD_CARDS }

// The flipping cards of a page in display order: by group order, then `order`. A card tagged NOT_CAPTURED is a documented placeholder,
// never a flipping card, and appears only in placeholdersFor. A card with `hidden: true` stays registered but is left off the page
// (Amendment 2 item 7: mine.fires is on hold until the owner decides).
export function cardsFor<K extends StatsPage>(page: K): StatsCardDef<StatsPayloads[K]>[] {
  return sortCards(REGISTRY[page], page, groupsFor(page)).filter((card) => card.tag !== 'NOT_CAPTURED' && !card.hidden)
}

// The NOT_CAPTURED placeholders (the page panel is gone, Amendment 2 item 11; see docs/stats-not-captured.md).
export function placeholdersFor<K extends StatsPage>(page: K): StatsCardDef<StatsPayloads[K]>[] {
  return sortCards(REGISTRY[page], page, groupsFor(page)).filter((card) => card.tag === 'NOT_CAPTURED')
}

// Every registered card of every page, for the guard tests (unique ids and orders, needs paths, copy).
export function allCards(): StatsCardDef<unknown>[] {
  return [...MINE_CARDS, ...TEAM_CARDS, ...BOARD_CARDS] as unknown as StatsCardDef<unknown>[]
}
