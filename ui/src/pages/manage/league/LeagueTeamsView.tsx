import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Avatar, Box, Link as MuiLink, Skeleton, Stack, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { avatarSx } from '../../../components/RecordCard'
import { Card } from '../../../components/Card'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { FilterBar } from '../../../components/FilterBar'
import { initialsFromName } from '../../../utils/initials'
import { useLeagueView } from './leagueViewContext'

type TeamScope = 'all' | 'own' | 'league'

interface TeamTileProps {
  name: string
  abbreviation: string | null
  logoUrl: string | null
  // Own teams link to the team; league teams (no detail page) do not.
  to?: string
}

// A two-across tile (docs/specs/091 C): a logo or short name, the full team name (never clipped) and what it is.
function TeamTile({ name, abbreviation, logoUrl, to }: TeamTileProps) {
  const own = Boolean(to)
  return (
    <Box
      data-testid="league-team-tile"
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        px: 1.5,
        py: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        ...(own && { '&:hover': { boxShadow: 3, borderColor: 'primary.main' } }),
      }}
    >
      <Avatar
        src={logoUrl ?? undefined}
        variant="rounded"
        sx={{
          ...avatarSx(40, '0.7rem'),
          borderRadius: 1.25,
          ...(own ? {} : { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), color: 'primary.main', border: 1, borderColor: 'divider' }),
        }}
      >
        {abbreviation || initialsFromName(name)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} component="div" sx={{ overflowWrap: 'anywhere' }}>
          {to ? (
            // Stretched link, same pattern as RecordCard (docs/specs/059).
            <MuiLink component={RouterLink} to={to} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
              {name}
            </MuiLink>
          ) : (
            name
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {own ? 'Open team ›' : 'League team'}
        </Typography>
      </Box>
    </Box>
  )
}

function TeamsCard({ title, count, testId, children }: { title: string; count: number; testId: string; children: React.ReactNode }) {
  return (
    <Card data-testid={testId} sx={{ height: '100%' }} contentSx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box
          aria-hidden
          sx={{ width: 32, height: 32, flex: 'none', borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 20 } }}
        >
          <GroupsOutlinedIcon />
        </Box>
        <Typography variant="subtitle2" component="h2" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem' }}>
          {`${title} · ${count}`}
        </Typography>
      </Stack>
      <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, alignContent: 'start' }}>{children}</Box>
    </Card>
  )
}

// docs/specs/091 (C) (replacing 072 section 5's tile cards): the Teams view, read-only - a search and an All | Our teams |
// League teams switch, then "Our teams" (the season's affiliated club teams, linked to their page) and "League teams" (the
// season's active league teams, not linked) as equal-height cards with icon-tile headings.
export default function LeagueTeamsView() {
  const { seasons, seasonLabel, teamsById, affiliationsForSeason, activeLeagueTeams, isLoadingTeams } = useLeagueView()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<TeamScope>('all')

  const term = search.trim().toLowerCase()
  const ownTeams = useMemo(
    () =>
      affiliationsForSeason.flatMap((affiliation) => {
        const team = teamsById.get(affiliation.teamId)
        return team && (!term || team.name.toLowerCase().includes(term)) ? [{ affiliationId: affiliation.id, team }] : []
      }),
    [affiliationsForSeason, teamsById, term],
  )
  const leagueTeams = useMemo(
    () => activeLeagueTeams.filter((leagueTeam) => !term || leagueTeam.name.toLowerCase().includes(term)),
    [activeLeagueTeams, term],
  )

  if (seasons.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No seasons yet — teams are affiliated to a league for a specific season.
      </Typography>
    )
  }

  const showOwn = scope !== 'league'
  const showLeague = scope !== 'own'
  const shownTeams = (showOwn ? ownTeams.length : 0) + (showLeague ? leagueTeams.length : 0)
  const nothingRegistered = affiliationsForSeason.length === 0 && activeLeagueTeams.length === 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FilterBar
        density="compact"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams"
        viewControls={
          <CompactToggleGroup<TeamScope> value={scope} onChange={setScope} ariaLabel="Teams to show" fullWidth>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="own">Our teams</ToggleButton>
            <ToggleButton value="league">League teams</ToggleButton>
          </CompactToggleGroup>
        }
        onClearAll={() => {
          setSearch('')
          setScope('all')
        }}
      />
      <ContentControlsLine
        scope={`Showing ${shownTeams} ${shownTeams === 1 ? 'team' : 'teams'}${seasonLabel ? ` · ${seasonLabel}` : ''}`}
        controls={
          <CompactToggleGroup<TeamScope> value={scope} onChange={setScope} ariaLabel="Teams to show">
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="own">Our teams</ToggleButton>
            <ToggleButton value="league">League teams</ToggleButton>
          </CompactToggleGroup>
        }
      />

      {isLoadingTeams && nothingRegistered ? (
        <Skeleton variant="rounded" height={96} aria-label="Loading teams" />
      ) : nothingRegistered ? (
        <Typography variant="body2" color="text.secondary">
          No teams registered for this season yet.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', md: showOwn && showLeague ? 'repeat(2, minmax(0, 1fr))' : '1fr' } }}>
          {showOwn && (
            <TeamsCard testId="league-teams-own" title="Our teams" count={ownTeams.length}>
              {ownTeams.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {term ? 'No teams match your search.' : 'None of your teams are entered this season.'}
                </Typography>
              ) : (
                ownTeams.map(({ affiliationId, team }) => (
                  <TeamTile key={affiliationId} name={team.name} abbreviation={team.abbreviation} logoUrl={team.logoUrl} to={`/manage/sections/${team.sectionId}/teams/${team.id}`} />
                ))
              )}
            </TeamsCard>
          )}
          {showLeague && (
            <TeamsCard testId="league-teams-league" title="League teams" count={leagueTeams.length}>
              {leagueTeams.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {term ? 'No teams match your search.' : 'No league teams registered this season.'}
                </Typography>
              ) : (
                leagueTeams.map((leagueTeam) => (
                  <TeamTile key={leagueTeam.id} name={leagueTeam.name} abbreviation={leagueTeam.abbreviation} logoUrl={leagueTeam.logoUrl} />
                ))
              )}
            </TeamsCard>
          )}
        </Box>
      )}
    </Box>
  )
}
