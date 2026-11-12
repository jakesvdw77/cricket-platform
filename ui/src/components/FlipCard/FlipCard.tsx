import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, blackAlpha } from '../../brandTokens'

// docs/specs/147 section 4: a generic, Hub-agnostic two-faced card. The whole card is ONE real <button> stretched over it (the 135
// stretched-link pattern); a drill link or a dot inside a face sits above it. Both faces are always in the DOM and the accessibility
// tree, front then back, each a labelled group; the face that is not showing is hidden visually only (backface and pointer-events),
// never aria-hidden, display none or visibility hidden. Controls on the face that is not showing leave the tab order through
// FaceActive (useFaceTabIndex) but their text stays readable. Flip state is local, never stored, and resets when `scopeKey` changes.
// Motion: a 0.7 s rotation about the Y axis (transform only, backface-visibility hidden); under prefers-reduced-motion there is no
// rotation, only a 150 ms cross-fade. The faces share one grid cell whose row is `minmax(0, 1fr)`: the card fills its parent (height 100%) and a face never makes it taller, so a parent with a fixed height gives a fixed-height card (a face scrolls its own content); in a parent with no height the card is as tall as its taller face.

export const FLIP_MS = 700
export const FADE_MS = 150
const DEFAULT_RADIUS = '22px'

// True while the face that contains the reader is the one showing.
const FaceActiveContext = createContext(true)
export const FaceActiveProvider = FaceActiveContext.Provider
export const useFaceActive = (): boolean => useContext(FaceActiveContext)
// tabIndex for a control inside a face: untouched on the showing face, -1 on the hidden one.
export const useFaceTabIndex = (): -1 | undefined => (useFaceActive() ? undefined : -1)

// prefers-reduced-motion, read live (a change while the page is open takes effect on the next flip).
export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [reduced, setReduced] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(query)
    const onChange = () => setReduced(media.matches)
    onChange()
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

export interface FlipCardProps {
  // The card's title: the stretched button is named "Flip <label>".
  label: string
  front: ReactNode
  back: ReactNode
  // Controlled use: pass `flipped` and handle `onFlip`. Uncontrolled: `defaultFlipped` is the starting side.
  flipped?: boolean
  defaultFlipped?: boolean
  onFlip?: (flipped: boolean) => void
  // When this changes (a new scope) an uncontrolled card goes back to its starting side.
  scopeKey?: string
  // id of the element holding the card's one-sentence summary (aria-describedby of the button).
  describedBy?: string
  testId?: string
  // The corner radius of the faces and of the flip button's focus ring; default 22px.
  radius?: string
}

export function FlipCard({ label, front, back, flipped, defaultFlipped = false, onFlip, scopeKey = '', describedBy, testId = 'flip-card', radius = DEFAULT_RADIUS }: FlipCardProps) {
  const reduced = usePrefersReducedMotion()
  const [local, setLocal] = useState(defaultFlipped)
  const [seenScope, setSeenScope] = useState(scopeKey)
  if (seenScope !== scopeKey) {
    setSeenScope(scopeKey)
    setLocal(defaultFlipped)
  }
  const showingBack = flipped ?? local
  const toggle = () => {
    const next = !showingBack
    if (flipped === undefined) setLocal(next)
    onFlip?.(next)
  }

  const face = (active: boolean, isBack: boolean): SxProps<Theme> => ({
    gridArea: '1 / 1',
    minWidth: 0,
    minHeight: 0,
    borderRadius: radius,
    // The face is never removed from the tree; only what the eye and the pointer reach changes.
    pointerEvents: 'none',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    ...(reduced
      ? { opacity: active ? 1 : 0, transition: `opacity ${FADE_MS}ms linear` }
      : { transform: isBack ? 'rotateY(180deg)' : 'none' }),
    // A link or button inside the showing face is reachable above the stretched button.
    ...(active ? { '& a, & button, & [data-flip-interactive]': { pointerEvents: 'auto', position: 'relative', zIndex: 2 } } : {}),
  })

  return (
    <Box data-testid={testId} data-flipped={showingBack ? 'true' : 'false'} sx={{ position: 'relative', minWidth: 0, height: '100%', perspective: '1400px', borderRadius: radius }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1fr)',
          gridTemplateColumns: 'minmax(0, 1fr)',
          minWidth: 0,
          height: '100%',
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'none',
          transformStyle: reduced ? 'flat' : 'preserve-3d',
          willChange: reduced ? 'auto' : 'transform',
          transition: reduced ? 'none' : `transform ${FLIP_MS}ms cubic-bezier(.4, .1, .2, 1)`,
          transform: !reduced && showingBack ? 'rotateY(180deg)' : 'none',
        }}
      >
        <Box role="group" aria-label="Front" data-testid={`${testId}-front`} sx={face(!showingBack, false)}>
          <FaceActiveProvider value={!showingBack}>{front}</FaceActiveProvider>
        </Box>
        <Box role="group" aria-label="Back" data-testid={`${testId}-back`} sx={face(showingBack, true)}>
          <FaceActiveProvider value={showingBack}>{back}</FaceActiveProvider>
        </Box>
      </Box>
      <Box
        component="button"
        type="button"
        aria-pressed={showingBack}
        aria-label={`Flip ${label}`}
        aria-describedby={describedBy}
        data-testid={`${testId}-flip`}
        onClick={toggle}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          minHeight: 44,
          m: 0,
          p: 0,
          border: 0,
          borderRadius: radius,
          background: 'transparent',
          cursor: 'pointer',
          WebkitTapHighlightColor: alpha(BRAND.gold, 0.18),
          '&:hover': { backgroundColor: blackAlpha(0.06) },
          '&:focus-visible': { outline: `3px solid ${BRAND.gold}`, outlineOffset: 3 },
        }}
      />
    </Box>
  )
}
