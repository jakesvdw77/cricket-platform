import type { ReactNode } from 'react'
import { Box, IconButton, SwipeableDrawer, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export interface BottomSheetProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  // Accessible name of the sheet.
  ariaLabel: string
  // Heading shown under the handle; omitted, there is no header row.
  title?: string
  // When set, the header carries a close button with this accessible name.
  closeLabel?: string
  children: ReactNode
}

// The phone bottom sheet shared by MenuSheet (079) and FilterBar (083): a SwipeableDrawer from the
// bottom, so Escape, focus trap, backdrop tap and swipe-down all come with it. Rounded top corners,
// a drag handle, an optional title row. Like any SwipeableDrawer it stays mounted (hidden) while closed.
export function BottomSheet({ open, onOpen, onClose, ariaLabel, title, closeLabel, children }: BottomSheetProps) {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      disableDiscovery
      PaperProps={{
        'aria-label': ariaLabel,
        sx: { borderRadius: '20px 20px 0 0', maxHeight: '88%', px: 2, pt: 1, pb: 2.5 },
      }}
    >
      <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 99, bgcolor: 'divider', mx: 'auto', mt: 0.5, mb: 1.25 }} />
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle1" component="h2" fontWeight={700}>
            {title}
          </Typography>
          {closeLabel && (
            <IconButton aria-label={closeLabel} onClick={onClose} size="small" sx={{ bgcolor: 'divider' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
      {children}
    </SwipeableDrawer>
  )
}
