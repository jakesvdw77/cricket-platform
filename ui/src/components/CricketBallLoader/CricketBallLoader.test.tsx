import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CricketBallLoader } from './CricketBallLoader'
import { FullPageLoader } from './FullPageLoader'

describe('CricketBallLoader', () => {
  it('is a status region named "Loading" by default', () => {
    render(<CricketBallLoader />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('uses the label as its accessible name', () => {
    render(<CricketBallLoader label="Loading overview" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading overview')
  })

  it('draws the ball and shadow as decoration only', () => {
    render(<CricketBallLoader />)
    expect(screen.getByTestId('cricket-ball')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('cricket-ball-shadow')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws a straight seam: one ridge and two stitch rows, all vertical lines', () => {
    render(<CricketBallLoader />)
    const lines = [screen.getByTestId('ball-ridge'), ...screen.getAllByTestId('ball-stitches')]
    expect(lines).toHaveLength(3)
    lines.forEach((line) => expect(line.getAttribute('x1')).toBe(line.getAttribute('x2')))
  })

  it('sizes sm, md and lg to 28, 56 and 88 px', () => {
    const widths = (['sm', 'md', 'lg'] as const).map((size) => {
      const { unmount } = render(<CricketBallLoader size={size} />)
      const width = getComputedStyle(screen.getByTestId('cricket-ball-loader')).width
      unmount()
      return width
    })
    expect(widths).toEqual(['28px', '56px', '88px'])
  })

  it('ships a prefers-reduced-motion rule that removes the bounce', () => {
    render(<CricketBallLoader />)
    const css = Array.from(document.querySelectorAll('style')).map((el) => el.textContent ?? '').join('')
    expect(css).toContain('prefers-reduced-motion')
  })
})

describe('FullPageLoader', () => {
  it('shows the message and names the status after it', () => {
    render(<FullPageLoader message="Signing you in" variant="backdrop" />)
    expect(screen.getByRole('status', { name: 'Signing you in' })).toBeInTheDocument()
    expect(screen.getByTestId('page-backdrop')).toBeInTheDocument()
    expect(screen.getByText('Cricket Legend')).toBeInTheDocument()
  })

  it('the plain variant has no backdrop', () => {
    render(<FullPageLoader label="Loading overview" />)
    expect(screen.queryByTestId('page-backdrop')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading overview' })).toBeInTheDocument()
  })
})
