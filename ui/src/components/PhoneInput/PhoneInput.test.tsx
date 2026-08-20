import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PhoneInput } from './PhoneInput'

describe('PhoneInput', () => {
  it('renders as a tel input labeled "Phone" by default', () => {
    render(<PhoneInput value="" onChange={vi.fn()} />)

    const input = screen.getByLabelText('Phone')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'tel')
  })

  it('calls onChange with the raw typed value, unmodified', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PhoneInput value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Phone'), '0')

    expect(onChange).toHaveBeenCalledWith('0')
  })

  it('renders an inline error when provided', () => {
    render(<PhoneInput value="abc" onChange={vi.fn()} error="Enter a valid phone number" />)

    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument()
  })
})
