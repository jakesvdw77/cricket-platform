import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ListViewToggle } from './ListViewToggle'

describe('ListViewToggle (docs/specs/088)', () => {
  it('shows Cards and List with the current view pressed', () => {
    render(<ListViewToggle value="cards" onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the other view when it is chosen', async () => {
    const onChange = vi.fn()
    render(<ListViewToggle value="cards" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'List' }))

    expect(onChange).toHaveBeenCalledWith('list')
  })

  it('does not report anything when the current view is clicked again', async () => {
    const onChange = vi.fn()
    render(<ListViewToggle value="list" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'List' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders the full-width variant for the Filters sheet with the same two buttons', () => {
    render(<ListViewToggle value="list" onChange={vi.fn()} fullWidth />)

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
