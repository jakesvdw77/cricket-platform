import type { ReactNode } from 'react'
import { Link as RouterLink, useOutletContext } from 'react-router-dom'
import { Button as CompactButton } from '../../components/Button'
import { EmptyStateLink } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PageCounters } from '../../components/PageCounters'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Card as MuiCard, Chip, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { BrandIcon } from '../../components/BrandIcon'
import type { BrandIconName } from '../../components/BrandIcon'
import { QuickActions } from '../../components/QuickActions'
import type { QuickAction } from '../../components/QuickActions'
import { CardProgressBar } from '../../components/CardProgressBar'
import { badgeSx } from '../../components/RecordCard'
import { keycloak } from '../../auth/keycloak'
import { getManagerOverview } from '../../api/overviewApi'
import type { OverviewMatch, OverviewPoll, OverviewResult } from '../../api/overviewApi'
import { groupPollResponsesPath, squadPollResponsesPath } from '../../utils/pollRoutes'

// docs/specs/079-manager-shell-and-overview.md: the /manage index - what needs the manager's
// attention now. The navigation the old tile grid carried lives in the shell's menus.

// docs/standards/page-anatomy.md section 4: a card that holds content is flat with a hairline (raised is for the figure cards only).
const cardSx = { boxShadow: 'none', border: 1, borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', gap: 1 } as const

function firstName(): string | undefined {
  const parsed = keycloak.tokenParsed as { given_name?: string; name?: string } | undefined
  const given = parsed?.given_name?.trim()
  if (given) return given
  return parsed?.name?.trim().split(/\s+/)[0] || undefined
}

function greeting(now: Date): string {
  const hour = now.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = firstName()
  return name ? `${part}, ${name}` : part
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function closeText(iso: string | null): string {
  if (!iso) return 'no close date'
  const when = new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return `closes ${when}`
}

function matchTitle(match: OverviewMatch): string {
  return `${match.homeTeamName} v ${match.awayTeamName}`
}

// The selection page for the own side that still needs picking (else the first own side); the match
// view when the fixture has no own side.
function matchLink(match: OverviewMatch): string {
  const base = `/manage/fixtures/matches/${match.matchId}`
  const side = match.ownSides.find((s) => !s.announced) ?? match.ownSides[0]
  if (!side) return base
  const tab = side.teamId === match.homeTeamId ? 'home-xi' : 'away-xi'
  return `${base}/edit?tab=${tab}`
}

function pollLink(poll: OverviewPoll): string {
  if (poll.kind === 'SQUAD' && poll.matchId) return squadPollResponsesPath(poll.matchId, poll.id)
  return groupPollResponsesPath(poll.id)
}

function sideProgress(selected: number, max: number | null): string {
  return max === null ? `${selected} selected` : `${selected} of ${max} selected`
}

function OverviewCard({
  icon,
  title,
  linkTo,
  linkLabel,
  children,
}: {
  icon: BrandIconName
  title: string
  linkTo: string
  linkLabel: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <MuiCard sx={cardSx}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BrandIcon name={icon} size={28} padding={4} />
        {/* The title takes the free width so the card's button sits at the right edge (the shared Button does not pass an auto margin through). */}
        <Typography variant="subtitle2" component="h2" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        <CompactButton size="compact" variant="secondary" onClick={() => navigate(linkTo)} sx={{ flex: 'none' }}>
          {linkLabel}
        </CompactButton>
      </Stack>
      {children}
    </MuiCard>
  )
}

function CardEmpty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <Stack spacing={0.5} alignItems="flex-start" sx={{ py: 1 }}>
      <Typography variant="body2" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {hint}
      </Typography>
      {action}
    </Stack>
  )
}

function UpcomingRow({ match, first }: { match: OverviewMatch; first: boolean }) {
  const date = new Date(match.matchDate)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
  const several = match.ownSides.length > 1
  const details = [timeOf(match.matchDate), match.venue].filter(Boolean).join(' · ')
  return (
    <Stack
      component={RouterLink}
      to={matchLink(match)}
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        py: 1.25,
        color: 'text.primary',
        textDecoration: 'none',
        borderTop: first ? 0 : 1,
        borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 46,
          flex: 'none',
          textAlign: 'center',
          borderRadius: 2,
          py: 0.5,
          fontSize: '0.68rem',
          color: 'text.secondary',
          bgcolor: `color-mix(in srgb, ${theme.palette.primary.main} 10%, ${theme.palette.background.paper})`,
        })}
      >
        {weekday}
        <Box component="b" sx={{ display: 'block', fontSize: '1.05rem', color: 'text.primary' }}>
          {date.getDate()}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
          {matchTitle(match)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {details}
        </Typography>
        {match.ownSides.map((side) => (
          <Typography key={side.teamId} variant="caption" color="text.secondary" component="div">
            {several ? `${side.teamName}: ` : ''}
            {sideProgress(side.selectedCount, side.maxSelected)}
          </Typography>
        ))}
      </Box>
      <Stack spacing={0.5} alignItems="flex-end" sx={{ flex: 'none' }}>
        {match.ownSides.map((side) => (
          <Chip
            key={side.teamId}
            size="small"
            label={side.announced ? 'Announced' : 'Pick team'}
            sx={badgeSx(side.announced ? 'positive' : 'season')}
          />
        ))}
      </Stack>
    </Stack>
  )
}

function PollRow({ poll }: { poll: OverviewPoll }) {
  return (
    <Box
      component={RouterLink}
      to={pollLink(poll)}
      sx={{ display: 'block', py: 0.75, color: 'text.primary', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}
    >
      <Typography variant="body2" fontWeight={600}>
        {poll.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {poll.repliedCount} of {poll.totalCount} replied · {closeText(poll.scheduledCloseAt)}
      </Typography>
      <CardProgressBar
        value={poll.repliedCount}
        max={poll.totalCount}
        ariaLabel={`${poll.title} replies`}
        valueText={`${poll.repliedCount} of ${poll.totalCount} replied`}
      />
    </Box>
  )
}

function ResultRow({ result, first }: { result: OverviewResult; first: boolean }) {
  return (
    <Box
      component={RouterLink}
      to={`/manage/fixtures/matches/${result.matchId}`}
      sx={{ py: 1, color: 'text.primary', textDecoration: 'none', borderTop: first ? 0 : 1, borderColor: 'divider', fontSize: '0.86rem' }}
    >
      {result.summary}
    </Box>
  )
}

export default function ManagerOverviewPage() {
  const { clubId } = useOutletContext<{ clubId?: string } | null>() ?? {}
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['managed-club', clubId, 'overview'],
    queryFn: () => getManagerOverview(clubId as string),
    enabled: Boolean(clubId),
  })

  if (!clubId) {
    return <Alert severity="warning">No club is associated with your account.</Alert>
  }
  if (isLoading) {
    return (
      <FullPageLoader label="Loading overview" />
    )
  }
  if (isError || !data) {
    return (
      <Alert
        severity="error"
        action={
          <CompactButton variant="ghost" size="compact" onClick={() => refetch()}>
            Try again
          </CompactButton>
        }
      >
        We couldn't load your overview. Please try again.
      </Alert>
    )
  }

  const now = new Date()
  const { quickActions: qa } = data
  const actions = [
    qa.createMatch && { id: 'create-match', label: 'Create New Match', to: '/manage/fixtures/matches/new', icon: 'nav/upcoming-matches' },
    qa.createPoll && { id: 'create-poll', label: 'Create New Poll', to: '/manage/availability/new', icon: 'nav/availability-polls' },
    qa.addPlayer && { id: 'add-player', label: 'Add New Player', to: '/manage/players/new', icon: 'nav/cricket-players' },
    qa.messageSquad && { id: 'message-squad', label: 'Message the squad', to: '/manage/communication', icon: 'nav/communication' },
  ].filter((action): action is QuickAction => Boolean(action))

  // An empty card carries ONE underlined link worded like the title-row action (page-anatomy section 6b).
  const actionLink = (label: string) => {
    const action = actions.find((a) => a.label === label)
    return action ? <EmptyStateLink onClick={() => navigate(action.to)}>{action.label}</EmptyStateLink> : undefined
  }

  return (
    // Bottom padding on a phone clears the speed dial and the tab bar so the last card is never covered.
    <Stack spacing={2} sx={{ pb: { xs: 12, md: 0 } }}>
      {/* The shared header: the greeting as the title, the date as the sub-header, the one Quick Actions menu on the right. */}
      <ManageScreenHeader
        title={greeting(now)}
        subtitle={now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        action={<QuickActions actions={actions} />}
      />

      {/* Compact figure cards that open the page behind each number (page-anatomy section 2). */}
      <PageCounters
        density="compact"
        items={[
          { id: 'matches-week', value: data.matchesThisWeek, label: plural(data.matchesThisWeek, 'Match This Week', 'Matches This Week'), shortLabel: 'Matches', kind: 'drill', to: '/manage/fixtures/matches' },
          {
            id: 'not-announced',
            value: data.teamsNotAnnounced,
            tone: data.teamsNotAnnounced > 0 ? 'warning' : 'default',
            label: plural(data.teamsNotAnnounced, 'Team Not Announced', 'Teams Not Announced'),
            shortLabel: 'Unannounced',
            kind: 'drill',
            to: '/manage/team-selection',
          },
          { id: 'poll-answers', value: data.pollAnswersAwaited, label: plural(data.pollAnswersAwaited, 'Poll Answer Awaited', 'Poll Answers Awaited'), shortLabel: 'Answers', kind: 'drill', to: '/manage/availability' },
          { id: 'active-players', value: data.activePlayers, label: plural(data.activePlayers, 'Active Player', 'Active Players'), shortLabel: 'Players', kind: 'drill', to: '/manage/players' },
        ]}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
        }}
      >
        <Box sx={{ gridRow: { md: '1 / span 2' }, minWidth: 0 }}>
          <OverviewCard
            icon="nav/upcoming-matches"
            title="Upcoming matches"
            linkTo="/manage/fixtures/matches"
            linkLabel="All matches"
          >
            {data.upcomingMatches.length === 0 ? (
              <CardEmpty
                title="No matches coming up"
                hint="Create your first match to start picking teams and asking for availability."
                action={actionLink('Create New Match')}
              />
            ) : (
              <Box>
                {data.upcomingMatches.map((match, index) => (
                  <UpcomingRow key={match.matchId} match={match} first={index === 0} />
                ))}
              </Box>
            )}
          </OverviewCard>
        </Box>

        <OverviewCard icon="nav/availability-polls" title="Needs an answer" linkTo="/manage/availability" linkLabel="Polls">
          {data.openPolls.length === 0 ? (
            <CardEmpty
              title="Nothing waiting on an answer"
              hint="Open an availability poll to find out who can play."
              action={actionLink('Create New Poll')}
            />
          ) : (
            <Stack spacing={1}>
              {data.openPolls.map((poll) => (
                <PollRow key={`${poll.kind}-${poll.id}`} poll={poll} />
              ))}
            </Stack>
          )}
        </OverviewCard>

        <OverviewCard icon="nav/match-results" title="Recent results" linkTo="/manage/results" linkLabel="Results">
          {data.recentResults.length === 0 ? (
            <CardEmpty title="No results yet" hint="Finished matches will appear here." />
          ) : (
            <Box>
              {data.recentResults.map((result, index) => (
                <ResultRow key={result.matchId} result={result} first={index === 0} />
              ))}
            </Box>
          )}
        </OverviewCard>
      </Box>
    </Stack>
  )
}
