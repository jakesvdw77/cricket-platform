import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecordStatusToggle } from './RecordStatusToggle'

describe('RecordStatusToggle', () => {
  it('renders "Deactivate" and calls onClick when active', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RecordStatusToggle active pending={false} onClick={onClick} />)

    const button = screen.getByRole('button', { name: 'Deactivate' })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()

    await user.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders "Reactivate" and calls onClick when inactive', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RecordStatusToggle active={false} pending={false} onClick={onClick} />)

    const button = screen.getByRole('button', { name: 'Reactivate' })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows the pending label and disables the button while deactivating', () => {
    render(<RecordStatusToggle active pending onClick={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Deactivating…' })).toBeDisabled()
  })

  it('shows the pending label and disables the button while reactivating', () => {
    render(<RecordStatusToggle active={false} pending onClick={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Reactivating…' })).toBeDisabled()
  })
})
