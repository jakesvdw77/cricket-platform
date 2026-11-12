import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'
import { DASH, formatDecimal, formatSigned } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.sum-nrr: net run rate. Front: the figure with the run rate scored against the run rate conceded (a
// two-category comparison: green and blue). Back: the rule and the matches it is worked out from. Source: netRunRate, batting, bowling.
const reason = (p: MyTeamStatsDto): string =>
  p.netRunRate.status === 'NOT_ONE_COMPETITION'
    ? 'Net run rate needs a single league or friendlies to be chosen.'
    : 'Net run rate needs results with both innings recorded.'

export const teamSumNetRunRate: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-nrr',
  page: 'team',
  group: 'summary',
  title: () => 'Net Run Rate',
  tag: 'PARTLY',
  needs: ['netRunRate', 'batting', 'bowling', 'basis'],
  order: 30,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  basis: (p) => ({ counted: p.netRunRate.matchesUsed, total: p.netRunRate.matchesCounted }),
  state: (p) => (p.netRunRate.matchesCounted === 0 ? 'empty' : p.netRunRate.status === 'SHOWN' ? 'ready' : 'partial'),
  partialNote: (p) => reason(p),
  summary: (p) => `${p.teamName}'s net run rate is ${p.netRunRate.status === 'SHOWN' ? formatSigned(p.netRunRate.value) : 'not available'}.`,
  Front: ({ payload: p }) => (
    <BigBars
      value={p.netRunRate.status === 'SHOWN' ? formatSigned(p.netRunRate.value) : DASH}
      caption="net run rate"
      total={2}
      legend={['Scored', 'Conceded']}
      alt={`${p.teamName}'s run rate ${formatDecimal(p.batting.runRate, 2)} scored and ${formatDecimal(p.bowling.economy, 2)} conceded.`}
      rows={[
        { key: 'scored', label: 'Scored', tone: 'compare', seriesIndex: 0, value: p.batting.runRate ?? 0, valueLabel: formatDecimal(p.batting.runRate, 2) },
        { key: 'conceded', label: 'Conceded', tone: 'compare', seriesIndex: 1, value: p.bowling.economy ?? 0, valueLabel: formatDecimal(p.bowling.economy, 2) },
      ]}
    />
  ),
  Back: ({ payload: p }) => (
    <>
      <Cap>Net run rate</Cap>
      <FaceTable
        label="Net run rate and the run rates behind it"
        heads={['Figure', 'Value']}
        rows={[
          { key: 'nrr', cells: ['Net run rate', p.netRunRate.status === 'SHOWN' ? formatSigned(p.netRunRate.value) : DASH] },
          { key: 'scored', cells: ['Run rate scored', formatDecimal(p.batting.runRate, 2)] },
          { key: 'conceded', cells: ['Run rate conceded', formatDecimal(p.bowling.economy, 2)] },
          { key: 'matches', cells: ['Matches used', `${p.netRunRate.matchesUsed} of ${p.netRunRate.matchesCounted}`] },
        ]}
      />
      {p.netRunRate.status !== 'SHOWN' ? <Note>{reason(p)}</Note> : <Note>{p.netRunRate.rule}</Note>}
    </>
  ),
}
