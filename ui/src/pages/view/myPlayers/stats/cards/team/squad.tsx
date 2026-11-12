import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { formatDecimal, plural } from '../../statsFormat'
import { truncatedTeamNote } from '../../teamKit'

// docs/specs/147 Amendment 3, team.squad: squad depth and availability. Front: how many players the team used, the average number available
// from the polls and the guest games. Back: the table. Source: squad, basis.
export const teamSquad: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.squad',
  page: 'team',
  group: 'squad',
  title: () => 'Squad Depth',
  tag: 'HAVE',
  needs: ['squad', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No squad figures yet.',
  basis: (p) => ({ counted: p.squad.counted, total: p.basis.resultsCounted }),
  state: (p) => {
    if (p.squad.playersUsed === 0 && p.squad.guestAppearances === 0) return 'empty'
    return p.squad.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `The availability average is from ${p.squad.matchesWithPoll} of ${p.squad.counted} results that had a poll.`,
  summary: (p) => `${p.teamName} used ${plural(p.squad.playersUsed, 'player')}.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={String(p.squad.playersUsed)} caption="players used" />
      <Tiles
        dense
        items={[
          { key: 'avail', label: 'Avg available', value: formatDecimal(p.squad.averageAvailable, 1) },
          { key: 'guests', label: 'Guest games', value: String(p.squad.guestAppearances) },
        ]}
      />
      <Note>{p.squad.averageAvailable === null ? 'No availability polls have closed yet.' : 'Averages come from the closed polls.'}</Note>
    </>
  ),
  Back: ({ payload: p }) => (
    <>
      <Cap>Squad and availability</Cap>
      <FaceTable
        label="Players used, guest appearances and availability"
        heads={['Figure', 'Value']}
        rows={[
          { key: 'used', cells: ['Players used', String(p.squad.playersUsed)] },
          { key: 'guests', cells: ['Guest appearances', String(p.squad.guestAppearances)] },
          { key: 'avail', cells: ['Average available', formatDecimal(p.squad.averageAvailable, 1)] },
          { key: 'polls', cells: ['Results with a poll', `${p.squad.matchesWithPoll} of ${p.squad.counted}`] },
        ]}
      />
      {p.basis.truncated && <Note>{truncatedTeamNote(p)}</Note>}
    </>
  ),
}
