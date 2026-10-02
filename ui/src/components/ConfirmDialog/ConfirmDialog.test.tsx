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
})
