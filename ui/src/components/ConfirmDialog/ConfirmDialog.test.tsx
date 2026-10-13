import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title, description and calls onConfirm / onClose from its buttons', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog open title="Delete it?" description="Gone for good." confirmLabel="Delete" destructive onConfirm={onConfirm} onClose={onClose} />,
    )

    expect(screen.getByText('Delete it?')).toBeInTheDocument()
    expect(screen.getByText('Gone for good.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons and shows the pending label while pending', () => {
    render(
      <ConfirmDialog open title="t" description="d" confirmLabel="Delete" pendingLabel="Deleting…" pending onConfirm={() => {}} onClose={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('acknowledge-only mode shows a single dismiss button', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog open title="Cannot delete" description="Because." acknowledgeOnly onConfirm={onConfirm} onClose={onClose} />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="Hidden" description="d" onClose={() => {}} />)
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('renders an optional icon in the title row', () => {
    render(<ConfirmDialog open title="Announce?" description="d" icon={<span data-testid="dlg-icon" />} onConfirm={() => {}} onClose={() => {}} />)

    expect(screen.getByTestId('dlg-icon')).toBeInTheDocument()
    expect(screen.getByText('Announce?')).toBeInTheDocument()
  })

  // docs/specs/099-fields-directory.md: the required reason (Reject a field).
  describe('reasonLabel', () => {
    it('keeps Confirm disabled until a reason is typed, then passes the trimmed reason to onConfirm', async () => {
      const onConfirm = vi.fn()
      render(<ConfirmDialog open title="Reject?" description="d" reasonLabel="Reason for rejecting" confirmLabel="Reject field" onConfirm={onConfirm} onClose={() => {}} />)

      const confirm = screen.getByRole('button', { name: 'Reject field' })
      expect(confirm).toBeDisabled()
      await userEvent.type(screen.getByLabelText(/Reason for rejecting/), '   ')
      expect(confirm).toBeDisabled()

      await userEvent.type(screen.getByLabelText(/Reason for rejecting/), '  Not a cricket field ')
      expect(confirm).toBeEnabled()
      await userEvent.click(confirm)

      expect(onConfirm).toHaveBeenCalledWith('Not a cricket field')
    })

    it('has no reason box and passes no reason when reasonLabel is not set', async () => {
      const onConfirm = vi.fn()
      render(<ConfirmDialog open title="t" description="d" confirmLabel="Go" onConfirm={onConfirm} onClose={() => {}} />)

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Go' }))
      expect(onConfirm).toHaveBeenCalledWith(undefined)
    })

    it('clears the typed reason when the dialog closes and reopens', async () => {
      const props = { title: 't', description: 'd', reasonLabel: 'Reason', onConfirm: () => {}, onClose: () => {} }
      const { rerender } = render(<ConfirmDialog open {...props} />)
      await userEvent.type(screen.getByLabelText(/Reason/), 'because')

      rerender(<ConfirmDialog open={false} {...props} />)
      rerender(<ConfirmDialog open {...props} />)

      expect(screen.getByLabelText(/Reason/)).toHaveValue('')
    })

    it('shows no reason box in acknowledge-only mode', () => {
      render(<ConfirmDialog open title="t" description="d" reasonLabel="Reason" acknowledgeOnly onClose={() => {}} />)
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })
})
