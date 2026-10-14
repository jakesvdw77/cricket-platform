import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HowOutSelect } from './HowOutSelect'
import type { DismissalType } from '../../api/matchResultApi'

function Harness({ initial = null, onChange }: { initial?: DismissalType | null; onChange?: (value: DismissalType | null) => void }) {
  const [value, setValue] = useState<DismissalType | null>(initial)
  return (
    <HowOutSelect
      value={value}
      ariaLabel="How out, A. Smith"
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const field = () => screen.getByRole('combobox', { name: 'How out, A. Smith' })

describe('HowOutSelect', () => {
  it('shows the chosen dismissal as text', () => {
    render(<Harness initial="CAUGHT" />)
    expect(field()).toHaveValue('Caught')
  })

  it('accepts the spec shortcuts with Enter', async () => {
    const cases: Array<[string, DismissalType]> = [
      ['c', 'CAUGHT'], ['b', 'BOWLED'], ['l', 'LBW'], ['r', 'RUN_OUT'], ['s', 'STUMPED'], ['n', 'NOT_OUT'], ['d', 'DID_NOT_BAT'],
      ['cb', 'CAUGHT_AND_BOWLED'], ['ro', 'RETIRED_OUT'], ['rn', 'RETIRED_NOT_OUT'],
    ]
    for (const [typed, expected] of cases) {
      const onChange = vi.fn()
      const { unmount } = render(<Harness onChange={onChange} />)
      await userEvent.click(field())
      await userEvent.keyboard(`${typed}{Enter}`)
      expect(onChange, typed).toHaveBeenCalledWith(expected)
      unmount()
    }
  })

  it('lists the matches while typing, the exact shortcut first', async () => {
    render(<Harness />)
    await userEvent.click(field())
    await userEvent.keyboard('r')

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options[0]).toContain('Run out')
    expect(options.some((text) => text?.includes('Retired out'))).toBe(true)
    expect(options.some((text) => text?.includes('Retired not out'))).toBe(true)
  })

  it('arrow keys pick from the open list', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(field())
    await userEvent.keyboard('c{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('CAUGHT_AND_BOWLED')
  })

  it('accepts on leaving the field and by clicking an option', async () => {
    const onChange = vi.fn()
    render(
      <>
        <Harness onChange={onChange} />
        <button>elsewhere</button>
      </>,
    )
    await userEvent.click(field())
    await userEvent.keyboard('b')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith('BOWLED')

    await userEvent.click(field())
    await userEvent.click(screen.getByRole('option', { name: /Stumped/ }))
    expect(onChange).toHaveBeenLastCalledWith('STUMPED')
  })

  it('clears the answer when the field is emptied, and Escape abandons the typing', async () => {
    const onChange = vi.fn()
    render(<Harness initial="CAUGHT" onChange={onChange} />)
    await userEvent.click(field())
    await userEvent.keyboard('{Backspace}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(null)

    await userEvent.click(field())
    await userEvent.keyboard('b{Escape}')
    expect(field()).toHaveValue('')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
