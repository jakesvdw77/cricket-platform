import { useState } from 'react'
import { Alert, Box } from '@mui/material'
import type { TeamNotice } from '../scorecardDraft'
import { Button } from '../../../../components/Button'

export interface NotSelectedBannerProps {
  notice: TeamNotice
  // Teams only: build the list from the team's squad, and Select players opens the Add player picker without leaving the page.
  onPopulate?: () => void
  populating?: boolean
  onSelectPlayers?: () => void
  // Batting and Bowling: back to the Teams step.
  onOpenTeams?: () => void
  disabled?: boolean
}

const NONE_MESSAGE =
  'No team is selected for this match. You can still capture the scorecard; names you enter become guests unless they match a registered player.'
const shortMessage = (count: number) => `Only ${count} ${count === 1 ? 'player is' : 'players are'} on our team list for this match. You can add the rest on Teams.`

// The gentle "our team is not selected" notice: an info alert, dismissible for the visit, never blocking.
export function NotSelectedBanner({ notice, onPopulate, populating = false, onSelectPlayers, onOpenTeams, disabled = false }: NotSelectedBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <Alert
      severity="info"
      data-testid="not-selected-banner"
      onClose={() => setDismissed(true)}
      sx={{ '& .MuiAlert-message': { width: '100%', minWidth: 0 } }}
    >
      {notice.kind === 'none' ? NONE_MESSAGE : shortMessage(notice.count)}
      {(onPopulate || onSelectPlayers || onOpenTeams) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
          {onPopulate && (
            <Button variant="secondary" size="compact" onClick={onPopulate} disabled={disabled || populating}>
              {populating ? 'Loading the team…' : 'Populate from the team'}
            </Button>
          )}
          {onSelectPlayers && (
            <Button variant="secondary" size="compact" onClick={onSelectPlayers} disabled={disabled}>
              Select players
            </Button>
          )}
          {onOpenTeams && (
            <Button variant="ghost" size="compact" onClick={onOpenTeams} disabled={disabled}>
              Open Teams
            </Button>
          )}
        </Box>
      )}
    </Alert>
  )
}
