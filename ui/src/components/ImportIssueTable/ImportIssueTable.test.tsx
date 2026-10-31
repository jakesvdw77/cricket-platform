import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportDecisions } from '../../api/importApi'
import { toggleExcluded, withResolution } from '../../utils/importDecisions'
import { installFakeImportApi } from '../ImportWizard/importFakes'
import type { FakeImportServer } from '../ImportWizard/importFakes'
import { SAMPLE_CLUB_ID, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportIssueTable } from './ImportIssueTable'

let server: FakeImportServer
afterEach(() => server.restore())

function Harness({ initial }: { initial?: ImportDecisions }) {
  const [decisions, setDecisions] = useState(initial ?? emptyImportDecisions())
  return <ImportIssueTable clubId={SAMPLE_CLUB_ID} batch={sampleBatch()} decisions={decisions} onToggleExclude={(row) => setDecisions((current) => toggleExcluded(current, row))} onToggleUpdate={() => undefined} />
}

function renderTable() {
  server = installFakeImportApi()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Harness />
    </QueryClientProvider>,
  )
}

const rowCalls = () => server.calls.filter((call) => call.url.endsWith('/rows'))

describe('ImportIssueTable, rows that wait for a later step', () => {
  it('shows a neutral chip, not Error, and leaves them out of the Errors counter', async () => {
    server = installFakeImportApi()
    const batch = sampleBatch({ issues: [{ code: 'TEAM_UNRESOLVED', severity: 'ERROR', rowNumbers: [14], field: 'home', message: 'Not linked to a team yet.', hint: null }], counts: { ...sampleBatch().counts, errors: 1 } })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ImportIssueTable clubId={SAMPLE_CLUB_ID} batch={batch} decisions={emptyImportDecisions()} deferredCodes={['TEAM_UNRESOLVED']} onToggleExclude={() => undefined} />
      </QueryClientProvider>,
    )
    const row = await screen.findByTestId('import-row-14')
    expect(within(row).getByText('Resolved in the team step')).toBeInTheDocument()
    expect(within(row).queryByText('Error')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('page-counter-errors')).getByText('0')).toBeInTheDocument()
  })
})

describe('ImportIssueTable, the reason of a pending row', () => {
  const issues = ['home', 'away'].map((field) => ({ code: 'TEAM_UNRESOLVED', severity: 'ERROR' as const, rowNumbers: [14], field, message: "Row 14: 'Irene Villagers 2' is not linked to a team yet. Link it or create it in the team step.", hint: null }))
  const exact = { targetKind: 'OWN_TEAM', targetId: 't-9', targetName: 'Irene Villagers 2', origin: null, confidence: 100, reasons: [], preselected: true, source: 'OWN_AFFILIATED' as const }
  // Only a settled name reads as matched (spec 125 amendment): the seeded exact match.
  const linked = withResolution(emptyImportDecisions(), { key: 'Irene Villagers 2', kind: 'LINK', targetKind: 'OWN_TEAM', targetId: 't-9', targetName: 'Irene Villagers 2', remember: false })
  const renderPending = (candidates: typeof exact[], extra: { decisions?: ImportDecisions; candidateBadge?: (candidate: typeof exact) => string | null } = {}) => {
    server = installFakeImportApi()
    const batch = sampleBatch({ issues, counts: { ...sampleBatch().counts, errors: 2 }, proposals: [{ key: 'Irene Villagers 2', value: 'Irene Villagers 2', step: 'RESOLVE', rowNumbers: [14], candidates }] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ImportIssueTable clubId={SAMPLE_CLUB_ID} batch={batch} decisions={extra.decisions ?? emptyImportDecisions()} deferredCodes={['TEAM_UNRESOLVED']} onToggleExclude={() => undefined} candidateBadge={extra.candidateBadge} />
      </QueryClientProvider>,
    )
  }

  it('says where an exact match will link, once for the row, not the server failure text', async () => {
    renderPending([exact], { decisions: linked, candidateBadge: () => 'Our team in this league' })
    const row = await screen.findByTestId('import-row-14')
    expect(within(row).getAllByText('Matched: Irene Villagers 2 (Our team in this league)')).toHaveLength(1)
    expect(within(row).queryByText(/is not linked to a team yet/)).not.toBeInTheDocument()
  })

  it('falls back to "your team" without a badge function', async () => {
    renderPending([exact], { decisions: linked })
    expect(await screen.findByText('Matched: Irene Villagers 2 (your team)')).toBeInTheDocument()
  })

  it('says the manager chooses when no candidate is preselected', async () => {
    renderPending([{ ...exact, preselected: false, confidence: 80 }])
    expect(await screen.findByText('Pick a match.')).toBeInTheDocument()
  })
})

describe('ImportIssueTable', () => {
  it('asks the server for the live rows only, 50 per page, and never the skipped ones', async () => {
    renderTable()
    expect(await screen.findByTestId('import-row-14')).toBeInTheDocument()
    expect(screen.queryByTestId('import-row-60')).not.toBeInTheDocument()
    expect(rowCalls()[0].params).toMatchObject({ status: 'OK,WARNING,ERROR', page: 0, size: 50 })
  })

  it('shows icon-and-word chips and the reason for a row', async () => {
    renderTable()
    const row = await screen.findByTestId('import-row-14')
    expect(within(row).getByText('Error')).toBeInTheDocument()
    expect(within(row).getByText('Home and away are the same team.')).toBeInTheDocument()
    expect(within(screen.getByTestId('import-row-43')).getByText('Already exists')).toBeInTheDocument()
    expect(within(screen.getByTestId('import-row-41')).getByText('Differs')).toBeInTheDocument()
  })

  it('sends the Problems only filter to the server', async () => {
    renderTable()
    await screen.findByTestId('import-row-14')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Problems only' }))
    await waitFor(() => expect(rowCalls().some((call) => call.params?.status === 'ERROR,WARNING')).toBe(true))
    await waitFor(() => expect(screen.queryByTestId('import-row-44')).not.toBeInTheDocument())
  })

  it('uses the Errors counter as a filter', async () => {
    renderTable()
    await screen.findByTestId('import-row-14')
    fireEvent.click(screen.getByTestId('page-counter-errors'))
    await waitFor(() => expect(rowCalls().some((call) => call.params?.status === 'ERROR')).toBe(true))
  })

  it('toggles Exclude and Include on a row', async () => {
    renderTable()
    await screen.findByTestId('import-row-14')
    fireEvent.click(screen.getByRole('button', { name: 'Exclude row 14' }))
    expect(screen.getByRole('button', { name: 'Include row 14' })).toBeInTheDocument()
    expect(screen.getByText('Excluded. This row will not be imported.')).toBeInTheDocument()
  })

  it('expands the skipped section and asks for the skipped outcome', async () => {
    renderTable()
    await screen.findByTestId('import-row-14')
    fireEvent.click(screen.getByRole('button', { name: /Skipped, not ours \(2\)/ }))
    expect(await screen.findByTestId('import-row-60')).toBeInTheDocument()
    expect(rowCalls().some((call) => call.params?.outcome === 'SKIPPED_NOT_OURS')).toBe(true)
  })
})
