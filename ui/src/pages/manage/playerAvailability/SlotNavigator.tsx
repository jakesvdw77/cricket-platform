import { useCallback, useEffect, useState } from 'react'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { Box, IconButton, Typography } from '@mui/material'
import { readSlotStarts, scrollBehaviour, slotLabelText, slotNavState } from './slotNavigation'
import type { SlotNavState } from './slotNavigation'

interface Measured {
  nav: SlotNavState
  labels: string[]
}

const EMPTY: Measured = { nav: { index: -1, previousLeft: null, nextLeft: null }, labels: [] }

export interface SlotNavigatorProps {
  // The grid's scroll box (null while it is not on screen: nothing is shown then).
  scrollBox: HTMLElement | null
}

// docs/specs/093: "Previous slot" / "Next slot" for a sideways-scrolling match grid. Ordinary scrolling is untouched; the
// arrows scroll to the start of the previous or next day-and-slot group, and the label says which group is at the left.
export function SlotNavigator({ scrollBox }: SlotNavigatorProps) {
  const [measured, setMeasured] = useState<Measured>(EMPTY)

  const measure = useCallback(() => {
    if (!scrollBox) return
    const starts = readSlotStarts(scrollBox)
    const maxScrollLeft = scrollBox.scrollWidth - scrollBox.clientWidth
    const nav = slotNavState(
      starts.map((start) => start.left),
      scrollBox.scrollLeft,
      maxScrollLeft,
    )
    const labels = starts.map((start) => start.label)
    setMeasured((current) =>
      current.nav.index === nav.index &&
      current.nav.previousLeft === nav.previousLeft &&
      current.nav.nextLeft === nav.nextLeft &&
      current.labels.length === labels.length &&
      current.labels.every((label, position) => label === labels[position])
        ? current
        : { nav, labels },
    )
  }, [scrollBox])

  useEffect(() => {
    if (!scrollBox) {
      setMeasured(EMPTY)
      return undefined
    }
    // At most one measurement per frame while scrolling or resizing.
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    measure()
    scrollBox.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resizeObserver?.observe(scrollBox)
    // The groups change when the data or the filters do.
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule)
    mutationObserver?.observe(scrollBox, { childList: true, subtree: true })
    return () => {
      scrollBox.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [scrollBox, measure])

  if (!scrollBox || measured.nav.index < 0) return null

  const { nav, labels } = measured
  const go = (left: number | null) => {
    if (left !== null) scrollBox.scrollTo({ left, behavior: scrollBehaviour() })
  }

  return (
    <Box role="group" aria-label="Slot navigation" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      <IconButton size="small" aria-label="Previous slot" disabled={nav.previousLeft === null} onClick={() => go(nav.previousLeft)}>
        <ChevronLeft fontSize="small" />
      </IconButton>
      <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {slotLabelText(labels[nav.index] ?? '', nav.index, labels.length)}
      </Typography>
      <IconButton size="small" aria-label="Next slot" disabled={nav.nextLeft === null} onClick={() => go(nav.nextLeft)}>
        <ChevronRight fontSize="small" />
      </IconButton>
    </Box>
  )
}
