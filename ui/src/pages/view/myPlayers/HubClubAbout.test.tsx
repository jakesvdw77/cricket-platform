import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubClubAbout } from './HubClubAbout'
import { cssRulesFor } from '../../../test/emotionCss'
import { makeClubInfo } from '../../../test/clubInfoFixtures'

// docs/specs/148 About: the images, the club details card (a fact with no value is omitted) and the social icon row.
describe('HubClubAbout', () => {
  it('shows Type, Address, Phone and Email facts, with the address on separate lines', () => {
    render(<HubClubAbout info={makeClubInfo()} />)

    const facts = within(screen.getByTestId('club-facts'))
    for (const label of ['Type', 'Address', 'Phone', 'Email']) expect(facts.getByText(label)).toBeInTheDocument()
    expect(facts.getByText('Club')).toBeInTheDocument()
    for (const line of ['12 Oval Road', 'Durban, KZN 4001', 'South Africa']) expect(facts.getByText(line)).toBeInTheDocument()
  })

  it('omits a fact that has no value, and the whole card when there is none', () => {
    const { rerender } = render(<HubClubAbout info={makeClubInfo({ about: { type: null, address: null, phone: '082 555 0100', email: null } })} />)
    const facts = within(screen.getByTestId('club-facts'))
    expect(facts.getByText('Phone')).toBeInTheDocument()
    for (const label of ['Type', 'Address', 'Email']) expect(facts.queryByText(label)).not.toBeInTheDocument()

    rerender(<HubClubAbout info={makeClubInfo({ about: null })} />)
    expect(screen.queryByTestId('club-facts')).not.toBeInTheDocument()
  })

  it('offers Open In Maps for the address text, in a new tab with rel noopener noreferrer, named and with a tooltip title', () => {
    render(<HubClubAbout info={makeClubInfo()} />)

    const maps = screen.getByRole('link', { name: 'Open In Maps' })
    expect(maps).toHaveAttribute('href', expect.stringContaining('https://www.google.com/maps/search/?api=1&query=12%20Oval%20Road'))
    expect(maps).toHaveAttribute('target', '_blank')
    expect(maps).toHaveAttribute('rel', 'noopener noreferrer')
    expect(maps.getAttribute('href')).not.toMatch(/Riverside/)
  })

  it('links the phone as tel: and the email as mailto:, in the value and as framed buttons', () => {
    render(<HubClubAbout info={makeClubInfo()} />)

    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+27315550100')
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:office@riverside.example')
    expect(screen.getByRole('link', { name: '+27 31 555 0100' })).toHaveAttribute('href', 'tel:+27315550100')
    expect(screen.getByRole('link', { name: 'office@riverside.example' })).toHaveAttribute('href', 'mailto:office@riverside.example')
  })

  it('shows a phone that cannot be dialled as plain text with no Call button', () => {
    render(<HubClubAbout info={makeClubInfo({ about: { type: null, address: null, phone: 'ask at the bar', email: null } })} />)

    expect(screen.getByText('ask at the bar')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
  })

  it('shows the website and social icons named for the club, https only', () => {
    render(<HubClubAbout info={makeClubInfo({ links: { website: 'https://riverside.example', social: [{ platform: 'facebook', url: 'https://www.facebook.com/riverside' }, { platform: 'x', url: 'javascript:alert(1)' }] } })} />)

    expect(screen.getByRole('link', { name: 'Riverside CC website' })).toHaveAttribute('href', 'https://riverside.example')
    expect(screen.getByRole('link', { name: 'Riverside CC on Facebook' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: /on X/ })).not.toBeInTheDocument()
  })

  it('puts the social icons in the header row, right aligned, not below the card', () => {
    render(<HubClubAbout info={makeClubInfo()} />)

    const icon = screen.getByRole('link', { name: 'Riverside CC on Facebook' })
    const row = icon.parentElement as Element
    expect(cssRulesFor(row)).toContain('justify-content:flex-end')
    expect(screen.getByRole('heading', { name: 'Riverside CC' }).closest('[data-testid="hub-club-about"] > div')).toContainElement(icon)
  })
})
