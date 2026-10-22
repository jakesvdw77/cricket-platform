import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GroupedBarChart } from './GroupedBarChart'

const SIZE = { width: 400, height: 200 }
const series = [
  { key: 'scored', label: 'Scored', style: { tone: 'primary' as const, pattern: 'solid' as const }, values: [150, null, 90] },
  { key: 'conceded', label: 'Conceded', style: { tone: 'error' as const, pattern: 'diagonal' as const }, values: [120, null, 100] },
]

describe('GroupedBarChart', () => {
  it('puts the result letter in the axis label and labels only the first series', () => {
    const { container } = render(<GroupedBarChart size={SIZE} labels={['1 Mar W', '2 Mar L', '3 Mar T']} series={series} gapTexts={[null, 'forfeit', null]} />)
    const ticks = Array.from(container.querySelectorAll('.MuiChartsAxis-directionX .MuiChartsAxis-tickLabel')).map((node) => node.textContent)
    expect(ticks).toEqual(['1 Mar W', '2 Mar L', '3 Mar T'])
    // value labels for the scored series (150, 90), the forfeit gap in words, nothing for conceded and no zero
    expect(Array.from(container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)).toEqual(['150', '90', 'forfeit'])
  })

  it('hatches the conceded series, so it is not told apart by colour alone', () => {
    const { container } = render(<GroupedBarChart size={SIZE} labels={['a', 'b', 'c']} series={series} />)
    expect(container.querySelectorAll('pattern')).toHaveLength(1)
  })

  it('drops the direct value labels past twelve matches (too crowded at 375 px) but keeps the gap words', () => {
    const labels = Array.from({ length: 13 }, (_, index) => `d${index}`)
    const values = labels.map((_, index) => (index === 4 ? null : 10 + index))
    const { container } = render(
      <GroupedBarChart size={SIZE} labels={labels} series={[{ ...series[0], values }, { ...series[1], values }]} gapTexts={labels.map((_, index) => (index === 4 ? 'n/r' : null))} />,
    )
    expect(Array.from(container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)).toEqual(['n/r'])
  })
})
