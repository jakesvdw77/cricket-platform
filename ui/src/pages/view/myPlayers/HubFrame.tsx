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
          background: 'linear-gradient(180deg, #0a3322 0%, #072a1c 55%, #05201a 100%)',
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
            <Box component="svg" viewBox="0 0 600 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.3 }}>
              <circle cx="500" cy="110" r="64" fill="#E8B83D" opacity=".38" />
              <path d="M0 360 Q150 300 300 350 T600 330 V500 H0Z" fill="#0F5132" opacity=".75" />
              <path d="M0 420 Q200 380 400 415 T600 400 V500 H0Z" fill="#14633F" opacity=".7" />
              <path d="M430 330 L520 280 L600 330 V380 H430Z" fill="#0B3D26" opacity=".9" />
              <path d="M262 500 L300 420 L338 500Z" fill="#E2D5B0" opacity=".55" />
            </Box>
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
