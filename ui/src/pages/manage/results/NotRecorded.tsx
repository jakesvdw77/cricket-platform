import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'

// docs/specs/118: a value that was not specified is shown with a warning-coloured icon and a warning-coloured "Not recorded".
// Shared by the Review step's preview card and the Details card of the Result page. A visual hint only.
export function MissingIcon({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}>
      {children}
    </Box>
  )
}

// `children` is an optional action next to the text (the Review step's Add button).
export function NotRecordedValue({ children, testId = 'review-not-recorded' }: { children?: ReactNode; testId?: string }) {
  return (
    <Box component="span" data-testid={testId} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <WarningAmberOutlinedIcon fontSize="inherit" sx={{ color: 'warning.main' }} aria-hidden />
      <Box component="span" sx={{ color: 'warning.dark', fontWeight: 600 }}>
        Not recorded
      </Box>
      {children}
    </Box>
  )
}
