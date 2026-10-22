import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineSeriesChart } from './LineSeriesChart'

const SIZE = { width: 400, height: 200 }
const labels = ['a', 'b', 'c']

describe('LineSeriesChart', () => {
  it('breaks the line at a missing value instead of drawing a zero, and draws no marker for it', () => {
    const { container } = render(
      <LineSeriesChart size={SIZE} labels={labels} series={[{ key: 's', label: 'S', values: [1, null, 3], tone: 'primary', marker: 'circle' }]} />,
    )
    const path = container.querySelector('.MuiLineElement-series-s')?.getAttribute('d') ?? ''
    // two separate sub-paths: nothing joins the points across the gap
    expect(path.match(/M/g)).toHaveLength(2)
    expect(path).not.toContain('L')
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('marks a point where every series is missing with a labelled gap, unless markGaps is off', () => {
    const series = [{ key: 's', label: 'S', values: [1, null, 3], tone: 'primary' as const, marker: 'circle' as const }]
    const on = render(<LineSeriesChart size={SIZE} labels={labels} series={series} gapText="n/r" />)
    expect(Array.from(on.container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)).toEqual(['n/r'])
    const off = render(<LineSeriesChart size={SIZE} labels={labels} series={series} markGaps={false} />)
    expect(off.container.querySelectorAll('g[aria-hidden] text')).toHaveLength(0)
  })

  it('a point missing from one series but not all is no gap marker', () => {
    const { container } = render(
      <LineSeriesChart
        size={SIZE}
        labels={labels}
        series={[
          { key: 'a', label: 'A', values: [1, null, 3], tone: 'primary', marker: 'circle' },
          { key: 'b', label: 'B', values: [2, 2, 2], tone: 'error', marker: 'square', dashed: true },
        ]}
      />,
    )
    expect(container.querySelectorAll('g[aria-hidden] text')).toHaveLength(0)
  })

  it('tells series apart by marker shape and not by colour alone', () => {
    const { container } = render(
      <LineSeriesChart
        size={SIZE}
        labels={['a']}
        series={[
          { key: 'a', label: 'A', values: [1], tone: 'primary', marker: 'circle' },
          { key: 'b', label: 'B', values: [2], tone: 'error', marker: 'square' },
          { key: 'c', label: 'C', values: [3], tone: 'info', marker: 'diamond' },
        ]}
      />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelectorAll('rect[stroke-width="2"]')).toHaveLength(1)
    expect(container.querySelectorAll('polygon')).toHaveLength(1)
  })

  it('writes the supplied point texts and the dashed reference line with its label', () => {
    const { container } = render(
      <LineSeriesChart
        size={SIZE}
        labels={labels}
        series={[{ key: 's', label: 'S', values: [1, 2, 3], tone: 'info', marker: 'circle', pointTexts: ['1.00', '2.00', null] }]}
        referenceValue={2.5}
        referenceLabel="Average 2.50"
      />,
    )
    expect(Array.from(container.querySelectorAll('circle + text')).map((node) => node.textContent)).toEqual(['1.00', '2.00'])
    expect(container.querySelector('.MuiChartsReferenceLine-label')).toHaveTextContent('Average 2.50')
  })

  it('draws no reference line without a value', () => {
    const { container } = render(<LineSeriesChart size={SIZE} labels={['a']} series={[{ key: 's', label: 'S', values: [1], tone: 'info', marker: 'circle' }]} referenceValue={null} />)
    expect(container.querySelector('.MuiChartsReferenceLine-line')).not.toBeInTheDocument()
  })
})
