import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportBatch, ImportDecisions } from '../../api/importApi'
import type { ImportColumnOptions } from '../../utils/importDecisions'
import { withAddedRow, withRowEdit } from '../../utils/importDecisions'
import { installFakeImportApi } from '../ImportWizard/importFakes'
import type { FakeImportServer } from '../ImportWizard/importFakes'
import { SAMPLE_CLUB_ID, SAMPLE_EDITABLE_COLUMNS, SAMPLE_ROWS, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportIssueTable } from './ImportIssueTable'

let server: FakeImportServer
afterEach(() => server.restore())

function renderTable(options: { batch?: ImportBatch; rows?: typeof SAMPLE_ROWS; decisions?: ImportDecisions; editable?: boolean; columnOptions?: ImportColumnOptions } = {}) {
  const batch = options.batch ?? sampleBatch()
  server = installFakeImportApi({ batch, rows: options.rows })
  const handlers = { onEditRow: vi.fn(), onAddRow: vi.fn(), onRemoveRow: vi.fn(), onResetRow: vi.fn() }
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ImportIssueTable
        clubId={SAMPLE_CLUB_ID}
        batch={batch}
        decisions={options.decisions ?? emptyImportDecisions()}
        onToggleExclude={() => undefined}
        columns={SAMPLE_EDITABLE_COLUMNS.map((column) => ({ id: column.key, header: column.label }))}
        editableColumns={options.editable === false ? undefined : SAMPLE_EDITABLE_COLUMNS}
        emptyLabel="No rows yet. Add the first match."
        columnOptions={options.columnOptions}
        editLayout={{ primary: ['date', 'time', 'home', 'away', 'venue'], differentPair: ['home', 'away'] }}
        {...handlers}
      />
    </QueryClientProvider>,
  )
  return handlers
}

describe('ImportIssueTable, editing rows (spec 125)', () => {
  it('offers no Edit or Add row for a type that is not editable', async () => {
    renderTable({ editable: false })
    await screen.findByTestId('import-row-44')
    expect(screen.queryByRole('button', { name: /edit row/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Row' })).not.toBeInTheDocument()
  })

  it('saves only the changed keys in one call, and Cancel sends nothing', async () => {
    const handlers = renderTable()
    await screen.findByTestId('import-row-44')
    fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
    fireEvent.change(screen.getByLabelText('Time, row 44'), { target: { value: '10:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handlers.onEditRow).toHaveBeenCalledTimes(1)
    expect(handlers.onEditRow).toHaveBeenCalledWith(44, { time: '10:30' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit row 51' }))
    fireEvent.change(screen.getByLabelText('Home team, row 51'), { target: { value: 'Zebras' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handlers.onEditRow).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit row 51' })).toHaveFocus())
  })

  it('saves with Enter and cancels with Escape', async () => {
    const handlers = renderTable()
    await screen.findByTestId('import-row-44')
    fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
    fireEvent.change(screen.getByLabelText('Venue, row 44'), { target: { value: 'Main oval' } })
    fireEvent.keyDown(screen.getByLabelText('Venue, row 44'), { key: 'Enter' })
    expect(handlers.onEditRow).toHaveBeenCalledWith(44, { venue: 'Main oval' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit row 51' }))
    fireEvent.keyDown(screen.getByLabelText('Venue, row 51'), { key: 'Escape' })
    expect(screen.queryByLabelText('Venue, row 51')).not.toBeInTheDocument()
    expect(handlers.onEditRow).toHaveBeenCalledTimes(1)
  })

  it('shows the Edited chip with the file value and resets to the file values', async () => {
    const decisions = withRowEdit(emptyImportDecisions(), 44, { time: '10:30' })
    const handlers = renderTable({ decisions, batch: sampleBatch({ decisions }) })
    // The fake serves effective rows from the batch's decisions, as the server does.
    const row = await screen.findByTestId('import-row-44')
    expect(within(row).getByText('Edited')).toBeInTheDocument()
    expect(within(row).getByText('was: 09:00')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Edit row 44' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to File Values' }))
    expect(handlers.onResetRow).toHaveBeenCalledWith(44)
  })

  it('adds a row below with the date and venue of the previous row, and removes an added row', async () => {
    const decisions = withAddedRow(emptyImportDecisions(), { rowNumber: 1001, values: { home: 'A', away: 'B' } })
    const handlers = renderTable({ decisions, batch: sampleBatch({ decisions }) })
    const added = await screen.findByTestId('import-row-1001')
    expect(within(added).getByText('Manually Added')).toBeInTheDocument()
    expect(within(added).queryByRole('button', { name: /exclude/i })).not.toBeInTheDocument()
    fireEvent.click(within(added).getByRole('button', { name: 'Remove row New 1' }))
    expect(handlers.onRemoveRow).toHaveBeenCalledWith(1001)

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[1])
    expect(screen.getByLabelText('Date, row new')).toHaveValue('2026-10-04')
    fireEvent.change(screen.getByLabelText('Home team, row new'), { target: { value: 'CBC U13' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handlers.onAddRow).toHaveBeenCalledWith({ date: '2026-10-04', home: 'CBC U13' })
  })

  it('keeps a no-op edit a no-op, even for a file value that is not a strict date', async () => {
    const odd = SAMPLE_ROWS.map((row) => (row.rowNumber === 44 ? { ...row, values: { ...row.values, date: '13-Sept-26', time: '8.00' } } : row))
    const handlers = renderTable({ rows: odd })
    await screen.findByTestId('import-row-44')
    fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
    expect(screen.getByLabelText('Date, row 44')).toHaveValue('13-Sept-26')
    expect(screen.getByLabelText('Time, row 44')).toHaveValue('8.00')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handlers.onEditRow).not.toHaveBeenCalled()
  })

  it('shows the empty state of a batch with no rows', async () => {
    renderTable({ rows: [], batch: sampleBatch({ counts: { rows: 0 }, issues: [], proposals: [] }) })
    expect(await screen.findByText('No rows yet. Add the first match.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add Row' })).toHaveLength(1)
  })

  describe('choosing a team from the list (amendment 2026-10-30)', () => {
    const columnOptions: ImportColumnOptions = {
      home: [{ label: 'Irene Villagers 2', kind: 'OWN_TEAM', id: 't-9' }, 'Plain Past Opponent'],
      away: [{ label: 'Hilton', kind: 'LEAGUE_TEAM', id: 'lt-3' }],
    }

    it('passes the pick with the edit in one call, and a typed name or plain option passes none', async () => {
      const handlers = renderTable({ columnOptions })
      await screen.findByTestId('import-row-44')
      fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
      const home = screen.getByLabelText('Home team, row 44')
      fireEvent.change(home, { target: { value: 'Irene' } })
      fireEvent.click(await screen.findByRole('option', { name: 'Irene Villagers 2' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(handlers.onEditRow).toHaveBeenCalledTimes(1)
      expect(handlers.onEditRow).toHaveBeenCalledWith(44, { home: 'Irene Villagers 2' }, [{ name: 'Irene Villagers 2', kind: 'OWN_TEAM', id: 't-9' }])

      fireEvent.click(screen.getByRole('button', { name: 'Edit row 51' }))
      fireEvent.change(screen.getByLabelText('Home team, row 51'), { target: { value: 'Irene Villagers 2' } })
      fireEvent.change(screen.getByLabelText('Away team, row 51'), { target: { value: 'Hilton' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(handlers.onEditRow).toHaveBeenLastCalledWith(51, expect.any(Object))
      expect(handlers.onEditRow.mock.calls[1]).toHaveLength(2)

      fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
      fireEvent.change(screen.getByLabelText('Home team, row 44'), { target: { value: 'Plain' } })
      fireEvent.click(await screen.findByRole('option', { name: 'Plain Past Opponent' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(handlers.onEditRow.mock.calls[2]).toHaveLength(2)
    })

    it('forgets a pick once the text is typed over', async () => {
      const handlers = renderTable({ columnOptions })
      await screen.findByTestId('import-row-44')
      fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
      const home = screen.getByLabelText('Home team, row 44')
      fireEvent.change(home, { target: { value: 'Irene' } })
      fireEvent.click(await screen.findByRole('option', { name: 'Irene Villagers 2' }))
      fireEvent.change(home, { target: { value: 'Irene Villagers 3' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(handlers.onEditRow.mock.calls[0]).toHaveLength(2)
    })
  })

  it('disables Save, and Enter does nothing, while both sides hold the same team', async () => {
    const handlers = renderTable({ columnOptions: { home: ['Hilton'], away: ['Hilton'] } })
    await screen.findByTestId('import-row-44')
    fireEvent.click(screen.getByRole('button', { name: 'Edit row 44' }))
    // The sample rows use the same two-sided layout through the consumer; pair them here.
    fireEvent.change(screen.getByLabelText('Home team, row 44'), { target: { value: 'Hilton' } })
    fireEvent.change(screen.getByLabelText('Away team, row 44'), { target: { value: 'Hilton' } })
    expect(screen.getByText('A team cannot play itself')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText('Away team, row 44'), { key: 'Enter' })
    expect(handlers.onEditRow).not.toHaveBeenCalled()
  })
})
