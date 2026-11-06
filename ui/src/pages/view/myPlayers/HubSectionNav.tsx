import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { Box, IconButton } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'

// docs/specs/145 (owner, 2026-11-06): the Results page is a few sections one under another (the hero, the cards, All Cards) and landing exactly on
// the next one by scrolling is fiddly on a phone. Two translucent floating arrows jump one section up or down; each shows only when there is a
// section in that direction. The sections are whatever carries `data-hub-section` (with `data-hub-label` for the accessible name) inside `container`.
// It must be rendered as the LAST child of a plain block wrapper that also holds the content: a sticky element is confined to its containing
// block, so inside a grid item (a zero-height grid area at the bottom) it could not follow the viewport.

const SECTION = '[data-hub-section]'
const READ_LINE = 140 // a section counts as current once its top is within this many pixels of the top of the scroll area

function scrollParent(from: HTMLElement | null): HTMLElement | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el
  }
  return null
}

const reducedMotion = (): boolean => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const buttonSx = {
  width: 48,
  height: 48,
  color: HUB.cream,
  bgcolor: blackAlpha(0.45),
  border: `1px solid ${HUB.line}`,
  backdropFilter: 'blur(6px)',
  opacity: 0.85,
  '&:hover': { bgcolor: blackAlpha(0.6), opacity: 1 },
  '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2, opacity: 1 },
} as const

export function HubSectionNav({ container }: { container: RefObject<HTMLElement | null> }) {
  const [state, setState] = useState<{ count: number; active: number; labels: string[] }>({ count: 0, active: 0, labels: [] })

  const measure = useCallback(() => {
    const root = container.current
    if (!root) return
    const sections = Array.from(root.querySelectorAll<HTMLElement>(SECTION))
    const parent = scrollParent(root)
    const top = parent ? parent.getBoundingClientRect().top : 0
    let active = 0
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= top + READ_LINE) active = index
    })
    const labels = sections.map((section) => section.dataset.hubLabel ?? '')
    setState((previous) =>
      previous.count === sections.length && previous.active === active && previous.labels.join('|') === labels.join('|') ? previous : { count: sections.length, active, labels },
    )
  }, [container])

  useEffect(() => {
    const root = container.current
    measure()
    const parent = scrollParent(root)
    const target: HTMLElement | Window = parent ?? window
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The sections change as rows load; re-measure when the content grows or shrinks.
    const observer = typeof ResizeObserver === 'undefined' || !root ? null : new ResizeObserver(schedule)
    if (observer && root) observer.observe(root)
    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [container, measure])

  const jump = (direction: -1 | 1) => {
    const sections = Array.from(container.current?.querySelectorAll<HTMLElement>(SECTION) ?? [])
    const target = sections[state.active + direction]
    target?.scrollIntoView?.({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  if (state.count < 2) return null
  const upLabel = state.labels[state.active - 1]
  const downLabel = state.labels[state.active + 1]
  const showUp = state.active > 0
  const showDown = state.active < state.count - 1

  return (
    <Box data-testid="hub-section-nav" sx={{ position: 'sticky', bottom: 16, height: 0, zIndex: 5, pointerEvents: 'none' }}>
      <Box sx={{ position: 'absolute', right: 0, bottom: 0, display: 'grid', gap: 1, pointerEvents: 'auto' }}>
        {showUp && (
          <IconButton aria-label={`Jump To ${upLabel || 'Previous Section'}`} onClick={() => jump(-1)} sx={buttonSx}>
            <ExpandLessIcon />
          </IconButton>
        )}
        {showDown && (
          <IconButton aria-label={`Jump To ${downLabel || 'Next Section'}`} onClick={() => jump(1)} sx={buttonSx}>
            <ExpandMoreIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
