import { useState } from 'react'
import type { DragEvent } from 'react'
import { moveId, placeAtPosition, placeAtSlot } from '../utils/reorderRows'

export interface UseReorderableRowsOptions {
  // The ids of the rows in their current order (only the listed, numbered rows; a holding area is not part of it).
  ids: string[]
  // The most rows the list may hold (batting places); omitted, no limit.
  maxPlaces?: number | null
  // The full new order. Called with the whole list, never a patch.
  onReorder: (ids: string[]) => void
}

export interface RowDragOptions {
  // The row's slot among the listed rows as drawn.
  index: number
  // Whether the row is a drop target (a listed row; a row waiting in a holding area is not).
  accepts: boolean
}

// docs/specs/076-team-selection.md, extracted from TeamSelectionList for docs/specs/101 (the scorecard's batting and
// bowling order): the drag-and-drop state of a reorderable list, plus the move / position / drop operations, all
// expressed as "the full new id order". Native HTML5 drag events, as the team selection list has always used; touch and
// keyboard reach the same result through components/PlayerRowMenu (Move up, Move down, a position field).
export function useReorderableRows({ ids, maxPlaces = null, onReorder }: UseReorderableRowsOptions) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [holdingOver, setHoldingOver] = useState(false)

  const resetDrag = () => {
    setDragId(null)
    setDropIndex(null)
    setHoldingOver(false)
  }

  const move = (id: string, direction: -1 | 1) => {
    const next = moveId(ids, id, direction)
    if (next) onReorder(next)
  }

  // Places `id` at the typed 1-based position. Returns whether the order changed.
  const commitPosition = (id: string, text: string): boolean => {
    const next = placeAtPosition(ids, id, text, maxPlaces)
    if (next) onReorder(next)
    return next !== null
  }

  // index is the target slot among the listed rows as drawn (0..ids.length).
  const dropAt = (index: number) => {
    if (!dragId) return
    const id = dragId
    resetDrag()
    const next = placeAtSlot(ids, id, index, maxPlaces)
    if (next) onReorder(next)
  }

  // Drops a dragged listed row out of the list (into a holding area).
  const dropOut = () => {
    const id = dragId
    resetDrag()
    if (id && ids.includes(id)) onReorder(ids.filter((candidate) => candidate !== id))
  }

  // The drag attributes of one row (spread onto the draggable element).
  const rowDragProps = (id: string, { index, accepts }: RowDragOptions, disabled = false) => ({
    draggable: !disabled,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
      setDragId(id)
    },
    onDragEnd: resetDrag,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!dragId || !accepts) return
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      setHoldingOver(false)
      setDropIndex(event.clientY < rect.top + rect.height / 2 ? index : index + 1)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!dragId || !accepts) return
      event.preventDefault()
      event.stopPropagation()
      dropAt(dropIndex ?? index)
    },
  })

  return {
    ids,
    dragId,
    dropIndex,
    holdingOver,
    setDropIndex,
    setHoldingOver,
    resetDrag,
    move,
    commitPosition,
    dropAt,
    dropOut,
    rowDragProps,
    // True when the list is at its limit, so a row from outside cannot be dropped in.
    full: maxPlaces != null && ids.length >= maxPlaces,
  }
}

export type ReorderableRows = ReturnType<typeof useReorderableRows>
