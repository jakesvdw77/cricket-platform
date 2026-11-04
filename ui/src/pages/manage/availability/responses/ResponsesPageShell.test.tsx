import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ResponsesPageShell } from './ResponsesPageShell'
import type { ResponsesPageShellProps } from './ResponsesPageShell'

function renderShell(overrides: Partial<ResponsesPageShellProps> = {}) {
  return render(
    <MemoryRouter>
      <ResponsesPageShell
        title="A poll"
        backTo="/back"
        backLabel="Back"
        open
        responses={{ brackets: [], rows: [] }}
        matches={[]}
        override={{ pendingKey: null, onOverride: vi.fn() }}
        emptyText="Nobody here yet."
        {...overrides}
      />
    </MemoryRouter>,
  )
}

describe('ResponsesPageShell', () => {
  it('shows the title, the empty text, and no closed note or alert for an open poll', () => {
    renderShell()

    expect(screen.getByRole('heading', { level: 1, name: 'A poll' })).toBeInTheDocument()
    expect(screen.getByText('Nobody here yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Changes are recorded as a manager correction/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a title adornment next to the heading when given (090)', () => {
    renderShell({ titleAdornment: <button type="button">Edit description</button> })

    expect(screen.getByRole('heading', { level: 1, name: 'A poll' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit description' })).toBeInTheDocument()
  })

  it('shows the closed note and the override error when given', () => {
    renderShell({ open: false, overrideError: 'Could not save.' })

    expect(screen.getByText('Changes are recorded as a manager correction.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
  })

  it('marks the selected view button as pressed', async () => {
    const user = userEvent.setup()
    renderShell()

    expect(screen.getByRole('group', { name: 'Responses view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Time Slot' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(screen.getByRole('button', { name: 'Player' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Time Slot' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('has two views, Time Slot and Player, and the views and search sit in the flat toolbar card (085, 136)', () => {
    renderShell()

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Time Slot', 'Player'])
    const panel = screen.getByRole('group', { name: 'Responses view' }).parentElement?.parentElement as HTMLElement
    expect(within(panel).getByLabelText('Search players')).toBeInTheDocument()
    // Flat toolbar card (page-anatomy section 3): a hairline, no shadow.
    expect(getComputedStyle(panel).boxShadow).toMatch(/^(none|)$/)
  })

  it('renders the poll title as the browser tab title (085)', () => {
    renderShell({ title: 'Sat 6 Jun - U13 Boys fixtures' })

    expect(document.title).toBe('Sat 6 Jun - U13 Boys fixtures')
  })

  it('renders the meta and a status gauge for a single slot, in the same row; the gauge is on both tabs', async () => {
    const user = userEvent.setup()
    const brackets = [{ dayPart: 'MORNING' as const, windowDate: '2026-06-06', windowId: 'w1', availableCount: 2, unsureCount: 1, unavailableCount: 0, noResponseCount: 1, coveredMatchCount: 1 }]
    renderShell({ meta: <span>poll meta</span>, responses: { brackets, rows: [] } })

    expect(screen.getByText('poll meta')).toBeInTheDocument()
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
  })
})
