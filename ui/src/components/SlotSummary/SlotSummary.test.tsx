import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotSummary } from './SlotSummary'
import { legend } from '../../test/legend'

const counts = { available: 2, unsure: 1, unavailable: 1, noResponse: 4 }

describe('SlotSummary', () => {
  it('shows the heading, a text legend with all four counts and the answered total', () => {
    render(<SlotSummary heading="Sat 3 Oct · Morning" counts={counts} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Sat 3 Oct · Morning' })).toBeInTheDocument()
    expect(screen.getByText(legend('Available 2'))).toBeInTheDocument()
    expect(screen.getByText(legend('Unsure 1'))).toBeInTheDocument()
    expect(screen.getByText(legend('Unavailable 1'))).toBeInTheDocument()
    expect(screen.getByText(legend('No response 4'))).toBeInTheDocument()
    expect(screen.getByText('4 of 8 answered')).toBeInTheDocument()
  })

  it('draws each count bold and larger beside its word, and the answered line bold in the primary text colour', () => {
    render(<SlotSummary heading="Slot" counts={{ available: 128, unsure: 0, unavailable: 240, noResponse: 3 }} />)
    const item = screen.getByText(legend('Available 128'))
    expect(item.children).toHaveLength(3)
    const count = item.children[2] as HTMLElement
    expect(count).toHaveTextContent('128')
    expect(count).toHaveStyle({ fontWeight: '700', fontSize: '1rem' })
    expect(item.children[1]).toHaveTextContent('Available')
    expect(screen.getByText('368 of 371 answered')).toHaveStyle({ fontWeight: '700' })
  })

  it('puts the answered text on the heading line, right-aligned, never broken inside, wrapping when tight', () => {
    render(<SlotSummary heading="Thursday, 15 October · Afternoon" counts={counts} />)
    const heading = screen.getByRole('heading', { level: 3 })
    const answered = screen.getByText('4 of 8 answered')
    expect(answered.parentElement).toBe(heading.parentElement)
    expect(answered.parentElement).toHaveStyle({ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' })
    expect(answered).toHaveStyle({ whiteSpace: 'nowrap' })
    expect(heading).toHaveStyle({ flex: '1 1 auto' })
  })

  it('applies the same heading row to the compact variant', () => {
    render(<SlotSummary heading="Slot" counts={counts} compact />)
    expect(screen.getByText('4 of 8 answered').parentElement).toBe(screen.getByRole('heading', { level: 4 }).parentElement)
  })

  it('lays the legend out as one six-column grid with every cell a direct child, so columns line up', () => {
    render(<SlotSummary heading="Slot" counts={counts} compact />)
    const first = screen.getByText(legend('Available 2'))
    const grid = first.parentElement as HTMLElement
    expect(grid).toHaveStyle({ display: 'grid', gridTemplateColumns: 'repeat(6, auto)' })
    expect(first).toHaveStyle({ display: 'contents' })
    // Order: Available, Unsure | Unavailable, No response - first column Available/Unavailable.
    expect(Array.from(grid.children).map((child) => child.getAttribute('data-legend'))).toEqual([
      'Available 2',
      'Unsure 1',
      'Unavailable 1',
      'No response 4',
    ])
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
