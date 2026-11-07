import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, Chips, Note, Tiles } from '../../cardParts'
import { DASH, dayText, formatDecimal, formatPercent, formatSigned } from '../../statsFormat'
import { RESULT_LETTER, RESULT_WORD, resultTone } from '../../teamKit'

// docs/specs/147 section 5, team.season: the team's record. Front: won of played with the win percentage, net run rate, run rate and the
// highest total. Back: the last five results (each a link to its Result page) and the biggest wins. Source: record, form, netRunRate,
// batting, chasing.
export const teamSeason: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.season',
  page: 'team',
  group: 'record',
  title: (ctx) => (ctx.teamName ? `${ctx.teamName} season` : 'Team season card'),
  tag: 'HAVE',
  needs: ['record', 'form', 'netRunRate', 'batting', 'chasing', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No results yet.',
  state: (p) => {
    if (p.record.played === 0) return 'empty'
    return p.batting.coverage.inningsUsable < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Run rate and highest total are from ${p.batting.coverage.inningsUsable} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName} won ${p.record.won} of ${p.record.played} matches.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={`${p.record.won} / ${p.record.played}`} caption={p.record.winPercent === null ? 'won' : `won · ${formatPercent(p.record.winPercent, 0)}`} />
      <Tiles
        items={[
          { key: 'nrr', label: 'NRR', value: p.netRunRate.status === 'SHOWN' ? formatSigned(p.netRunRate.value) : DASH },
          { key: 'rr', label: 'Run rate', value: formatDecimal(p.batting.runRate, 2) },
          { key: 'high', label: 'High', value: p.batting.highestTotal ? String(p.batting.highestTotal.runs) : DASH },
        ]}
      />
      <Note>
        Lost {p.record.lost}, tied {p.record.tied}, drawn {p.record.drawn}, no result {p.record.noResult}.
      </Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const byRuns = p.chasing.largestVictoryByRuns
    const byWickets = p.chasing.largestVictoryByWickets
    const nrrNote =
      p.netRunRate.status === 'SHOWN'
        ? `Net run rate is from ${p.netRunRate.matchesUsed} of ${p.netRunRate.matchesCounted} matches.`
        : p.netRunRate.status === 'NOT_ONE_COMPETITION'
          ? 'Net run rate needs a single league or friendlies to be chosen.'
          : 'Net run rate needs results with both innings recorded.'
    return (
      <>
        <Cap>Last {Math.min(5, p.form.length)} results, newest first</Cap>
        <Chips
          items={p.form.slice(0, 5).map((entry, index) => ({
            key: `${entry.matchId}-${index}`,
            text: RESULT_LETTER[entry.result],
            tone: resultTone(entry.result),
            href: ctx.resultHref(entry.matchId),
            name: `${p.teamName} ${RESULT_WORD[entry.result]}${entry.forfeit ? ' by forfeit' : ''}${entry.opponentName ? ` against ${entry.opponentName}` : ''}, ${dayText(entry.matchDate)}. Open the match.`,
          }))}
        />
        {byRuns && <Note>Biggest win by runs: {byRuns.margin}{byRuns.opponentName ? ` against ${byRuns.opponentName}` : ''}.</Note>}
        {byWickets && <Note>Biggest win by wickets: {byWickets.margin}{byWickets.opponentName ? ` against ${byWickets.opponentName}` : ''}.</Note>}
        {p.chasing.highestSuccessfulChase && <Note>Highest successful chase: {p.chasing.highestSuccessfulChase.runs}.</Note>}
        <Note>{nrrNote}</Note>
      </>
    )
  },
}
