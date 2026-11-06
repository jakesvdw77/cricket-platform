import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography } from '@mui/material'
import { HUB, hubPageHeading } from './hubStyle'

// docs/specs/145 decision 15: the fixed band across the top of the Hub console is the page's header. HubFrame provides this context
// (the slot element inside the band, and a way for a header to claim the band so the fallback text steps aside); HubPageHeader draws
// the page title (the page's single h1) and its controls into the slot. Outside a frame it renders inline, as the old heading did.
export interface HubHeaderSlot {
  slot: HTMLElement | null
  claim: () => () => void
}

const HubHeaderContext = createContext<HubHeaderSlot | null>(null)
export const HubHeaderProvider = HubHeaderContext.Provider

export function useHubHeaderState() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [claims, setClaims] = useState(0)
  const value = useMemo<HubHeaderSlot>(
    () => ({
      slot,
      claim: () => {
        setClaims((count) => count + 1)
        return () => setClaims((count) => count - 1)
      },
    }),
    [slot],
  )
  return { value, setSlot, claimed: claims > 0 }
}

// `context` is an optional second line under the title (what the page is showing, e.g. the active filters), kept visible while the content scrolls.
export function HubPageHeader({ title, actions, context }: { title: string; actions?: ReactNode; context?: ReactNode }) {
  const frame = useContext(HubHeaderContext)
  const claim = frame?.claim
  useLayoutEffect(() => claim?.(), [claim])

  if (!frame) {
    if (!actions && !context) {
      return (
        <Typography component="h2" sx={hubPageHeading}>
          {title}
        </Typography>
      )
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, minHeight: 44 }}>
        <Box sx={{ minWidth: 0, display: 'grid', gap: 0.75 }}>
          <Typography component="h2" sx={hubPageHeading}>
            {title}
          </Typography>
          {context}
        </Box>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{actions}</Box>}
      </Box>
    )
  }
  if (!frame.slot) return null
  // The context (the active filters) sits on the SAME line as the title from sm up (owner, 2026-11-06: under the title it looked detached); only
  // on a narrow phone, where title, tags and controls cannot share a row, does it drop to a second line.
  return createPortal(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', minWidth: 0, minHeight: context ? { xs: 80, sm: 'auto' } : undefined }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, alignItems: 'center', columnGap: 2, rowGap: 0.75 }}>
        <Typography component="h1" noWrap sx={{ ...bandTitle, flex: 'none', maxWidth: '100%' }}>
          {title}
        </Typography>
        {context && <Box sx={{ minWidth: 0, flex: { xs: '1 1 100%', sm: '1 1 0' }, overflow: 'hidden' }}>{context}</Box>}
      </Box>
      {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>{actions}</Box>}
    </Box>,
    frame.slot,
  )
}

export const bandTitle = {
  fontFamily: HUB.display,
  fontWeight: 700,
  fontSize: { xs: 22, md: 'clamp(24px, 3vw, 32px)' },
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  lineHeight: 1,
  textAlign: 'left',
  m: 0,
} as const
