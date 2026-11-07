import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note } from '../../cardParts'
import { batterDismissalColour } from '../../dismissalColours'
import { NOT_RECORDED, formatPercent, nOfM } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.dismissals: how the team's batters get out (a donut in the Player Stats dismissal colours). Back: the
// types as a table with the not outs. Source: dismissals.
export const teamDismissals: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.dismissals',
  page: 'team',
  group: 'batting',
  title: (ctx) => `How ${ctx.teamName ?? 'The Team'} Gets Out`,
  tag: 'PARTLY',
  needs: ['dismissals', 'basis'],
  order: 30,
  whenMissing: 'notCaptured',
  emptyText: 'No wickets lost yet.',
  missingText: 'The way batters got out is not recorded for these results.',
  basis: (p) => ({ counted: p.dismissals.coverage.recorded, total: p.dismissals.coverage.counted }),
  state: (p) => {
    if (p.dismissals.wickets === 0) return p.dismissals.coverage.recorded === 0 && p.dismissals.coverage.counted > 0 ? 'missing' : 'empty'
    if (p.dismissals.types.length === 0) return 'missing'
    return p.dismissals.notRecorded > 0 || p.dismissals.coverage.recorded < p.dismissals.coverage.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `The way out is recorded for ${nOfM(p.dismissals.wickets - p.dismissals.notRecorded, p.dismissals.wickets)} wickets.`,
  summary: (p) => `How ${p.teamName}'s batters were out over ${p.dismissals.wickets} wickets: ${p.dismissals.types.map((slice) => `${slice.label} ${slice.count}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const slices = [
      ...p.dismissals.types.map((slice) => ({ key: slice.type, label: slice.label, value: slice.count, colour: batterDismissalColour(slice.type) })),
      ...(p.dismissals.notRecorded > 0 ? [{ key: 'not-recorded', label: NOT_RECORDED, value: p.dismissals.notRecorded, colour: STATS_COLOUR.neutralGrey }] : []),
    ]
    return (
      <>
        <Donut
          alt={`How ${p.teamName}'s batters were out: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(', ')}.`}
          centre={String(p.dismissals.wickets)}
          centreCaption="wickets"
          slices={slices}
        />
        <Note>{p.dismissals.notOut} {p.dismissals.notOut === 1 ? 'batter' : 'batters'} finished not out.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>How the batters were out</Cap>
      <FaceTable
        label="Dismissal types with counts and shares"
        heads={['How', 'Wickets', 'Share']}
        rows={[
          ...p.dismissals.types.map((slice) => ({ key: slice.type, cells: [slice.label, String(slice.count), formatPercent(slice.percent, 0)] })),
          ...(p.dismissals.notRecorded > 0 ? [{ key: 'not-recorded', cells: [NOT_RECORDED, String(p.dismissals.notRecorded), '–'] }] : []),
          { key: 'not-out', cells: ['Not out', String(p.dismissals.notOut), '–'] },
        ]}
      />
      <Note>Shares are of all batters, not outs included. Recorded for {nOfM(p.dismissals.coverage.recorded, p.dismissals.coverage.counted)} innings.</Note>
    </>
  ),
}
