import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ShareScheduleDialog } from './ShareScheduleDialog'
import type { ShareScheduleDialogProps, ShareScheduleTeamOption } from './ShareScheduleDialog'

const teams: ShareScheduleTeamOption[] = [
  { teamId: 'team-home', teamName: 'Riverside 1st XI' },
  { teamId: 'team-away', teamName: 'Coastal CC' },
]

function renderDialog(overrides: Partial<ShareScheduleDialogProps> = {}) {
  const props: ShareScheduleDialogProps = {
    open: true,
    onClose: vi.fn(),
    leagueName: 'Premier League',
    seasonLabel: '2026',
    teams,
    onSharePdf: vi.fn().mockResolvedValue(undefined),
    onSharePoster: vi.fn().mockResolvedValue(undefined),
    onShareCalendar: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  const view = render(<ShareScheduleDialog {...props} />)
  return { ...view, props }
}

describe('ShareScheduleDialog', () => {
  it('renders all three option rows, the league/season caption, and the team-scope selector', () => {
    renderDialog()

    expect(screen.getByText('Premier League — 2026')).toBeInTheDocument()
    expect(screen.getByText('Schedule PDF')).toBeInTheDocument()
    expect(screen.getByText('Poster Image')).toBeInTheDocument()
    expect(screen.getByText('Add to Calendar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All Teams (Full Schedule)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Riverside 1st XI' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coastal CC' })).toBeInTheDocument()
  })

  it('renders "Add to Calendar" as a disabled, non-clickable row while scope is "All Teams", and a real clickable row once a team is selected', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.queryByRole('button', { name: /add to calendar/i })).not.toBeInTheDocument()
    expect(screen.getByText('Select a single team')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Riverside 1st XI' }))

    expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument()
    expect(screen.queryByText('Select a single team')).not.toBeInTheDocument()
  })

  it('resets the selected option back to "pdf" (and re-disables Add to Calendar) when switching scope back to "All Teams"', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Riverside 1st XI' }))
    await user.click(screen.getByRole('button', { name: /add to calendar/i }))
    expect(screen.getByRole('button', { name: 'Download Calendar' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All Teams (Full Schedule)' }))

    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to calendar/i })).not.toBeInTheDocument()
    expect(screen.getByText('Select a single team')).toBeInTheDocument()
  })

  it("tracks the footer button's label and disabled state to the selected option and the in-flight state", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    let resolveShare: () => void = () => {}
    const onSharePoster = vi.fn(() => new Promise<void>((resolve) => { resolveShare = resolve }))
    renderDialog({ onSharePoster, onClose })

    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /poster image/i }))
    expect(screen.getByRole('button', { name: 'Download Poster' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download Poster' }))
    expect(await screen.findByRole('button', { name: 'Generating…' })).toBeDisabled()

    resolveShare()
    await screen.findByRole('button', { name: 'Download Poster' }) // no longer "Generating…" once resolved
    expect(screen.getByRole('button', { name: 'Download Poster' })).not.toBeDisabled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSharePdf with null for the "All Teams" scope and closes the dialog on success', async () => {
    const user = userEvent.setup()
    const onSharePdf = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderDialog({ onSharePdf, onClose })

    await user.click(screen.getByRole('button', { name: 'Open PDF' }))

    expect(onSharePdf).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSharePoster with the selected team when a per-team scope is chosen', async () => {
    const user = userEvent.setup()
    const onSharePoster = vi.fn().mockResolvedValue(undefined)
    renderDialog({ onSharePoster })

    await user.click(screen.getByRole('button', { name: 'Coastal CC' }))
    await user.click(screen.getByRole('button', { name: /poster image/i }))
    await user.click(screen.getByRole('button', { name: 'Download Poster' }))

    expect(onSharePoster).toHaveBeenCalledWith({ teamId: 'team-away', teamName: 'Coastal CC' })
  })

  it('calls onShareCalendar with the selected team', async () => {
    const user = userEvent.setup()
    const onShareCalendar = vi.fn().mockResolvedValue(undefined)
    renderDialog({ onShareCalendar })

    await user.click(screen.getByRole('button', { name: 'Riverside 1st XI' }))
    await user.click(screen.getByRole('button', { name: /add to calendar/i }))
    await user.click(screen.getByRole('button', { name: 'Download Calendar' }))

    expect(onShareCalendar).toHaveBeenCalledWith({ teamId: 'team-home', teamName: 'Riverside 1st XI' })
  })

  it('shows an inline error (plain text, not an Alert) and keeps the dialog open when the selected callback rejects', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSharePdf = vi.fn().mockRejectedValue(new Error('Network error'))
    renderDialog({ onSharePdf, onClose })

    await user.click(screen.getByRole('button', { name: 'Open PDF' }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    // Retry is possible: the option/scope selection is still intact.
    expect(screen.getByRole('button', { name: 'Open PDF' })).not.toBeDisabled()
  })

  it('resets its draft state (scope, selected option, and error) when the dialog closes and reopens', async () => {
    const user = userEvent.setup()
    const { rerender, props } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Riverside 1st XI' }))
    await user.click(screen.getByRole('button', { name: /poster image/i }))
    expect(screen.getByRole('button', { name: 'Download Poster' })).toBeInTheDocument()

    rerender(<ShareScheduleDialog {...props} open={false} />)
    rerender(<ShareScheduleDialog {...props} open />)

    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to calendar/i })).not.toBeInTheDocument()
    expect(screen.getByText('Select a single team')).toBeInTheDocument()
  })
})
