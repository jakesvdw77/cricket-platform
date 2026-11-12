import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { BOWLER_WICKET_COLOUR, bowlerWicketColour } from '../../dismissalColours'
import { formatPercent, nOfM, need } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.wicket-types: how the team's bowlers take wickets (a donut in the Player Stats wicket colours: every type
// is good for a bowler). Back: the types as a table. Source: wicketTypes.
export const teamWicketTypes: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.wicket-types',
  page: 'team',
  group: 'bowling',
  title: (ctx) => `How ${ctx.teamName ?? 'The Team'} Takes Wickets`,
  tag: 'PARTLY',
  needs: ['wicketTypes', 'basis'],
  order: 30,
  whenMissing: 'notCaptured',
  emptyText: 'No wickets taken yet.',
  missingText: 'The way wickets fell is not recorded for these results.',
  basis: (p) => ({ counted: need(p.wicketTypes).coverage.recorded, total: need(p.wicketTypes).coverage.counted }),
  state: (p) => {
    if (!p.wicketTypes) return 'missing'
    if (p.wicketTypes.total === 0) return 'empty'
    if (p.wicketTypes.types.length === 0) return 'missing'
    return p.wicketTypes.notItemised > 0 || p.wicketTypes.coverage.recorded < p.wicketTypes.coverage.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `The way out is itemised for ${nOfM(need(p.wicketTypes).total - need(p.wicketTypes).notItemised, need(p.wicketTypes).total)} wickets.`,
  summary: (p) => `How ${p.teamName}'s bowlers took ${need(p.wicketTypes).total} wickets: ${need(p.wicketTypes).types.map((slice) => `${slice.label} ${slice.count}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const slices = [
      ...need(p.wicketTypes).types.map((slice) => ({ key: slice.type, label: slice.label, value: slice.count, colour: bowlerWicketColour(slice.type) })),
      ...(need(p.wicketTypes).notItemised > 0 ? [{ key: 'not-itemised', label: 'Not itemised', value: need(p.wicketTypes).notItemised, colour: BOWLER_WICKET_COLOUR.NOT_ITEMISED }] : []),
    ]
    return (
      <Donut
        alt={`How ${p.teamName}'s bowlers took wickets: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(', ')}.`}
        centre={String(need(p.wicketTypes).total)}
        centreCaption="wickets"
        slices={slices}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>How the wickets fell</Cap>
      <FaceTable
        label="Wicket types with counts and shares"
        heads={['How', 'Wickets', 'Share']}
        rows={[
          ...need(p.wicketTypes).types.map((slice) => ({ key: slice.type, cells: [slice.label, String(slice.count), formatPercent(slice.percent, 0)] })),
          ...(need(p.wicketTypes).notItemised > 0 ? [{ key: 'not-itemised', cells: ['Not itemised', String(need(p.wicketTypes).notItemised), '–'] }] : []),
        ]}
      />
      <Note>Itemised for {nOfM(need(p.wicketTypes).coverage.recorded, need(p.wicketTypes).coverage.counted)} innings.</Note>
    </>
  ),
}
