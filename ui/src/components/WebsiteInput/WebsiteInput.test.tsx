import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WebsiteInput } from './WebsiteInput'

describe('WebsiteInput', () => {
  it('renders as a url input labeled "Website" by default', () => {
    render(<WebsiteInput value="" onChange={vi.fn()} />)

    const input = screen.getByLabelText('Website')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'url')
  })

  it('prepends https:// on blur when the value has no protocol', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<WebsiteInput value="example.com" onChange={onChange} />)

    await user.click(screen.getByLabelText('Website'))
    await user.tab()

    expect(onChange).toHaveBeenCalledWith('https://example.com')
  })

  it('leaves an already-protocol-prefixed value unchanged on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<WebsiteInput value="http://example.com" onChange={onChange} />)

    await user.click(screen.getByLabelText('Website'))
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not normalize an empty value on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<WebsiteInput value="" onChange={onChange} />)

    await user.click(screen.getByLabelText('Website'))
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders an inline error when provided', () => {
    render(<WebsiteInput value="not a url" onChange={vi.fn()} error="Enter a valid website URL" />)

    expect(screen.getByText('Enter a valid website URL')).toBeInTheDocument()
  })
})
