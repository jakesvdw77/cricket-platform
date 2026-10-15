import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultStepper } from './ResultStepper'

const steps = [
  { id: 'outcome', label: 'Result' },
  { id: 'scores', label: 'Scores' },
  { id: 'review', label: 'Review' },
]

describe('ResultStepper', () => {
  it('marks the active step, ticks earlier ones and selects a step', async () => {
    const onSelect = vi.fn()
    render(<ResultStepper steps={steps} activeId="scores" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Step 2: Scores' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Step 1: Result (done)' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Step 3: Review' }))
    expect(onSelect).toHaveBeenCalledWith('review')
  })

  it('lets no step be chosen while disabled', async () => {
    const onSelect = vi.fn()
    render(<ResultStepper steps={steps} activeId="outcome" onSelect={onSelect} disabled />)

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('names an optional step as optional and explains the dashed steps; no legend when none is optional', () => {
    const { rerender } = render(<ResultStepper steps={[{ id: 'teams', label: 'Teams', optional: true }, ...steps]} activeId="outcome" onSelect={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Step 1: Teams (optional) (done)' })).toBeInTheDocument()
    expect(screen.getByText(/dashed steps can be skipped/i)).toBeInTheDocument()
    rerender(<ResultStepper steps={steps} activeId="outcome" onSelect={() => undefined} />)
    expect(screen.queryByText(/dashed steps can be skipped/i)).not.toBeInTheDocument()
  })
})
