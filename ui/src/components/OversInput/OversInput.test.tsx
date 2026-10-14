import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { OversInput } from './OversInput'

function Harness({ initial = null }: { initial?: number | null }) {
  const [balls, setBalls] = useState<number | null>(initial)
  return (
    <>
      <OversInput label="Overs" value={balls} onChange={setBalls} />
      <output data-testid="balls">{balls === null ? 'none' : balls}</output>
    </>
  )
}

describe('OversInput', () => {
  it('turns 36.4 into 220 balls', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Overs'), '36.4')
    expect(screen.getByTestId('balls')).toHaveTextContent('220')
  })

  it('refuses a ball digit at or above balls per over', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Overs'), '36.7')
    expect(screen.getByTestId('balls')).toHaveTextContent('none')
    expect(screen.getByText(/must be 0 to 5/)).toBeInTheDocument()
  })

  it('shows an existing value as overs', () => {
    render(<Harness initial={240} />)
    expect(screen.getByLabelText('Overs')).toHaveValue('40.0')
  })
})
