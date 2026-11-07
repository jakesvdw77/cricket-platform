import { sortCards } from '../../../../components/StatsCards'
import type { StatsCardDef, StatsPage } from '../../../../components/StatsCards'
import type { MyStanding, MyStatsDto, MyTeamStatsDto } from '../../../../api/meStatsApi'
import { groupsFor } from './statsCardGroups'

// docs/specs/147 section 3: THE list of cards. A card is one file under ./cards/<page>/ exporting its StatsCardDef; adding it is one import
// and one line in the array of its page below, and nothing else: the pages, StatsCardGrid, StatsCardShell, FlipCard and the endpoint are
// never edited. The pages import `cardsFor` / `placeholdersFor` from here and no individual card (a guard test pins it).
// Slice 0 ships the lists empty; the first cards arrive with the My stats page.

export interface StatsPayloads {
  mine: MyStatsDto
  team: MyTeamStatsDto
  boards: MyStanding
}

const MINE_CARDS: StatsCardDef<MyStatsDto>[] = []
const TEAM_CARDS: StatsCardDef<MyTeamStatsDto>[] = []
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
