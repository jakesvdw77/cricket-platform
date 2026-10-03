import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardProgressBar } from './CardProgressBar'

describe('CardProgressBar', () => {
  it('exposes progressbar attributes and a proportional fill', () => {
    render(<CardProgressBar value={3} max={12} ariaLabel="Matches played" valueText="3 of 12 played" />)

    const bar = screen.getByRole('progressbar', { name: 'Matches played' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '12')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 12 played')
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '25%' })
  })

  it('clamps a value above max to a full bar', () => {
    render(<CardProgressBar value={15} max={11} ariaLabel="x" valueText="15 of 11" />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '11')
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '100%' })
  })

  it('renders an empty bar when max is 0', () => {
    render(<CardProgressBar value={0} max={0} ariaLabel="x" valueText="none" />)

    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '0%' })
  })
})
