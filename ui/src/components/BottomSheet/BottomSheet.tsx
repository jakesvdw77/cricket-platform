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
  // Lift the sheet above dialogs, for a sheet opened from inside one (a dialog's z-index is higher than a drawer's).
  aboveDialogs?: boolean
  // docs/specs/120: 'dark' is the platform chrome look (the phone Menu sheet); 'light' (default) is every other sheet, unchanged.
  tone?: 'light' | 'dark'
  children: ReactNode
}

// The phone bottom sheet shared by MenuSheet (079) and FilterBar (083): a SwipeableDrawer from the
// bottom, so Escape, focus trap, backdrop tap and swipe-down all come with it. Rounded top corners,
// a drag handle, an optional title row. Like any SwipeableDrawer it stays mounted (hidden) while closed.
export function BottomSheet({ open, onOpen, onClose, ariaLabel, title, closeLabel, aboveDialogs, tone = 'light', children }: BottomSheetProps) {
  const dark = tone === 'dark'
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      disableDiscovery
      sx={aboveDialogs ? { zIndex: (theme) => theme.zIndex.modal + 1 } : undefined}
      PaperProps={{
        'aria-label': ariaLabel,
        sx: {
          borderRadius: '20px 20px 0 0',
          maxHeight: '88%',
          px: 2,
          pt: 1,
          pb: 2.5,
          ...(dark && { bgcolor: 'chrome.menu', color: 'chrome.text', backgroundImage: 'none' }),
        },
      }}
    >
      <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 99, bgcolor: dark ? 'chrome.text' : 'divider', opacity: dark ? 0.5 : 1, mx: 'auto', mt: 0.5, mb: 1.25 }} />
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography
            variant="subtitle1"
            component="h2"
            fontWeight={700}
            sx={dark ? { fontFamily: (theme) => theme.typography.fontFamilyDisplay, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase' } : undefined}
          >
            {title}
          </Typography>
          {closeLabel && (
            <IconButton
              aria-label={closeLabel}
              onClick={onClose}
              size="small"
              sx={dark ? { bgcolor: 'chrome.hover', color: 'chrome.text', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'chrome.text', outlineOffset: 2 } } : { bgcolor: 'divider' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
      {children}
    </SwipeableDrawer>
  )
}
