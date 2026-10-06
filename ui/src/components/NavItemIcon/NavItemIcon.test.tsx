import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NavItemIcon } from './NavItemIcon'

describe('NavItemIcon', () => {
  it('renders a brand icon at the given size', () => {
    const { container } = render(<NavItemIcon name="nav/teams" size={40} />)

    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveStyle({ width: '40px', height: '40px' })
  })

  it('renders the menu glyph on a disc, 32 px by default, hidden from assistive tech', () => {
    render(<NavItemIcon name="menu" />)

    const disc = screen.getByTestId('nav-icon-menu')
    expect(disc).toHaveStyle({ width: '32px', height: '32px' })
    expect(disc).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the Overview brand icon', () => {
    const { container } = render(<NavItemIcon name="nav/overview-home" size={32} />)

    expect(container.querySelector('img')).toBeInTheDocument()
  })
})
