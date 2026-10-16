import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GridNumberInput, ScorecardGrid } from './index'
import type { ScorecardGridColumn } from './index'
import { HowOutSelect } from '../HowOutSelect'
import { useReorderableRows } from '../../hooks/useReorderableRows'
import type { DismissalType } from '../../api/matchResultApi'

interface Row {
  id: string
  name: string
  howOut: DismissalType | null
  runs: number | null
  balls: number | null
}

const ROWS: Row[] = [
  { id: 'a', name: 'Ann Ash', howOut: null, runs: 12, balls: 20 },
  { id: 'b', name: 'Bob Birch', howOut: null, runs: 34, balls: 40 },
  { id: 'c', name: 'Cal Cedar', howOut: 'DID_NOT_BAT', runs: null, balls: null },
]

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

function Harness({ onPick, withReorder = false, onReorder = vi.fn() }: { onPick?: (id: string) => void; withReorder?: boolean; onReorder?: (ids: string[]) => void }) {
  const [rows, setRows] = useState(ROWS)
  const patch = (id: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const reorder = useReorderableRows({ ids: rows.map((row) => row.id), onReorder })
  const columns: ScorecardGridColumn<Row>[] = [
    {
      id: 'howOut',
      header: 'How out',
      render: (row) => <HowOutSelect value={row.howOut} onChange={(howOut) => patch(row.id, { howOut })} ariaLabel={`How out, ${row.name}`} />,
    },
    {
      id: 'runs',
      header: 'R',
      align: 'right',
      render: (row) => <GridNumberInput value={row.runs} onChange={(runs) => patch(row.id, { runs })} ariaLabel={`Runs, ${row.name}`} column="runs" />,
    },
    {
      id: 'balls',
      header: 'B',
      align: 'right',
      render: (row) => <GridNumberInput value={row.balls} onChange={(balls) => patch(row.id, { balls })} ariaLabel={`Balls, ${row.name}`} column="balls" />,
    },
  ]
  return (
    <ScorecardGrid
      ariaLabel="Batting card"
      rows={rows}
      getRowId={(row) => row.id}
      columns={columns}
      renderPlayer={(row) => <button>{row.name}</button>}
      renderCard={(row) => <div>{`Card ${row.name}`}</div>}
      onPickPlayer={onPick}
      reorder={withReorder ? reorder : undefined}
    />
  )
}

const cell = (name: string) => screen.getByRole('textbox', { name })

describe('ScorecardGrid', () => {
  it('is a real table of labelled inputs', () => {
    render(<Harness />)

    const table = screen.getByRole('table', { name: 'Batting card' })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(cell('Runs, Ann Ash')).toHaveValue('12')
    expect(cell('Runs, Ann Ash')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByRole('combobox', { name: 'How out, Ann Ash' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
  })

  it('selects a number cell\'s content on focus', async () => {
    render(<Harness />)
    await userEvent.click(cell('Balls, Bob Birch'))

    const input = cell('Balls, Bob Birch') as HTMLInputElement
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(2)
  })

  it('Enter moves along the row and wraps to the next row\'s first cell; Shift+Enter goes back', async () => {
    render(<Harness />)
    cell('Runs, Ann Ash').focus()

    await userEvent.keyboard('{Enter}')
    expect(cell('Balls, Ann Ash')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('combobox', { name: 'How out, Bob Birch' })).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(cell('Balls, Ann Ash')).toHaveFocus()
  })

  it('Arrow Down and Up move within a column', async () => {
    render(<Harness />)
    cell('Runs, Ann Ash').focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(cell('Runs, Bob Birch')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(cell('Runs, Cal Cedar')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(cell('Runs, Ann Ash')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(cell('Runs, Ann Ash')).toHaveFocus()
  })

  it('has no Alt+Arrow shortcut: the key is left alone', () => {
    render(<Harness />)
    cell('Runs, Bob Birch').focus()

    const down = fireEvent.keyDown(cell('Runs, Bob Birch'), { key: 'ArrowDown', altKey: true })
    expect(down).toBe(true) // not default-prevented
    expect(cell('Runs, Bob Birch')).toHaveFocus()
    expect(fireEvent.keyDown(cell('Runs, Bob Birch'), { key: 'ArrowUp', altKey: true })).toBe(true)
    expect(cell('Runs, Bob Birch')).toHaveFocus()
  })

  it('an open How out list keeps the arrows for itself', async () => {
    render(<Harness />)
    const howOut = screen.getByRole('combobox', { name: 'How out, Ann Ash' })
    howOut.focus()
    await userEvent.keyboard('c{ArrowDown}')

    expect(howOut).toHaveFocus()
  })

  it('/ opens the player picker for the row, and ? shows the shortcuts', async () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    cell('Runs, Bob Birch').focus()

    await userEvent.keyboard('/')
    expect(onPick).toHaveBeenCalledWith('b')

    await userEvent.keyboard('?')
    expect(await screen.findByRole('note', { name: /keyboard shortcuts/ })).toBeInTheDocument()
    await userEvent.keyboard('?')
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
  })

  it('shows a drag handle on every row only when the rows can be reordered', () => {
    const { unmount } = render(<Harness />)
    expect(screen.queryAllByTestId('drag-handle')).toHaveLength(0)
    unmount()

    render(<Harness withReorder />)
    expect(screen.getAllByTestId('drag-handle')).toHaveLength(3)
  })

  it('renders each row as a card on a phone, the keys still working across the cards', async () => {
    setPhone(true)
    function CardHarness() {
      const [runs, setRuns] = useState<Record<string, number | null>>({ a: 1, b: 2 })
      return (
        <ScorecardGrid
          ariaLabel="Batting card"
          rows={[{ id: 'a' }, { id: 'b' }]}
          getRowId={(row) => row.id}
          columns={[]}
          renderPlayer={() => null}
          renderCard={(row) => (
            <GridNumberInput value={runs[row.id]} onChange={(next) => setRuns({ ...runs, [row.id]: next })} ariaLabel={`Runs, ${row.id}`} column="runs" stepper />
          )}
        />
      )
    }
    render(<CardHarness />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    cell('Runs, a').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(cell('Runs, b')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Runs, b' }))
    expect(cell('Runs, b')).toHaveValue('3')
  })

  it('says so when there are no rows', () => {
    render(
      <ScorecardGrid
        ariaLabel="Batting card"
        rows={[]}
        getRowId={() => ''}
        columns={[]}
        renderPlayer={() => null}
        renderCard={() => null}
        emptyMessage="Add a player to start."
      />,
    )
    expect(screen.getByText('Add a player to start.')).toBeInTheDocument()
  })

  // docs/specs/104: a row to look at but not a problem (an imported guess): a light amber tint, no problem icon or reason.
  it('tints a flagged row in both layouts without marking it as a problem', () => {
    const flagged = (phone: boolean) => {
      setPhone(phone)
      return render(
        <ScorecardGrid
          ariaLabel="Teams"
          rows={[{ id: 'a' }, { id: 'b' }]}
          getRowId={(row) => row.id}
          columns={[]}
          renderPlayer={(row) => <span>{`Player ${row.id}`}</span>}
          renderCard={(row) => <span>{`Card ${row.id}`}</span>}
          isRowFlagged={(row) => row.id === 'a'}
        />,
      )
    }
    // A table row tints its cells, a phone card tints itself.
    const background = (text: string) => {
      const node = screen.getByText(text)
      const row = node.closest('tr')
      return getComputedStyle((row ? row.querySelector('td') : node.closest('[role="listitem"]')) as HTMLElement).backgroundColor
    }

    const table = flagged(false)
    expect(background('Player a')).not.toBe(background('Player b'))
    expect(screen.queryByLabelText(/problem|needs attention/i)).not.toBeInTheDocument()
    table.unmount()

    flagged(true)
    expect(background('Card a')).not.toBe(background('Card b'))
  })
})
