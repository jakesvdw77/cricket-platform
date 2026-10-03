import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Avatar, Box, Link as MuiLink, Skeleton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { avatarSx } from '../../../components/RecordCard'
import { Card } from '../../../components/Card'
import { initialsFromName } from '../../../utils/initials'
import { CardHeaderRow } from './leagueViewParts'
import { useLeagueView } from './leagueViewContext'

interface TeamTileProps {
  name: string
  abbreviation: string | null
  logoUrl: string | null
  // Own teams get the solid primary avatar and a stretched link to the team; league teams (no
  // detail page) get the neutral wash and no link.
  to?: string
}

// A vertical tile for the Teams view (docs/specs/072-league-view-pages.md section 5), carried over
// from the old LeagueDetailPage's page-local LeagueTeamTile (docs/specs/062): a centred 44px avatar
// over the name. Page-local rather than a components/** addition, same rationale as 062's.
function TeamTile({ name, abbreviation, logoUrl, to }: TeamTileProps) {
  const own = Boolean(to)
  const nameNode: ReactNode = to ? (
    // Stretched link, same pattern as RecordCard (docs/specs/059): position: static on the link so
    // its ::after resolves its containing block to the tile Box.
    <MuiLink
      component={RouterLink}
      to={to}
      color="inherit"
      underline="none"
      sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
    >
      {name}
    </MuiLink>
  ) : (
    name
  )

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        px: 1,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 0,
        position: 'relative',
        textAlign: 'center',
        ...(own && {
          transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
          outline: '1px solid transparent',
          '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
        }),
      }}
    >
      <Avatar
        src={logoUrl ?? undefined}
        variant="circular"
        sx={
          own
            ? avatarSx(44, '0.8125rem')
            : {
                ...avatarSx(44, '0.8125rem'),
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                color: 'primary.main',
                border: 1,
                borderColor: 'divider',
              }
        }
      >
        {abbreviation || initialsFromName(name)}
      </Avatar>
      <Typography
        variant="body2"
        fontWeight={600}
        component="div"
        sx={{
          maxWidth: '100%',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
        }}
      >
        {nameNode}
      </Typography>
    </Box>
  )
}

function TileGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} component="h3">
        {label}
      </Typography>
      <Box sx={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {children}
      </Box>
    </Stack>
  )
}

// docs/specs/072-league-view-pages.md section 5: the Teams view, read-only. "Our teams" are the
// season's affiliated club teams (linked to their detail page); "League teams" are the season's
// active docs/specs/070-league-teams.md league teams (not linked, they have no detail page).
export default function LeagueTeamsView() {
  const { seasons, seasonLabel, teamsById, affiliationsForSeason, activeLeagueTeams, isLoadingTeams } =
    useLeagueView()

  const ownTeams = affiliationsForSeason.flatMap((affiliation) => {
    const team = teamsById.get(affiliation.teamId)
    return team ? [{ affiliationId: affiliation.id, team }] : []
  })

  return (
    <Card>
      <CardHeaderRow title={seasonLabel ? `Teams in ${seasonLabel}` : 'Teams'} />
      {seasons.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No seasons yet — teams are affiliated to a league for a specific season.
        </Typography>
      ) : isLoadingTeams && ownTeams.length === 0 && activeLeagueTeams.length === 0 ? (
        <Skeleton variant="rounded" height={96} aria-label="Loading teams" />
      ) : ownTeams.length === 0 && activeLeagueTeams.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No teams registered for this season yet.
        </Typography>
      ) : (
        <Stack spacing={3}>
          {ownTeams.length > 0 && (
            <TileGrid label="Our teams">
              {ownTeams.map(({ affiliationId, team }) => (
                <TeamTile
                  key={affiliationId}
                  name={team.name}
                  abbreviation={team.abbreviation}
                  logoUrl={team.logoUrl}
                  to={`/manage/sections/${team.sectionId}/teams/${team.id}`}
                />
              ))}
            </TileGrid>
          )}
          {activeLeagueTeams.length > 0 && (
            <TileGrid label="League teams">
              {activeLeagueTeams.map((leagueTeam) => (
                <TeamTile
                  key={leagueTeam.id}
                  name={leagueTeam.name}
                  abbreviation={leagueTeam.abbreviation}
                  logoUrl={leagueTeam.logoUrl}
                />
              ))}
            </TileGrid>
          )}
        </Stack>
      )}
    </Card>
  )
}
