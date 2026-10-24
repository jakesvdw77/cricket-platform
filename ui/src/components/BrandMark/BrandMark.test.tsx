import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('draws the green favicon tile at the requested size, decorative', () => {
    render(<BrandMark size={34} />)
    const mark = screen.getByTestId('brand-mark')
    expect(mark).toHaveAttribute('src', '/favicon.svg')
    expect(mark).toHaveStyle({ width: '34px', height: '34px' })
    expect(mark).toHaveAttribute('aria-hidden', 'true')
  })

  it('never puts the mark on a white tile', () => {
    render(<BrandMark edge />)
    const style = window.getComputedStyle(screen.getByTestId('brand-mark'))
    expect(style.backgroundColor === '' || style.backgroundColor === 'rgba(0, 0, 0, 0)').toBe(true)
  })

  it('adds a thin light edge only when asked', () => {
    const { rerender } = render(<BrandMark />)
    expect(window.getComputedStyle(screen.getByTestId('brand-mark')).boxShadow).toBe('')
    rerender(<BrandMark edge />)
    expect(window.getComputedStyle(screen.getByTestId('brand-mark')).boxShadow).not.toBe('')
  })
})
