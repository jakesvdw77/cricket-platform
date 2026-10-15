import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DragEvent } from 'react'
import { useReorderableRows } from './useReorderableRows'

const dragEvent = (clientY = 0) =>
  ({
    dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientY,
    currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 0 }) },
  }) as unknown as DragEvent<HTMLElement>

describe('useReorderableRows', () => {
  it('moves a row and commits a typed position as the full new order', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useReorderableRows({ ids: ['a', 'b', 'c'], onReorder }))

    result.current.move('b', -1)
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c'])
    expect(result.current.commitPosition('a', '3')).toBe(true)
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'c', 'a'])
    expect(result.current.commitPosition('b', '2')).toBe(false)
  })

  it('drags a row to a slot: top half drops before the row, bottom half after it', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useReorderableRows({ ids: ['a', 'b', 'c'], onReorder }))

    act(() => result.current.rowDragProps('a', { index: 0, accepts: true }).onDragStart(dragEvent()))
    expect(result.current.dragId).toBe('a')
    act(() => result.current.rowDragProps('c', { index: 2, accepts: true }).onDragOver(dragEvent(10)))
    expect(result.current.dropIndex).toBe(3)
    act(() => result.current.rowDragProps('c', { index: 2, accepts: true }).onDrop(dragEvent(10)))

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
    expect(result.current.dragId).toBeNull()
  })

  it('refuses a row from outside when the list is full, and accepts one when there is room', () => {
    const onReorder = vi.fn()
    const full = renderHook(() => useReorderableRows({ ids: ['a', 'b'], maxPlaces: 2, onReorder }))
    act(() => full.result.current.rowDragProps('x', { index: 0, accepts: false }).onDragStart(dragEvent()))
    act(() => full.result.current.dropAt(1))
    expect(onReorder).not.toHaveBeenCalled()
    expect(full.result.current.full).toBe(true)

    const roomy = renderHook(() => useReorderableRows({ ids: ['a', 'b'], maxPlaces: 3, onReorder }))
    act(() => roomy.result.current.rowDragProps('x', { index: 0, accepts: false }).onDragStart(dragEvent()))
    act(() => roomy.result.current.dropAt(1))
    expect(onReorder).toHaveBeenCalledWith(['a', 'x', 'b'])
  })

  it('ignores a drag over a row that does not accept', () => {
    const { result } = renderHook(() => useReorderableRows({ ids: ['a'], onReorder: vi.fn() }))
    act(() => result.current.rowDragProps('a', { index: 0, accepts: true }).onDragStart(dragEvent()))
    const event = dragEvent()
    act(() => result.current.rowDragProps('w', { index: 0, accepts: false }).onDragOver(event))
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('drops a listed row out of the list', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useReorderableRows({ ids: ['a', 'b'], onReorder }))
    act(() => result.current.rowDragProps('a', { index: 0, accepts: true }).onDragStart(dragEvent()))
    act(() => result.current.dropOut())
    expect(onReorder).toHaveBeenCalledWith(['b'])
  })
})
