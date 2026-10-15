import { useState } from 'react'
import { Alert } from '@mui/material'

const STORAGE_KEY = 'results:inningsHint:dismissed'

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// One compact, dismissible line at the top of Batting and Bowling and fielding that replaces the helper texts under the
// Innings card. Once closed it stays closed for this browser (storage failures are ignored).
export function InningsHintBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed)
  if (dismissed) return null
  return (
    <Alert
      severity="info"
      data-testid="innings-hint"
      sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.8125rem', py: 0.75 } }}
      onClose={() => {
        setDismissed(true)
        try {
          window.localStorage.setItem(STORAGE_KEY, '1')
        } catch {
          // storage unavailable: closed for this visit only
        }
      }}
    >
      Runs and wickets are worked out from the batting card and overs from the bowling card. Type a figure to override it with the official score.
      <br />
      Wides and no-balls add up from the bowlers; byes, leg byes and penalty runs are not charged to a bowler.
    </Alert>
  )
}
