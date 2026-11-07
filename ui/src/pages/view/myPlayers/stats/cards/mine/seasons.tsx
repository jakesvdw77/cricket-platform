import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatDecimal } from '../../statsFormat'

// docs/specs/147 section 5, mine.seasons: runs in each season (the Season filter is ignored for this block; the other filters apply).
// Back: the seasons as a table. Source: bySeason.
const SHOWN = 8

export const mineSeasons: StatsCardDef<MyStatsDto> = {
  id: 'mine.seasons',
  page: 'mine',
  group: 'teammate',
  title: () => 'Season by season',
  tag: 'HAVE',
  needs: ['bySeason', 'basis'],
  order: 30,
  whenMissing: 'hide',
  emptyText: 'No seasons yet.',
  basis: (p) => ({ counted: p.basis.resultsCounted, total: p.basis.resultsCounted }),
  state: (p) => (p.bySeason.length === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName}'s runs in each of ${p.bySeason.length} seasons.`,
  Front: ({ payload: p, ctx }) => {
    const seasons = p.bySeason.slice(-SHOWN)
    return (
      <>
        <HorizontalBars
          alt={`${ctx.firstName}'s runs by season: ${seasons.map((season) => `${season.label} ${season.runs}`).join(', ')}.`}
          rows={seasons.map((season) => ({ key: season.seasonId, label: season.label, value: season.runs, valueLabel: String(season.runs) }))}
        />
        <Note>Runs in each season, whichever season is chosen above.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const seasons = [...p.bySeason].reverse().slice(0, SHOWN)
    return (
      <>
        <Cap>The seasons</Cap>
        <FaceTable
          label="Matches, runs, average and wickets by season"
          heads={['Season', 'Matches', 'Runs', 'Avg', 'Wkts']}
          rows={seasons.map((season) => ({ key: season.seasonId, cells: [season.label, String(season.matches), String(season.runs), formatDecimal(season.average), String(season.wickets)] }))}
        />
        {p.bySeason.length > SHOWN && <Note>The latest {SHOWN} of {p.bySeason.length} seasons.</Note>}
      </>
    )
  },
}
