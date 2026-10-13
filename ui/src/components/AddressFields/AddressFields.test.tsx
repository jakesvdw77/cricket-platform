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

  // docs/specs/099-fields-directory.md: the optional props the Fields form uses; ClubForm's call is unchanged (above).
  describe('with the Fields form props', () => {
    it('renders only the fields asked for, in the order asked', () => {
      render(<AddressFields value={emptyAddress()} onChange={vi.fn()} fields={['city', 'country', 'street']} />)

      expect(screen.queryByLabelText('Number')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Postal code')).not.toBeInTheDocument()
      const all = screen.getAllByLabelText(/^(City|Country|Street)$/).map((el) => el.closest('.MuiFormControl-root')?.querySelector('label')?.textContent)
      expect(all).toEqual(['City', 'Country', 'Street'])
    })

    it('adds (optional) to the labels it is told are optional', () => {
      render(<AddressFields value={emptyAddress()} onChange={vi.fn()} optional={['street', 'postalCode']} />)

      expect(screen.getByLabelText('Street (optional)')).toBeInTheDocument()
      expect(screen.getByLabelText('Postal code (optional)')).toBeInTheDocument()
      expect(screen.getByLabelText('City')).toBeInTheDocument()
    })

    it('shows per-field errors and the country hint, and disables everything when asked', () => {
      render(
        <AddressFields
          value={emptyAddress()}
          onChange={vi.fn()}
          errors={{ city: 'City is required' }}
          countryHelperText="Chosen from your browser"
          disabled
        />,
      )

      expect(screen.getByText('City is required')).toBeInTheDocument()
      expect(screen.getByLabelText('City')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText('Chosen from your browser')).toBeInTheDocument()
      expect(screen.getByLabelText('City')).toBeDisabled()
    })

    describe('isoCountry', () => {
      it('shows the Country by name and reports the ISO code when another is chosen', async () => {
        const onChange = vi.fn()
        render(<AddressFields value={{ ...emptyAddress(), country: 'ZA' }} onChange={onChange} isoCountry />)

        expect(screen.getByLabelText('Country')).toHaveTextContent('South Africa')
        await userEvent.click(screen.getByLabelText('Country'))
        await userEvent.click(await screen.findByRole('option', { name: 'New Zealand' }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ country: 'NZ' }))
      })

      it.each([
        ['ZA', 'Province'],
        ['GB', 'County'],
        ['US', 'State'],
        [null, 'Province/County/State'],
      ])('labels the region level for %s as %s', (country, label) => {
        render(<AddressFields value={{ ...emptyAddress(), country }} onChange={vi.fn()} isoCountry />)
        expect(screen.getByLabelText(label)).toBeInTheDocument()
      })

      it('keeps the free-text Province/State label and Country input without it (ClubForm)', () => {
        render(<AddressFields value={emptyAddress()} onChange={vi.fn()} />)
        expect(screen.getByLabelText('Province/State')).toBeInTheDocument()
        expect(screen.getByLabelText('Country').tagName).toBe('INPUT')
      })
    })
  })
})
