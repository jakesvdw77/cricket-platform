import type { ReactNode } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Button } from '../../../components/Button'
import { AccountShell } from '../AccountShell'
import { HUB, hubOutlineButton } from './hubStyle'

// docs/specs/119 3C: the dark console frame shared by the player hub, the picker and Find players: a title bar, an optional
// menu column on the left (desktop) or above (phone), the panel with the cricket scene, and an optional footer bar.
// Nothing opens over it; a sub-view replaces the panel and offers Back.
export interface HubFrameProps {
  title: string
  menu?: ReactNode
  footer?: ReactNode
  children: ReactNode
  maxWidth?: number
  testId?: string
  // Below md the title bar is slim by default; 'hidden' removes it (the hub shows its own headers there).
  phoneTitle?: 'slim' | 'hidden'
}

export function HubFrame({ title, menu, footer, children, maxWidth = 1040, testId, phoneTitle = 'slim' }: HubFrameProps) {
  return (
    <AccountShell bare maxWidth={maxWidth} testId={testId}>
      <Box
        sx={{
          border: `1px solid ${HUB.line}`,
          borderRadius: '6px',
          overflow: 'hidden',
          // Translucent so the page's own cricket-scene backdrop shows through (no scene of its own).
          background: 'linear-gradient(180deg, rgba(10,51,34,0.78) 0%, rgba(7,42,28,0.82) 55%, rgba(5,32,26,0.88) 100%)',
          backdropFilter: 'blur(1.5px)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
        }}
      >
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: { xs: 0.75, md: 1.75 }, borderBottom: `1px solid ${HUB.line}`, display: { xs: phoneTitle === 'hidden' ? 'none' : 'flex', md: 'flex' }, justifyContent: 'flex-end' }}>
          <Typography component="h1" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 22, md: 'clamp(24px, 3vw, 32px)' }, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1, textAlign: 'right' }}>
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: menu ? 'minmax(250px, 36%) 1fr' : '1fr' }, minHeight: { md: 480 }, minWidth: 0 }}>
          {menu}
          <Box component="section" aria-live="polite" sx={{ position: 'relative', overflow: 'hidden', p: { xs: '16px 16px', md: '26px 28px' }, minWidth: 0 }}>
            <Box sx={{ position: 'relative', display: 'grid', gap: 2.25 }}>{children}</Box>
          </Box>
        </Box>

        {footer && (
          <Box component="footer" sx={{ borderTop: `1px solid ${HUB.line}`, px: { xs: 2, md: 2.5 }, py: 1, bgcolor: 'rgba(0,0,0,.35)', display: 'flex' }}>
            {footer}
          </Box>
        )}
      </Box>
    </AccountShell>
  )
}

// The footer's Back slot.
export function HubFooterButton({ onClick, children, icon }: { onClick: () => void; children: string; icon?: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ minHeight: 44, gap: 1.25, fontFamily: HUB.display, fontWeight: 600, fontSize: 20, letterSpacing: '.12em', textTransform: 'uppercase', color: HUB.cream, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
    >
      {icon ?? <ArrowBackIcon sx={{ fontSize: 20 }} />}
      {children}
    </ButtonBase>
  )
}

// Outlined Back at the top left of the panel.
export function HubBackButton({ onClick, children = 'Back' }: { onClick: () => void; children?: string }) {
  return (
    <Box>
      <Button variant="secondary" size="compact" startIcon={<ArrowBackIcon />} onClick={onClick} sx={hubOutlineButton}>
        {children}
      </Button>
    </Box>
  )
}
