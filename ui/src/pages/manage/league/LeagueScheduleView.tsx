import { useMemo, useState } from 'react'
import type { Match } from '../../../api/matchApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { MatchShareHost } from '../matches/MatchShareHost'
import { Box, Button as MuiButton, Skeleton, Typography } from '@mui/material'
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom'
import { compactButtonSx } from '../../../components/Button'
import { importScheduleDisabledReason, leagueAddMatchPath, leagueScheduleImportPath } from '../../../utils/leagueScheduleImport'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { EmptyState } from '../../../components/EmptyState'
import { ToolbarToggleChip } from '../../../components/ToolbarCard'
import { FilterBar } from '../../../components/FilterBar'
import { filterFixtures } from './leagueFixtureFilters'
import { LeagueFixturesTable } from './LeagueFixturesTable'
import { ImportScheduleButton } from '../leagueImport/ImportScheduleControls'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { LeagueTabMenu } from './LeagueTabMenu'
import { useLeagueView } from './leagueViewContext'

// docs/specs/091 (C), calmer in docs/specs/126: the Schedule view - one flat control bar (Team, search and the Only our matches and
// View entire season switches; a Filters button and sheet on a phone) and the season's fixtures as a zebra table. The
// season's matches come from the layout (listAllMatches, not just the first page); the filters are client-side and per
// visit. Share schedule is in the page header's Actions menu; the next-match countdown is in the key-figure strip.
export default function LeagueScheduleView() {
  const { clubId, leagueId, league, seasons, selectedSeasonId, teamsById, affiliationsForSeason, activeLeagueTeams, matches, isLoadingMatches, openShare } =
    useLeagueView()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyOurs, setOnlyOurs] = useState(false)
  // docs/specs/127: ?showAll=1 (added when a saved past match returns here) starts with the whole season visible.
  const [searchParams] = useSearchParams()
  const [showPlayed, setShowPlayed] = useState(searchParams.get('showAll') === '1')
  const location = useLocation()
  const originLabel = `${league.name} schedule`
  // docs/specs/131: Share Match on a row opens the Share Match dialog; each click mounts a fresh host.
  const [shareTarget, setShareTarget] = useState<{ match: Match; nonce: number } | null>(null)
  const leaguesById = useMemo(() => new Map<string, League>([[league.id, league]]), [league])
  const seasonsById = useMemo(() => new Map<string, Season>(seasons.map((season) => [season.id, season])), [seasons])

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
  const importReason = importScheduleDisabledReason({ hasSeason: Boolean(selectedSeasonId), leagueActive: league.active })
  const isFiltering = teamId !== null || search.trim() !== '' || onlyOurs

  const bar = (
    <FilterBar
      density="compact"
      bare
      inCard
      viewControlsInline
      teams={teamOptions}
      teamId={teamId}
      onTeamChange={setTeamId}
      teamAllLabel="All teams"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search teams or venue"
      // docs/standards/page-anatomy.md section 3: the switches sit in the toolbar as toggle chips (the sheet keeps switches; below lg they fold into it).
      secondaryControls={(placement) =>
        placement === 'row' ? (
          <>
            <ToolbarToggleChip pressed={onlyOurs} onChange={setOnlyOurs} label="Only our matches" />
            <ToolbarToggleChip pressed={showPlayed} onChange={setShowPlayed} label="View entire season" />
          </>
        ) : (
          <>
            {ourSwitch}
            {playedSwitch}
          </>
        )
      }
      onClearAll={() => {
        setTeamId(null)
        setSearch('')
        setOnlyOurs(false)
      }}
    />
  )
  // What replaces the rows: loading, no fixtures at all, or no match for the filters. It sits INSIDE the fused card, so
  // the toolbar keeps one place in the tree in every state (typing into Search never remounts it).
  const loading = Boolean(isLoadingMatches && selectedSeasonId)
  const emptyNode = loading ? (
    <Skeleton variant="rounded" height={96} aria-label="Loading fixtures" />
  ) : visible.length > 0 ? null : matches.length === 0 ? (
    <EmptyState
      title="No fixtures yet"
      description="No matches scheduled for this league and season yet."
      action={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
          <ImportScheduleButton leagueId={leagueId} seasonId={selectedSeasonId} leagueActive={league.active} from="view" originLabel={originLabel} />
          <MuiButton component={RouterLink} to={withReturnTo(leagueAddMatchPath(leagueId, selectedSeasonId), currentOrigin(location), originLabel)} variant="contained" size="small" sx={compactButtonSx}>
            Add Match
          </MuiButton>
        </Box>
      }
    />
  ) : (
    <EmptyState
      title="No matching fixtures"
      description={
        isFiltering
          ? 'No matches match the current filters. Try a different team, search, or turn off Only our matches.'
          : 'No upcoming matches. Turn on View entire season to see earlier fixtures.'
      }
    />
  )

  if (seasons.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No seasons yet — matches are scheduled for a league and a specific season.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {/* The tab's one action: a white Manage Schedule menu (docs/standards/page-anatomy.md). */}
      <LeagueTabMenu
        label="Manage Schedule"
        heading="Schedule"
        testId="manage-schedule"
        items={[
          {
            id: 'add-match',
            title: 'Add Match',
            description: 'Create one fixture for this league and season.',
            icon: <AddOutlinedIcon fontSize="small" />,
            to: selectedSeasonId ? withReturnTo(leagueAddMatchPath(leagueId, selectedSeasonId), currentOrigin(location), originLabel) : undefined,
            disabled: !selectedSeasonId,
            reason: 'Create a season first',
          },
          {
            id: 'import-schedule',
            title: 'Import Schedule',
            description: 'Upload an Excel or CSV file, or type the fixtures into the import table.',
            icon: <UploadFileOutlinedIcon fontSize="small" />,
            to: withReturnTo(leagueScheduleImportPath(leagueId, selectedSeasonId, 'view'), currentOrigin(location), originLabel),
            disabled: Boolean(importReason),
            reason: importReason ?? undefined,
          },
          {
            id: 'share-schedule',
            title: 'Share Schedule',
            description: 'The fixtures as a PDF, poster, calendar or message.',
            icon: <ShareOutlinedIcon fontSize="small" />,
            onClick: () => openShare?.(['SCHEDULE']),
            disabled: !openShare,
          },
        ]}
      />

      <LeagueFixturesTable matches={loading ? [] : visible} teamsById={teamsById} toolbar={bar}
        empty={emptyNode}
        originLabel={originLabel}
        onShare={(match) => setShareTarget((previous) => ({ match, nonce: (previous?.nonce ?? 0) + 1 }))}
      />
      {shareTarget && (
        <MatchShareHost key={shareTarget.nonce} clubId={clubId} match={shareTarget.match} teamsById={teamsById} leaguesById={leaguesById} seasonsById={seasonsById} />
      )}
    </Box>
  )
}
