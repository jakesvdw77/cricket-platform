import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SelectionGauge } from './SelectionGauge'

describe('SelectionGauge', () => {
  it('shows the bar and the Picked and To go counts', () => {
    render(<SelectionGauge picked={10} size={12} ariaLabel="1st XI selection" />)
    const bar = screen.getByRole('progressbar', { name: '1st XI selection' })
    expect(bar).toHaveAttribute('aria-valuenow', '10')
    expect(bar).toHaveAttribute('aria-valuemax', '12')
    expect(bar).toHaveAttribute('aria-valuetext', '10 of 12 picked')
    expect(screen.getByTestId('selection-picked')).toHaveTextContent('10 Picked')
    expect(screen.getByTestId('selection-togo')).toHaveTextContent('2 To go')
    expect(screen.queryByTestId('selection-complete')).not.toBeInTheDocument()
  })

  it('says Squad complete once full, and never reports a negative To go', () => {
    const { rerender } = render(<SelectionGauge picked={12} size={12} ariaLabel="x" />)
    expect(screen.getByTestId('selection-complete')).toHaveTextContent('Squad complete')
    expect(screen.queryByTestId('selection-togo')).not.toBeInTheDocument()
    rerender(<SelectionGauge picked={14} size={12} ariaLabel="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12')
    expect(screen.getByTestId('selection-complete')).toBeInTheDocument()
  })

  it('draws an empty bar for nobody picked', () => {
    render(<SelectionGauge picked={0} size={12} ariaLabel="x" />)
    expect(screen.getByTestId('selection-fill')).toHaveStyle({ width: '0%' })
    expect(screen.getByTestId('selection-togo')).toHaveTextContent('12 To go')
  })
})
