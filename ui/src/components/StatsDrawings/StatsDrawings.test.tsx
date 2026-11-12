import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { FlipCard } from '../FlipCard'
import { ColumnChart, Donut, HorizontalBars, LineChart, ProgressBars } from '.'
import type { LineChartPoint } from '.'

// docs/specs/147 section 4: our own drawings. The values are also text, links have names, a zero is still visible.
const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('HorizontalBars', () => {
  const rows = [
    { key: 'a', label: 'Premier League', value: 5, valueLabel: '5' },
    { key: 'b', label: 'Cup', value: 2, valueLabel: '2' },
    { key: 'c', label: 'Friendly', value: 0, valueLabel: '0' },
  ]

  it('writes every value as text in its row and names the group by the alt text', () => {
    inRouter(<HorizontalBars rows={rows} alt="Matches by league" />)
    const group = screen.getByRole('group', { name: 'Matches by league' })
    const rowEls = within(group).getAllByTestId('bar-row')
    expect(rowEls).toHaveLength(3)
    expect(rowEls[0]).toHaveTextContent('Premier League')
    expect(rowEls[0]).toHaveTextContent('5')
    expect(rowEls[2]).toHaveTextContent('0')
  })

  it('draws no bar fill for an unmarked zero, and a 3 px stub when the row has a colour', () => {
    const { rerender } = inRouter(<HorizontalBars rows={rows} alt="x" />)
    expect(screen.queryAllByTestId('bar-stub')).toHaveLength(0)
    rerender(<MemoryRouter><HorizontalBars rows={[{ ...rows[2], colour: STATS_COLOUR.bad }]} alt="x" /></MemoryRouter>)
    expect(screen.getByTestId('bar-stub')).toHaveStyle({ width: '3px' })
  })

  it('makes a row with an href a link named with its figure', () => {
    inRouter(<HorizontalBars rows={[{ ...rows[0], href: '/drill/1' }]} alt="x" />)
    const link = screen.getByRole('link', { name: 'Premier League: 5' })
    expect(link).toHaveAttribute('href', '/drill/1')
  })

  it('labels a two-category comparison with a legend, and shows the tag under the label', () => {
    inRouter(<HorizontalBars rows={[{ ...rows[0], tone: 'compare', seriesIndex: 0, tag: 'Home' }, { ...rows[1], tone: 'compare', seriesIndex: 1 }]} alt="x" legend={['Home', 'Away']} />)
    expect(within(screen.getByTestId('bars-legend')).getByText('Away')).toBeInTheDocument()
    expect(screen.getAllByTestId('bar-row')[0]).toHaveTextContent('Home')
  })

  describe('selectable dense rows', () => {
    it('are toggle buttons that call onSelect, name the filter and show the pressed state', async () => {
      const onSelect = vi.fn()
      const onParent = vi.fn()
      const user = userEvent.setup()
      render(
        <div onClick={onParent}>
          <HorizontalBars dense alt="Matches by league" rows={[{ ...rows[0], onSelect }, { ...rows[1], onSelect: vi.fn(), selected: true }]} />
        </div>,
      )
      const pick = screen.getByRole('button', { name: 'Filter to Premier League' })
      expect(pick).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Clear Cup filter' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(pick)
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onParent).not.toHaveBeenCalled()
    })

    it('draw a selected row gold, and a selectable zero row still has its stub', () => {
      render(<HorizontalBars dense alt="x" rows={[{ ...rows[1], onSelect: vi.fn(), selected: true }, { ...rows[2], onSelect: vi.fn(), colour: STATS_COLOUR.bar }]} />)
      const [selected, zero] = screen.getAllByTestId('bar-row')
      expect(selected.querySelector('.track > span')).toHaveStyle({ backgroundColor: BRAND.gold })
      expect(within(zero).getByTestId('bar-stub')).toBeInTheDocument()
    })

    it('leave the tab order when they sit on the hidden face of a flip card', async () => {
      const user = userEvent.setup()
      render(<FlipCard label="Leagues" front={<span>front</span>} back={<HorizontalBars dense alt="x" rows={[{ ...rows[0], onSelect: vi.fn() }]} />} />)
      const row = screen.getByTestId('bar-row')
      expect(row).toHaveAttribute('tabindex', '-1')
      await user.click(screen.getByRole('button', { name: 'Flip Leagues' }))
      expect(row).not.toHaveAttribute('tabindex')
    })
  })
})

describe('ProgressBars', () => {
  it('writes the sentence of each row beside the bar and colours the row text by its colour', () => {
    render(<ProgressBars alt="Progress" rows={[{ key: 'r', label: '250 runs', value: 200, target: 250, text: '50 to go', colour: STATS_COLOUR.good }, { key: 'w', label: '10 wickets', value: 0, target: 10, text: '10 to go' }]} />)
    const rows = screen.getAllByTestId('progress-row')
    expect(rows[0]).toHaveTextContent('250 runs')
    expect(rows[0]).toHaveTextContent('50 to go')
    expect(screen.getByRole('img', { name: 'Progress' })).toBeInTheDocument()
    expect(within(rows[0]).getByText('50 to go')).toHaveStyle({ color: STATS_COLOUR.good })
    // An empty bar draws no fill at all.
    expect(rows[1].querySelectorAll('[aria-hidden] > span, [aria-hidden] > div').length).toBe(0)
  })
})

describe('Donut', () => {
  const slices = [
    { key: 'a', label: 'Bowled', value: 1 },
    { key: 'b', label: 'Caught', value: 5 },
    { key: 'c', label: 'LBW', value: 3 },
    { key: 'z', label: 'Stumped', value: 0 },
  ]

  it('gives the largest slice the first (strongest) shade whatever its position, and draws no zero slice', () => {
    render(<Donut slices={slices} alt="Dismissals" centre="9" centreCaption="out" />)
    const paths = screen.getAllByTestId('donut-slice')
    expect(paths).toHaveLength(3)
    const fillOf = (index: number) => paths[index].getAttribute('fill')
    expect(fillOf(1)).toBe(STATS_COLOUR.ramp[0])
    expect(fillOf(2)).toBe(STATS_COLOUR.ramp[1])
    expect(fillOf(0)).toBe(STATS_COLOUR.ramp[2])
  })

  it('lists the label and count of every drawn slice as text, so colour is never the only cue', () => {
    render(<Donut slices={slices} alt="Dismissals" />)
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByText('Caught').parentElement).toHaveTextContent('5')
    expect(within(list).queryByText('Stumped')).not.toBeInTheDocument()
  })

  it('honours a colour override and makes a slice with an href a named link', () => {
    inRouter(<Donut slices={[{ key: 'a', label: 'Not out', value: 2, colour: STATS_COLOUR.good, href: '/d/NOT_OUT' }, { key: 'b', label: 'Bowled', value: 1 }]} alt="x" />)
    expect(screen.getByRole('link', { name: 'Not out: 2' })).toHaveAttribute('href', '/d/NOT_OUT')
    expect(screen.getAllByTestId('donut-slice')[0].querySelector('path')).toHaveAttribute('fill', STATS_COLOUR.good)
  })
})

describe('LineChart', () => {
  const point = (index: number, over: Partial<LineChartPoint> = {}): LineChartPoint => ({ key: `p${index}`, value: 10 * index, name: `${10 * index} runs`, ...over })
  const many = (count: number, over: (index: number) => Partial<LineChartPoint> = () => ({})) => Array.from({ length: count }, (_, index) => point(index + 1, over(index + 1)))

  it('prints the number by every dot up to eight points, and none beyond that', () => {
    const { unmount } = inRouter(<LineChart alt="Runs" points={many(6, (n) => ({ valueLabel: n === 2 ? '20*' : undefined }))} />)
    expect(screen.getAllByTestId('line-value').map((text) => text.textContent)).toEqual(['10', '20*', '30', '40', '50', '60'])
    unmount()
    inRouter(<LineChart alt="Runs" points={many(12)} />)
    expect(screen.queryAllByTestId('line-value')).toHaveLength(0)
    expect(screen.getAllByTestId('line-dot')).toHaveLength(12)
  })

  it('draws a not out as a hollow dot, and each guide with its label, and the running average dashed', () => {
    inRouter(
      <LineChart
        alt="Runs"
        points={many(4, (n) => ({ notOut: n === 3 }))}
        average={[10, 15, 20, null]}
        guides={[{ value: 30, label: '30' }, { value: 50, label: '50' }]}
      />,
    )
    const dots = Array.from(document.querySelectorAll('circle.dot'))
    expect(dots.map((dot) => dot.getAttribute('data-notout'))).toEqual(['false', 'false', 'true', 'false'])
    expect(dots[2]).toHaveAttribute('fill', 'transparent')
    expect(screen.getAllByTestId('line-guide')).toHaveLength(2)
    expect(screen.getAllByTestId('line-guide')[1]).toHaveTextContent('50')
    expect(screen.getByTestId('line-average')).toBeInTheDocument()
  })

  it('makes a dot with an href a named link and leaves others plain', () => {
    inRouter(<LineChart alt="Runs" points={many(3, (n) => (n === 2 ? { href: '/r/m2', name: '20 not out against Rovers, 2 Nov' } : {}))} />)
    expect(screen.getByRole('link', { name: '20 not out against Rovers, 2 Nov' })).toHaveAttribute('href', '/r/m2')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('names the whole drawing by its alt text', () => {
    inRouter(<LineChart alt="Sam's runs in 4 innings" points={many(4)} />)
    expect(screen.getByRole('group', { name: "Sam's runs in 4 innings" })).toBeInTheDocument()
  })

  it('falls back to labelled columns for fewer than three points', () => {
    inRouter(<LineChart alt="Runs" points={many(2, (n) => ({ label: `${n} Nov` }))} />)
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('column')).toHaveLength(2)
  })
})

describe('ColumnChart', () => {
  it('colours each column by its meaning, prints the value and shows a hollow marker for zero', () => {
    inRouter(
      <ColumnChart
        alt="Totals"
        columns={[
          { key: 'a', value: 180, valueLabel: '180', label: '1 Nov', name: '180 against Rovers', colour: STATS_COLOUR.good },
          { key: 'b', value: 120, valueLabel: '120', label: '2 Nov', name: '120 against Hawks', colour: STATS_COLOUR.bad },
          { key: 'c', value: 0, valueLabel: '0', label: '3 Nov', name: '0 against Lions' },
        ]}
      />,
    )
    const bars = screen.getAllByTestId('column-bar')
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveStyle({ backgroundColor: STATS_COLOUR.good })
    expect(bars[1]).toHaveStyle({ backgroundColor: STATS_COLOUR.bad })
    expect(screen.getAllByTestId('column-zero')).toHaveLength(1)
    expect(screen.getAllByTestId('column')[0]).toHaveTextContent('180')
  })

  it('makes a column with an href a named link and one without a plain labelled image', () => {
    inRouter(
      <ColumnChart
        alt="Totals"
        columns={[
          { key: 'a', value: 5, valueLabel: '5', name: 'Won against Rovers', href: '/r/m1' },
          { key: 'b', value: 4, valueLabel: '4', name: 'Lost against Hawks' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Won against Rovers' })).toHaveAttribute('href', '/r/m1')
    expect(screen.getByRole('img', { name: 'Lost against Hawks' })).toBeInTheDocument()
  })
})
