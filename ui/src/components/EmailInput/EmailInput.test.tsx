import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmailInput } from './EmailInput'

describe('EmailInput', () => {
  it('renders as an email input labeled "Email" by default', () => {
    render(<EmailInput value="" onChange={vi.fn()} />)

    const input = screen.getByLabelText('Email')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
  })

  it('trims and lowercases the value on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EmailInput value="  Jane.Doe@Example.com  " onChange={onChange} />)

    await user.click(screen.getByLabelText('Email'))
    await user.tab()

    expect(onChange).toHaveBeenCalledWith('jane.doe@example.com')
  })

  it('leaves an already-trimmed, already-lowercase value unchanged on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EmailInput value="jane.doe@example.com" onChange={onChange} />)

    await user.click(screen.getByLabelText('Email'))
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not normalize an empty value on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EmailInput value="" onChange={onChange} />)

    await user.click(screen.getByLabelText('Email'))
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders an inline error when provided', () => {
    render(<EmailInput value="not an email" onChange={vi.fn()} error="Enter a valid email address" />)

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })
})
