import { Alert, Box } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../../api/leagueTeamApi'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { LeagueTeamTable } from '../leagueEdit/LeagueTeamTable'
import { useLeagueTeamActions } from './useLeagueTeamActions'

export interface LeagueTeamsSectionProps {
  clubId: string
  leagueId: string
  seasonId: string
  // "TVL Division 1 · 2026/27"
  contextLabel: string
}

// docs/specs/070-league-teams.md: the "League teams" section of a league's Teams tab for the
// selected season. There is no toast mechanism in the app, so outcomes show in an inline Alert.
export function LeagueTeamsSection({ clubId, leagueId, seasonId, contextLabel }: LeagueTeamsSectionProps) {
  const teamsQuery = useQuery({
    queryKey: leagueTeamsQueryKey(clubId, leagueId, seasonId),
    queryFn: () => listLeagueTeams(clubId, leagueId, seasonId),
  })
  const teams = teamsQuery.data ?? []

  const { openAdd, openEdit, openCopy, toggleActive, askRemove, togglePending, dialogs, feedbackAlert } = useLeagueTeamActions({
    clubId,
    leagueId,
    seasonId,
    contextLabel,
    targetTeams: teams,
  })
  const bodyPx = { px: { xs: 1.5, md: 2 }, pb: 2 }

  return (
    <LeagueEditPanel
      icon={<GroupsOutlinedIcon />}
      title={`League teams · ${teams.length}`}
      ariaLabel="League teams"
      testId="league-teams-panel"
      caption="Opponents you pick on matches, for this season only"
      actions={
        <>
          <Button size="compact" startIcon={<AddIcon fontSize="small" />} onClick={openAdd} sx={{ flex: 'none' }}>
            Add league team
          </Button>
          <Button
            size="compact"
            variant="secondary"
            startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
            aria-label="Copy teams from another league or season"
            onClick={openCopy}
            sx={{ flex: 'none' }}
          >
            Copy teams
          </Button>
        </>
      }
    >
      {feedbackAlert && <Box sx={bodyPx}>{feedbackAlert}</Box>}

      {teamsQuery.isError && (
        <Box sx={bodyPx}>
          <Alert severity="error">Couldn&apos;t load the league teams. Please try again.</Alert>
        </Box>
      )}

      {teamsQuery.isSuccess && teams.length === 0 && (
        <Box sx={bodyPx}>
          <EmptyState
            title="No league teams yet"
            description="Add the teams in this league one at a time, or copy them from another league or season."
          />
        </Box>
      )}

      {teams.length > 0 && (
        <LeagueTeamTable
          teams={teams}
          onEdit={openEdit}
          onToggleActive={toggleActive}
          onRemove={askRemove}
          togglePending={togglePending}
        />
      )}

      {dialogs}
    </LeagueEditPanel>
  )
}
