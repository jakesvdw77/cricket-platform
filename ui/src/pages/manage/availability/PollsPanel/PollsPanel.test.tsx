import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PollsPanel } from './PollsPanel'
import type { PollsPanelProps } from './PollsPanel'
import type { PollPanelRow } from '../pollPanelRows'

const NOW = new Date('2026-06-01T10:00:00Z').getTime()
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString()

const ROWS: PollPanelRow[] = [
  { key: 'closed', kind: 'SQUAD', title: 'Lions vs Old', open: false, autoClose: true, scheduledCloseAt: '2026-05-29T10:00:00Z', answered: 9, total: 11, path: '/manage/availability/squad/m2/s2' },
  { key: 'late', kind: 'SQUAD', title: 'Lions vs Rivals', open: true, autoClose: true, scheduledCloseAt: at(100), answered: 3, total: 11, path: '/manage/availability/squad/m1/s1' },
  { key: 'soon', kind: 'GROUP', title: 'Thursday 15 October - Over 40 fixtures', open: true, autoClose: true, scheduledCloseAt: at(30), answered: 15, total: 18, path: '/manage/availability/group/g1' },
  { key: 'manual', kind: 'GROUP', title: 'Manual round', open: true, autoClose: false, scheduledCloseAt: null, answered: 0, total: 5, path: '/manage/availability/group/g2' },
]

function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: !wide && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
afterEach(() => {
  delete window.matchMedia
})

function renderPanel(props: Partial<PollsPanelProps> = {}) {
  setViewport(true)
  return render(
    <MemoryRouter>
      <PollsPanel open onClose={vi.fn()} kind="all" rows={ROWS} showClosed scope="Vets › Over 40" now={NOW} {...props} />
    </MemoryRouter>,
  )
}

describe('PollsPanel', () => {
  it('lists one row per poll: title, Group / Squad, Open / Closed, close text and N of M answered, as a link', () => {
    renderPanel()

    const rows = screen.getAllByTestId('polls-panel-row')
    const soon = rows.find((row) => row.textContent?.includes('Thursday 15 October')) as HTMLElement
    expect(within(soon).getByRole('link')).toHaveAttribute('href', '/manage/availability/group/g1')
    expect(within(soon).getByText('Group')).toBeInTheDocument()
    expect(within(soon).getByText('Open')).toBeInTheDocument()
    expect(within(soon).getByRole('timer')).toBeInTheDocument()
    expect(within(soon).getByText('15 of 18 answered')).toBeInTheDocument()

    const closed = rows.find((row) => row.textContent?.includes('Lions vs Old')) as HTMLElement
    expect(within(closed).getByText('Squad')).toBeInTheDocument()
    expect(within(closed).getByText('Closed')).toBeInTheDocument()
    expect(within(closed).getByText(/^Closed /)).toBeInTheDocument()
    expect(within(closed).getByRole('link')).toHaveAttribute('href', '/manage/availability/squad/m2/s2')

    expect(within(rows.find((row) => row.textContent?.includes('Manual round')) as HTMLElement).getByText('Closes manually')).toBeInTheDocument()
  })

  it('sorts open polls by soonest close first, with closed polls after them', () => {
    renderPanel()

    expect(screen.getAllByTestId('polls-panel-row').map((row) => row.textContent?.match(/Thursday|Lions vs Rivals|Manual round|Lions vs Old/)?.[0])).toEqual([
      'Thursday',
      'Lions vs Rivals',
      'Manual round',
      'Lions vs Old',
    ])
  })

  it('titles the panel Polls shown with Show closed on, with a header naming open and closed', () => {
    renderPanel()

    expect(screen.getByRole('heading', { level: 2, name: 'Polls shown' })).toBeInTheDocument()
    expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('4 polls shown, 3 open and 1 closed')
    expect(screen.getByTestId('polls-panel-scope')).toHaveTextContent('Showing: Vets › Over 40')
  })

  it('titles the panel Open polls with Show closed off and counts the open polls', () => {
    renderPanel({ showClosed: false, rows: ROWS.filter((row) => row.open), scope: '' })

    expect(screen.getByRole('heading', { level: 2, name: 'Open polls' })).toBeInTheDocument()
    expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('3 open polls')
    expect(screen.queryByTestId('polls-panel-scope')).not.toBeInTheDocument()
  })

  it('the closing-soon panel lists only open polls closing within 48 hours', () => {
    renderPanel({ kind: 'closing-soon', showClosed: false })

    expect(screen.getByRole('heading', { level: 2, name: 'Closing within 48 hours' })).toBeInTheDocument()
    expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('1 open poll closing within 48 hours')
    expect(screen.getAllByTestId('polls-panel-row')).toHaveLength(1)
  })

  it('drops a poll from the closing-soon list when its close time passes while the panel stays open', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(NOW)
    try {
      const { unmount } = renderPanel({ kind: 'closing-soon', showClosed: false, now: undefined })
      expect(screen.getAllByTestId('polls-panel-row')).toHaveLength(1)

      act(() => {
        vi.setSystemTime(NOW + 31 * 3_600_000)
        vi.advanceTimersByTime(60_000)
      })
      expect(screen.queryAllByTestId('polls-panel-row')).toHaveLength(0)
      unmount()
      // No timer is left running after the panel unmounts.
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows loading rows until the polls are known, and an empty note for none', () => {
    const { unmount } = renderPanel({ rows: null })
    expect(screen.getByTestId('polls-panel-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('polls-panel-header')).not.toBeInTheDocument()
    unmount()

    renderPanel({ rows: [] })
    expect(screen.getByText('No polls to show.')).toBeInTheDocument()
  })

  it('closes with the close button and with Escape', async () => {
    const onClose = vi.fn()
    renderPanel({ onClose })

    await userEvent.click(screen.getByRole('button', { name: 'Close polls list' }))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('is a bottom sheet with the same rows on a phone', () => {
    setViewport(false)
    render(
      <MemoryRouter>
        <PollsPanel open onClose={vi.fn()} kind="all" rows={ROWS} showClosed scope="" now={NOW} />
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('polls-panel-row')).toHaveLength(4)
  })
})
