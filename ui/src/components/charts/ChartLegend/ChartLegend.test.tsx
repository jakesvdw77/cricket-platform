import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartLegend } from './ChartLegend'

describe('ChartLegend', () => {
  it('is a named list of text entries, each with a swatch that is hidden from assistive technology', () => {
    render(
      <ChartLegend
        label="Extras types"
        items={[
          { key: 'wides', label: 'Wides', style: { tone: 'info', pattern: 'diagonal' } },
          { key: 'avg', label: 'Average 36.7', line: { tone: 'grey', dashed: true } },
          { key: 'team', label: 'Team run rate', line: { tone: 'primary', marker: 'diamond' } },
        ]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Extras types' })
    const entries = within(list).getAllByRole('listitem')
    expect(entries.map((entry) => entry.textContent)).toEqual(['Wides', 'Average 36.7', 'Team run rate'])
    for (const svg of Array.from(list.querySelectorAll('svg'))) expect(svg).toHaveAttribute('aria-hidden', 'true')
    // a pattern swatch, a dashed line, and a marker shape: the cue is never the colour alone
    expect(entries[0].querySelector('pattern')).toBeInTheDocument()
    expect(entries[1].querySelector('line')?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(entries[2].querySelector('polygon')).toBeInTheDocument()
  })
})
