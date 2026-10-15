import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CountField, WicketsField } from './IntegerField'

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
})
