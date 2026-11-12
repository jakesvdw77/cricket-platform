import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultStepper } from './ResultStepper'
import { cssRulesFor } from '../../test/emotionCss'

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
  // Owner sweep, 2026-11-12: on a phone the active step keeps room for its number and short label while the others share the rest.
  it('gives the active step a minimum width on a phone and lets the others shrink to nothing', () => {
    render(<ResultStepper steps={steps} activeId="scores" onSelect={() => undefined} />)

    // jsdom has no media queries, so read the written rule: the base (phone) rule carries 76px for the active step only.
    const rule = (name: string) => cssRulesFor(screen.getByRole('button', { name }))
    expect(rule('Step 2: Scores')).toMatch(/min-width:76px/)
    expect(rule('Step 1: Result (done)')).not.toMatch(/min-width:76px/)
    expect(rule('Step 3: Review')).not.toMatch(/min-width:76px/)
    // The active step's list item does not flex, the others share the remaining row.
    expect(cssRulesFor(screen.getByRole('button', { name: 'Step 2: Scores' }).parentElement as HTMLElement)).toMatch(/flex:00auto/)
    expect(cssRulesFor(screen.getByRole('button', { name: 'Step 3: Review' }).parentElement as HTMLElement)).toMatch(/flex:110/)
  })
})
