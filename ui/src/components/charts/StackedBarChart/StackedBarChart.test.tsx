import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StackedBarChart } from './StackedBarChart'
import { EXTRAS_STYLES, NOT_ITEMISED_STYLE } from '../chartStyles'

const SIZE = { width: 400, height: 200 }
const categories = [
  { key: 'wides', label: 'Wides', style: EXTRAS_STYLES.wides },
  { key: 'byes', label: 'Byes', style: EXTRAS_STYLES.byes },
  { key: 'notItemised', label: 'Not itemised', style: NOT_ITEMISED_STYLE },
]

describe('StackedBarChart', () => {
  it('writes the server\'s total above each stack and a labelled gap where nothing was recorded', () => {
    const { container } = render(
      <StackedBarChart size={SIZE} labels={['a', 'b', 'c']} categories={categories} values={[[4, null, null], [2, null, null], [null, null, 12]]} totals={[6, null, 12]} gapText="n/r" />,
    )
    expect(Array.from(container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)).toEqual(['6', '12', 'n/r'])
  })

  it('gives each patterned type its own pattern and leaves the solid and grey ones as flat fills', () => {
    const { container } = render(<StackedBarChart size={SIZE} labels={['a']} categories={categories} values={[[4], [2], [null]]} totals={[6]} />)
    // wides (solid info) and Not itemised (grey solid) need none; byes has dots
    expect(container.querySelectorAll('pattern')).toHaveLength(1)
  })

  it('draws no bar for a segment that was not recorded (a null is not stacked as a value)', () => {
    const { container } = render(<StackedBarChart size={SIZE} labels={['a', 'b']} categories={categories} values={[[4, null], [null, null], [null, null]]} totals={[4, null]} />)
    // the only value label is the first total; the second point is a gap
    expect(Array.from(container.querySelectorAll('g[aria-hidden] text')).map((node) => node.textContent)).toEqual(['4', 'n/r'])
  })
})
