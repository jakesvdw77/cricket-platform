import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  afterEach(() => {
    document.title = ''
  })

  it('sets the title and restores the previous one on unmount', () => {
    document.title = 'Cricket Legend'
    const { unmount } = renderHook(() => useDocumentTitle('Players · Availability'))

    expect(document.title).toBe('Players · Availability')
    unmount()
    expect(document.title).toBe('Cricket Legend')
  })

  it('follows a changed title', () => {
    document.title = 'Cricket Legend'
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), { initialProps: { title: 'A' } })
    rerender({ title: 'B' })

    expect(document.title).toBe('B')
  })

  it('leaves the title alone without one', () => {
    document.title = 'Cricket Legend'
    renderHook(() => useDocumentTitle(undefined))

    expect(document.title).toBe('Cricket Legend')
  })
})
