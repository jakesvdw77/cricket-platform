import { render, screen } from '@testing-library/react'
import { cssRulesFor } from '../../../test/emotionCss'
import { describe, expect, it } from 'vitest'
import { describeLink, HubSocialIconRow, socialFor } from './HubSocialLinks'

// Shared by the league page and the Club info page (docs/specs/148).
describe('socialFor and describeLink', () => {
  it('names the known networks from the host and falls back to the platform text', () => {
    expect(socialFor('https://www.facebook.com/x', 'a').name).toBe('Facebook')
    expect(socialFor('https://fb.com/x', 'a').name).toBe('Facebook')
    expect(socialFor('https://twitter.com/x', 'a').name).toBe('X')
    expect(socialFor('https://youtu.be/x', 'a').name).toBe('YouTube')
    expect(socialFor('https://tiktok.com/x', 'Tiktok').name).toBe('Tiktok')
    expect(socialFor('not a url', 'Other').name).toBe('Other')
  })

  it('calls the website Website and capitalises an unknown platform', () => {
    expect(describeLink({ platform: 'Website', url: 'https://a.example' }).name).toBe('Website')
    expect(describeLink({ platform: 'mastodon', url: 'https://m.example' }).name).toBe('Mastodon')
  })
})

describe('icon choice (platform first, then host)', () => {
  const iconOf = (platform: string, url: string) => {
    const { container } = render(<HubSocialIconRow links={[{ platform, url }]} />)
    return container.querySelector('svg')?.getAttribute('data-testid')
  }

  it('uses the stored platform even when the host is not that network', () => {
    expect(iconOf('facebook', 'https://pages.example.org/riverside')).toBe('FacebookIcon')
  })

  it('keeps the globe for Website', () => {
    expect(iconOf('Website', 'https://riverside.example')).toBe('LanguageIcon')
  })

  it('falls back to the host for an unknown platform', () => {
    expect(iconOf('page', 'https://www.instagram.com/riverside')).toBe('InstagramIcon')
  })
})

describe('HubSocialIconRow', () => {
  const links = [{ platform: 'Website', url: 'https://riverside.example' }, { platform: 'facebook', url: 'https://facebook.com/r' }, { platform: 'x', url: 'http://x.com/r' }]

  it('shows https links only, as named buttons that open a new tab safely', () => {
    render(<HubSocialIconRow links={links} ownerLabel="Riverside CC" />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Riverside CC website' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Riverside CC on Facebook' })).toHaveAttribute('target', '_blank')
  })

  it('names the buttons by network and "opens in a new tab" without an owner', () => {
    render(<HubSocialIconRow links={links} />)

    expect(screen.getByRole('link', { name: 'Facebook (opens in a new tab)' })).toBeInTheDocument()
  })

  it('right aligns by default and left aligns on request', () => {
    const { container, rerender } = render(<HubSocialIconRow links={links} />)
    expect(cssRulesFor(container.firstElementChild as Element)).toContain('justify-content:flex-end')
    rerender(<HubSocialIconRow links={links} justify="flex-start" />)
    expect(cssRulesFor(container.firstElementChild as Element)).toContain('justify-content:flex-start')
  })

  it('draws nothing when no link is https', () => {
    const { container } = render(<HubSocialIconRow links={[{ platform: 'x', url: 'http://x.com/r' }]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
