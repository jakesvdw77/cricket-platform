import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { fieldingBasis } from '../../cardKit'
import { DASH, formatDecimal, ordinal } from '../../statsFormat'
import { allowsRankings } from '../../statsRankingPolicy'

// docs/specs/147 section 5, mine.fielding: catches, run-outs and stumpings (a tile with a count opens those matches), per match. Back: the
// player's figures beside the team's fielding totals and, only where the field is filled and rankings are allowed, the place in the team.
// Dropped catches and direct hits are not recorded. Source: fielding, teamFielding, teamFieldingRank.
export const mineFielding: StatsCardDef<MyStatsDto> = {
  id: 'mine.fielding',
  page: 'mine',
  group: 'fielding',
  title: () => 'In the field',
  tag: 'HAVE',
  needs: ['fielding', 'teamFielding', 'teamFieldingRank', 'basis'],
  order: 10,
  whenMissing: 'notCaptured',
  emptyText: 'No fielding yet.',
  missingText: 'Fielding was not recorded for these results.',
  basis: (p) => fieldingBasis(p),
  state: (p) => {
    if (p.basis.resultsWithFieldingCard === 0) return p.basis.resultsCounted === 0 ? 'empty' : 'missing'
    return p.basis.resultsWithFieldingCard < p.basis.resultsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fielding is recorded in ${p.basis.resultsWithFieldingCard} of ${p.basis.resultsCounted} results.`,
  summary: (p, ctx) => `${ctx.firstName} has ${p.fielding.catches} catches, ${p.fielding.runOuts} run-outs and ${p.fielding.stumpings} stumpings.`,
  Front: ({ payload: p, ctx }) => {
    const { catches, runOuts, stumpings } = p.fielding
    return (
      <>
        <Tiles
          items={[
            { key: 'catches', label: 'Catches', value: String(catches), href: catches > 0 ? ctx.drillHref({ kind: 'FIELDING', filter: 'CATCHES', label: 'Catches' }) : undefined },
            { key: 'runouts', label: 'Run-outs', value: String(runOuts), href: runOuts > 0 ? ctx.drillHref({ kind: 'FIELDING', filter: 'RUN_OUTS', label: 'Run-outs' }) : undefined },
            { key: 'stumpings', label: 'Stumpings', value: String(stumpings), href: stumpings > 0 ? ctx.drillHref({ kind: 'FIELDING', filter: 'STUMPINGS', label: 'Stumpings' }) : undefined },
            { key: 'permatch', label: 'Per match', value: formatDecimal(p.fielding.dismissalsPerMatch, 1) },
          ]}
        />
        <Note>Dropped catches and direct hits are not recorded.</Note>
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const team = p.teamFielding
    return (
      <>
        <Cap>Team fielding</Cap>
        <FaceTable
          label="Fielding by the player and by the team"
          heads={['Fielding', ctx.firstName, 'Team']}
          rows={[
            { key: 'catches', cells: ['Catches', String(p.fielding.catches), team ? String(team.catches) : DASH] },
            { key: 'runouts', cells: ['Run-outs', String(p.fielding.runOuts), team ? String(team.runOuts) : DASH] },
            { key: 'stumpings', cells: ['Stumpings', String(p.fielding.stumpings), team ? String(team.stumpings) : DASH] },
          ]}
        />
        {p.teamFieldingRank !== null && allowsRankings() && <Note>{ctx.firstName} is {ordinal(p.teamFieldingRank)} for catches in the team.</Note>}
        {!team && <Note>There are no team totals for this scope (no team of the player's has results in it).</Note>}
      </>
    )
  },
}
