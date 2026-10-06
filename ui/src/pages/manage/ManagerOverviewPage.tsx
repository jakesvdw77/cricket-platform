import type { ReactNode } from 'react'
import { Link as RouterLink, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Card as MuiCard, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { BrandIcon } from '../../components/BrandIcon'
import type { BrandIconName } from '../../components/BrandIcon'
import { QuickActions } from '../../components/QuickActions'
import type { QuickAction } from '../../components/QuickActions'
import { CardProgressBar } from '../../components/CardProgressBar'
import { badgeSx } from '../../components/RecordCard'
import { keycloak } from '../../auth/keycloak'
import { getManagerOverview } from '../../api/overviewApi'
import type { OverviewMatch, OverviewPoll, OverviewResult } from '../../api/overviewApi'

// docs/specs/079-manager-shell-and-overview.md: the /manage index - what needs the manager's
// attention now. The navigation the old tile grid carried lives in the shell's menus.

const cardSx = { bgcolor: 'background.paper', boxShadow: 2, p: 2, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }

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
  if (poll.kind === 'SQUAD' && poll.matchId) return `/manage/availability/squad/${poll.matchId}/${poll.id}`
  return `/manage/availability/group/${poll.id}`
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
  return (
    <MuiCard sx={cardSx}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BrandIcon name={icon} size={28} padding={4} />
        <Typography variant="subtitle2" component="h2" fontWeight={700}>
          {title}
        </Typography>
        <Button component={RouterLink} to={linkTo} size="small" sx={{ ml: 'auto', fontWeight: 600 }}>
          {linkLabel}
        </Button>
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

function KeyFigure({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <MuiCard sx={cardSx}>
      <Typography
        component="b"
        data-testid="key-figure-value"
        sx={{
          fontSize: '1.6rem',
          fontWeight: 700,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          color: warn ? 'warning.main' : 'text.primary',
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </MuiCard>
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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading overview" />
      </Box>
    )
  }
  if (isError || !data) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        We couldn't load your overview. Please try again.
      </Alert>
    )
  }

  const now = new Date()
  const { quickActions: qa } = data
  const actions = [
    qa.createMatch && { id: 'create-match', label: 'Create match', to: '/manage/fixtures/matches/new', icon: 'nav/upcoming-matches' },
    qa.createPoll && { id: 'create-poll', label: 'Create availability poll', to: '/manage/availability/new', icon: 'nav/availability-polls' },
    qa.addPlayer && { id: 'add-player', label: 'Add player', to: '/manage/players/new', icon: 'nav/cricket-players' },
    qa.messageSquad && { id: 'message-squad', label: 'Message the squad', to: '/manage/communication', icon: 'nav/communication' },
  ].filter((action): action is QuickAction => Boolean(action))

  const actionButton = (label: string) => {
    const action = actions.find((a) => a.label === label)
    return action ? (
      <Button component={RouterLink} to={action.to} variant="outlined" size="small">
        {action.label}
      </Button>
    ) : undefined
  }

  return (
    // Bottom padding on a phone clears the speed dial and the tab bar so the last card is never covered.
    <Stack spacing={2} sx={{ pb: { xs: 12, md: 0 } }}>
      <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap={2} rowGap={0.5}>
        <Typography variant="h5" component="h1" fontWeight={700}>
          {greeting(now)}
        </Typography>
        <Stack direction="row" alignItems="center" columnGap={2} rowGap={0.5} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          <QuickActions actions={actions} />
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        <KeyFigure value={data.matchesThisWeek} label={plural(data.matchesThisWeek, 'match this week', 'matches this week')} />
        <KeyFigure
          value={data.teamsNotAnnounced}
          warn={data.teamsNotAnnounced > 0}
          label={plural(data.teamsNotAnnounced, 'team not announced', 'teams not announced')}
        />
        <KeyFigure
          value={data.pollAnswersAwaited}
          label={plural(data.pollAnswersAwaited, 'poll answer awaited', 'poll answers awaited')}
        />
        <KeyFigure value={data.activePlayers} label={plural(data.activePlayers, 'active player', 'active players')} />
      </Box>

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
                action={actionButton('Create match')}
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
              action={actionButton('Create availability poll')}
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
