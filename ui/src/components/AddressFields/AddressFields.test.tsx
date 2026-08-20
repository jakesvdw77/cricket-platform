import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddressFields } from './AddressFields'
import type { Address } from '../../api/clubApi'

function emptyAddress(): Address {
  return { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null }
}

describe('AddressFields', () => {
  it('renders all six address fields', () => {
    render(<AddressFields value={emptyAddress()} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Number')).toBeInTheDocument()
    expect(screen.getByLabelText('Street')).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toBeInTheDocument()
    expect(screen.getByLabelText('Province/State')).toBeInTheDocument()
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
    expect(screen.getByLabelText('Postal code')).toBeInTheDocument()
  })

  it('renders null fields as empty inputs, not "null"', () => {
    render(<AddressFields value={emptyAddress()} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Number')).toHaveValue('')
  })

  it('pre-fills fields from value', () => {
    render(
      <AddressFields
        value={{
          number: '12',
          street: 'Main Road',
          city: 'Cape Town',
          provinceState: 'Western Cape',
          country: 'South Africa',
          postalCode: '8001',
        }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Street')).toHaveValue('Main Road')
    expect(screen.getByLabelText('City')).toHaveValue('Cape Town')
  })

  it('calls onChange with the full address, only the edited field updated', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AddressFields value={emptyAddress()} onChange={onChange} />)

    await user.type(screen.getByLabelText('City'), 'A')

    expect(onChange).toHaveBeenCalledWith({ ...emptyAddress(), city: 'A' })
  })
})
