import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { Button } from '../Button'
import { PageBackdrop, BACKDROP_COLOURS } from '../PageBackdrop'
import { BRAND, FONT_DISPLAY, creamAlpha } from '../../brandTokens'
import { StatusIllustration } from './StatusIllustration'

// docs/standards/design-system.md, StatusScreen: the one full-page look for "you cannot be here" and "something is wrong"
// states: the dark cricket-scene PageBackdrop, the Cricket Legend mark, an illustration, a friendly cricket heading, one plain
// sentence and one or two actions. No header or footer, so it suits signed-in and signed-out people and fits a 375 px phone.
export type StatusKind = 'not-authorised' | 'signed-out' | 'suspended' | 'session-expired' | 'not-found' | 'unreachable' | 'error'

export interface StatusAction {
  label: string
  onClick?: () => void
  href?: string
}

export interface StatusScreenProps {
  kind: StatusKind
  title?: string
  message?: string
  // Omitted: the kind's default. `null`: none.
  primaryAction?: StatusAction | null
  secondaryAction?: StatusAction | null
  // Pins the screen over everything else (the unreachable guard).
  overlay?: boolean
  children?: ReactNode
}

const COPY: Record<StatusKind, { title: string; message: string }> = {
  'not-authorised': { title: 'Not out, but not in either', message: 'You do not have access to this area. If that seems wrong, ask your club to check your access.' },
  'signed-out': { title: 'Stumps for today', message: 'You have been signed out. Sign in again whenever you are ready.' },
  suspended: { title: 'Play is suspended', message: 'Your account is disabled. Please contact your club.' },
  'session-expired': { title: 'Your innings has ended', message: 'Your session has expired. Sign in again to carry on.' },
  'not-found': { title: 'Not on the scorecard', message: 'We cannot find that page. It may have moved, or the address may be mistyped.' },
  unreachable: { title: 'Rain stopped play', message: 'We cannot reach the server right now. Check your connection and try again.' },
  error: { title: 'Dropped catch', message: 'Something went wrong on our side. Try again, and if it keeps happening let your club know.' },
}

const reload = () => window.location.reload()

const DEFAULT_ACTIONS: Record<StatusKind, { primary: StatusAction | null; secondary: StatusAction | null }> = {
  'not-authorised': { primary: { label: 'Back to home', href: '/' }, secondary: null },
  'signed-out': { primary: { label: 'Sign in', href: '/login' }, secondary: null },
  suspended: { primary: null, secondary: null },
  'session-expired': { primary: { label: 'Sign in again', href: '/login' }, secondary: null },
  'not-found': { primary: { label: 'Back to home', href: '/' }, secondary: null },
  unreachable: { primary: { label: 'Try again', onClick: reload }, secondary: null },
  error: { primary: { label: 'Try again', onClick: reload }, secondary: { label: 'Back to home', href: '/' } },
}

const goldSx = { bgcolor: BRAND.gold, color: BRAND.ink, '&:hover': { bgcolor: BRAND.goldLight } }
const outlineSx = { color: BACKDROP_COLOURS.cream, borderColor: BACKDROP_COLOURS.cream, '&:hover': { borderColor: BACKDROP_COLOURS.cream, bgcolor: creamAlpha(0.12) } }

function ActionButton({ action, primary }: { action: StatusAction; primary: boolean }) {
  return (
    <Button
      size="compact"
      variant={primary ? 'primary' : 'secondary'}
      href={action.href}
      onClick={action.onClick}
      sx={{ minHeight: 40, px: 2.5, fontSize: '0.9375rem', ...(primary ? goldSx : outlineSx) }}
    >
      {action.label}
    </Button>
  )
}

export function StatusScreen({ kind, title, message, primaryAction, secondaryAction, overlay = false, children }: StatusScreenProps) {
  const copy = COPY[kind]
  const primary = primaryAction === undefined ? DEFAULT_ACTIONS[kind].primary : primaryAction
  const secondary = secondaryAction === undefined ? DEFAULT_ACTIONS[kind].secondary : secondaryAction
  const screen = (
    <PageBackdrop>
      <Box
        component="main"
        data-testid="status-screen"
        data-kind={kind}
        sx={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, textAlign: 'center', px: 3, py: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: BACKDROP_COLOURS.cream, mb: 1 }}>
          <Box component="img" src="/favicon.svg" alt="" width={32} height={32} />
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>Cricket Legend</Typography>
        </Box>
        <StatusIllustration kind={kind} />
        <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 30, sm: 40 }, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1.05, color: BACKDROP_COLOURS.cream }}>
          {title ?? copy.title}
        </Typography>
        <Typography sx={{ maxWidth: 420, fontSize: { xs: 16, sm: 17 }, color: creamAlpha(0.88) }}>{message ?? copy.message}</Typography>
        {children}
        {(primary || secondary) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5, mt: 1.5 }}>
            {primary && <ActionButton action={primary} primary />}
            {secondary && <ActionButton action={secondary} primary={false} />}
          </Box>
        )}
      </Box>
    </PageBackdrop>
  )
  if (!overlay) return screen
  return <Box sx={{ position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.modal + 20, display: 'flex', '& > *': { flex: 1 } }}>{screen}</Box>
}
