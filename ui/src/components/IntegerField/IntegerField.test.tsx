import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CountField, RunsField, WicketsField } from './IntegerField'

function Harness({ max }: { max?: number }) {
  const [value, setValue] = useState<number | null>(null)
  return max ? <WicketsField ariaLabel="Wickets" value={value} onChange={setValue} max={max} /> : <CountField ariaLabel="Count" value={value} onChange={setValue} />
}

describe('IntegerField', () => {
  it('accepts digits only', async () => {
    render(<Harness />)
    const field = screen.getByLabelText('Count')
    await userEvent.type(field, '-1.2e3x')
    expect(field).toHaveValue('123')
  })

  it('ignores a keystroke past the maximum', async () => {
    render(<Harness max={10} />)
    const field = screen.getByLabelText('Wickets')
    await userEvent.type(field, '11')
    expect(field).toHaveValue('1')
  })

  it('filters a paste to its digits', async () => {
    render(<Harness />)
    const field = screen.getByLabelText('Count')
    await userEvent.click(field)
    await userEvent.paste('1,234 runs')
    expect(field).toHaveValue('1234')
  })

  it('reports null when emptied and drops leading zeros', async () => {
    render(<Harness />)
    const field = screen.getByLabelText('Count')
    await userEvent.type(field, '007')
    expect(field).toHaveValue('7')
    await userEvent.clear(field)
    expect(field).toHaveValue('')
  })

  it('RunsField is a numeric-keypad field that selects its content on focus', async () => {
    render(<RunsField ariaLabel="Runs, A. Smith" value={42} onChange={() => undefined} />)
    const field = screen.getByLabelText('Runs, A. Smith') as HTMLInputElement
    expect(field).toHaveAttribute('inputmode', 'numeric')
    await userEvent.click(field)
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(2)
  })
})
