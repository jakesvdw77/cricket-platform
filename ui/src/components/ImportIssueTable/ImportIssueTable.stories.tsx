import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportBatch, ImportRow } from '../../api/importApi'
import { removeAddedRow, nextAddedRowNumber, toggleExcluded, toggleUpdate, withAddedRow, withRowEdit, withoutRowEdit } from '../../utils/importDecisions'
import { FakeImportApiProvider } from '../ImportWizard/FakeImportApiProvider'
import { SAMPLE_CLUB_ID, SAMPLE_EDITABLE_COLUMNS, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportIssueTable } from './ImportIssueTable'
import type { ImportColumn } from './ImportIssueTable'

const meta: Meta<typeof ImportIssueTable> = {
  title: 'Components/ImportIssueTable',
  component: ImportIssueTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ImportIssueTable>

const columns: ImportColumn[] = [
  { id: 'date', header: 'Date' },
  { id: 'home', header: 'Home' },
  { id: 'away', header: 'Away' },
  { id: 'time', header: 'Time' },
]

function Harness({ batch, withColumns = true }: { batch: ImportBatch; withColumns?: boolean }) {
  const [decisions, setDecisions] = useState(emptyImportDecisions())
  return (
    <FakeImportApiProvider options={{ batch }}>
      <ImportIssueTable clubId={SAMPLE_CLUB_ID} batch={batch} decisions={decisions} columns={withColumns ? columns : undefined} onToggleExclude={(row) => setDecisions((current) => toggleExcluded(current, row))} onToggleUpdate={(row) => setDecisions((current) => toggleUpdate(current, row))} />
    </FakeImportApiProvider>
  )
}

export const WithProblems: Story = { render: () => <Harness batch={sampleBatch()} /> }
export const DefaultColumns: Story = { render: () => <Harness batch={sampleBatch()} withColumns={false} /> }
export const NoSkippedRows: Story = { render: () => <Harness batch={sampleBatch({ counts: { rows: 8, ok: 4, warnings: 2, errors: 2, skippedNotOurs: 0 } })} /> }

export const WaitingForTeamStep: Story = {
  render: () => {
    const batch = sampleBatch({ issues: [{ code: 'TEAM_UNRESOLVED', severity: 'ERROR', rowNumbers: [14], field: 'home', message: 'Not linked to a team yet. Link it or create it in the team step.', hint: null }], counts: { rows: 8, ok: 4, warnings: 2, errors: 1, skippedNotOurs: 2 } })
    return (
      <FakeImportApiProvider options={{ batch }}>
        <ImportIssueTable clubId={SAMPLE_CLUB_ID} batch={batch} decisions={emptyImportDecisions()} deferredCodes={['TEAM_UNRESOLVED']} onToggleExclude={() => undefined} />
      </FakeImportApiProvider>
    )
  },
}


// Spec 125: Edit, Add row and Remove, the decisions kept in state and the fake server laying them over the rows.
function EditableHarness({ batch, rows }: { batch: ImportBatch; rows?: ImportRow[] }) {
  const [decisions, setDecisions] = useState(emptyImportDecisions())
  return (
    <FakeImportApiProvider options={{ batch, rows }}>
      <ImportIssueTable
        clubId={SAMPLE_CLUB_ID}
        batch={{ ...batch, decisions }}
        decisions={decisions}
        columns={[...columns, { id: 'venue', header: 'Venue' }]}
        onToggleExclude={(row) => setDecisions((current) => toggleExcluded(current, row))}
        editableColumns={SAMPLE_EDITABLE_COLUMNS}
        columnOptions={{ home: ['Alphas', 'Bravos', 'POLICE 1'], away: ['Alphas', 'Bravos', 'POLICE 1'], venue: ['Main oval', 'Side pitch'] }}
        editLayout={{ primary: ['date', 'time', 'home', 'away', 'venue'], secondary: ['notes'], addSecondaryLabel: 'Add note' }}
        emptyLabel="No rows yet. Add the first match."
        onEditRow={(row, values) => setDecisions((current) => withRowEdit(current, row, values))}
        onAddRow={(values) => setDecisions((current) => withAddedRow(current, { rowNumber: nextAddedRowNumber(current), values }))}
        onRemoveRow={(row) => setDecisions((current) => removeAddedRow(current, row))}
        onResetRow={(row) => setDecisions((current) => withoutRowEdit(current, row))}
      />
    </FakeImportApiProvider>
  )
}

export const EditRows: Story = { render: () => <EditableHarness batch={sampleBatch()} /> }
export const EmptyStart: Story = { render: () => <EditableHarness batch={sampleBatch({ source: 'MANUAL', fileName: 'Typed in the wizard', issues: [], proposals: [], counts: { rows: 0 } })} rows={[]} /> }
