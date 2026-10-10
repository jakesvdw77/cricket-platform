import { useMemo, useState } from 'react'
import { Box, Skeleton, Typography } from '@mui/material'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { filterFixtures } from './leagueFixtureFilters'
import { LeagueFixturesTable } from './LeagueFixturesTable'
import { useLeagueView } from './leagueViewContext'

// docs/specs/091 (C) (replacing 072 section 5's Fixtures card): the Schedule view - a compact toolbar (Team and search),
// the content line with the Only our matches and Show played switches, and the season's fixtures as a zebra table. The
// season's matches come from the layout (listAllMatches, not just the first page); the filters are client-side and per
// visit. Share schedule and the next-match countdown live in the page header and key-figure strip.
export default function LeagueScheduleView() {
  const { seasons, seasonLabel, selectedSeasonId, teamsById, affiliationsForSeason, activeLeagueTeams, matches, isLoadingMatches } =
    useLeagueView()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyOurs, setOnlyOurs] = useState(false)
  const [showPlayed, setShowPlayed] = useState(false)

  // Our entered teams first, then the league's other teams, each once.
  const teamOptions = useMemo(
    () => [
      ...affiliationsForSeason.map((affiliation) => ({ id: affiliation.teamId, name: teamsById.get(affiliation.teamId)?.name ?? 'Unknown team' })),
      ...activeLeagueTeams.map((leagueTeam) => ({ id: leagueTeam.id, name: leagueTeam.name })),
    ],
    [affiliationsForSeason, activeLeagueTeams, teamsById],
  )

  const visible = useMemo(
    () => filterFixtures(matches, { teamId, search, onlyOurs, showPlayed, today: new Date() }, teamsById),
    [matches, teamId, search, onlyOurs, showPlayed, teamsById],
  )

  const ourSwitch = <CompactSwitch checked={onlyOurs} onChange={setOnlyOurs} label="Only our matches" />
  const playedSwitch = <CompactSwitch checked={showPlayed} onChange={setShowPlayed} label="View entire season" />
  const isFiltering = teamId !== null || search.trim() !== '' || onlyOurs

  if (seasons.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No seasons yet — matches are scheduled for a league and a specific season.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FilterBar
        density="compact"
        teams={teamOptions}
        teamId={teamId}
        onTeamChange={setTeamId}
        teamAllLabel="All teams"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams or venue"
        viewControls={
          <>
            {ourSwitch}
            {playedSwitch}
          </>
        }
        onClearAll={() => {
          setTeamId(null)
          setSearch('')
          setOnlyOurs(false)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${visible.length} ${showPlayed ? '' : 'upcoming '}${visible.length === 1 ? 'match' : 'matches'}${seasonLabel ? ` · ${seasonLabel}` : ''}`}
        controls={
          <>
            {ourSwitch}
            {playedSwitch}
          </>
        }
      />

      {isLoadingMatches && selectedSeasonId ? (
        // Loading is not an empty season: no empty state until the matches arrive.
        <Skeleton variant="rounded" height={96} aria-label="Loading fixtures" />
      ) : visible.length > 0 ? (
        <LeagueFixturesTable matches={visible} teamsById={teamsById} />
      ) : matches.length === 0 ? (
        <EmptyState title="No fixtures yet" description="No matches scheduled for this league and season yet." />
      ) : (
        <EmptyState
          title="No matching fixtures"
          description={
            isFiltering
              ? 'No matches match the current filters. Try a different team, search, or turn off Only our matches.'
              : 'No upcoming matches. Turn on View entire season to see earlier fixtures.'
          }
        />
      )}
    </Box>
  )
}
