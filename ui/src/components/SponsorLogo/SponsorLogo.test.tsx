import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SponsorLogo } from './SponsorLogo'

// Sponsor logos are mostly wide, so the tile is as wide as the logo needs at a fixed height (a square avatar left them tiny).
describe('SponsorLogo', () => {
  it('shows the logo on a tile of the given height, never stretched (contain)', () => {
    const { container } = render(<SponsorLogo src="/media/s.png" fallback="SU" height={48} />)
    const tile = screen.getByTestId('sponsor-logo')
    expect(getComputedStyle(tile).height).toBe('48px')
    const image = container.querySelector('img') as HTMLImageElement
    expect(image).toHaveAttribute('src', '/media/s.png')
    expect(getComputedStyle(image).objectFit).toBe('contain')
  })

  it('shows the initials when there is no logo, and when the logo fails to load', () => {
    const { rerender, container } = render(<SponsorLogo src={null} fallback="SU" />)
    expect(screen.getByText('SU')).toBeInTheDocument()
    rerender(<SponsorLogo src="/media/broken.png" fallback="SU" />)
    fireEvent.error(container.querySelector('img') as HTMLImageElement)
    expect(screen.getByText('SU')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
