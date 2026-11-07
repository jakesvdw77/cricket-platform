import type { StatsGroupDef, StatsPage } from '../../../../components/StatsCards'

// docs/specs/147 section 3: the group order per page. A group is a headed section on a tablet or desktop and one pill on a phone; a group
// with no card to show has neither. A new group is the one other permitted edit (beside the registry) when a card family needs one.
export const STATS_GROUPS: Record<StatsPage, StatsGroupDef[]> = {
  mine: [
    { id: 'batting', label: 'Batting' },
    { id: 'bowling', label: 'Bowling' },
    { id: 'fielding', label: 'Fielding' },
    { id: 'teammate', label: 'Teammate' },
  ],
  team: [
    { id: 'record', label: 'Record' },
    { id: 'contribution', label: 'Contribution' },
    { id: 'matchups', label: 'Matchups' },
    { id: 'squad', label: 'Squad' },
  ],
  boards: [{ id: 'standing', label: 'Standing' }],
}

export const groupsFor = (page: StatsPage): StatsGroupDef[] => STATS_GROUPS[page]
