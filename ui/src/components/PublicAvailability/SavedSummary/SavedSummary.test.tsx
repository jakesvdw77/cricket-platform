import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SavedSummary } from './SavedSummary'

const entries = [
  { label: 'Thu 15 Oct · Morning', status: 'AVAILABLE' as const },
  { label: 'Thu 15 Oct · Afternoon', status: 'UNSURE' as const },
]

describe('SavedSummary', () => {
  it('thanks the player and summarises each answer with its word', () => {
    render(<SavedSummary firstName="Liam" entries={entries} onChangeAnswer={vi.fn()} onSomeoneElse={vi.fn()} />)
    expect(screen.getByText('Thanks, Liam')).toBeInTheDocument()
    expect(screen.getByText('Thu 15 Oct · Morning')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Unsure')).toBeInTheDocument()
  })

  it('offers Change my answer and Answer for someone else', async () => {
    const onChangeAnswer = vi.fn()
    const onSomeoneElse = vi.fn()
    render(<SavedSummary firstName="Liam" entries={entries} onChangeAnswer={onChangeAnswer} onSomeoneElse={onSomeoneElse} />)
    await userEvent.click(screen.getByRole('button', { name: 'Change my answer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Answer for someone else' }))
    expect(onChangeAnswer).toHaveBeenCalledTimes(1)
    expect(onSomeoneElse).toHaveBeenCalledTimes(1)
  })
})
