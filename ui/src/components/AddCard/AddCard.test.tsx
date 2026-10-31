import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AddCard } from './AddCard'

describe('AddCard', () => {
  it('is a link to the add route with a dashed border', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AddCard label="Add League" to="/new" />} />
          <Route path="/new" element={<p>Arrived</p>} />
        </Routes>
      </MemoryRouter>,
    )
    const card = screen.getByRole('link', { name: 'Add League' })
    expect(card).toHaveAttribute('href', '/new')
    expect(getComputedStyle(card).borderStyle).toBe('dashed')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(card)
    expect(await screen.findByText('Arrived')).toBeInTheDocument()
  })

  it('runs onClick and is keyboard operable', async () => {
    const onClick = vi.fn()
    render(<AddCard label="Add Team" onClick={onClick} />)
    screen.getByRole('button', { name: 'Add Team' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', async () => {
    const onClick = vi.fn()
    render(<AddCard label="Add Team" onClick={onClick} disabled />)
    const card = screen.getByRole('button', { name: 'Add Team' })
    expect(card).toBeDisabled()
    await userEvent.setup({ pointerEventsCheck: 0 }).click(card)
    expect(onClick).not.toHaveBeenCalled()
  })
})
