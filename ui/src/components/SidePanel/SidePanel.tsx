import type { ReactNode } from 'react'
import { Box, Drawer, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { BottomSheet } from '../BottomSheet'

export interface SidePanelProps {
  open: boolean
  onClose: () => void
  // Heading and accessible name of the panel.
  title: string
  closeLabel: string
  // The content; told whether the phone sheet is showing. Rendered only while the panel is open on a phone (the sheet
  // stays mounted when closed), and always inside the drawer (which unmounts its content when closed).
  children: (isPhone: boolean) => ReactNode
}

// docs/specs/084 + 085 (G): the slide-in panel chrome shared by the Availability counters' panels (players, polls) - a
// bottom sheet below sm, a 420 px right Drawer from sm up. Escape, backdrop, the close button and focus returning to the
// element that opened it come with the MUI Modal underneath.
export function SidePanel({ open, onClose, title, closeLabel, children }: SidePanelProps) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel={title} title={title} closeLabel={closeLabel}>
        {open && children(true)}
      </BottomSheet>
    )
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ 'aria-label': title, sx: { width: 420, maxWidth: '100vw', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h2" fontWeight={700}>
          {title}
        </Typography>
        <IconButton aria-label={closeLabel} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      {children(false)}
    </Drawer>
  )
}
