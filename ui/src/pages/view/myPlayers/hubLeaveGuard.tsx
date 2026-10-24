import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { HUB, hubGoldButton, hubOutlineButton } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/121: one place that lets the footer Back and Escape ask a Profile sub view whether it holds unsaved input.
// The page owns the controller; a form registers its dirty state with useHubLeaveGuard and renders <HubLeaveConfirm />.
// A clean view leaves at once; a dirty one shows "Discard your changes?" inside the panel and leaves only on Discard.
interface Guard {
  setDirty: (dirty: boolean) => void
  confirming: boolean
  keep: () => void
  discard: () => void
}

const GuardContext = createContext<Guard | null>(null)
export const HubLeaveGuardProvider = GuardContext.Provider

export function useHubLeaveGuardController() {
  const dirtyRef = useRef(false)
  const pendingRef = useRef<(() => void) | null>(null)
  const [confirming, setConfirming] = useState(false)
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
    if (!dirty) setConfirming(false)
  }, [])
  const keep = useCallback(() => {
    pendingRef.current = null
    setConfirming(false)
  }, [])
  const discard = useCallback(() => {
    const go = pendingRef.current
    pendingRef.current = null
    dirtyRef.current = false
    setConfirming(false)
    go?.()
  }, [])
  const attempt = useCallback((go: () => void) => {
    if (dirtyRef.current) {
      pendingRef.current = go
      setConfirming(true)
    } else {
      go()
    }
  }, [])
  const guard = useMemo<Guard>(() => ({ setDirty, confirming, keep, discard }), [setDirty, confirming, keep, discard])
  return { guard, attempt }
}

// Registers the view's dirty state (cleared on unmount, so leaving after a save never prompts).
export function useHubLeaveGuard(dirty: boolean) {
  const guard = useContext(GuardContext)
  const setDirty = guard?.setDirty
  useEffect(() => {
    setDirty?.(dirty)
    return () => setDirty?.(false)
  }, [dirty, setDirty])
}

export function HubLeaveConfirm() {
  const guard = useContext(GuardContext)
  if (!guard?.confirming) return null
  return (
    <Box role="alert" data-testid="hub-leave-confirm" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, display: 'grid', gap: 1, bgcolor: blackAlpha(0.3) }}>
      <Typography fontSize={14}>Discard your changes?</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="compact" onClick={guard.discard} sx={hubOutlineButton}>
          Discard
        </Button>
        <Button size="compact" onClick={guard.keep} sx={hubGoldButton}>
          Keep editing
        </Button>
      </Box>
    </Box>
  )
}
