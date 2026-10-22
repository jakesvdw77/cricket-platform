import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DonutChart } from './DonutChart'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../chartStyles'

const slices = [
  { key: 'won', label: 'Won', value: 9, percentText: '64.3%', style: { tone: 'success' as const, pattern: 'solid' as const } },
  { key: 'lost', label: 'Lost', value: 4, percentText: '28.6%', style: { tone: 'error' as const, pattern: 'diagonal' as const } },
  { key: 'tied', label: 'Tied', value: 0, percentText: '0%', style: CATEGORY_STYLES[3] },
  { key: 'rest', label: 'Not itemised', value: 1, percentText: null, style: NOT_ITEMISED_STYLE },
]

describe('DonutChart', () => {
  it('lists every slice in the legend with the count and the server\'s percentage as text, a zero slice included', () => {
    render(<DonutChart slices={slices} centerValue="14" centerLabel="played" />)
    const items = within(screen.getByTestId('donut-legend')).getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Won9 · 64.3%', 'Lost4 · 28.6%', 'Tied0 · 0%', 'Not itemised1'])
  })

  it('shows the total and its caption in the centre, as given', () => {
    const { container } = render(<DonutChart slices={slices} centerValue="14" centerLabel="played" />)
    const centre = Array.from(container.querySelectorAll('svg g[aria-hidden] text')).map((node) => node.textContent)
    expect(centre).toEqual(['14', 'played'])
  })

  it('gives each non-solid slice a pattern swatch in the legend, so no slice is told apart by colour alone', () => {
    render(<DonutChart slices={slices} centerValue="14" centerLabel="played" />)
    // Lost (diagonal) and Tied (dots) carry a pattern; Won and the grey Not itemised are flat
    const legend = screen.getByTestId('donut-legend')
    expect(legend.querySelectorAll('pattern')).toHaveLength(2)
    expect(legend.querySelectorAll('svg')).toHaveLength(4)
  })

  it('is a labelled legend list', () => {
    render(<DonutChart slices={slices} centerValue="14" centerLabel="played" />)
    expect(screen.getByRole('list', { name: 'Legend' })).toBe(screen.getByTestId('donut-legend'))
  })
})
