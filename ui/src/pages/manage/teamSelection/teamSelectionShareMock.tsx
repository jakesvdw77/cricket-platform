import { useState } from 'react'
import type { UseTeamSheetShareArgs, TeamSheetShare } from '../matches/useTeamSheetShare'

// Test stand-in for useTeamSheetShare (not production code): the real dialog needs squads and sides, which the hub tests
// do not care about. It renders a marker showing which match and scope the dialog was opened with.
export function useFakeTeamSheetShare(args: UseTeamSheetShareArgs): TeamSheetShare {
  const [open, setOpen] = useState(false)
  return {
    openShare: () => setOpen(true),
    shareDialog: open ? <div data-testid="share-dialog" data-match-id={args.match.id} data-scope={args.initialScope} /> : null,
  }
}
