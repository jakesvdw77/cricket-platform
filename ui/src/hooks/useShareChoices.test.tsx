import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('useShareChoices storage behaviour', () => {
  afterEach(() => vi.restoreAllMocks())

  it('round trips a full set of choices through localStorage', async () => {
    const chosen = {
      ...DEFAULT_SHARE_CHOICES,
      format: 'TV' as const,
      templates: { ...DEFAULT_SHARE_CHOICES.templates, tv: 'LIGHT' as const, whatsapp: 'SCORECARD' as const },
      teams: 'ours' as const,
      imageSize: 'STORY' as const,
      tvPerformers: 2 as const,
      include: { ...DEFAULT_SHARE_CHOICES.include, tv: { batters: false, bowlers: true, playerOfTheMatchBar: false } },
      logos: { club: false, team: true, league: false },
      footerLine: false,
      sponsorIds: ['s1', 's2'],
      initialsOnly: true,
    }
    const first = renderHook(() => useShareChoices('club-1'))
    act(() => first.result.current[1](chosen))
    await waitFor(() => expect(localStorage.getItem(shareChoicesKey('club-1'))).not.toBeNull())
    first.unmount()

    const second = renderHook(() => useShareChoices('club-1'))
    await waitFor(() => expect(second.result.current[0]).toEqual(chosen))
  })

  it('keeps one club\'s choices out of another club\'s', async () => {
    const a = renderHook(() => useShareChoices('club-a'))
    act(() => a.result.current[1]({ format: 'PDF', initialsOnly: true }))
    await waitFor(() => expect(localStorage.getItem(shareChoicesKey('club-a'))).not.toBeNull())

    const b = renderHook(() => useShareChoices('club-b'))
    expect(b.result.current[0]).toEqual(DEFAULT_SHARE_CHOICES)
    expect(localStorage.getItem(shareChoicesKey('club-b'))).toBeNull()
  })

  it('falls back to the defaults, with no error, when reading localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { result } = renderHook(() => useShareChoices('club-1'))
    expect(result.current[0]).toEqual(DEFAULT_SHARE_CHOICES)
    // Choices still work for the visit even though nothing is read.
    act(() => result.current[1]({ format: 'IMAGE' }))
    await waitFor(() => expect(result.current[0].format).toBe('IMAGE'))
  })

  it('keeps working in memory when writing localStorage throws (quota or blocked)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useShareChoices('club-1'))
    act(() => result.current[1]({ teams: 'ours' }))
    await waitFor(() => expect(result.current[0].teams).toBe('ours'))
  })

  it('falls back to the defaults for corrupt JSON and for JSON that is not an object', async () => {
    for (const raw of ['{not json', 'null', '"text"', '42', '[1,2]']) {
      localStorage.setItem(shareChoicesKey('club-1'), raw)
      const { result, unmount } = renderHook(() => useShareChoices('club-1'))
      await waitFor(() => expect(result.current[0]).toEqual(DEFAULT_SHARE_CHOICES))
      unmount()
    }
  })

  it('drops stored values that are no longer valid but keeps the valid ones', async () => {
    localStorage.setItem(
      shareChoicesKey('club-1'),
      JSON.stringify({ format: 'IMAGE', templates: { image: 'RETIRED', pdf: 'COMPACT' }, sponsorIds: ['1', '2', '3', '4', '5'] }),
    )
    const { result } = renderHook(() => useShareChoices('club-1'))
    await waitFor(() => expect(result.current[0].format).toBe('IMAGE'))
    expect(result.current[0].templates.image).toBe('CLUB_GREEN')
    expect(result.current[0].templates.pdf).toBe('COMPACT')
    expect(result.current[0].sponsorIds).toEqual(['1', '2', '3', '4'])
  })
})

describe('useShareChoices quick changes', () => {
  it('keeps both of two quick toggles in different formats (no stale snapshot overwrites the other)', async () => {
    const { result } = renderHook(() => useShareChoices('club-1'))
    const update = result.current[1]

    act(() => {
      update({ include: { whatsapp: { emoji: false } } })
      update({ include: { facebook: { hashtags: false } } })
      update({ include: { whatsapp: { attachImage: false } } })
    })

    expect(result.current[0].include.whatsapp).toEqual({ emoji: false, attachImage: false })
    expect(result.current[0].include.facebook.hashtags).toBe(false)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(shareChoicesKey('club-1')) as string).include.facebook.hashtags).toBe(false))
  })
})
