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
import { teamContribution } from './cards/team/contribution'
import { teamExtras } from './cards/team/extras'
import { teamFirstChasing } from './cards/team/firstChasing'
import { teamSeason } from './cards/team/season'
import { teamSquad } from './cards/team/squad'

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
  mineSeason,
  mineInnings,
  mineDismissals,
  mineBands,
  mineInningsNumber,
  mineMilestone,
  mineFires,
  mineBowling,
  mineWicketsHow,
  mineDiscipline,
  mineFielding,
  mineAvailability,
  mineHomeAway,
  mineSeasons,
]
const TEAM_CARDS: StatsCardDef<MyTeamStatsDto>[] = [teamSeason, teamContribution, teamExtras, teamFirstChasing, teamSquad]
const BOARD_CARDS: StatsCardDef<MyStanding>[] = []

const REGISTRY: { [K in StatsPage]: StatsCardDef<StatsPayloads[K]>[] } = { mine: MINE_CARDS, team: TEAM_CARDS, boards: BOARD_CARDS }

// The flipping cards of a page in display order: by group order, then `order`. A card tagged NOT_CAPTURED is a documented placeholder,
// never a flipping card, and appears only in placeholdersFor.
export function cardsFor<K extends StatsPage>(page: K): StatsCardDef<StatsPayloads[K]>[] {
  return sortCards(REGISTRY[page], page, groupsFor(page)).filter((card) => card.tag !== 'NOT_CAPTURED')
}

// The placeholders for the page's closing "Not captured yet" panel.
export function placeholdersFor<K extends StatsPage>(page: K): StatsCardDef<StatsPayloads[K]>[] {
  return sortCards(REGISTRY[page], page, groupsFor(page)).filter((card) => card.tag === 'NOT_CAPTURED')
}

// Every registered card of every page, for the guard tests (unique ids and orders, needs paths, copy).
export function allCards(): StatsCardDef<unknown>[] {
  return [...MINE_CARDS, ...TEAM_CARDS, ...BOARD_CARDS] as unknown as StatsCardDef<unknown>[]
}
