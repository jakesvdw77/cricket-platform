import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/meApi'
import { useProfileSwitch } from './useProfileSwitch'

const useMyProfiles = vi.fn()
vi.mock('../api/meApi', () => ({ useMyProfiles: () => useMyProfiles() }))

// docs/specs/119 slice 4: the switcher's items exist only for a person with more than one profile card.
const players: Profile = { kind: 'MY_PLAYERS', title: 'My players', subtitle: 'Sam and 1 more', landing: '/account', pendingCount: 0 }
const riverside: Profile = { kind: 'MANAGER', title: 'Manager of Riverside CC', clubId: 'c1', clubName: 'Riverside CC', clubSlug: 'riverside', landing: '/manage', pendingCount: 0 }

function render(path: string) {
  let location = ''
  const Probe = () => {
    location = useLocation().pathname
    return null
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      {children}
      <Probe />
    </MemoryRouter>
  )
  return { ...renderHook(() => useProfileSwitch(), { wrapper }), location: () => location }
}

beforeEach(() => {
  useMyProfiles.mockReset()
  localStorage.clear()
})

describe('useProfileSwitch', () => {
  it('is undefined while loading, with no profiles and with a single profile', () => {
    for (const data of [undefined, [], [players]]) {
      useMyProfiles.mockReturnValue({ data })
      expect(render('/account').result.current).toBeUndefined()
    }
  })

  it('lists every card with the subtitle (or the club name) and marks the one for the current area', () => {
    useMyProfiles.mockReturnValue({ data: [players, riverside] })

    const account = render('/account/players/k').result.current
    expect(account?.map((item) => [item.key, item.title, item.subtitle, item.active])).toEqual([
      ['MY_PLAYERS:', 'My players', 'Sam and 1 more', true],
      ['MANAGER:c1', 'Manager of Riverside CC', 'Riverside CC', false],
    ])

    const manage = render('/manage/players').result.current
    expect(manage?.map((item) => item.active)).toEqual([false, true])
  })

  it('choosing a card navigates to its landing', () => {
    useMyProfiles.mockReturnValue({ data: [players, riverside] })
    const hook = render('/manage')

    act(() => hook.result.current?.[0].onChoose())

    expect(hook.location()).toBe('/account')
  })
})
