import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'
import { DASH, dayText } from '../../statsFormat'
import { matchLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-highest: the highest total. Front: the figure with the highest and lowest totals as bars. Back: the
// highest total, the lowest total and the highest successful chase with their date and opponent, each a link to its Result page.
// Source: batting.highestTotal, batting.lowestTotal, chasing.highestSuccessfulChase.
const totalText = (total: { runs: number; wickets: number }): string => `${total.runs}/${total.wickets}`

export const teamSumHighest: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-highest',
  page: 'team',
  group: 'summary',
  title: () => 'Highest Total',
  tag: 'PARTLY',
  needs: ['batting', 'chasing', 'basis'],
  order: 80,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No totals recorded yet.',
  basis: (p) => ({ counted: p.batting.coverage.inningsUsable, total: p.batting.coverage.inningsCounted }),
  state: (p) => {
    if (!p.batting.highestTotal) return 'empty'
    return p.batting.coverage.inningsUsable < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Totals are recorded in ${p.batting.coverage.inningsUsable} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => (p.batting.highestTotal ? `${p.teamName}'s highest total is ${totalText(p.batting.highestTotal)}.` : `${p.teamName} has no total recorded yet.`),
  Front: ({ payload: p }) => {
    const { highestTotal, lowestTotal } = p.batting
    const rows = [highestTotal, lowestTotal].flatMap((total, index) =>
      total ? [{ key: index === 0 ? 'high' : 'low', label: index === 0 ? 'Highest' : 'Lowest', value: total.runs, valueLabel: String(total.runs) }] : [],
    )
    return (
      <BigBars
        value={highestTotal ? String(highestTotal.runs) : DASH}
        caption={highestTotal ? `for ${highestTotal.wickets}${highestTotal.opponentName ? ` v ${highestTotal.opponentName}` : ''}` : 'highest total'}
        total={rows.length}
        alt={`${p.teamName}'s highest total ${highestTotal?.runs ?? 'not recorded'} and lowest total ${lowestTotal?.runs ?? 'not recorded'}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p, ctx }) => {
    const chase = p.chasing.highestSuccessfulChase
    const lines = [
      { key: 'high', label: 'Highest total', total: p.batting.highestTotal ? { ...p.batting.highestTotal, text: totalText(p.batting.highestTotal) } : null },
      { key: 'low', label: 'Lowest total', total: p.batting.lowestTotal ? { ...p.batting.lowestTotal, text: totalText(p.batting.lowestTotal) } : null },
      { key: 'chase', label: 'Highest chase', total: chase ? { ...chase, text: `${chase.runs} (target ${chase.target})` } : null },
    ].flatMap((line) => (line.total ? [{ ...line, total: line.total }] : []))
    return (
      <>
        <Cap>Highest and lowest totals</Cap>
        {lines.length === 0 ? (
          <Note>No totals recorded yet.</Note>
        ) : (
          <FaceTable
            label="Highest total, lowest total and highest chase"
            heads={['Total', 'Score', 'Match']}
            rows={lines.map((line) => ({
              key: line.key,
              cells: [line.label, line.total.text, `${line.total.matchDate ? dayText(line.total.matchDate) : DASH}${line.total.opponentName ? ` v ${line.total.opponentName}` : ''}`],
              href: ctx.resultHref(line.total.matchId),
              linkName: `Open the match: ${matchLabel(line.total)}`,
            }))}
          />
        )}
        <Note>Totals are shown as runs / wickets lost.</Note>
      </>
    )
  },
}
