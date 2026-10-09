import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PollTable } from './PollTable'
import type { PollPanelRow } from './pollPanelRows'

const NOW = new Date('2026-10-09T12:00:00')
const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString()

function row(overrides: Partial<PollPanelRow> = {}): PollPanelRow {
  return {
    key: 'k1',
    kind: 'SQUAD',
    title: 'Irene Villagers 1 vs POHBS',
    subtitle: 'Squad poll · Home · Thu 15 Oct',
    open: true,
    autoClose: true,
    scheduledCloseAt: at(120),
    answered: 10,
    total: 14,
    path: '/manage/availability/squad/m1/p1',
    ...overrides,
  }
}

function renderTable(rows: PollPanelRow[]) {
  return render(
    <MemoryRouter>
      <PollTable rows={rows} />
    </MemoryRouter>,
  )
}

describe('PollTable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('renders the header and a row per poll with the title and subtitle', () => {
    renderTable([row(), row({ key: 'k2', kind: 'GROUP', title: 'Over 40s weekend', subtitle: 'Group poll · Vets', path: '/manage/availability/group/r1' })])
    expect(screen.getByRole('table', { name: 'Polls' })).toBeInTheDocument()
    for (const name of ['Poll', 'Type', 'Status', 'Closes', 'Answered']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByTestId('poll-row')).toHaveLength(2)
    expect(screen.getByText('Squad poll · Home · Thu 15 Oct')).toBeInTheDocument()
    expect(screen.getByText('Group poll · Vets')).toBeInTheDocument()
  })

  it('shows the type and status chips', () => {
    renderTable([row(), row({ key: 'k2', kind: 'GROUP', open: false, title: 'U15' })])
    const [a, b] = screen.getAllByTestId('poll-row')
    expect(within(a).getByTestId('poll-row-type')).toHaveTextContent('Squad')
    expect(within(a).getByTestId('poll-row-status')).toHaveTextContent('Open')
    expect(within(b).getByTestId('poll-row-type')).toHaveTextContent('Group')
    expect(within(b).getByTestId('poll-row-status')).toHaveTextContent('Closed')
  })

  it('shows the close time with a countdown, amber within 24 hours', () => {
    renderTable([row({ key: 'far', scheduledCloseAt: at(120) }), row({ key: 'soon', scheduledCloseAt: at(7) })])
    const [far, soon] = screen.getAllByTestId('poll-row')
    expect(far).toHaveAttribute('data-tone', 'neutral')
    expect(within(far).getByTestId('poll-row-closes')).toHaveTextContent(/Closes .*in 5 days/)
    expect(soon).toHaveAttribute('data-tone', 'warning')
    expect(within(soon).getByTestId('poll-row-closes')).toHaveTextContent(/in 7 h/)
  })

  it('says Closes manually for an open poll with no auto-close, and Closed for a closed one', () => {
    renderTable([row({ key: 'manual', autoClose: false, scheduledCloseAt: null }), row({ key: 'done', open: false, autoClose: false, scheduledCloseAt: null })])
    const [manual, done] = screen.getAllByTestId('poll-row')
    expect(within(manual).getByTestId('poll-row-closes')).toHaveTextContent('Closes manually')
    expect(within(manual).getByTestId('poll-row-closes')).toHaveTextContent('No auto-close')
    expect(within(done).getByTestId('poll-row-closes')).toHaveTextContent('Closed manually')
    expect(done).toHaveAttribute('data-tone', 'neutral')
  })

  it('shows how many have answered, noting the best slot of a group poll, and a dash with nobody to count', () => {
    renderTable([row({ key: 'a' }), row({ key: 'b', kind: 'GROUP', bestSlot: true, answered: 18, total: 25 }), row({ key: 'c', answered: 0, total: 0 })])
    const cells = screen.getAllByTestId('poll-row-answered')
    expect(cells[0]).toHaveTextContent('10 of 14')
    expect(cells[1]).toHaveTextContent('18 of 25 (best slot)')
    expect(cells[2]).toHaveTextContent('–')
  })

  it('keeps the desktop-only columns marked so a phone can drop them, and shows the phone chips and closing time', () => {
    renderTable([row()])
    const r = screen.getByTestId('poll-row')
    for (const id of ['poll-row-type', 'poll-row-status', 'poll-row-closes']) {
      expect(within(r).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(r).getByTestId('poll-row-phone-chips')).toBeInTheDocument()
    expect(within(r).getByTestId('poll-row-phone-closes')).toBeInTheDocument()
    expect(within(r).getByTestId('poll-row-answered')).not.toHaveAttribute('data-desktop-only')
  })

  it('links the whole row to the poll page', () => {
    renderTable([row()])
    expect(screen.getByRole('link', { name: 'Irene Villagers 1 vs POHBS' })).toHaveAttribute('href', '/manage/availability/squad/m1/p1')
  })
})
