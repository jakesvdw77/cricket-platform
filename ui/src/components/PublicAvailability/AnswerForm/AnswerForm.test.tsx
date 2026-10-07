import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerForm } from './AnswerForm'
import type { AnswerMap, AnswerSlot } from './AnswerForm'

const squadSlot: AnswerSlot = { key: 'squad', windowId: null, label: null, matches: [], open: true }
const groupSlots: AnswerSlot[] = [
  { key: 'w1', windowId: 'w1', label: 'Thu 15 Oct · Morning', matches: ['Villagers 1 v POHBS'], open: true },
  { key: 'w2', windowId: 'w2', label: 'Thu 15 Oct · Afternoon', matches: ['Villagers 1 v TBC'], open: true },
]

function Harness({
  slots,
  initial = {},
  onSave = vi.fn(),
  ...rest
}: {
  slots: AnswerSlot[]
  initial?: AnswerMap
  onSave?: () => void
  saving?: boolean
  errorMessage?: string
  hasExisting?: boolean
  onNotYou?: () => void
}) {
  const [answers, setAnswers] = useState<AnswerMap>(initial)
  return <AnswerForm playerName="Liam Carter" slots={slots} answers={answers} onChange={setAnswers} onSave={onSave} {...rest} />
}

describe('AnswerForm', () => {
  it('squad: one question, Save disabled until answered, then saves', async () => {
    const onSave = vi.fn()
    render(<Harness slots={[squadSlot]} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Save my answer' })
    expect(save).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Availability: Unsure' }))
    expect(screen.getByRole('button', { name: 'Availability: Unsure' })).toHaveAttribute('aria-pressed', 'true')
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(onSave).toHaveBeenCalled()
  })

  it('group: one row per window with its label and matches', () => {
    render(<Harness slots={groupSlots} />)
    expect(screen.getByText('Thu 15 Oct · Morning')).toBeInTheDocument()
    expect(screen.getByText('Villagers 1 v POHBS')).toBeInTheDocument()
    expect(screen.getByText('Thu 15 Oct · Afternoon')).toBeInTheDocument()
    expect(screen.getByText('Villagers 1 v TBC')).toBeInTheDocument()
  })

  it('group: allows a partial answer and changing a choice', async () => {
    render(<Harness slots={groupSlots} />)
    await userEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct · Morning: Available' }))
    expect(screen.getByRole('button', { name: 'Save my answer' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct · Morning: Unavailable' }))
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Morning: Unavailable' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Morning: Available' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Afternoon: Available' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('is prefilled from existing answers and says so', () => {
    render(<Harness slots={groupSlots} initial={{ w1: 'AVAILABLE', w2: 'UNSURE' }} hasExisting />)
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Morning: Available' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Afternoon: Unsure' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/You already answered/)).toBeInTheDocument()
  })

  it('shows a closed window as read-only', () => {
    render(<Harness slots={[groupSlots[0], { ...groupSlots[1], open: false }]} initial={{ w2: 'UNSURE' }} />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thu 15 Oct · Afternoon: Unsure' })).toBeDisabled()
    // the closed window's answer alone does not enable Save
    expect(screen.getByRole('button', { name: 'Save my answer' })).toBeDisabled()
  })

  it('shows the name, Not you?, saving state and an error', async () => {
    const onNotYou = vi.fn()
    const { rerender } = render(<Harness slots={[squadSlot]} onNotYou={onNotYou} errorMessage="Could not save." />)
    expect(screen.getByText('Liam Carter')).toBeInTheDocument()
    expect(screen.getByText('Could not save.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(onNotYou).toHaveBeenCalled()
    rerender(<Harness slots={[squadSlot]} saving />)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
