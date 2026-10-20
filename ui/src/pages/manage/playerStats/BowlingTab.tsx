import { Alert, Box, Typography } from '@mui/material'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined'
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import WhatshotOutlinedIcon from '@mui/icons-material/WhatshotOutlined'
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { FormStrip } from '../../../components/FormStrip'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { CardGrid, CountRows, NotCapturedPanel, StatTile, StatTileStrip } from './statsParts'
import { bestBowlingText, bowlingFormItems, coverageCaption, decimals, dismissalRows, notCapturedFor, oversText, percent } from './statsFormat'

function HaulCounter({ count, label, testId }: { count: number; label: string; testId: string }) {
  return (
    <Box data-testid={testId} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, textAlign: 'center', bgcolor: 'background.default' }}>
      <Typography component="div" sx={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1, color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
    </Box>
  )
}

// docs/specs/103-player-stats.md, the Bowling tab: four headline tiles, then Bowling, the three separate wicket-haul
// counters (exactly 3, exactly 4, 5 or more), Wickets by type and Recent form, and the Not captured yet panel. Overs go
// through oversFormat; with mixed over lengths Overs is a dash and Balls bowled carries the figure.
export function BowlingTab({ stats }: { stats: PlayerStats }) {
  const { bowling, basis } = stats

  if (basis.resultsWithBowlingCard === 0) {
    return (
      <>
        <StatTileStrip>
          <StatTile testId="tile-matches" icon={<SportsBaseballOutlinedIcon />} label="Matches" value={String(basis.matchesCounted)} />
        </StatTileStrip>
        <Alert severity="info" icon={false}>
          No bowling card has been captured for these results.
        </Alert>
      </>
    )
  }

  const cov = bowling.coverage
  const modes = dismissalRows(bowling.dismissalModes).map((row) => ({ key: row.key, label: row.label, value: String(row.count) }))
  const notRecorded = bowling.dismissalsNotRecorded
  const wicketRows = notRecorded > 0 ? [...modes, { key: 'notRecorded', label: 'Not recorded', value: String(notRecorded) }] : modes
  const dotsValue = cov.inningsWithDots > 0 ? `${bowling.dots}${bowling.dotBallPercentage != null ? ` · ${percent(bowling.dotBallPercentage)}` : ''}` : null

  return (
    <>
      <StatTileStrip>
        <StatTile testId="tile-wickets" icon={<SportsBaseballOutlinedIcon />} label="Wickets" value={String(bowling.wickets)} />
        <StatTile testId="tile-average" icon={<TrendingDownOutlinedIcon />} label="Bowling average" value={decimals(bowling.average, 2)} />
        <StatTile testId="tile-economy" icon={<SpeedOutlinedIcon />} label="Economy rate" value={decimals(bowling.economy, 2)} />
        <StatTile testId="tile-best" icon={<EmojiEventsOutlinedIcon />} label="Best bowling" value={bestBowlingText(bowling.best)} />
      </StatTileStrip>

      <CardGrid>
        <InfoCard fieldSize="large"
          title="Bowling"
          icon={<BarChartOutlinedIcon />}
          fields={[
            { label: 'Matches', value: String(basis.matchesCounted) },
            { label: 'Innings bowled', value: String(bowling.inningsBowled) },
            {
              label: 'Overs',
              value: oversText(bowling.ballsBowled, bowling.ballsPerOver, bowling.mixedOverLengths, bowling.inningsBowled),
              caption: bowling.mixedOverLengths ? 'Mixed over lengths' : undefined,
            },
            { label: 'Balls bowled', value: String(bowling.ballsBowled) },
            { label: 'Runs conceded', value: String(bowling.runsConceded) },
            { label: 'Wickets', value: String(bowling.wickets) },
            { label: 'Average', value: decimals(bowling.average, 2) },
            { label: 'Economy', value: decimals(bowling.economy, 2) },
            { label: 'Strike rate', value: decimals(bowling.strikeRate, 1) },
            { label: 'Best bowling', value: bestBowlingText(bowling.best) },
            { label: 'Maidens', value: String(bowling.maidens) },
            { label: 'Wides', value: String(bowling.wides), caption: coverageCaption(cov.inningsWithWides, cov.inningsCounted) },
            { label: 'No-balls', value: String(bowling.noBalls), caption: coverageCaption(cov.inningsWithNoBalls, cov.inningsCounted) },
            { label: 'Dot balls', value: dotsValue, caption: coverageCaption(cov.inningsWithDots, cov.inningsCounted) },
          ]}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
          <InfoCard fieldSize="large" title="Wicket hauls" icon={<WhatshotOutlinedIcon />}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
              <HaulCounter testId="haul-3" count={bowling.threeWicketHauls} label="3 wickets" />
              <HaulCounter testId="haul-4" count={bowling.fourWicketHauls} label="4 wickets" />
              <HaulCounter testId="haul-5" count={bowling.fiveWicketHauls} label="5 or more" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Three separate bands, so they add up: exactly 3, exactly 4, 5 or more.
            </Typography>
          </InfoCard>
          <InfoCard fieldSize="large" title="Wickets by type" icon={<ExitToAppOutlinedIcon />}>
            <CountRows rows={wicketRows} empty="No wickets yet." />
          </InfoCard>
        </Box>
      </CardGrid>

      {stats.form.bowling.length > 0 && (
        <InfoCard fieldSize="large" title="Recent form" icon={<ShowChartOutlinedIcon />} note="Last 5 spells, newest first">
          <FormStrip title="Bowling, last 5 spells" items={bowlingFormItems(stats.form.bowling)} size="comfortable" hideTitle />
        </InfoCard>
      )}

      <NotCapturedPanel items={notCapturedFor(stats.notCaptured, 'bowling')} />
    </>
  )
}
