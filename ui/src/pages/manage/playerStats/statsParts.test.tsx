import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotCapturedPanel, StatTile } from './statsParts'

describe('StatTile', () => {
  const colour = (tone?: 'primary' | 'success' | 'error') => {
    const { unmount } = render(<StatTile testId="tile" icon={<span />} label="Won" value="9" tone={tone} />)
    const value = getComputedStyle(screen.getByTestId('tile-value')).color
    unmount()
    return value
  }

  it('shows the value and label, with a coverage caption under the label when given', () => {
    render(<StatTile testId="tile" icon={<span />} label="Runs" value="412" caption="from 9 of 14 innings" />)
    expect(screen.getByTestId('tile-value')).toHaveTextContent('412')
    expect(screen.getByTestId('tile')).toHaveTextContent('Runs')
    expect(screen.getByText('from 9 of 14 innings')).toBeInTheDocument()
  })

  it('tones the figure: primary by default, success and error different from it and from each other', () => {
    expect(colour('primary')).toBe(colour())
    expect(colour('success')).not.toBe(colour())
    expect(colour('error')).not.toBe(colour())
    expect(colour('error')).not.toBe(colour('success'))
  })
})

describe('NotCapturedPanel', () => {
  it('lists each item, and renders nothing for an empty list', () => {
    const { container, rerender } = render(<NotCapturedPanel items={[{ code: 'P', label: 'Partnerships', reason: 'not recorded' }]} />)
    expect(screen.getByText('Partnerships')).toBeInTheDocument()
    rerender(<NotCapturedPanel items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
