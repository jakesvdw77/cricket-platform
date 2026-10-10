import { useState } from 'react'
import { Alert, Box } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../../api/leagueTeamApi'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { errorDetail } from '../../../utils/errorDetail'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { LeagueTeamTable } from '../leagueEdit/LeagueTeamTable'
import { LeagueTeamFormDialog } from './LeagueTeamFormDialog'
import { CopyLeagueTeamsDialog } from './CopyLeagueTeamsDialog'
import { useLeagueTeamMutations } from './useLeagueTeamMutations'

export interface LeagueTeamsSectionProps {
  clubId: string
  leagueId: string
  seasonId: string
  // "TVL Division 1 · 2026/27"
  contextLabel: string
}

// Only a 409 is the duplicate-name conflict; anything else is a general failure.
const isDuplicateName = (error: unknown) => isAxiosError(error) && error.response?.status === 409

type Feedback = { severity: 'success' | 'info' | 'error'; message: string }

// docs/specs/070-league-teams.md: the "League teams" section of a league's Teams tab for the
// selected season. There is no toast mechanism in the app, so outcomes show in an inline Alert.
export function LeagueTeamsSection({ clubId, leagueId, seasonId, contextLabel }: LeagueTeamsSectionProps) {
  const [editing, setEditing] = useState<LeagueTeam | 'new' | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [removing, setRemoving] = useState<LeagueTeam | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const teamsQuery = useQuery({
    queryKey: leagueTeamsQueryKey(clubId, leagueId, seasonId),
    queryFn: () => listLeagueTeams(clubId, leagueId, seasonId),
  })
  const teams = teamsQuery.data ?? []

  const { create, update, deactivate, reactivate, remove, copy } = useLeagueTeamMutations(clubId, leagueId, seasonId)
  const saveMutation = editing && editing !== 'new' ? update : create

  const closeForm = () => {
    create.reset()
    update.reset()
    setEditing(null)
  }

  const handleSave = (payload: { name: string; abbreviation?: string | null; logoUrl?: string | null }) => {
    if (editing && editing !== 'new') {
      update.mutate({ id: editing.id, payload }, { onSuccess: closeForm })
    } else {
      create.mutate(payload, { onSuccess: closeForm })
    }
  }

  const handleToggle = (team: LeagueTeam) => {
    setFeedback(null)
    const mutation = team.active ? deactivate : reactivate
    mutation.mutate(team.id, {
      onError: (error) => setFeedback({ severity: 'error', message: errorDetail(error, 'Something went wrong. Please try again.') }),
    })
  }

  const handleRemove = () => {
    if (!removing) {
      return
    }
    const team = removing
    remove.mutate(team.id, {
      onSuccess: (result) => {
        setRemoving(null)
        setFeedback(
          result.outcome === 'DELETED'
            ? { severity: 'success', message: `${team.name} was deleted.` }
            : { severity: 'info', message: `${team.name} is used by matches, so it was deactivated instead.` },
        )
      },
      onError: (error) => {
        setRemoving(null)
        setFeedback({ severity: 'error', message: errorDetail(error, 'Something went wrong removing this team.') })
      },
    })
  }

  const removeDescription = removing
    ? removing.referencedByMatchCount > 0
      ? `${removing.name} is used in ${removing.referencedByMatchCount} ${
          removing.referencedByMatchCount === 1 ? 'match' : 'matches'
        }, so it will be deactivated instead of deleted.`
      : `This permanently deletes ${removing.name} from this league and season.`
    : ''

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
          <Button size="sm" startIcon={<AddIcon fontSize="small" />} onClick={() => setEditing('new')} sx={{ flex: 'none' }}>
            Add league team
          </Button>
          <Button
            size="sm"
            variant="secondary"
            startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
            aria-label="Copy teams from another league or season"
            onClick={() => setCopyOpen(true)}
            sx={{ flex: 'none' }}
          >
            Copy from...
          </Button>
        </>
      }
    >
      {feedback && (
        <Box sx={bodyPx}>
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        </Box>
      )}

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
          onEdit={setEditing}
          onToggleActive={handleToggle}
          onRemove={setRemoving}
          togglePending={deactivate.isPending || reactivate.isPending}
        />
      )}

      {editing && (
        <LeagueTeamFormDialog
          open
          leagueTeam={editing === 'new' ? undefined : editing}
          contextLabel={contextLabel}
          pending={saveMutation.isPending}
          nameError={saveMutation.isError && isDuplicateName(saveMutation.error) ? errorDetail(saveMutation.error, 'That name is already registered.') : null}
          errorMessage={
            saveMutation.isError && !isDuplicateName(saveMutation.error)
              ? errorDetail(saveMutation.error, 'Something went wrong saving this team.')
              : null
          }
          onSubmit={handleSave}
          onClose={closeForm}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title={removing ? (removing.referencedByMatchCount > 0 ? `Deactivate ${removing.name}?` : `Delete ${removing.name}?`) : ''}
        description={removeDescription}
        confirmLabel={removing && removing.referencedByMatchCount > 0 ? 'Deactivate' : 'Delete'}
        pendingLabel="Removing..."
        destructive
        pending={remove.isPending}
        onConfirm={handleRemove}
        onClose={() => setRemoving(null)}
      />

      {copyOpen && (
        <CopyLeagueTeamsDialog
          open
          clubId={clubId}
          leagueId={leagueId}
          seasonId={seasonId}
          contextLabel={contextLabel}
          targetTeams={teams}
          pending={copy.isPending}
          errorMessage={copy.isError ? errorDetail(copy.error, 'Something went wrong copying these teams.') : null}
          onCopy={(source) =>
            copy.mutate(source, {
              onSuccess: (result) => {
                setCopyOpen(false)
                setFeedback({
                  severity: 'success',
                  message:
                    result.skipped.length > 0
                      ? `Copied ${result.created.length}, skipped ${result.skipped.length} (already here).`
                      : `Copied ${result.created.length}.`,
                })
              },
            })
          }
          onClose={() => {
            copy.reset()
            setCopyOpen(false)
          }}
        />
      )}
    </LeagueEditPanel>
  )
}
