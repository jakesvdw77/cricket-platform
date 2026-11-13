import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubClubImages } from './HubClubImages'
import { cssRulesFor } from '../../../test/emotionCss'

// docs/specs/148 Decision 8: the banner band, the logo beside the club name, Download only when the club allows it.
const logos = (overrides = {}) => ({ logoUrl: 'https://cdn.example/Logo.PNG', bannerUrl: 'https://cdn.example/banner.jpeg', downloadable: true, ...overrides })

describe('HubClubImages', () => {
  it('shows the banner, the logo and the club name heading', () => {
    render(<HubClubImages clubName="Riverside CC" logos={logos()} />)

    expect(screen.getByRole('img', { name: 'Riverside CC banner' })).toHaveAttribute('src', 'https://cdn.example/banner.jpeg')
    expect(screen.getByRole('img', { name: 'Riverside CC logo' })).toHaveAttribute('src', 'https://cdn.example/Logo.PNG')
    expect(screen.getByRole('heading', { name: 'Riverside CC' })).toBeInTheDocument()
  })

  it('offers a named Download link per file with the suggested file name when downloadable', () => {
    render(<HubClubImages clubName="Riverside CC" logos={logos()} />)

    expect(screen.getByRole('link', { name: 'Download logo' })).toHaveAttribute('download', 'riverside-cc-logo.png')
    expect(screen.getByRole('link', { name: 'Download banner' })).toHaveAttribute('download', 'riverside-cc-banner.jpeg')
    expect(screen.getByRole('link', { name: 'Download logo' })).toHaveAttribute('href', 'https://cdn.example/Logo.PNG')
  })

  it('offers no Download at all when the club does not allow it', () => {
    render(<HubClubImages clubName="Riverside CC" logos={logos({ downloadable: false })} />)

    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument()
    expect(document.querySelector('[download]')).toBeNull()
  })

  it('shows initials and no banner or download when there are no images', () => {
    render(<HubClubImages clubName="Riverside CC" logos={logos({ logoUrl: null, bannerUrl: null })} />)

    expect(screen.queryByRole('img', { name: /banner/ })).not.toBeInTheDocument()
    expect(screen.getByText('RC')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Download/ })).not.toBeInTheDocument()
  })

  it('puts the trailing content at the right end of the logo and name row', () => {
    render(<HubClubImages clubName="Riverside CC" logos={null} trailing={<span data-testid="trail">icons</span>} />)

    const wrap = screen.getByTestId('trail').parentElement as Element
    expect(cssRulesFor(wrap)).toContain('margin-left:auto')
    expect(cssRulesFor(wrap)).toContain('justify-content:flex-end')
    expect(screen.getByRole('heading', { name: 'Riverside CC' }).closest('div')?.parentElement).toContainElement(wrap as HTMLElement)
  })

  it('copes with no logos block at all', () => {
    render(<HubClubImages clubName="Riverside CC" logos={null} />)

    expect(screen.getByRole('heading', { name: 'Riverside CC' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
