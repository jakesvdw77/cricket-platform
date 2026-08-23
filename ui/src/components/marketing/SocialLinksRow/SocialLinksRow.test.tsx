import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SocialLinksRow } from './SocialLinksRow'

describe('SocialLinksRow', () => {
  it('renders a link per platform pointing at the given url', () => {
    render(
      <SocialLinksRow
        links={[
          { platform: 'facebook', url: 'https://facebook.com/cricketlegend' },
          { platform: 'x', url: 'https://x.com/cricketlegend' },
        ]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/cricketlegend')
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute('href', 'https://x.com/cricketlegend')
  })

  it('falls back to the generic link icon and the raw platform string as its aria-label, for an unrecognized (custom) platform', () => {
    render(<SocialLinksRow links={[{ platform: 'discord', url: 'https://discord.gg/cricketlegend' }]} />)

    const link = screen.getByRole('link', { name: 'discord' })
    expect(link).toHaveAttribute('href', 'https://discord.gg/cricketlegend')
    // The generic MUI LinkIcon renders as <svg data-testid="LinkIcon">, same convention
    // @mui/icons-material uses for every icon's testid.
    expect(link.querySelector('[data-testid="LinkIcon"]')).toBeInTheDocument()
  })

  it.each(['tiktok', 'threads', 'snapchat'] as const)(
    'falls back to the generic link icon for %s, a known SocialPlatform with no dedicated @mui/icons-material icon',
    (platform) => {
      render(<SocialLinksRow links={[{ platform, url: 'https://example.com/cricketlegend' }]} />)

      const link = screen.getByRole('link', { name: platform })
      expect(link.querySelector('[data-testid="LinkIcon"]')).toBeInTheDocument()
    },
  )
})
