import { useMemo } from 'react'
import { Avatar, Box, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import { EmptyState } from '../EmptyState'
import { initialsFromName } from '../../utils/initials'

export interface LeagueFixturesProps {
  matches: Match[]
  // Already-fetched — this component never calls listMatches/listTeamsForClub itself, per
  // docs/specs/050-league-schedule-and-fixtures.md's "deliberately presentational" requirement, so
  // a future player-facing context (fetching through a different, not-yet-built API surface
  // entirely) can reuse it unmodified.
  teamsById: Map<string, Team>
}

interface ResolvedSide {
  name: string
  logoUrl: string | null
}

// A real Team resolves its name/logo via id lookup; a free-text ("external") opponent uses its
// own name/homeTeamLogoUrl|awayTeamLogoUrl fields — same fallback posture RecordCard's own avatar
// slot already has (initialsFromName when there's no logo to show).
function resolveSide(
  teamId: string | null,
  teamName: string | null,
  logoUrl: string | null,
  teamsById: Map<string, Team>,
): ResolvedSide {
  if (teamId) {
    const team = teamsById.get(teamId)
    return { name: team?.name ?? 'Unknown team', logoUrl: team?.logoUrl ?? null }
  }
  return { name: teamName ?? 'TBC', logoUrl }
}

// e.g. "Sat, 14 Mar 2026" — the approved mockup's date-heading format.
function dateHeading(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

const AVATAR_SX: SxProps<Theme> = {
  width: { xs: 28, sm: 34 },
  height: { xs: 28, sm: 34 },
  fontSize: '0.75rem',
  fontWeight: 600,
  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
  color: 'primary.dark',
}

function FixtureAvatar({ side }: { side: ResolvedSide }) {
  return (
    <Avatar src={side.logoUrl ?? undefined} variant="rounded" sx={AVATAR_SX}>
      {initialsFromName(side.name)}
    </Avatar>
  )
}

function FixtureRow({ match, teamsById }: { match: Match; teamsById: Map<string, Team> }) {
  const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
  const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)
  const time = new Date(match.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <Box
      sx={{
        display: 'flex',
        // A three-column home / time+venue / away layout from `sm`, collapsing to a single
        // stacked column at 375px — no horizontal scroll, per docs/standards/frontend.md.
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1, sm: 2 },
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
        <FixtureAvatar side={home} />
        <Typography variant="body2" fontWeight={600} noWrap>
          {home.name}
        </Typography>
      </Stack>

      <Stack alignItems="center" sx={{ minWidth: { sm: 120 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </Typography>
        {match.venue && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {match.venue}
          </Typography>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
        sx={{ flex: 1, minWidth: 0 }}
      >
        <Typography variant="body2" fontWeight={600} noWrap>
          {away.name}
        </Typography>
        <FixtureAvatar side={away} />
      </Stack>
    </Box>
  )
}

// docs/specs/050-league-schedule-and-fixtures.md: a friendly, read-only "vs" row list, grouped by
// date — the reusable League Fixtures component, used by LeagueFormPage.tsx's Schedule tab and
// LeagueDetailPage.tsx's Fixtures section. No results/scores rendered — date, venue, teams,
// avatars only, matching this spec's own Non-goals.
export function LeagueFixtures({ matches, teamsById }: LeagueFixturesProps) {
  const groups = useMemo(() => {
    const sorted = [...matches].sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    const map = new Map<string, Match[]>()
    sorted.forEach((match) => {
      const key = dayKey(match.matchDate)
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(match)
      } else {
        map.set(key, [match])
      }
    })
    return Array.from(map.entries())
  }, [matches])

  if (matches.length === 0) {
    return <EmptyState title="No fixtures yet" description="No matches scheduled for this league and season yet." />
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {groups.map(([key, dayMatches]) => (
        <Box key={key} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {dateHeading(dayMatches[0].matchDate)}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {dayMatches.map((match) => (
              <FixtureRow key={match.id} match={match} teamsById={teamsById} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
