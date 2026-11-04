import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { usePollActions } from './usePollActions'
import type { PollActionsOptions } from './usePollActions'

vi.mock('../../../api/matchAvailabilityApi', () => ({
  closePoll: vi.fn(),
  deletePoll: vi.fn(),
  openPoll: vi.fn(),
  updatePollCloseTime: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const base: PollActionsOptions = {
  clubId: 'club-1',
  target: { kind: 'GROUP', roundId: 'round-1' },
  title: 'Saturday fixtures',
  open: true,
  autoClose: true,
  scheduledCloseAt: null,
  kickoff: '2030-06-01T09:00:00Z',
  canReopen: true,
  description: { roundId: 'round-1', text: 'Saturday fixtures' },
  onChanged: vi.fn(),
  onDeleted: vi.fn(),
  renderShare: () => null,
  renderMatches: () => null,
  placement: 'row',
  responsesTo: '/manage/availability/group/round-1',
  openMatchTo: '/manage/matches/m1',
}

const titles = (options: Partial<PollActionsOptions>) =>
  renderHook(() => usePollActions({ ...base, ...options }), { wrapper }).result.current.items.map((item) => item.title)

describe('usePollActions item order', () => {
  it('row: Open Responses first, then close time, description, matches, close, delete, Share Invite last', () => {
    expect(titles({ placement: 'row' })).toEqual([
      'Open Responses',
      'Edit Close Time',
      'Edit Description',
      'Matches Covered',
      'Close Poll',
      'Delete Poll',
      'Share Invite',
    ])
  })

  it('page: description first, no Open Responses, Open Match before Matches Covered, Share Invite last', () => {
    expect(titles({ placement: 'page' })).toEqual([
      'Edit Description',
      'Edit Close Time',
      'Close Poll',
      'Open Match',
      'Matches Covered',
      'Delete Poll',
      'Share Invite',
    ])
  })

  it('omits items the poll kind does not have', () => {
    expect(titles({ placement: 'row', description: undefined, renderMatches: undefined, openMatchTo: undefined })).toEqual([
      'Open Responses',
      'Edit Close Time',
      'Close Poll',
      'Delete Poll',
      'Share Invite',
    ])
  })
})

describe('usePollActions closed poll', () => {
  const closed = { open: false }

  it('offers Reopen Poll instead of Edit Close Time and no Close Poll, and disables Share Invite with a reason', () => {
    const { result } = renderHook(() => usePollActions({ ...base, ...closed }), { wrapper })
    const items = result.current.items
    expect(items.map((item) => item.title)).toEqual(['Open Responses', 'Reopen Poll', 'Edit Description', 'Matches Covered', 'Delete Poll', 'Share Invite'])
    const share = items.find((item) => item.id === 'share')
    expect(share?.disabled).toBe(true)
    expect(share?.reason).toBeTruthy()
  })

  it('disables Reopen Poll with a reason when every match is in the past', () => {
    const { result } = renderHook(() => usePollActions({ ...base, ...closed, canReopen: false }), { wrapper })
    const reopen = result.current.items.find((item) => item.id === 'reopen')
    expect(reopen?.disabled).toBe(true)
    expect(reopen?.reason).toBeTruthy()
  })

  it('marks Delete Poll as an error tone', () => {
    const { result } = renderHook(() => usePollActions(base), { wrapper })
    expect(result.current.items.find((item) => item.id === 'delete')?.tone).toBe('error')
  })
})
