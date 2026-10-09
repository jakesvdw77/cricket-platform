import type { SystemStyleObject } from '@mui/system'
import type { Theme } from '@mui/material/styles'
import { dateHeading, slotLabel } from './gridHelpers'
import type { DateGroup, DatedColumn } from './gridHelpers'

// docs/specs/093: Previous slot / Next slot arrows for the three sideways-scrolling match grids. The grids keep their
// normal scrolling; these helpers find the day-and-slot groups in the grid's DOM and work out where an arrow scrolls to.

export const SLOT_START_ATTR = 'data-slot-start'
export const SLOT_LABEL_ATTR = 'data-slot-label'
export const FIRST_COL_ATTR = 'data-first-col'

export interface SlotAttrs {
  'data-slot-start': string
  'data-slot-label': string
}

// The attributes for the first column header of each day-and-slot group, keyed by `idOf(column)`. Built from groupGames'
// output so the navigator's groups are exactly the header's groups.
export function slotStartAttrs<T extends DatedColumn>(groups: DateGroup<T>[], idOf: (column: T) => string): Map<string, SlotAttrs> {
  const byColumn = new Map<string, SlotAttrs>()
  for (const group of groups) {
    for (const slot of group.slots) {
      const first = slot.games[0]
      if (!first) continue
      const label = `${dateHeading(group.date)}, ${slotLabel(slot.dayPart)}`
      byColumn.set(idOf(first), { 'data-slot-start': `${group.dateKey}-${slot.dayPart}`, 'data-slot-label': label })
    }
  }
  return byColumn
}

// A group's first column header snaps to just after the sticky first column. The header's own scroll-margin-left (the
// first column's width, already set for scrollIntoView) is what offsets the snap area, so the box needs no scroll-padding
// (padding as well would count the first column twice).
export const slotSnapTargetSx: SystemStyleObject<Theme> = { scrollSnapAlign: 'start' }
// Gentle: proximity, never mandatory, and sideways only.
export const slotSnapBoxSx: SystemStyleObject<Theme> = { scrollSnapType: 'x proximity' }

export interface SlotStart {
  label: string
  // The scrollLeft at which the group's first column sits immediately after the sticky first column.
  left: number
}

export interface SlotNavState {
  index: number
  previousLeft: number | null
  nextLeft: number | null
}

// The current group is the one whose start is nearest the scroll position (a tie goes to the later group, so a box
// scrolled to its far end reports the last group even when that group's start cannot be reached). Starts beyond the
// furthest scroll position are clamped to it for the same reason. Previous and next are null at the ends.
export function slotNavState(starts: number[], scrollLeft: number, maxScrollLeft: number): SlotNavState {
  if (starts.length === 0) return { index: -1, previousLeft: null, nextLeft: null }
  const reachable = starts.map((start) => Math.max(0, Math.min(start, Math.max(0, maxScrollLeft))))
  let index = 0
  let best = Number.POSITIVE_INFINITY
  reachable.forEach((start, candidate) => {
    const distance = Math.abs(start - scrollLeft)
    if (distance <= best) {
      best = distance
      index = candidate
    }
  })
  return {
    index,
    previousLeft: index > 0 ? reachable[index - 1] : null,
    nextLeft: index < reachable.length - 1 ? reachable[index + 1] : null,
  }
}

// Measures the grid's groups from its DOM: each marked header's left edge in the box's scrolling content, less the first
// column's width. Needs layout, so it is not unit-tested in jsdom (slotNavState is).
export function readSlotStarts(box: HTMLElement): SlotStart[] {
  const boxLeft = box.getBoundingClientRect().left
  const firstCol = box.querySelector<HTMLElement>(`[${FIRST_COL_ATTR}]`)
  const firstColWidth = firstCol ? firstCol.getBoundingClientRect().width : 0
  return Array.from(box.querySelectorAll<HTMLElement>(`[${SLOT_START_ATTR}]`)).map((element) => ({
    label: element.getAttribute(SLOT_LABEL_ATTR) ?? '',
    left: Math.round(element.getBoundingClientRect().left - boxLeft + box.scrollLeft - firstColWidth),
  }))
}

export function slotLabelText(label: string, index: number, count: number): string {
  return `${label} (${index + 1} of ${count})`
}

// Smooth, unless the person has asked for less motion.
export function scrollBehaviour(): ScrollBehavior {
  const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduced ? 'auto' : 'smooth'
}
