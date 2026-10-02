import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotSummary } from './SlotSummary'

const counts = { available: 2, unsure: 1, unavailable: 1, noResponse: 4 }

describe('SlotSummary', () => {
  it('shows the heading, a text legend with all four counts and the answered total', () => {
    render(<SlotSummary heading="Sat 3 Oct · Morning" counts={counts} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Sat 3 Oct · Morning' })).toBeInTheDocument()
    expect(screen.getByText('Available 2')).toBeInTheDocument()
    expect(screen.getByText('Unsure 1')).toBeInTheDocument()
    expect(screen.getByText('Unavailable 1')).toBeInTheDocument()
    expect(screen.getByText('No response 4')).toBeInTheDocument()
    expect(screen.getByText('4 of 8 answered')).toBeInTheDocument()
  })

  it('sizes each bar segment proportionally and exposes prefixed test ids', () => {
    render(<SlotSummary heading="Slot" counts={counts} testIdPrefix="slot-1" />)
    expect(screen.getByTestId('slot-1-bar-AVAILABLE')).toHaveStyle({ width: '25%' })
    expect(screen.getByTestId('slot-1-bar-UNSURE')).toHaveStyle({ width: '12.5%' })
    expect(screen.getByTestId('slot-1-bar-UNAVAILABLE')).toHaveStyle({ width: '12.5%' })
    expect(screen.getByTestId('slot-1-bar-NONE')).toHaveStyle({ width: '50%' })
  })

  it('renders an empty bar and 0 of 0 when nobody is eligible', () => {
    render(
      <SlotSummary heading="Slot" counts={{ available: 0, unsure: 0, unavailable: 0, noResponse: 0 }} testIdPrefix="s" />,
    )
    expect(screen.getByText('0 of 0 answered')).toBeInTheDocument()
    expect(screen.getByTestId('s-bar-AVAILABLE')).toHaveStyle({ width: '0px' })
  })

  it('uses an h4 heading in the compact variant and renders children under the heading', () => {
    render(
      <SlotSummary heading="Compact" counts={counts} compact>
        <span>extra</span>
      </SlotSummary>,
    )
    expect(screen.getByRole('heading', { level: 4, name: 'Compact' })).toBeInTheDocument()
    expect(screen.getByText('extra')).toBeInTheDocument()
  })
})
