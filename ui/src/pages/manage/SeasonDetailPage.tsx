import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { DetailFieldGrid, DetailFieldRow } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { InfoCard } from '../../components/InfoCard'
import { KeyFigureTile } from '../../components/KeyFigureTile'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { SelectionGauge } from '../../components/SelectionGauge'
import { badgeSx } from '../../components/RecordCard'
import { getSeasonsSummary, listSeasons, seasonsSummaryKey } from '../../api/seasonApi'
import {
  formatSeasonDate,
  localToday,
  seasonBadge,
  seasonLength,
  seasonProgress,
  seasonStatus,
} from '../../utils/seasonStatus'

const SEASONS_PATH = '/manage/fixtures/seasons'
const NOT_ON_FILE = '-'
const STATUS_LABELS = { current: 'Current', upcoming: 'Upcoming', past: 'Past', inactive: 'Inactive' } as const

// docs/specs/094-club-structure-and-seasons.md ("Season page"): the record detail standard (header, key-figure strip,
// equal-height InfoCards), read-only counterpart to SeasonFormPage.tsx. No single-season GET exists, so the season is found
// in the club's list as before; the Matches figure and "In this season" counts come from the seasons summary.
export default function SeasonDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { seasonId } = useParams<{ seasonId?: string }>()

  const {
    data: season,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
    select: (seasons) => seasons.find((candidate) => candidate.id === seasonId),
  })

  const summaryQuery = useQuery({
    queryKey: seasonsSummaryKey(clubId as string),
    queryFn: () => getSeasonsSummary(clubId as string),
    enabled: Boolean(clubId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !season) {
    return (
      <EmptyState
        title="Couldn't load this season"
        description="Something went wrong loading this season. Please try again."
      />
    )
  }

  const today = localToday()
  const badge = seasonBadge(season, today)
  const status = seasonStatus(season, today)
  const progress = seasonProgress(season, today)
  const summary = summaryQuery.data?.seasons.find((entry) => entry.seasonId === season.id)
  const summaryReady = Boolean(summary) && !summaryQuery.isError
  const figure = (value: number | undefined) => (summaryReady && value !== undefined ? String(value) : NOT_ON_FILE)
  const isEmpty = summaryReady && summary!.leagueCount === 0 && summary!.teamsEntered === 0 && summary!.matchCount === 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={SEASONS_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to Seasons
            </MuiButton>
            <MuiButton
              component={RouterLink}
              to={`${SEASONS_PATH}/${season.id}/edit`}
              variant="contained"
              startIcon={<EditOutlinedIcon fontSize="small" />}
            >
              Edit
            </MuiButton>
          </Box>

          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.4rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}
            >
              {season.label}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap aria-label="Season badges">
              <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} />
            </Stack>
          </Stack>
        </Stack>
      </PageHeaderBand>

      <Box
        data-testid="season-key-figures"
        sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
      >
        <KeyFigureTile testId="season-figure-starts" icon={<EventOutlinedIcon />} value={formatSeasonDate(season.startDate)} label="Starts" textValue />
        <KeyFigureTile testId="season-figure-ends" icon={<EventAvailableOutlinedIcon />} value={formatSeasonDate(season.endDate)} label="Ends" textValue />
        <KeyFigureTile testId="season-figure-length" icon={<HourglassBottomOutlinedIcon />} value={seasonLength(season)} label="Length" textValue />
        <KeyFigureTile testId="season-figure-matches" icon={<SportsCricketOutlinedIcon />} value={figure(summary?.matchCount)} label="Matches" />
      </Box>

      {progress && (
        <Box
          data-testid="season-progress"
          sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, px: { xs: 1.5, md: 2 }, py: { xs: 1.25, md: 1.75 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TodayOutlinedIcon fontSize="small" sx={{ color: 'primary.dark' }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {`Day ${progress.dayNumber} of ${progress.totalDays}`}
            </Typography>
          </Box>
          <SelectionGauge
            picked={progress.dayNumber}
            size={progress.totalDays}
            ariaLabel="Season progress"
            testIdPrefix="season-gauge"
            pickedLabel="Days gone"
            toGoLabel="To go"
            completeLabel="Final day"
          />
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        <InfoCard testId="season-dates-card" title="Dates" icon={<EventOutlinedIcon />}>
          <DetailFieldGrid>
            <DetailFieldRow icon={<LabelOutlinedIcon />} label="Label" value={season.label} />
            <DetailFieldRow icon={<EventOutlinedIcon />} label="Start date" value={formatSeasonDate(season.startDate)} />
            <DetailFieldRow icon={<EventAvailableOutlinedIcon />} label="End date" value={formatSeasonDate(season.endDate)} />
            <DetailFieldRow icon={<FlagOutlinedIcon />} label="Status" value={STATUS_LABELS[status]} />
          </DetailFieldGrid>
        </InfoCard>

        <InfoCard
          testId="season-contents-card"
          title="In this season"
          icon={<EmojiEventsOutlinedIcon />}
          actions={
            // Both pages open on their own saved filters; they do not read a season from the address.
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <MuiButton component={RouterLink} to="/manage/fixtures/leagues" variant="outlined" startIcon={<EmojiEventsOutlinedIcon fontSize="small" />}>
                View leagues
              </MuiButton>
              <MuiButton component={RouterLink} to="/manage/fixtures/matches" variant="outlined" startIcon={<SportsCricketOutlinedIcon fontSize="small" />}>
                View matches
              </MuiButton>
            </Stack>
          }
        >
          {isEmpty ? (
            <Typography variant="body2" color="text.secondary">
              Nothing entered in this season yet
            </Typography>
          ) : (
            <DetailFieldGrid>
              <DetailFieldRow icon={<EmojiEventsOutlinedIcon />} label="Leagues" value={figure(summary?.leagueCount)} />
              <DetailFieldRow icon={<GroupsOutlinedIcon />} label="Teams entered" value={figure(summary?.teamsEntered)} />
            </DetailFieldGrid>
          )}
        </InfoCard>
      </Box>
    </Box>
  )
}
