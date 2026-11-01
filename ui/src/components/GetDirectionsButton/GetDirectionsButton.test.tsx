import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GetDirectionsButton, directionsMenuItems } from './GetDirectionsButton'
import { baseTheme } from '../../theme'
import type { DirectionsTarget } from '../../utils/fieldLocation'

const target: DirectionsTarget = { point: { lat: -26.1, lng: 28.05 }, approximate: false, viaAccess: false, name: 'Wanderers', accessNote: null, addressText: 'Wanderers\nJohannesburg' }
const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={baseTheme}>{node}</ThemeProvider>)
const touch = (coarse: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: coarse && query.includes('coarse'), media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GetDirectionsButton', () => {
  it('renders nothing when no point resolves', () => {
    const { container } = wrap(<GetDirectionsButton target={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens Google Maps in a new tab on a desktop in one click', () => {
    touch(false)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    wrap(<GetDirectionsButton target={target} />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }))
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-26.1,28.05', '_blank', 'noopener,noreferrer')
  })

  it('opens the map-app menu on a touch device: Google, Waze and Copy Address, no Apple Maps off iOS', async () => {
    touch(true)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    wrap(<GetDirectionsButton target={target} />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }))
    expect(open).not.toHaveBeenCalled()
    expect(await screen.findByTestId('directions-google')).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-26.1,28.05')
    expect(screen.getByTestId('directions-waze')).toHaveAttribute('href', 'https://waze.com/ul?ll=-26.1,28.05&navigate=yes')
    expect(screen.getByTestId('directions-waze')).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByTestId('directions-copy')).toHaveTextContent('Copy Address')
    expect(screen.queryByTestId('directions-apple')).not.toBeInTheDocument()
  })

  it('offers Apple Maps on iOS', async () => {
    touch(true)
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    wrap(<GetDirectionsButton target={target} />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }))
    expect(await screen.findByTestId('directions-apple')).toHaveAttribute('href', 'https://maps.apple.com/?daddr=-26.1,28.05')
  })

  it('labels a town-only point approximate and says when it goes to the access point', async () => {
    touch(true)
    wrap(<GetDirectionsButton target={{ ...target, approximate: true }} />)
    expect(screen.getByRole('button', { name: 'Get Directions (approximate)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText(/Approximate: only the town is known/)).toBeInTheDocument()
  })

  it('renders as an inline link', () => {
    wrap(<GetDirectionsButton target={target} variant="link" />)
    expect(screen.getByTestId('get-directions').tagName).toBe('BUTTON')
  })
})

describe('directionsMenuItems', () => {
  it('is empty without a point (hidden, not disabled)', () => {
    expect(directionsMenuItems(null, () => undefined)).toEqual([])
  })

  it('describes an access-point destination', () => {
    const [item] = directionsMenuItems({ ...target, viaAccess: true }, () => undefined)
    expect(item.title).toBe('Get Directions')
    expect(item.description).toBe('Goes to the entrance or parking point.')
  })
})
