import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubClubLinks } from './HubClubLinks'
import { cssRulesFor } from '../../../test/emotionCss'
import { makeClubInfo } from '../../../test/clubInfoFixtures'

// docs/specs/148 Links: framed icon buttons plus the same links as labelled rows; https only, always a new tab.
describe('HubClubLinks', () => {
  it('shows the website and each social page as icon buttons and as rows with the host', () => {
    render(<HubClubLinks info={makeClubInfo()} />)

    expect(screen.getByRole('link', { name: 'Riverside CC website' })).toHaveAttribute('href', 'https://riverside.example')
    expect(screen.getByRole('link', { name: 'Riverside CC on Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/riverside')
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Website')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link', { name: 'riverside.example' })).toBeInTheDocument()
    expect(within(rows[1]).getByText('Facebook')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('link', { name: 'facebook.com' })).toBeInTheDocument()
  })

  it('right aligns the icon row', () => {
    render(<HubClubLinks info={makeClubInfo()} />)

    expect(cssRulesFor(screen.getByRole('link', { name: 'Riverside CC website' }).parentElement as Element)).toContain('justify-content:flex-end')
  })

  it('opens every link in a new tab with rel noopener noreferrer', () => {
    render(<HubClubLinks info={makeClubInfo()} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('drops a link that is not https', () => {
    render(<HubClubLinks info={makeClubInfo({ links: { website: 'http://insecure.example', social: [{ platform: 'instagram', url: 'https://instagram.com/riverside' }, { platform: 'other', url: 'javascript:alert(1)' }] } })} />)

    expect(screen.queryByRole('link', { name: /website/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Riverside CC on Instagram' })).toBeInTheDocument()
  })

  it('draws nothing when there is no usable link', () => {
    const { container } = render(<HubClubLinks info={makeClubInfo({ links: { website: null, social: [] } })} />)

    expect(container).toBeEmptyDOMElement()
  })
})
