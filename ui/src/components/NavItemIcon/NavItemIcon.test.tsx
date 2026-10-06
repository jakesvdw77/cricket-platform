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

  it.each(['nav/availability-player', 'nav/availability-team'] as const)('renders the %s brand icon', (name) => {
    const { container } = render(<NavItemIcon name={name} size={36} surface="none" />)

    expect(container.querySelector('img')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('renders the Overview brand icon', () => {
    const { container } = render(<NavItemIcon name="nav/overview-home" size={32} />)

    expect(container.querySelector('img')).toBeInTheDocument()
  })

  it('passes padding and active through to the brand icon tile', () => {
    render(<NavItemIcon name="nav/teams" size={32} padding={3} active />)

    expect(screen.getByTestId('brand-icon-tile')).toHaveStyle({ width: '38px', height: '38px', boxShadow: '0 0 0 2px #fff' })
  })
})
