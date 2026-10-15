import { useState } from 'react'
import { Alert, Box } from '@mui/material'
import type { TeamNotice } from '../scorecardDraft'
import { Button } from '../../../../components/Button'

export interface NotSelectedBannerProps {
  notice: TeamNotice
  // Teams only: build the list from the team's squad, and open the Select team page (the page saves first).
  onPopulate?: () => void
  populating?: boolean
  onSelectTeam?: () => void
  // Batting and Bowling: back to the Teams step.
  onOpenTeams?: () => void
  disabled?: boolean
}

const NONE_MESSAGE =
  'Our team is not selected for this match (a random friendly?). You can still capture the scorecard; names you enter become guests unless they match a registered player.'
const shortMessage = (count: number) => `Only ${count} ${count === 1 ? 'player is' : 'players are'} on our team list for this match. You can add the rest on Teams.`

// The gentle "our team is not selected" notice: an info alert, dismissible for the visit, never blocking.
export function NotSelectedBanner({ notice, onPopulate, populating = false, onSelectTeam, onOpenTeams, disabled = false }: NotSelectedBannerProps) {
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
      {(onPopulate || onSelectTeam || onOpenTeams) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
          {onPopulate && (
            <Button variant="secondary" size="sm" onClick={onPopulate} disabled={disabled || populating}>
              {populating ? 'Loading the team…' : 'Populate from the team'}
            </Button>
          )}
          {onSelectTeam && (
            <Button variant="secondary" size="sm" onClick={onSelectTeam} disabled={disabled}>
              Select the team
            </Button>
          )}
          {onOpenTeams && (
            <Button variant="ghost" size="sm" onClick={onOpenTeams} disabled={disabled}>
              Open Teams
            </Button>
          )}
        </Box>
      )}
    </Alert>
  )
}
