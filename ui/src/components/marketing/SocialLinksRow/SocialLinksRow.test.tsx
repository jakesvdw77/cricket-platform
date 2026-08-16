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
})
