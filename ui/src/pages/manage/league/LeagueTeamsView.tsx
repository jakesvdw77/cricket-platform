import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LogoAvatar } from '../../../components/LogoAvatar'
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom'
import { Box, Link as MuiLink, Skeleton, Stack, ToggleButton, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { LinkExistingRecordDialog } from '../../../components/LinkExistingRecordDialog'
import { createLeagueAffiliation, unaffiliateLeagueTeam } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { useLeagueTeamActions } from '../leagueTeams/useLeagueTeamActions'
import { AddTeamChooserDialog } from '../../../components/AddTeamChooserDialog'
import { EmptyState } from '../../../components/EmptyState'
import { Card } from '../../../components/Card'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { FilterBar } from '../../../components/FilterBar'
import { initialsFromName } from '../../../utils/initials'
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { LeagueTabMenu } from './LeagueTabMenu'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { useLeagueView } from './leagueViewContext'

type TeamScope = 'all' | 'own' | 'league'

interface TeamTileProps {
  name: string
  abbreviation: string | null
  logoUrl: string | null
  // Own teams link to the team; league teams (no detail page) do not.
  to?: string
  // Page-anatomy section 6: the tile's one Actions button, top-right corner (a kebab ManageMenu). Never navigates the tile.
  actions?: ReactNode
}

// A two-across tile (docs/specs/091 C): a logo or short name, the full team name (never clipped) and what it is.
function TeamTile({ name, abbreviation, logoUrl, to, actions }: TeamTileProps) {
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
      <LogoAvatar
        src={logoUrl}
        variant="rounded"
        size={40}
        fontSize="0.7rem"
        sx={{ borderRadius: 1.25 }}
        fallbackSx={own ? undefined : { backgroundImage: 'none', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), color: 'primary.main', border: 1, borderColor: 'divider' }}
      >
        {abbreviation || initialsFromName(name)}
      </LogoAvatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
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
      {actions && <Box sx={{ alignSelf: 'flex-start', mt: -0.75, mr: -1, flex: 'none' }}>{actions}</Box>}
    </Box>
  )
}

interface TeamsCardProps {
  title: string
  count: number
  testId: string
  children: React.ReactNode
}

function TeamsCard({ title, count, testId, children }: TeamsCardProps) {
  return (
    <Card data-testid={testId} sx={{ height: '100%', boxShadow: 0 }} contentSx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: '1 1 200px' }}>
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
      </Box>
      <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, alignContent: 'start' }}>{children}</Box>
    </Card>
  )
}

// docs/specs/091 (C) (replacing 072 section 5's tile cards): the Teams view, a read-focused page whose only writes are the
// Add actions (Add Team on the tab row, which asks Our team, Opponent team or Copy teams), the same dialogs as the edit page's Teams tab - a search and an All | Our teams |
// League teams switch in one row (counts in the labels), then "Our teams" (the season's affiliated club teams, linked to their page) and "League teams" (the
// season's active league teams, not linked) as equal-height cards with icon-tile headings.
export default function LeagueTeamsView() {
  const { clubId, leagueId, league, seasons, selectedSeasonId, seasonLabel, teamsById, affiliationsForSeason, activeLeagueTeams, isLoadingTeams, openShare } =
    useLeagueView()
  const queryClient = useQueryClient()
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const [linkOpen, setLinkOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  // docs/specs/127: Open Team returns to this tab (and season).
  const teamPath = (team: Team) => withReturnTo(`/manage/sections/${team.sectionId}/teams/${team.id}`, currentOrigin(location), `${league.name} teams`)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<TeamScope>('all')
  const [unaffiliating, setUnaffiliating] = useState<{ affiliationId: string; team: Team } | null>(null)

  // Manage League > Add Team lands here with ?add=team: open the chooser once and take the parameter off the address.
  const addRequested = searchParams.get('add') === 'team'
  useEffect(() => {
    if (!addRequested) {
      return
    }
    if (selectedSeasonId) {
      setChooserOpen(true)
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('add')
        return next
      },
      { replace: true },
    )
  }, [addRequested, selectedSeasonId, setSearchParams])

  const contextLabel = `${league.name} · ${seasonLabel}`
  const leagueTeamActions = useLeagueTeamActions({
    clubId,
    leagueId,
    seasonId: selectedSeasonId,
    contextLabel,
    targetTeams: activeLeagueTeams,
    announceAdded: true,
  })

  // The club's active teams not yet affiliated to this league for the selected season (as on the edit page).
  const affiliatedTeamIds = new Set(affiliationsForSeason.map((affiliation) => affiliation.teamId))
  const linkableTeams: Team[] = Array.from(teamsById.values()).filter((team) => team.active && !affiliatedTeamIds.has(team.id))

  const linkMutation = useMutation({
    mutationFn: (team: Team) => createLeagueAffiliation(clubId, leagueId, team.id, selectedSeasonId),
    onSuccess: (_affiliation, team) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'] })
      setLinkOpen(false)
      leagueTeamActions.setFeedback({ severity: 'success', message: `${team.name} was added to this season.` })
    },
  })

  // Our team tile's Remove from League: the same unaffiliate (and the same confirmation) as the edit page's Teams tab.
  const unaffiliateMutation = useMutation({
    mutationFn: (target: { affiliationId: string; team: Team }) => unaffiliateLeagueTeam(clubId, leagueId, target.affiliationId),
    onSuccess: (_result, target) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'] })
      setUnaffiliating(null)
      leagueTeamActions.setFeedback({ severity: 'success', message: `${target.team.name} was removed from this season.` })
    },
    onError: () => setUnaffiliating(null),
  })

  const ownTeamActions = (affiliationId: string, team: Team) => {
    const items: ManageMenuItem[] = [
      { id: 'open', title: 'Open Team', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: teamPath(team) },
      { id: 'remove', title: 'Remove from League', icon: <LinkOffOutlinedIcon fontSize="small" />, onClick: () => setUnaffiliating({ affiliationId, team }), disabled: unaffiliateMutation.isPending },
    ]
    return <ManageMenu trigger="kebab" dense label={`Actions for ${team.name}`} testId={`league-team-actions-${team.id}`} groups={[{ id: 'actions', heading: 'Actions', items }]} />
  }
  const leagueTeamMenu = (leagueTeam: LeagueTeam) => {
    const items: ManageMenuItem[] = [
      { id: 'edit', title: 'Edit League Team', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => leagueTeamActions.openEdit(leagueTeam) },
      {
        id: 'toggle',
        title: leagueTeam.active ? 'Deactivate' : 'Reactivate',
        icon: leagueTeam.active ? <BlockOutlinedIcon fontSize="small" /> : <ReplayOutlinedIcon fontSize="small" />,
        onClick: () => leagueTeamActions.toggleActive(leagueTeam),
        disabled: leagueTeamActions.togglePending,
      },
      { id: 'remove', title: 'Remove', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => leagueTeamActions.askRemove(leagueTeam) },
    ]
    return <ManageMenu trigger="kebab" dense label={`Actions for ${leagueTeam.name}`} testId={`league-team-actions-${leagueTeam.id}`} groups={[{ id: 'actions', heading: 'Actions', items }]} />
  }

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

  const scopeToggle = (
    <CompactToggleGroup<TeamScope> value={scope} onChange={setScope} ariaLabel="Teams to show" fullWidth={isPhone} toolbar={!isPhone}>
      <ToggleButton value="all">All</ToggleButton>
      <ToggleButton value="own">Our teams</ToggleButton>
      <ToggleButton value="league">League teams</ToggleButton>
    </CompactToggleGroup>
  )
  const bar = (
    <FilterBar
        density="compact"
        bare
        inCard
        viewControlsInline
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams"
        viewControls={scopeToggle}
        onClearAll={() => {
          setSearch('')
          setScope('all')
        }}
      />
  )
  const showOwn = scope !== 'league'
  const showLeague = scope !== 'own'
  const nothingRegistered = affiliationsForSeason.length === 0 && activeLeagueTeams.length === 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {leagueTeamActions.feedbackAlert}
      {/* The tab's one action: a white Manage Teams menu (docs/standards/page-anatomy.md); with nothing registered the empty state also carries a filled Add Team. */}
      <LeagueTabMenu
        label="Manage Teams"
        heading="Teams"
        testId="manage-teams"
        items={[
          {
            id: 'add-team',
            title: 'Add Team',
            description: 'Link one of your teams, add an opponent, or copy teams from another season.',
            icon: <GroupAddOutlinedIcon fontSize="small" />,
            onClick: () => setChooserOpen(true),
            disabled: !selectedSeasonId,
            reason: 'Create a season first',
          },
          {
            id: 'copy-teams',
            title: 'Copy Teams',
            description: 'Copy the league teams from another season.',
            icon: <ContentCopyOutlinedIcon fontSize="small" />,
            onClick: () => leagueTeamActions.openCopy(),
            disabled: !selectedSeasonId,
            reason: 'Create a season first',
          },
          {
            id: 'share-teams',
            title: 'Share Teams',
            description: "The season's teams as a PDF, poster or message.",
            icon: <ShareOutlinedIcon fontSize="small" />,
            onClick: () => openShare?.(['TEAMS']),
            disabled: !openShare,
          },
        ]}
      />
      <ToolbarCard>{bar}</ToolbarCard>

      {isLoadingTeams && nothingRegistered ? (
        <Skeleton variant="rounded" height={96} aria-label="Loading teams" />
      ) : nothingRegistered ? (
        <EmptyState
          title={`No teams in this league yet${seasonLabel ? ` for ${seasonLabel}` : ''}.`}
          action={
            <Button size="compact" onClick={() => setChooserOpen(true)} disabled={!selectedSeasonId}>
              Add Team
            </Button>
          }
        />
      ) : (
        <>
        <Box sx={{ display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', md: showOwn && showLeague ? 'repeat(2, minmax(0, 1fr))' : '1fr' } }}>
          {showOwn && (
            <TeamsCard
              testId="league-teams-own"
              title="Our teams"
              count={ownTeams.length}
            >
              {ownTeams.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {term ? 'No teams match your search.' : 'None of your teams are entered this season. Use Add Team.'}
                </Typography>
              ) : (
                ownTeams.map(({ affiliationId, team }) => (
                  <TeamTile key={affiliationId} name={team.name} abbreviation={team.abbreviation} logoUrl={team.logoUrl} to={teamPath(team)} actions={ownTeamActions(affiliationId, team)} />
                ))
              )}
            </TeamsCard>
          )}
          {showLeague && (
            <TeamsCard
              testId="league-teams-league"
              title="League teams"
              count={leagueTeams.length}
            >
              {leagueTeams.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {term ? 'No teams match your search.' : 'No league teams registered this season. Use Add Team.'}
                </Typography>
              ) : (
                leagueTeams.map((leagueTeam) => (
                  <TeamTile key={leagueTeam.id} name={leagueTeam.name} abbreviation={leagueTeam.abbreviation} logoUrl={leagueTeam.logoUrl} actions={leagueTeamMenu(leagueTeam)} />
                ))
              )}
            </TeamsCard>
          )}
        </Box>
        </>
      )}

      {leagueTeamActions.dialogs}
      <ConfirmDialog
        open={unaffiliating !== null}
        title={unaffiliating ? `Unaffiliate ${unaffiliating.team.name} from this season?` : ''}
        description={unaffiliating ? `This removes ${unaffiliating.team.name} from this league for ${seasonLabel}. The team and its matches are kept, and you can affiliate it again at any time.` : ''}
        confirmLabel="Unaffiliate"
        pendingLabel="Removing..."
        destructive
        pending={unaffiliateMutation.isPending}
        onConfirm={() => unaffiliating && unaffiliateMutation.mutate(unaffiliating)}
        onClose={() => setUnaffiliating(null)}
      />
      <AddTeamChooserDialog
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onChooseOwn={() => {
          setChooserOpen(false)
          setLinkOpen(true)
        }}
        onChooseOpponent={() => {
          setChooserOpen(false)
          leagueTeamActions.openAdd()
        }}
        onChooseCopy={() => {
          setChooserOpen(false)
          leagueTeamActions.openCopy()
        }}
        copyDisabledReason={selectedSeasonId ? undefined : 'Pick a season first.'}
      />
      <LinkExistingRecordDialog<Team>
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Affiliate a team for this season"
        candidates={linkableTeams}
        loading={isLoadingTeams}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        searchLabel="Search teams"
        searchPlaceholder="Search by name"
        onLink={(option) => linkMutation.mutate(option)}
      />
    </Box>
  )
}
