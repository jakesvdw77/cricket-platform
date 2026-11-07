import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto, MyStatsRecordSplit } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { DASH, formatDecimal, formatPercent, nOfM, ordinal } from '../../statsFormat'
import { allowsRankings } from '../../statsRankingPolicy'

// docs/specs/147 section 5, mine.fires: the team's record when the batter scores 30 or more, and when not (each tile opens those matches).
// Back: the record in full and, where the field is filled and rankings are allowed, where the batter stands among the league's batters in
// the league's own average column (no percentages). Source: teamRecordWhenScoring, standing.
const record = (split: MyStatsRecordSplit): string[] => [String(split.won), String(split.lost), String(split.tied + split.drawn), formatPercent(split.winPercent, 0)]

export const mineFires: StatsCardDef<MyStatsDto> = {
  id: 'mine.fires',
  page: 'mine',
  group: 'batting',
  title: (ctx) => `When ${ctx.firstName} fires, we win`,
  tag: 'HAVE',
  needs: ['teamRecordWhenScoring', 'standing', 'basis'],
  order: 70,
  whenMissing: 'hide',
  emptyText: 'Not enough matches yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    const { scored, notScored } = p.teamRecordWhenScoring
    if (scored.matches + notScored.matches === 0) return 'empty'
    return p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: truncatedNote,
  summary: (p, ctx) => {
    const { scored, threshold } = p.teamRecordWhenScoring
    return `The team won ${scored.won} of ${scored.matches} matches in which ${ctx.firstName} scored ${threshold} or more.`
  },
  Front: ({ payload: p, ctx }) => {
    const { threshold, scored, notScored, scoredFilter, notScoredFilter } = p.teamRecordWhenScoring
    return (
      <>
        <Big value={scored.matches > 0 ? `${scored.won} / ${scored.matches}` : DASH} caption={`wins when ${ctx.firstName} scores ${threshold}+`} />
        <Tiles
          min={120}
          items={[
            {
              key: 'scored',
              label: `Scored ${threshold}+`,
              value: nOfM(scored.won, scored.matches),
              href: scoredFilter && scored.matches > 0 ? ctx.drillHref({ kind: 'MATCHES', filter: scoredFilter, label: `Scored ${threshold} or more` }) : undefined,
              name: `Matches where ${ctx.firstName} scored ${threshold} or more: won ${scored.won} of ${scored.matches}`,
            },
            {
              key: 'not',
              label: 'Did not',
              value: nOfM(notScored.won, notScored.matches),
              href: notScoredFilter && notScored.matches > 0 ? ctx.drillHref({ kind: 'MATCHES', filter: notScoredFilter, label: `Did not score ${threshold}` }) : undefined,
              name: `Matches where ${ctx.firstName} did not score ${threshold}: won ${notScored.won} of ${notScored.matches}`,
            },
          ]}
        />
        <Note>The team's record in matches where {ctx.firstName} scored {threshold} or more, against the matches where not.</Note>
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const { threshold, scored, notScored } = p.teamRecordWhenScoring
    const standing = p.standing
    return (
      <>
        <Cap>The team's record</Cap>
        <FaceTable
          label={`Team record by whether ${ctx.firstName} scored ${threshold}`}
          heads={['Matches', 'Won', 'Lost', 'Tied or drawn', 'Win %']}
          rows={[
            { key: 'scored', cells: [`Scored ${threshold}+`, ...record(scored)] },
            { key: 'not', cells: [`Did not`, ...record(notScored)] },
          ]}
        />
        {standing && standing.rank !== null && allowsRankings() && (
          <Note>
            Where {ctx.firstName} stands: {ordinal(standing.rank)} of {standing.playersRanked ?? DASH} batters in the league, by batting average ({formatDecimal(standing.average)} from {standing.innings ?? DASH} innings).
          </Note>
        )}
      </>
    )
  },
}
