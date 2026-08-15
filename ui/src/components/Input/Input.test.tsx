import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('associates the label with the field', () => {
    render(<Input label="Club name" />)
    expect(screen.getByLabelText('Club name')).toBeInTheDocument()
  })

  it('accepts typed input', async () => {
    render(<Input label="Club name" />)
    const field = screen.getByLabelText('Club name')

    await userEvent.type(field, 'Riverside CC')

    expect(field).toHaveValue('Riverside CC')
  })

  it('marks the field invalid and shows the error message', () => {
    render(<Input label="Club name" error helperText="Club name is required" />)
    const field = screen.getByLabelText('Club name')

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Club name is required')).toBeInTheDocument()
  })
})
