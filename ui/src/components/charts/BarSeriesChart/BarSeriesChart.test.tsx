import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarSeriesChart } from './BarSeriesChart'

// docs/specs/117-stats-dashboard.md (Test Plan: "do not assert drawn geometry"): a fixed size lets the library lay the SVG out in jsdom;
// the assertions are on what the wrapper itself decides: the labels, the gap marker, the pattern and the reference line.
const SIZE = { width: 400, height: 200 }
const overlay = (container: HTMLElement) => Array.from(container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)

describe('BarSeriesChart', () => {
  it('writes the server\'s value text above each bar and a labelled gap, never a zero, for a missing value', () => {
    const { container } = render(<BarSeriesChart size={SIZE} labels={['a', 'b', 'c']} values={[3, null, 5]} valueTexts={['3', null, '5*']} gapText="n/r" />)
    // value labels first (3 and 5*), then the gap word; no "0" label anywhere in the overlay
    expect(overlay(container)).toEqual(['3', '5*', 'n/r'])
    expect(container.querySelectorAll('g[aria-hidden] rect[stroke-dasharray]')).toHaveLength(1)
  })

  it('defaults the labels to the values and the gap word to "n/r"', () => {
    const { container } = render(<BarSeriesChart size={SIZE} labels={['a', 'b']} values={[7, null]} />)
    expect(overlay(container)).toEqual(['7', 'n/r'])
  })

  it('defines a hatch pattern for the marked (not-out) bars, so the cue is not colour alone', () => {
    const { container } = render(<BarSeriesChart size={SIZE} labels={['a', 'b']} values={[3, 5]} hatched={[false, true]} />)
    expect(container.querySelectorAll('pattern')).toHaveLength(1)
    expect(container.querySelector('pattern')?.getAttribute('patternTransform')).toBe('rotate(45)')
  })

  it('draws the dashed reference line with its label only when a value is given', () => {
    const withLine = render(<BarSeriesChart size={SIZE} labels={['a']} values={[3]} referenceValue={4} referenceLabel="Avg 4.00" />)
    expect(withLine.container.querySelector('.MuiChartsReferenceLine-line')).toBeInTheDocument()
    expect(withLine.container.querySelector('.MuiChartsReferenceLine-label')).toHaveTextContent('Avg 4.00')
    const withoutLine = render(<BarSeriesChart size={SIZE} labels={['a']} values={[3]} referenceValue={null} />)
    expect(withoutLine.container.querySelector('.MuiChartsReferenceLine-line')).not.toBeInTheDocument()
  })

  it('shows every x label for a short series', () => {
    const { container } = render(<BarSeriesChart size={SIZE} labels={['6 Sep', '13 Sep']} values={[1, 2]} />)
    const ticks = Array.from(container.querySelectorAll('.MuiChartsAxis-directionX .MuiChartsAxis-tickLabel')).map((node) => node.textContent)
    expect(ticks).toEqual(['6 Sep', '13 Sep'])
  })
})
