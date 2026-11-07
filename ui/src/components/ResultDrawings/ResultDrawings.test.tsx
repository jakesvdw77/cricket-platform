import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverBlocks, RunsMixBar, dotCentres, overBlocks, roundedRectPath, runsMixSplit, segmentOffsets, segmentWidths } from '.'

// docs/specs/145: the Results drawings are our own SVG. Every figure is also in the text alternative, nothing is drawn for a zero, and
// the grow animation only runs when the person has not asked for reduced motion.
describe('drawingMath', () => {
  it('splits a score into fours, sixes and the rest, and never lets the bar overflow', () => {
    expect(runsMixSplit(46, 4, 1)).toEqual({ fours: 16, sixes: 6, rest: 24, total: 46 })
    expect(runsMixSplit(10, 3, 1)).toEqual({ fours: 12, sixes: 6, rest: 0, total: 18 })
    expect(runsMixSplit(0, -2, -1)).toEqual({ fours: 0, sixes: 0, rest: 0, total: 0 })
  })

  it('scales segment widths in proportion with the gap between visible segments only', () => {
    const widths = segmentWidths([16, 0, 24], 303, 3)
    expect(widths).toEqual([120, 0, 180])
    expect(segmentOffsets(widths, 3)).toEqual([0, 123, 123])
    expect(segmentWidths([0, 0], 300)).toEqual([0, 0])
    expect(segmentWidths([5], 0)).toEqual([0])
  })

  it('draws one block per over, with a part over filling its share', () => {
    const blocks = overBlocks(26, 6, 300, 6)
    expect(blocks).toHaveLength(5)
    expect(blocks.slice(0, 4).every((block) => block.fill === 1)).toBe(true)
    expect(blocks[4].fill).toBeCloseTo(2 / 6)
    expect(overBlocks(0, 6, 300)).toEqual([])
    expect(overBlocks(12, 6, 0)).toEqual([])
  })

  it('caps the number of blocks and shrinks them rather than overflowing', () => {
    const blocks = overBlocks(6 * 40, 6, 300, 6, 20)
    expect(blocks).toHaveLength(20)
    const last = blocks[19]
    expect(last.x + last.width).toBeLessThanOrEqual(300.001)
  })

  it('uses eight balls an over when the league does, and six for a bad value', () => {
    expect(overBlocks(16, 8, 300)).toHaveLength(2)
    expect(overBlocks(12, 0, 300)).toHaveLength(2)
  })

  it('centres dots from the radius and squeezes a long row to fit', () => {
    expect(dotCentres(0, 100, 9)).toEqual([])
    expect(dotCentres(1, 100, 9)).toEqual([9])
    const squeezed = dotCentres(30, 150, 9)
    expect(squeezed).toHaveLength(30)
    expect(squeezed[29]).toBeLessThanOrEqual(150 - 9 + 0.001)
  })

  it('rounds only the requested edges of a segment', () => {
    expect(roundedRectPath(0, 0, 40, 20, 0, 0)).not.toContain('A')
    expect(roundedRectPath(0, 0, 40, 20, 8, 0).match(/A/g)).toHaveLength(2)
    expect(roundedRectPath(0, 0, 4, 20, 8, 8)).toContain('A2 2')
  })
})

describe('RunsMixBar', () => {
  it('names every part in its text alternative and caption', () => {
    render(<RunsMixBar runs={46} fours={4} sixes={1} />)
    expect(screen.getByRole('img', { name: 'Runs made: 16 in fours, 6 in sixes, 24 in ones and twos' })).toBeInTheDocument()
    expect(screen.getByTestId('runs-mix-bar').textContent).toBe('4 fours = 16 · 1 six = 6 · ones and twos 24')
  })

  it('draws a segment per non-zero part only', () => {
    const { container } = render(<RunsMixBar runs={8} fours={2} sixes={0} />)
    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAccessibleName('Runs made: 8 in fours, 0 in sixes, 0 in ones and twos')
  })

  it('draws nothing but the caption for a duck', () => {
    const { container } = render(<RunsMixBar runs={0} fours={0} sixes={0} />)
    expect(container.querySelectorAll('path')).toHaveLength(0)
    expect(screen.getByRole('img')).toHaveAccessibleName('Runs made: 0 in fours, 0 in sixes, 0 in ones and twos')
  })

  it('animates the growth only under a no-preference media query (reduced motion keeps it still)', () => {
    const { container } = render(<RunsMixBar runs={46} fours={4} sixes={1} />)
    const cls = (container.querySelector('path') as SVGPathElement).getAttribute('class')?.split(' ').find((name) => name.startsWith('css-')) as string
    const rules = [...document.querySelectorAll('style')].map((style) => style.textContent ?? '')
    const withAnimation = rules.filter((text) => text.includes(`.${cls}`) && text.includes('animation:'))
    expect(withAnimation).toHaveLength(1)
    expect(withAnimation[0].startsWith('@media (prefers-reduced-motion: no-preference)')).toBe(true)
  })
})

describe('OverBlocks', () => {
  it('says overs, maidens and wickets in its text alternative', () => {
    render(<OverBlocks balls={26} ballsPerOver={6} wickets={2} maidens={1} />)
    expect(screen.getByRole('img', { name: '4.2 overs bowled, 1 maiden, 2 wickets' })).toBeInTheDocument()
    expect(screen.getByTestId('over-blocks').textContent).toContain('each block is an over · gold = a wicket · ring = a maiden')
  })

  it('uses singular wicket, plural maidens, and leaves out the legend of what is absent', () => {
    render(<OverBlocks balls={12} ballsPerOver={6} wickets={1} maidens={0} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('2 overs bowled, 0 maidens, 1 wicket')
    expect(screen.getByTestId('over-blocks').textContent).toBe('each block is an over · gold = a wicket')
  })

  it('draws a block pair per over, a dot per wicket and a ring per maiden', () => {
    const { container } = render(<OverBlocks balls={18} ballsPerOver={6} wickets={3} maidens={2} />)
    expect(container.querySelectorAll('rect')).toHaveLength(6)
    expect(container.querySelectorAll('circle')).toHaveLength(5)
  })

  it('counts eight-ball overs from the league rule', () => {
    render(<OverBlocks balls={16} ballsPerOver={8} wickets={0} maidens={0} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('2 overs bowled, 0 maidens, 0 wickets')
  })
})
