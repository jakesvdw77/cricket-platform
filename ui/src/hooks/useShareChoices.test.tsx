import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useShareChoices } from './useShareChoices'
import { DEFAULT_SHARE_CHOICES, shareChoicesKey } from '../utils/share/shareChoices'

beforeEach(() => localStorage.clear())

describe('useShareChoices', () => {
  it('starts from the defaults and remembers a change for the club', async () => {
    const { result, unmount } = renderHook(() => useShareChoices('club-1'))
    expect(result.current[0]).toEqual(DEFAULT_SHARE_CHOICES)

    act(() => result.current[1]({ format: 'WHATSAPP' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(shareChoicesKey('club-1')) as string).format).toBe('WHATSAPP'))
    unmount()

    const again = renderHook(() => useShareChoices('club-1'))
    await waitFor(() => expect(again.result.current[0].format).toBe('WHATSAPP'))
  })

  it('sanitises a corrupt stored value', async () => {
    localStorage.setItem(shareChoicesKey('club-1'), JSON.stringify({ format: 'NOPE', teams: 5 }))
    const { result } = renderHook(() => useShareChoices('club-1'))

    await waitFor(() => expect(result.current[0].format).toBeNull())
    expect(result.current[0].teams).toBe('both')
  })
})
