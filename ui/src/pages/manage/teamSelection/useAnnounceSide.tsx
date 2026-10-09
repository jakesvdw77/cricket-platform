import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateTeamSelection } from '../../../api/teamSelectionApi'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { errorDetail } from '../../../utils/errorDetail'
import { AnnounceTeamDialog } from './AnnounceTeamDialog'
import { announceWithRoles } from './announceWithRoles'
import type { AnnounceRoleChoices } from './announceWithRoles'

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
    mutationFn: ({ target, choices }: { target: AnnounceTarget; choices: AnnounceRoleChoices }) =>
      announceWithRoles(clubId, target.match.matchId, target.side.sideId as string, target.side, choices),
    onSuccess: () => {
      invalidateTeamSelection(queryClient, clubId)
      setPending(null)
    },
  })

  const close = () => {
    mutation.reset()
    setPending(null)
  }
  const side = pending?.side
  // A role can go to any picked player except the 12th man.
  const candidates = (side?.picks ?? [])
    .filter((pick) => pick.playerId !== side?.twelfthManPlayerId && !pick.twelfthMan)
    .map((pick) => ({ playerId: pick.playerId, name: `${pick.firstName} ${pick.lastName}`.trim() }))

  return {
    request: (match: TeamSelectionMatch, side: TeamSelectionSide) => {
      mutation.reset()
      setPending({ match, side })
    },
    // The side being announced right now.
    announcingSideId: mutation.isPending ? (pending?.side.sideId ?? null) : null,
    // A failure shows inside the dialog, which stays open.
    errorAlert: null,
    dialog: (
      <AnnounceTeamDialog
        open={pending !== null}
        candidates={candidates}
        captainMissing={!side?.captainPlayerId && !side?.picks.some((pick) => pick.captain)}
        keeperMissing={!side?.wicketKeeperPlayerId && !side?.picks.some((pick) => pick.wicketKeeper)}
        pending={mutation.isPending}
        errorMessage={mutation.isError ? errorDetail(mutation.error, "Couldn't announce this team. Please try again.") : null}
        onConfirm={(choices) => pending && mutation.mutate({ target: pending, choices })}
        onClose={close}
      />
    ),
  }
}
