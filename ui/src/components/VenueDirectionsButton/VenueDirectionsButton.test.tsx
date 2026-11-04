import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VenueDirectionsButton } from './VenueDirectionsButton'
import type { DirectionsTarget } from '../../utils/fieldLocation'

const target: DirectionsTarget = { name: 'Hofmeyer Park', point: { lat: -25.7, lng: 28.2 }, addressText: 'Hofmeyer Park', approximate: false, viaAccess: false, accessNote: null }

describe('VenueDirectionsButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders nothing when the venue has no usable position', () => {
    const { container } = render(<VenueDirectionsButton target={null} venue="Hofmeyer Park" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is an icon button named for the venue that opens Google Maps in a new tab on a desktop', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<VenueDirectionsButton target={target} venue="Hofmeyer Park" />)
    await userEvent.click(screen.getByRole('button', { name: 'Get Directions to Hofmeyer Park' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(String(open.mock.calls[0][0])).toContain('google.com/maps')
  })
})
