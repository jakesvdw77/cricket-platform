import { Alert, Box } from '@mui/material'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined'
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { FormStrip } from '../../../components/FormStrip'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { CardGrid, CountRows, NotCapturedPanel, StatTile, StatTileStrip } from './statsParts'
import { battingFormItems, coverageCaption, decimals, dismissalRows, highestScoreText, notCapturedFor, percent } from './statsFormat'

// docs/specs/103-player-stats.md, the Batting tab: four headline tiles, then Scoring, Milestones, How dismissed, Innings
// by batting position and Recent form, and the Not captured yet panel. Every figure is the server's.
export function BattingTab({ stats }: { stats: PlayerStats }) {
  const { batting, basis } = stats

  // Appearances but no batting card captured: Matches only and a plain note, never a wall of zeros.
  if (basis.resultsWithBattingCard === 0) {
    return (
      <>
        <StatTileStrip>
          <StatTile testId="tile-matches" icon={<SportsCricketOutlinedIcon />} label="Matches" value={String(basis.matchesCounted)} />
        </StatTileStrip>
        <Alert severity="info" icon={false}>
          No batting card has been captured for these results.
        </Alert>
      </>
    )
  }

  const ballsCaption = coverageCaption(batting.coverage.inningsWithBalls, batting.coverage.inningsCounted, 'that recorded balls')
  const boundaryCaption = coverageCaption(batting.coverage.inningsWithBoundaries, batting.coverage.inningsCounted, 'that recorded boundaries')
  const dismissed = dismissalRows(batting.dismissalModes).map((row) => ({ key: row.key, label: row.label, value: String(row.count) }))
  const dismissalList = batting.notOuts > 0 || dismissed.length > 0 ? [...dismissed, { key: 'NOT_OUT', label: 'Not out', value: String(batting.notOuts) }] : []

  const hasForm = stats.form.batting.length > 0

  return (
    <>
      <StatTileStrip>
        <StatTile testId="tile-runs" icon={<SportsCricketOutlinedIcon />} label="Runs" value={String(batting.runs)} />
        <StatTile testId="tile-average" icon={<TrendingUpOutlinedIcon />} label="Batting average" value={decimals(batting.average, 2)} />
        <StatTile testId="tile-strike-rate" icon={<SpeedOutlinedIcon />} label="Strike rate" value={decimals(batting.strikeRate, 2)} caption={ballsCaption} />
        <StatTile testId="tile-highest" icon={<EmojiEventsOutlinedIcon />} label="Highest score" value={highestScoreText(batting.highestScore)} />
      </StatTileStrip>

      <CardGrid>
        <InfoCard fieldSize="large"
          title="Scoring"
          icon={<BarChartOutlinedIcon />}
          fields={[
            { label: 'Matches', value: String(basis.matchesCounted) },
            { label: 'Innings', value: String(batting.innings) },
            { label: 'Not outs', value: String(batting.notOuts) },
            { label: 'Runs', value: String(batting.runs), emphasis: 'primary' },
            { label: 'Highest score', value: highestScoreText(batting.highestScore) },
            { label: 'Average', value: decimals(batting.average, 2) },
            { label: 'Balls faced', value: String(batting.ballsFaced), caption: ballsCaption },
            { label: 'Strike rate', value: decimals(batting.strikeRate, 2), caption: ballsCaption },
            { label: 'Fours', value: String(batting.fours), caption: boundaryCaption },
            { label: 'Sixes', value: String(batting.sixes), caption: boundaryCaption },
            { label: 'Boundary percentage', value: percent(batting.boundaryPercentage), caption: boundaryCaption },
            { label: 'Balls per boundary', value: decimals(batting.ballsPerBoundary, 1), caption: boundaryCaption },
          ]}
        />
        {/* Right column: Milestones at its natural height, Recent form grows to fill, so together they match Scoring's height. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ flex: hasForm ? 'none' : 1, display: 'flex', flexDirection: 'column' }}>
            <InfoCard fieldSize="large"
              title="Milestones"
              icon={<FlagOutlinedIcon />}
              fields={[
                { label: '30+ scores', value: String(batting.thirtyPlus) },
                { label: '50+ scores', value: String(batting.fiftyPlus) },
                { label: '100+ scores', value: String(batting.hundredPlus) },
                { label: 'Half-centuries (50 to 99)', value: String(batting.halfCenturies) },
                { label: 'Ducks', value: String(batting.ducks) },
                { label: 'Golden ducks', value: String(batting.goldenDucks), caption: batting.goldenDucks > 0 || batting.ducks > 0 ? 'from innings with balls' : undefined },
              ]}
            />
          </Box>
          {hasForm && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <InfoCard fieldSize="large" title="Recent form" icon={<ShowChartOutlinedIcon />} note="Last 5 innings, newest first">
                <FormStrip title="Batting, last 5 innings" items={battingFormItems(stats.form.batting)} hideTitle />
              </InfoCard>
            </Box>
          )}
        </Box>
        <InfoCard fieldSize="large" title="How dismissed" icon={<ExitToAppOutlinedIcon />}>
          <CountRows rows={dismissalList} empty="No innings yet." />
        </InfoCard>
        <InfoCard fieldSize="large" title="Innings by batting position" icon={<FormatListNumberedOutlinedIcon />}>
          <CountRows
            rows={batting.positions.map((row) => ({
              key: String(row.position),
              label: `No. ${row.position}`,
              value: `${row.innings} inns · ${row.runs} runs · avg ${decimals(row.average, 2)}`,
            }))}
            empty="No batting positions recorded."
          />
        </InfoCard>
      </CardGrid>

      <NotCapturedPanel items={notCapturedFor(stats.notCaptured, 'batting')} />
    </>
  )
}
