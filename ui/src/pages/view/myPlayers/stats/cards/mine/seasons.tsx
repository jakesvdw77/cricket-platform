import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Box, ToggleButton, Typography } from '@mui/material'
import { CompactToggleGroup } from '../../../../../../components/CompactToggleGroup'
import { useFaceTabIndex } from '../../../../../../components/FlipCard'
import { CardHeaderControls, STATS_TYPE, STATS_UI, fluid, useExpanded } from '../../../../../../components/StatsCards'
import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { formatDecimal } from '../../statsFormat'

// docs/specs/147 section 5, mine.seasons: runs in each season (the Season filter is ignored for this block; the other filters apply).
// Front: a Runs | Wickets switch in the card header (CardHeaderControls; local state, default Runs) over the chosen measure per season. Back: the seasons as a table. Source: bySeason.
const SHOWN = 8
// The front has room for three bars (a card; expanded shows every season).
const FRONT_SHOWN = 3

type Measure = 'runs' | 'wickets'

function SeasonsFront({ payload: p, ctx }: { payload: MyStatsDto; ctx: { firstName: string } }) {
  const expanded = useExpanded()
  const [measure, setMeasure] = useState<Measure>('runs')
  const tabIndex = useFaceTabIndex()
  const noBowling = p.bySeason.every((season) => season.wickets === 0)
  // A disabled Wickets option falls back to Runs.
  const active: Measure = noBowling ? 'runs' : measure
  const seasons = expanded ? p.bySeason : p.bySeason.slice(-FRONT_SHOWN)
  const earlier = p.bySeason.length - seasons.length
  // The headline is a display sum of the server's per-season counts (the payload's overall totals follow the Season filter, which this card ignores).
  const total = p.bySeason.reduce((sum, season) => sum + season[active], 0)
  const rows = seasons.map((season) => ({ key: season.seasonId, label: season.label, value: season[active], valueLabel: String(season[active]) }))
  const single = rows.length === 1 ? rows[0] : null
  return (
    <Box sx={{ display: 'grid', gap: '4px', minWidth: 0 }}>
      <CardHeaderControls>
        <Box data-flip-interactive onClick={(event: MouseEvent) => event.stopPropagation()} sx={{ display: 'flex', minWidth: 0 }}>
          <CompactToggleGroup<Measure> tone="dark" value={active} onChange={setMeasure} ariaLabel="Measure by season">
            <ToggleButton value="runs" aria-label="Runs" tabIndex={tabIndex}>Runs</ToggleButton>
            <ToggleButton value="wickets" aria-label={noBowling ? 'Wickets, no bowling yet' : 'Wickets'} title={noBowling ? 'No bowling yet' : undefined} disabled={noBowling} tabIndex={tabIndex}>Wickets</ToggleButton>
          </CompactToggleGroup>
        </Box>
      </CardHeaderControls>
      <Box sx={{ display: 'grid', gridTemplateColumns: expanded ? 'minmax(200px, 240px) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start', columnGap: '40px', rowGap: '4px', minWidth: 0 }}>
        <Big value={String(total)} caption={active === 'runs' ? 'runs' : 'wickets'} />
        {single ? (
          <Typography data-testid="stats-single-item" sx={{ fontSize: fluid(STATS_TYPE.label, STATS_TYPE.labelExpanded), lineHeight: 1.3, color: STATS_UI.muted, m: 0 }}>
            {single.label} · {single.valueLabel}
          </Typography>
        ) : (
          <HorizontalBars dense alt={`${ctx.firstName}'s ${active} by season: ${rows.map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`} rows={rows} />
        )}
      </Box>
      {earlier > 0 && <Note>+{earlier} earlier</Note>}
    </Box>
  )
}

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
  summary: (p, ctx) => `${ctx.firstName}'s runs and wickets in each of ${p.bySeason.length} seasons.`,
  Front: SeasonsFront,
  Back: ({ payload: p }) => {
    const seasons = [...p.bySeason].reverse().slice(0, SHOWN)
    return (
      <>
        <Cap>The seasons</Cap>
        <FaceTable
          label="Matches, innings, runs, average and wickets by season"
          heads={['Season', 'Matches', 'Innings', 'Runs', 'Average', 'Wickets']}
          rows={seasons.map((season) => ({
            key: season.seasonId,
            cells: [season.label, String(season.matches), String(season.innings), String(season.runs), season.average == null ? '-' : formatDecimal(season.average), String(season.wickets)],
          }))}
        />
        {p.bySeason.length > SHOWN && <Note>The latest {SHOWN} of {p.bySeason.length} seasons.</Note>}
      </>
    )
  },
}
