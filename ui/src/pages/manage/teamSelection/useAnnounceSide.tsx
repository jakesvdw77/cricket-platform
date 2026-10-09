import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@mui/material'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { announceMatchSide } from '../../../api/matchSideApi'
import { invalidateTeamSelection } from '../../../api/teamSelectionApi'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { errorDetail } from '../../../utils/errorDetail'

export interface AnnounceTarget {
  match: TeamSelectionMatch
  side: TeamSelectionSide
}

// docs/specs/093-team-selection-hub.md: announcing a side from a hub view - ask first (the confirm dialog), call the
// spec 076 announce endpoint, refresh the overview. Shared by the Matches and Batting order views.
export function useAnnounceSide(clubId: string) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<AnnounceTarget | null>(null)

  const mutation = useMutation({
    mutationFn: (target: AnnounceTarget) => announceMatchSide(clubId, target.match.matchId, target.side.sideId as string),
    onSuccess: () => invalidateTeamSelection(queryClient, clubId),
    onSettled: () => setPending(null),
  })

  return {
    request: (match: TeamSelectionMatch, side: TeamSelectionSide) => setPending({ match, side }),
    // The side being announced right now.
    announcingSideId: mutation.isPending ? (pending?.side.sideId ?? null) : null,
    errorAlert: mutation.isError ? (
      <Alert severity="error">{errorDetail(mutation.error, "Couldn't announce this team. Please try again.")}</Alert>
    ) : null,
    dialog: (
      <ConfirmDialog
        open={pending !== null}
        title="Announce this team?"
        description="Announcing marks this team as final: it shows as announced on the match and team sheet, and the team sheet can be shared. Nobody is notified automatically. If you change the selection afterwards, you will need to announce it again."
        confirmLabel="Announce team"
        pendingLabel="Announcing…"
        pending={mutation.isPending}
        onConfirm={() => pending && mutation.mutate(pending)}
        onClose={() => setPending(null)}
      />
    ),
  }
}
