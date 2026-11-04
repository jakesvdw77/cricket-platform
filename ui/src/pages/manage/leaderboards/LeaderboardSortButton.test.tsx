import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeaderboardSortButton } from './LeaderboardSortButton'
import type { SortableColumn } from './LeaderboardSortButton'

const COLUMNS: SortableColumn[] = [
  { code: 'runs', label: 'R', longLabel: 'Runs scored', sortable: true, direction: 'HIGHEST' },
  { code: 'economy', label: 'Econ', longLabel: 'Economy', sortable: true, direction: 'LOWEST' },
  { code: 'matches', label: 'M', longLabel: 'Matches', sortable: false, direction: 'HIGHEST' },
]

function setup(sortCode = 'runs', effectiveDirection: 'HIGHEST' | 'LOWEST' = 'HIGHEST') {
  const onSelect = vi.fn()
  const onReverse = vi.fn()
  render(<LeaderboardSortButton columns={COLUMNS} sortCode={sortCode} effectiveDirection={effectiveDirection} onSelect={onSelect} onReverse={onReverse} />)
  return { onSelect, onReverse }
}

describe('LeaderboardSortButton', () => {
  it('reads "Sort: <Column>, <Direction>" and lists the sortable columns, the current one with both directions', async () => {
    setup()
    const button = screen.getByRole('button', { name: /^Sort: / })
    expect(button).toHaveTextContent('Sort: Runs scored, Highest First')
    await userEvent.click(button)
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
      'Runs scored, Highest First',
      'Runs scored, Lowest First',
      'Economy, Lowest First',
    ])
  })

  it('choosing another column selects it from its natural direction', async () => {
    const { onSelect, onReverse } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^Sort: / }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Economy, Lowest First' }))
    expect(onSelect).toHaveBeenCalledWith('economy')
    expect(onReverse).not.toHaveBeenCalled()
  })

  it("choosing the current column's other direction reverses it; its current direction does nothing", async () => {
    const { onSelect, onReverse } = setup('economy', 'LOWEST')
    await userEvent.click(screen.getByRole('button', { name: /^Sort: / }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Economy, Lowest First' }))
    expect(onReverse).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^Sort: / }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Economy, Highest First' }))
    expect(onReverse).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders nothing when no column is sortable', () => {
    const { container } = render(
      <LeaderboardSortButton columns={[COLUMNS[2]]} sortCode="matches" effectiveDirection="HIGHEST" onSelect={() => undefined} onReverse={() => undefined} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
