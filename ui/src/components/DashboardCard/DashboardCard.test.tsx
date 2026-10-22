import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DashboardCard } from './DashboardCard'
import type { DashboardCardProps } from './DashboardCard'

// docs/specs/117-stats-dashboard.md ("The shared component: DashboardCard", Test Plan "Frontend component"): the card is presentational,
// every string comes from its caller, and the chart is `children` (a stand-in here, so no chart library is involved).
const table = {
  caption: 'Runs per innings, oldest first',
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'runs', label: 'Runs', align: 'right' as const },
  ],
  rows: [
    { key: 'a', cells: ['1 Mar', '10'] },
    { key: 'b', cells: ['2 Mar', 'Not recorded'] },
    { key: 'total', total: true, cells: ['Total', '412'] },
  ],
}

function renderCard(props: Partial<DashboardCardProps> = {}) {
  return render(
    <DashboardCard testId="demo" title="Runs per innings" table={table} {...props}>
      <div data-testid="the-chart">chart</div>
    </DashboardCard>,
  )
}

describe('DashboardCard', () => {
  it('shows the title as a heading, the subtitle, and names the chart "title, subtitle" with the description attached', () => {
    renderCard({ subtitle: 'Batting', description: '3 innings, 1 not out, 412 runs.' })
    expect(screen.getByRole('heading', { name: 'Runs per innings' })).toBeInTheDocument()
    expect(screen.getByTestId('demo-subtitle')).toHaveTextContent('Batting')
    const chart = screen.getByRole('img', { name: 'Runs per innings, Batting' })
    expect(chart).toContainElement(screen.getByTestId('the-chart'))
    const description = screen.getByTestId('demo-description')
    expect(description).toHaveTextContent('3 innings, 1 not out, 412 runs.')
    expect(chart).toHaveAttribute('aria-describedby', description.id)
    // the section is labelled by its heading
    expect(screen.getByRole('region', { name: 'Runs per innings' })).toBe(screen.getByTestId('dashboard-card-demo'))
  })

  it('the chart is named by the title alone when there is no subtitle, and has no description attribute without one', () => {
    renderCard()
    const chart = screen.getByRole('img', { name: 'Runs per innings' })
    expect(chart).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('demo-subtitle')).not.toBeInTheDocument()
  })

  it('shows the note, legend, footer and coverage caption it is given, and omits the caption when null', () => {
    const { rerender } = renderCard({ note: 'Lower is better', legend: <div data-testid="the-legend" />, footer: 'Trend sentence.', coverage: 'Economy shown for 7 of 8 matches.' })
    expect(screen.getByTestId('demo-note')).toHaveTextContent('Lower is better')
    expect(screen.getByTestId('the-legend')).toBeInTheDocument()
    expect(screen.getByTestId('demo-footer')).toHaveTextContent('Trend sentence.')
    expect(screen.getByTestId('demo-coverage')).toHaveTextContent('Economy shown for 7 of 8 matches.')
    rerender(
      <DashboardCard testId="demo" title="Runs per innings" table={table} coverage={null}>
        <div />
      </DashboardCard>,
    )
    expect(screen.queryByTestId('demo-coverage')).not.toBeInTheDocument()
  })

  describe('View as table', () => {
    it('is a 44 px toggle with aria-pressed that swaps the chart for a real table with the same rows in order, and back', async () => {
      renderCard()
      const toggle = screen.getByRole('button', { name: 'View as table' })
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect(toggle).toHaveStyle({ minHeight: '44px' })
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByTestId('the-chart')).not.toBeInTheDocument()
      const grid = screen.getByRole('table', { name: 'Runs per innings, oldest first' })
      expect(within(grid).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Date', 'Runs'])
      const rows = screen.getAllByTestId('demo-row')
      expect(rows.map((row) => row.textContent)).toEqual(['1 Mar10', '2 MarNot recorded'])
      expect(screen.getByTestId('demo-total')).toHaveTextContent('Total412')
      // the Total row is last
      expect(within(grid).getAllByRole('row').at(-1)).toBe(screen.getByTestId('demo-total'))
      expect(toggle).toHaveAttribute('aria-controls')

      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByTestId('the-chart')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('is not offered when the card has no table', () => {
      renderCard({ table: undefined })
      expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument()
    })
  })

  describe('states', () => {
    it('loading is an aria-busy skeleton with no chart, no toggle and no caption', () => {
      renderCard({ loading: true, coverage: 'Hidden while loading', description: 'Hidden too' })
      expect(screen.getByTestId('dashboard-card-demo')).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByTestId('demo-loading')).toBeInTheDocument()
      expect(screen.queryByTestId('the-chart')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('demo-coverage')).not.toBeInTheDocument()
      expect(screen.queryByTestId('demo-description')).not.toBeInTheDocument()
    })

    it('empty shows one line and its description, with no chart and no table toggle', () => {
      renderCard({ empty: { title: 'No batting cards captured', description: 'The runs chart needs a scorecard.' }, coverage: 'not shown' })
      const empty = screen.getByTestId('demo-empty')
      expect(empty).toHaveTextContent('No batting cards captured')
      expect(empty).toHaveTextContent('The runs chart needs a scorecard.')
      expect(screen.queryByTestId('the-chart')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'View as table' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('demo-coverage')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Runs per innings' })).toBeInTheDocument()
    })

    it('error is an alert with a 44 px Try again that calls onRetry', async () => {
      const onRetry = vi.fn()
      renderCard({ error: { onRetry } })
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent("Couldn't load the overview")
      const retry = within(alert).getByRole('button', { name: 'Try again' })
      expect(retry).toHaveStyle({ minHeight: '44px' })
      expect(screen.queryByTestId('the-chart')).not.toBeInTheDocument()
      await userEvent.click(retry)
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('an error is shown in place of an empty message', () => {
      renderCard({ error: { onRetry: vi.fn() }, empty: { title: 'Nothing' } })
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByTestId('demo-empty')).not.toBeInTheDocument()
    })

    it('dimmed keeps the content and lowers its opacity', () => {
      renderCard({ dimmed: true })
      expect(screen.getByTestId('the-chart')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-card-demo')).toHaveStyle({ opacity: '0.6' })
    })
  })

  it('records its width for the grid: full or half', () => {
    const { rerender } = renderCard({ fullWidth: true })
    expect(screen.getByTestId('dashboard-card-demo')).toHaveAttribute('data-width', 'full')
    rerender(<DashboardCard testId="demo" title="Runs per innings" />)
    expect(screen.getByTestId('dashboard-card-demo')).toHaveAttribute('data-width', 'half')
  })
})
