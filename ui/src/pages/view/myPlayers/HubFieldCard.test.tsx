import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubFieldCard } from './HubFieldCard'
import { hubField } from '../../../test/hubLeagueFixtures'

// docs/specs/121 (Field Directory): one read-only field card.
describe('HubFieldCard', () => {
  it('shows the name, the address as separate lines and the owner', () => {
    render(<HubFieldCard field={hubField({ owner: 'City Council' })} />)

    expect(screen.getByRole('heading', { name: 'Riverside Oval' })).toBeInTheDocument()
    const lines = within(screen.getByTestId('field-address')).getAllByText(/./).map((l) => l.textContent)
    expect(lines).toEqual(['1 Main Rd', 'Paarl, Western Cape 7646', 'South Africa'])
    expect(screen.getByText('Owner: City Council')).toBeInTheDocument()
  })

  it('leaves out the address block and the owner when they are empty', () => {
    render(<HubFieldCard field={hubField({ addressLine1: null, city: null, provinceState: null, postalCode: null, country: '', owner: ' ' })} />)

    expect(screen.queryByTestId('field-address')).not.toBeInTheDocument()
    expect(screen.queryByText(/Owner:/)).not.toBeInTheDocument()
  })

  it('shows a Verified chip for a verified field and Not Verified otherwise', () => {
    const { unmount } = render(<HubFieldCard field={hubField({ verified: true })} />)
    expect(screen.getByTestId('field-verified')).toHaveTextContent(/^Verified$/)
    unmount()

    render(<HubFieldCard field={hubField({ verified: false })} />)
    expect(screen.getByTestId('field-verified')).toHaveTextContent(/^Not Verified$/)
  })

  it('tags Home Field only for a home field', () => {
    const { unmount } = render(<HubFieldCard field={hubField({ home: true })} />)
    expect(screen.getByText('Home Field')).toBeInTheDocument()
    unmount()

    render(<HubFieldCard field={hubField({ home: false })} />)
    expect(screen.queryByText('Home Field')).not.toBeInTheDocument()
  })

  it('offers Directions only for an https map link', () => {
    const { unmount } = render(<HubFieldCard field={hubField({ mapUrl: 'https://maps.example/x' })} />)
    expect(screen.getByRole('link', { name: 'Directions to Riverside Oval' })).toHaveAttribute('href', 'https://maps.example/x')
    unmount()

    render(<HubFieldCard field={hubField({ mapUrl: 'http://maps.example/x' })} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
