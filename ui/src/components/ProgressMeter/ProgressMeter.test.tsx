import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressMeter } from './ProgressMeter'

describe('ProgressMeter', () => {
  it('shows "x of y" above a progressbar with a proportional fill', () => {
    render(<ProgressMeter value={3} max={12} ariaLabel="Matches played" />)
    const bar = screen.getByRole('progressbar', { name: 'Matches played' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '12')
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 12')
    expect(screen.getByText('3 of 12')).toBeInTheDocument()
    expect(screen.getByTestId('progress-meter-fill')).toHaveStyle({ width: '25%' })
  })

  it('uses a custom label and clamps the value', () => {
    render(<ProgressMeter value={15} max={11} ariaLabel="x" label="Full squad" />)
    expect(screen.getByText('Full squad')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '11')
    expect(screen.getByTestId('progress-meter-fill')).toHaveStyle({ width: '100%' })
  })

  it('shows the italic caption and no progressbar when max is 0', () => {
    render(<ProgressMeter value={0} max={0} ariaLabel="x" emptyLabel="No matches scheduled" />)
    expect(screen.getByText('No matches scheduled')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
