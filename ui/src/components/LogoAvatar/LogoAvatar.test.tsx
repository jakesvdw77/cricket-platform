import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogoAvatar } from './LogoAvatar'

const root = () => document.querySelector('.MuiAvatar-root') as HTMLElement

describe('LogoAvatar', () => {
  it('shows the soft green tint, not gold, for a record with no src, while loading and after an error', () => {
    render(<LogoAvatar size={40} src="/broken.png">IV</LogoAvatar>)
    expect(getComputedStyle(root()).backgroundImage).toBe('none')
    expect(getComputedStyle(root()).backgroundColor).not.toBe('rgb(232, 184, 61)')
    expect(getComputedStyle(root()).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    fireEvent.error(screen.getByRole('img'))
    expect(getComputedStyle(root()).backgroundImage).toBe('none')
    expect(getComputedStyle(root()).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('keeps the tile for a stock icon when keepTile is set', () => {
    render(<LogoAvatar size={40} src="/stock.svg" kind="person" keepTile>P</LogoAvatar>)
    fireEvent.load(screen.getByRole('img'))
    expect(getComputedStyle(root()).backgroundImage).toContain('gradient')
  })

  it('shows the gold tile and the initials with no src for a person', () => {
    render(<LogoAvatar size={40} kind="person">IV</LogoAvatar>)
    expect(getComputedStyle(root()).backgroundImage).toContain('gradient')
    expect(screen.getByText('IV')).toBeInTheDocument()
    expect(getComputedStyle(root()).color).not.toBe('')
  })

  it('keeps the gold tile while the image is loading', () => {
    render(<LogoAvatar size={40} src="/logo.png" kind="person">IV</LogoAvatar>)
    expect(getComputedStyle(root()).backgroundImage).toContain('gradient')
  })

  it('keeps the gold tile and shows the initials colour when the image errors', () => {
    render(<LogoAvatar size={40} src="/broken.png" kind="person">IV</LogoAvatar>)
    fireEvent.error(screen.getByRole('img'))
    expect(getComputedStyle(root()).backgroundImage).toContain('gradient')
    expect(root()).toHaveAttribute('data-logo-loaded', 'false')
  })

  it('drops the tile only after the image has loaded', () => {
    render(<LogoAvatar size={40} src="/logo.png" kind="person">IV</LogoAvatar>)
    fireEvent.load(screen.getByRole('img'))
    expect(root()).toHaveAttribute('data-logo-loaded', 'true')
    expect(getComputedStyle(root()).backgroundImage).not.toContain('gradient')
    expect(getComputedStyle(screen.getByRole('img')).objectFit).toBe('contain')
  })

  it('applies fallbackSx only while the tile shows', () => {
    render(<LogoAvatar size={40} src="/logo.png" fallbackSx={{ border: '2px solid red' }}>IV</LogoAvatar>)
    expect(getComputedStyle(root()).borderWidth).toBe('2px')
    fireEvent.load(screen.getByRole('img'))
    expect(getComputedStyle(root()).borderWidth).not.toBe('2px')
  })
})
