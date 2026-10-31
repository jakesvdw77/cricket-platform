import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '@mui/material'
import { useLeagueView } from './leagueViewContext'

// docs/specs/126: each league view's one white secondary button (the rest are in the Manage League panel) sits on the tab
// strip row, right-aligned beside the tab names. LeagueViewLayout renders the target element and hands it down through the outlet
// context; the view's buttons are portalled into it. Without the layout (a view on its own, or in a test) the buttons
// render inline instead, so the view still works in isolation.
export function LeagueTabActions({ children }: { children: ReactNode }) {
  const target = useLeagueView()?.tabActionsTarget
  if (target) {
    return createPortal(children, target)
  }
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>{children}</Box>
}
