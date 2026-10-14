import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExtrasFields } from './ExtrasFields'
import type { ExtrasBreakdown } from '../../utils/battingTotals'

function Harness({ initial = {}, onChange }: { initial?: ExtrasBreakdown; onChange?: (patch: object) => void }) {
  const [value, setValue] = useState<ExtrasBreakdown>(initial)
  return (
    <ExtrasFields
      value={value}
      owner="Riverside 1st XI"
      onChange={(patch) => {
        onChange?.(patch)
        setValue((current) => ({ ...current, ...patch }))
      }}
    />
  )
}

describe('ExtrasFields', () => {
  it('has the five fields, each named after its owner, and shows the sum', async () => {
    render(<Harness initial={{ wides: 6, noBalls: 2, byes: 4, legByes: 2, penaltyRuns: 0 }} />)

    for (const label of ['Wides', 'No-balls', 'Byes', 'Leg byes', 'Penalty']) {
      expect(screen.getByRole('textbox', { name: `${label}, Riverside 1st XI` })).toBeInTheDocument()
    }
    expect(screen.getByText('Extras 14')).toBeInTheDocument()
  })

  it('sends the part that changed and updates the sum', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox', { name: 'Byes, Riverside 1st XI' }), '5')

    expect(onChange).toHaveBeenLastCalledWith({ byes: 5 })
    expect(screen.getByText('Extras 5')).toBeInTheDocument()
  })

  it('takes digits only and an empty field is null', async () => {
    const onChange = vi.fn()
    render(<Harness initial={{ wides: 3 }} onChange={onChange} />)
    const wides = screen.getByRole('textbox', { name: 'Wides, Riverside 1st XI' })

    await userEvent.type(wides, 'x')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.clear(wides)
    expect(onChange).toHaveBeenLastCalledWith({ wides: null })
  })

  it('opens the numeric keypad and selects the content on focus', async () => {
    render(<Harness initial={{ wides: 12 }} />)
    const wides = screen.getByRole('textbox', { name: 'Wides, Riverside 1st XI' }) as HTMLInputElement

    expect(wides).toHaveAttribute('inputmode', 'numeric')
    await userEvent.click(wides)
    expect(wides.selectionStart).toBe(0)
    expect(wides.selectionEnd).toBe(2)
  })
})
