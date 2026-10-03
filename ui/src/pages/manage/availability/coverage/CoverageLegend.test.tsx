import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverageLegend } from './CoverageLegend'

describe('CoverageLegend (docs/specs/074 section 7)', () => {
  it('lists the three keys in a labelled list', () => {
    render(<CoverageLegend />)

    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Only this team',
      'Also available for another team',
      'Places needed (playing XI)',
    ])
  })
})
