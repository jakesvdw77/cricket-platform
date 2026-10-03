import { render, screen } from '@testing-library/react'
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
    expect(screen.queryByText(/This poll is closed/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the closed note and the override error when given', () => {
    renderShell({ open: false, overrideError: 'Could not save.' })

    expect(screen.getByText('This poll is closed. Changes are recorded as a manager correction.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
  })

  it('fills the selected view button with the primary green and white text, and keeps the pressed state', async () => {
    const user = userEvent.setup()
    renderShell()

    expect(screen.getByRole('group', { name: 'Responses view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Time slot' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(screen.getByRole('button', { name: 'Player' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Time slot' })).toHaveAttribute('aria-pressed', 'false')

    // jsdom does not resolve selector specificity, so assert the emitted rule instead of a computed colour.
    const css = Array.from(document.querySelectorAll('style')).map((style) => style.textContent).join('')
    expect(css).toMatch(/\.MuiToggleButton-root\.Mui-selected[^{]*\{background-color:#[0-9a-f]{6};color:#fff;/i)
  })
})
