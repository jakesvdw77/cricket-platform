import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert } from '@mui/material'
import { isAxiosError } from 'axios'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { errorDetail } from '../../../utils/errorDetail'
import { CopyLeagueTeamsDialog } from './CopyLeagueTeamsDialog'
import { LeagueTeamFormDialog } from './LeagueTeamFormDialog'
import { useLeagueTeamMutations } from './useLeagueTeamMutations'

export type LeagueTeamFeedback = { severity: 'success' | 'info' | 'error'; message: string }

export interface UseLeagueTeamActionsOptions {
  clubId: string
  leagueId: string
  seasonId: string
  // "TVL Division 1 · 2026/27", shown by both dialogs.
  contextLabel: string
  // The league teams already registered, so the Copy dialog can say what it will skip.
  targetTeams: LeagueTeam[]
  // Show "<name> was added." after a create. The edit page's table shows the new row, so it stays quiet; the league page's
  // Teams view has no such confirmation otherwise.
  announceAdded?: boolean
}

// Only a 409 is the duplicate-name conflict; anything else is a general failure.
const isDuplicateName = (error: unknown) => isAxiosError(error) && error.response?.status === 409

// docs/specs/070-league-teams.md: the add/edit/copy orchestration for a league's own opponent teams, shared by the edit page's
// League teams section and the league page's Teams view. Owns the form and copy dialogs, the mutations (which invalidate the
// league-team queries), the inline outcome Alert (there is no toast mechanism in the app) and the 409 duplicate-name error.
// The caller renders `dialogs` once and `feedbackAlert` where the outcome should show.
export function useLeagueTeamActions({ clubId, leagueId, seasonId, contextLabel, targetTeams, announceAdded = false }: UseLeagueTeamActionsOptions) {
  const [editing, setEditing] = useState<LeagueTeam | 'new' | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [feedback, setFeedback] = useState<LeagueTeamFeedback | null>(null)
  const [feedbackSeasonId, setFeedbackSeasonId] = useState(seasonId)

  // A message about one season is dropped when the season changes (adjusting state while rendering, no effect needed).
  if (feedbackSeasonId !== seasonId) {
    setFeedbackSeasonId(seasonId)
    setFeedback(null)
  }

  const mutations = useLeagueTeamMutations(clubId, leagueId, seasonId)
  const { create, update, copy } = mutations
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
      create.mutate(payload, {
        onSuccess: (created) => {
          closeForm()
          if (announceAdded) {
            setFeedback({ severity: 'success', message: `${created?.name ?? payload.name} was added.` })
          }
        },
      })
    }
  }

  const dialogs: ReactNode = (
    <>
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
      {copyOpen && (
        <CopyLeagueTeamsDialog
          open
          clubId={clubId}
          leagueId={leagueId}
          seasonId={seasonId}
          contextLabel={contextLabel}
          targetTeams={targetTeams}
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
    </>
  )

  const feedbackAlert: ReactNode = feedback ? (
    <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
      {feedback.message}
    </Alert>
  ) : null

  return {
    mutations,
    setFeedback,
    openAdd: () => setEditing('new'),
    openEdit: (team: LeagueTeam) => setEditing(team),
    openCopy: () => setCopyOpen(true),
    dialogs,
    feedbackAlert,
  }
}
