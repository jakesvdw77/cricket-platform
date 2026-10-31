import { Box, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { useLocation } from 'react-router-dom'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { CardProgressBar } from '../../../components/CardProgressBar'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { RecordCard } from '../../../components/RecordCard'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { SeasonRowMenu } from './SeasonRowMenu'
import type { Season, SeasonSummary } from '../../../api/seasonApi'
import { formatSeasonRange, localToday, seasonBadge, seasonLength, seasonProgress, seasonTimeStrip } from '../../../utils/seasonStatus'

export interface SeasonCardProps {
  season: Season
  // The figures of this season, or null while they load or when the summary failed (each tile then shows "-").
  summary: SeasonSummary | null
  // Today as a local YYYY-MM-DD string; injectable for tests and stories.
  today?: string
}

const NOT_ON_FILE = '-'

function FigureTile({ testId, label, value }: { testId: string; label: string; value: number | null }) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 0,
        py: 1,
        px: 0.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.06),
      }}
    >
      <Typography variant="h6" component="span" fontWeight={700} sx={{ lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
        {value === null ? NOT_ON_FILE : value}
      </Typography>
      <Typography variant="caption" component="span" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>
        {label}
      </Typography>
    </Box>
  )
}

// docs/specs/094-club-structure-and-seasons.md (B): one RecordCard per season, built like the league and team cards - a
// calendar tile, the label and ONE status badge (Current, Upcoming, Past or Inactive), the written date range and length,
// a time strip ("Ends in 41 days", amber within 7 days of a start or an end), a "Day n of m" bar for the current season,
// Leagues / Teams / Matches figures and one Actions kebab in the corner (no footer bar). Every card has the same parts and the same height:
// outside the current season the progress row shows a muted "-". The whole card opens the season.
export function SeasonCard({ season, summary, today = localToday() }: SeasonCardProps) {
  const location = useLocation()
  const base = `/manage/fixtures/seasons/${season.id}`
  const strip = seasonTimeStrip(season, today)
  const progress = seasonProgress(season, today)

  return (
    <RecordCard
      flat
      title={season.label}
      titleWrap
      badgesBelow
      avatar={{ fallback: <CalendarMonthOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badges={[seasonBadge(season, today)]}
      headerActions={<SeasonRowMenu season={season} testId="season-card-actions" />}
      viewTo={withReturnTo(base, currentOrigin(location), 'Seasons')}
      // No footer action bar (page-anatomy section 6): the kebab in the corner holds every action.
      footerActions={null}
    >
      <Typography variant="body2" data-testid="season-dates" sx={{ fontWeight: 600 }}>
        {formatSeasonRange(season)}
        <Typography component="span" variant="body2" color="text.secondary">
          {` · ${seasonLength(season)}`}
        </Typography>
      </Typography>

      <CardTimeStrip
        testId="season-time-strip"
        tone={strip.tone}
        icon={<EventOutlinedIcon fontSize="small" />}
        label={strip.label}
        value={strip.value}
      />

      <Stack spacing={0.75} data-testid="season-progress">
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
          <Typography variant="body2" component="h4" fontWeight={700}>
            Progress
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress ? `Day ${progress.dayNumber} of ${progress.totalDays}` : NOT_ON_FILE}
          </Typography>
        </Stack>
        {progress ? (
          <CardProgressBar
            value={progress.dayNumber}
            max={progress.totalDays}
            ariaLabel="Season progress"
            valueText={`Day ${progress.dayNumber} of ${progress.totalDays}`}
          />
        ) : (
          // The same 10 px track, faded and hidden from assistive tech, so the card keeps its height.
          <Box aria-hidden sx={{ opacity: 0.35 }}>
            <CardProgressBar value={0} max={0} ariaLabel="Season progress" valueText="Not in progress" />
          </Box>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
        <FigureTile testId="season-leagues" label="Leagues" value={summary ? summary.leagueCount : null} />
        <FigureTile testId="season-teams" label="Teams" value={summary ? summary.teamsEntered : null} />
        <FigureTile testId="season-matches" label="Matches" value={summary ? summary.matchCount : null} />
      </Box>
    </RecordCard>
  )
}
