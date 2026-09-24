import { Box, Chip, Divider, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Team } from '../../api/teamApi'
import type { NextMatchCountdown as NextMatchCountdownData } from '../../utils/nextMatchCountdown'

export interface NextMatchCountdownProps {
  countdown: NextMatchCountdownData | null
  teamsById: Map<string, Team>
}

// resolveSide is unexported in LeagueFixtures.tsx, so this component needs its own small inline
// team-name resolution rather than importing a private helper from a sibling component — the same
// duplication posture leagueSchedulePdf.ts/leagueSchedulePoster.ts/leagueScheduleIcs.ts already
// establish for this feature. Only the name is needed here — no logo/avatar in the approved
// mockup for this card.
function resolveSideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

// docs/specs/051-league-schedule-sharing.md — a static (never ticking) "next match" countdown,
// rendered above LeagueFixtures on LeagueDetailPage.tsx's Fixtures section only (not
// LeagueFormPage.tsx's Schedule tab). Deliberately presentational: takes an already-resolved
// NextMatchCountdown (or null, when there's no upcoming fixture — LeagueFixtures' own EmptyState
// already covers "nothing scheduled at all", so this component renders nothing rather than a
// second empty state).
export function NextMatchCountdown({ countdown, teamsById }: NextMatchCountdownProps) {
  if (!countdown) {
    return null
  }

  const { match, label, value } = countdown
  const home = resolveSideName(match.homeTeamId, match.homeTeamName, teamsById)
  const away = resolveSideName(match.awayTeamId, match.awayTeamName, teamsById)
  const date = new Date(match.matchDate)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <Box
      sx={{
        display: 'flex',
        // Stacks to a single column at 375px (day-count block above the divider above the
        // details), per docs/standards/frontend.md — a horizontal row from `sm` up.
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 3 },
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
      }}
    >
      <Stack alignItems="center" justifyContent="center" spacing={0.25} sx={{ minWidth: { sm: 96 } }}>
        {label === 'days' ? (
          <>
            <Typography variant="h3" fontWeight={700} color="primary.dark" sx={{ lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              DAYS
            </Typography>
          </>
        ) : (
          <Chip
            label={label === 'today' ? 'Today' : 'Tomorrow'}
            color="primary"
            sx={{ fontWeight: 700, fontSize: '0.9rem', px: 1 }}
          />
        )}
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Divider sx={{ display: { xs: 'block', sm: 'none' } }} />

      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          Next match
        </Typography>
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          {home} vs {away}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {dateStr} · {timeStr}
          {match.venue ? ` · ${match.venue}` : ''}
        </Typography>
      </Stack>
    </Box>
  )
}
