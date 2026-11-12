import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, Chips, Note } from '../../cardParts'
import { dayText, formatPercent } from '../../statsFormat'
import { MatchTable, ResultCell } from '../../teamParts'
import { RESULT_LETTER, RESULT_WORD, newestFirst, resultTone } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-win-rate: win percentage with the form chips (the last five results, each a link to its Result
// page). Back: the results table, newest first, with both scores. Source: record, form, series.results.
const FORM = 5

export const teamSumWinRate: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-win-rate',
  page: 'team',
  group: 'summary',
  title: () => 'Win Rate',
  tag: 'HAVE',
  needs: ['record', 'form', 'series', 'basis'],
  order: 20,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (p.record.played === 0 ? 'empty' : 'ready'),
  summary: (p) => `${p.teamName} has won ${formatPercent(p.record.winPercent, 0)} of the matches played.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big compact value={formatPercent(p.record.winPercent, 0)} caption={`won ${p.record.won} of ${p.record.played}`} />
      <Chips
        lead="Form"
        items={p.form.slice(0, FORM).map((entry, index) => ({
          key: `${entry.matchId}-${index}`,
          text: RESULT_LETTER[entry.result],
          tone: resultTone(entry.result),
          href: ctx.resultHref(entry.matchId),
          name: `${p.teamName} ${RESULT_WORD[entry.result]}${entry.forfeit ? ' by forfeit' : ''}${entry.opponentName ? ` against ${entry.opponentName}` : ''}, ${dayText(entry.matchDate)}. Open the match.`,
        }))}
      />
    </>
  ),
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Results, newest first</Cap>
      <MatchTable
        label="Results with both scores"
        heads={['Match', 'Result', 'Score']}
        points={newestFirst(p)}
        ctx={ctx}
        cells={(point) => [
          <ResultCell key="r" result={point.result} forfeit={point.forfeit} />,
          point.ownRuns === null || point.oppRuns === null ? '–' : `${point.ownRuns}-${point.oppRuns}`,
        ]}
      />
      <Note>W won, L lost, T tied, D drawn, NR no result, * a forfeit. The score is {p.teamName} then the opposition.</Note>
    </>
  ),
}
