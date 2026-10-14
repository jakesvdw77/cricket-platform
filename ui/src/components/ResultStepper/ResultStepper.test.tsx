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
})
