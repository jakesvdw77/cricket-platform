import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SidePicker } from './SidePicker'

const options = [
  { side: 'HOME' as const, name: 'Irene Villagers', initials: 'IV' },
  { side: 'AWAY' as const, name: 'Pretoria Wanderers', initials: 'PW' },
]

describe('SidePicker', () => {
  it('shows the chosen side and reports a pick', async () => {
    const onChange = vi.fn()
    render(<SidePicker label="Who won?" options={options} value="HOME" onChange={onChange} />)

    expect(screen.getByRole('radiogroup', { name: 'Who won?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Irene Villagers/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: /Pretoria Wanderers/ }))
    expect(onChange).toHaveBeenCalledWith('AWAY')
  })
})
