import { Link as RouterLink, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { DetailFieldGrid, DetailFieldRow } from '../../components/RecordDetailScreen'
import { compactButtonSx } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { InfoCard } from '../../components/InfoCard'
import { ManageMenu } from '../../components/ManageMenu'
import { PageCounters } from '../../components/PageCounters'
import type { PageCounterItem } from '../../components/PageCounters'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { SelectionGauge } from '../../components/SelectionGauge'
import { badgeSx } from '../../components/RecordCard'
import { getSeasonsSummary, listSeasons, seasonsSummaryKey } from '../../api/seasonApi'
import { useBackLink } from '../../hooks/useReturnTo'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { pageTitleSx } from '../../theme'
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
  const location = useLocation()
  const back = useBackLink(SEASONS_PATH, 'Back to Seasons')
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

  // docs/specs/127: every link that leaves the page carries the page as its origin, labelled "{season} season".
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), `${season.label} season`.slice(0, 60))
  const editPath = leaveTo(`${SEASONS_PATH}/${season.id}/edit`)
  // Both lists open on their own saved filters; they do not read a season from the address.
  const leaguesPath = leaveTo('/manage/fixtures/leagues')
  const matchesPath = leaveTo('/manage/fixtures/matches')

  // docs/specs/129: ONE filled Manage Season menu (no Share: seasons have no share content).
  const manageMenu = (
    <ManageMenu
      label="Manage Season"
      testId="manage-season"
      fixedWidth
      groups={[
        {
          id: 'season',
          heading: 'Season',
          items: [
            { id: 'edit-season', title: 'Edit Season', description: 'Label, start and end dates, and status.', icon: <EditOutlinedIcon fontSize="small" />, to: editPath },
            { id: 'view-leagues', title: 'View Leagues', description: 'Open the Leagues list.', icon: <EmojiEventsOutlinedIcon fontSize="small" />, to: leaguesPath },
            { id: 'view-matches', title: 'View Matches', description: 'Open the Matches list.', icon: <EventOutlinedIcon fontSize="small" />, to: matchesPath },
          ],
        },
      ]}
    />
  )

  // Four STATIC compact counters (page-anatomy section 2): no icons, no FILTER tag, no pointer.
  const counters: PageCounterItem[] = [
    { id: 'starts', testId: 'season-figure-starts', value: formatSeasonDate(season.startDate), label: 'Starts' },
    { id: 'ends', testId: 'season-figure-ends', value: formatSeasonDate(season.endDate), label: 'Ends' },
    { id: 'length', testId: 'season-figure-length', value: seasonLength(season), label: 'Length' },
    { id: 'matches', testId: 'season-figure-matches', value: figure(summary?.matchCount), label: 'Matches' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          {/* Top row: only the quiet Back link (page-anatomy section 1). */}
          <Box data-testid="season-header-top-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={back.to ?? SEASONS_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ...compactButtonSx, ml: -1, color: 'text.secondary' }}
            >
              {back.label}
            </MuiButton>
          </Box>

          {/* Title row: the season label with its one status badge inline, then the one filled Manage Season menu. */}
          <Box data-testid="season-header-title-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.25, rowGap: 0.5, minWidth: 0, flex: '1 1 auto' }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ ...pageTitleSx, fontSize: { xs: 26, md: 32 }, lineHeight: 1.1, letterSpacing: '0.02em', textTransform: 'none', overflowWrap: 'anywhere' }}
              >
                {season.label}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap aria-label="Season badges" sx={{ flex: 'none' }}>
                <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} />
              </Stack>
            </Box>
            <Box data-testid="season-header-actions" sx={{ display: 'flex', flex: { xs: '1 1 100%', sm: 'none' }, ml: { sm: 'auto' } }}>
              {manageMenu}
            </Box>
          </Box>
        </Stack>
      </PageHeaderBand>

      <Box data-testid="season-key-figures">
        <PageCounters items={counters} density="compact" />
      </Box>

      {progress && (
        <Box
          data-testid="season-progress"
          sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider', px: { xs: 1.5, md: 2 }, py: { xs: 1.25, md: 1.75 } }}
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

      <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        <InfoCard flat testId="season-dates-card" title="Dates" icon={<EventOutlinedIcon />}>
          <DetailFieldGrid>
            <DetailFieldRow icon={<LabelOutlinedIcon />} label="Label" value={season.label} />
            <DetailFieldRow icon={<EventOutlinedIcon />} label="Start Date" value={formatSeasonDate(season.startDate)} />
            <DetailFieldRow icon={<EventAvailableOutlinedIcon />} label="End Date" value={formatSeasonDate(season.endDate)} />
            <DetailFieldRow icon={<FlagOutlinedIcon />} label="Status" value={STATUS_LABELS[status]} />
          </DetailFieldGrid>
        </InfoCard>

        <InfoCard
          flat
          testId="season-contents-card"
          title="In This Season"
          icon={<EmojiEventsOutlinedIcon />}
          actions={
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <MuiButton component={RouterLink} to={leaguesPath} variant="outlined" sx={compactButtonSx}>
                View Leagues
              </MuiButton>
              <MuiButton component={RouterLink} to={matchesPath} variant="outlined" sx={compactButtonSx}>
                View Matches
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
              <DetailFieldRow icon={<GroupsOutlinedIcon />} label="Teams Entered" value={figure(summary?.teamsEntered)} />
            </DetailFieldGrid>
          )}
        </InfoCard>
      </Box>
    </Box>
  )
}
