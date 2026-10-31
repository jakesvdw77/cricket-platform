import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { installFakeImportApi } from './importFakes'
import type { FakeImportOptions, FakeImportServer } from './importFakes'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportIssue } from '../../api/importApi'
import { SAMPLE_BATCH_ID, SAMPLE_CLUB_ID, SAMPLE_EDITABLE_TYPE, SAMPLE_TYPE, committedBatch, confirmableBatch, sampleBatch } from './importFixtures'
import { ImportWizard } from './ImportWizard'

let server: FakeImportServer
afterEach(() => server.restore())

function renderWizard(options: FakeImportOptions = {}, batchId: string | null = SAMPLE_BATCH_ID) {
  server = installFakeImportApi(options)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ImportWizard clubId={SAMPLE_CLUB_ID} type={SAMPLE_TYPE.type} scope={{ params: { leagueId: 'l1' }, scopeMode: 'OURS_ONLY' }} title="Import league schedule" scopeLabel="Northern Premier League, 2026/27" backTo="/manage" batchId={batchId} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ImportWizard', () => {
  it('resumes a preview at Check rows with the target line and all five steps', async () => {
    renderWizard()
    // The first render of the file pays for loading the whole component tree.
    expect(await screen.findByTestId('import-row-14', undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText(/Importing into: Northern Premier League, 2026\/27/)).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button')
    expect(steps.map((step) => step.getAttribute('aria-label'))).toEqual(['Step 1: Upload (done)', 'Step 2: Check rows', 'Step 3: Identify ours', 'Step 4: Match teams', 'Step 5: Review'])
  })

  it('puts Convert with AI beside Import history on the Upload step only, and loads the help when its dialog opens', async () => {
    renderWizard({}, null)
    const button = await screen.findByRole('button', { name: 'Convert with AI' }, { timeout: 10000 })
    expect(screen.getByRole('button', { name: 'Import history' })).toBeInTheDocument()
    expect(server.calls.some((call) => call.url.includes('ai-help'))).toBe(false)
    fireEvent.click(button)
    expect(await screen.findByRole('dialog', { name: 'Convert your file with AI' })).toBeInTheDocument()
    await waitFor(() => expect(server.calls.some((call) => call.url.includes('ai-help'))).toBe(true))
    expect(await screen.findByLabelText('Conversion prompt')).toBeInTheDocument()
  })

  it('hides Convert with AI on the other steps', async () => {
    renderWizard()
    await screen.findByTestId('import-row-14')
    expect(screen.queryByRole('button', { name: 'Convert with AI' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import history' })).toBeInTheDocument()
  })

  it('drops Identify ours when the batch is not ours-only', async () => {
    renderWizard({ batch: sampleBatch({ scopeMode: 'ALL' }) })
    await screen.findByTestId('import-row-14')
    expect(screen.queryByText('Identify ours')).not.toBeInTheDocument()
  })

  it('blocks Next while errors remain, and lets excluded errors through', async () => {
    renderWizard()
    await screen.findByTestId('import-row-14')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByText('Fix or exclude 2 errors to continue.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exclude row 14' }))
    await waitFor(() => expect(server.calls.some((call) => call.method === 'put' && call.url.endsWith('/decisions'))).toBe(true))
  })

  it('saves decisions and moves on to Identify ours', async () => {
    renderWizard({ batch: confirmableBatch() })
    await screen.findByTestId('import-row-14')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByTestId('resolver-progress')).toHaveTextContent('of 2 names identified')
    expect(server.calls.some((call) => call.method === 'put')).toBe(true)
  })

  it('shows the report for a committed batch', async () => {
    renderWizard({ batch: committedBatch() })
    expect(await screen.findByTestId('report-created')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete import/i })).toBeInTheDocument()
  })

  it('restores saved exclusions and resumes at Match teams while references are unresolved', async () => {
    const decisions = { ...emptyImportDecisions(), excludedRows: [14, 22], identifiedAsOurs: ['CBCOB'] }
    renderWizard({ batch: sampleBatch({ decisions, issues: [], proposals: sampleBatch().proposals }) })
    expect(await screen.findByTestId('resolver-progress', undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Steps' })).getByRole('button', { name: /Match teams/ })).toHaveAttribute('aria-current', 'step')
  })

  it('does not block Check rows on teams the next step resolves, and saves the seeded matches once', async () => {
    const unresolved: ImportIssue = { code: 'TEAM_UNRESOLVED', severity: 'ERROR', rowNumbers: [44], field: 'home', message: "Row 44: 'CBC U15' is not linked to a team yet. Link it or create it in the team step.", hint: null }
    renderWizard({ batch: sampleBatch({ issues: [unresolved], counts: { ...sampleBatch().counts, errors: 1 } }) })
    const row = await screen.findByTestId('import-row-44', undefined, { timeout: 10000 })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled())
    expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument()
    await waitFor(() => expect(server.calls.filter((call) => call.method === 'put' && call.url.endsWith('/decisions'))).toHaveLength(1))
    const saved = server.calls.find((call) => call.method === 'put')
    const body = (typeof saved?.data === 'string' ? JSON.parse(saved.data) : saved?.data) as { revision: number; decisions: { resolutions: unknown[] } }
    expect(body.revision).toBe(1)
    expect(body.decisions.resolutions.length).toBeGreaterThan(0)
    expect(row).toBeInTheDocument()
    // Not saved again while the manager waits.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(server.calls.filter((call) => call.method === 'put')).toHaveLength(1)
  })

  it('starts on Upload with no batch', async () => {
    renderWizard({}, null)
    expect(await screen.findByRole('button', { name: 'Upload and check rows' })).toBeDisabled()
  })
})

describe('ImportWizard, consumer configuration', () => {
  it('uses the consumer step labels and merges the upload extras into the scope params', async () => {
    server = installFakeImportApi({})
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ImportWizard
            clubId={SAMPLE_CLUB_ID}
            type={SAMPLE_TYPE.type}
            scope={{ params: { leagueId: 'l1' }, scopeMode: 'OURS_ONLY' }}
            title="Import schedule"
            scopeLabel="League, 2026/27"
            backTo="/manage"
            labels={{ rowsStep: 'Check', identifyStep: 'Our teams', resolveStep: 'Teams', reportStep: 'Done' }}
            uploadExtras={({ params, onChange }) => <button type="button" onClick={() => onChange({ windowDays: '30' })}>{`Window ${params.windowDays ?? 'none'}`}</button>}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('button', { name: 'Window none' }, { timeout: 10000 })).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button')
    // No batch yet, so no team step is in doubt: the team steps appear once a name needs a decision.
    expect(steps.map((step) => step.getAttribute('aria-label'))).toEqual(['Step 1: Upload', 'Step 2: Check', 'Step 3: Review'])
    fireEvent.click(screen.getByRole('button', { name: 'Window none' }))
    expect(screen.getByRole('button', { name: 'Window 30' })).toBeInTheDocument()
  })
})

describe('ImportWizard, check settings', () => {
  it('renders the consumer settings on Check rows and saves one decisions update with the options patch', async () => {
    server = installFakeImportApi({})
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ImportWizard
            clubId={SAMPLE_CLUB_ID}
            type={SAMPLE_TYPE.type}
            scope={{ params: { leagueId: 'l1' }, scopeMode: 'OURS_ONLY' }}
            title="Import schedule"
            scopeLabel="League, 2026/27"
            backTo="/manage"
            batchId={SAMPLE_BATCH_ID}
            checkSettings={({ decisions, setOptions }) => <button type="button" onClick={() => setOptions({ setting: 30 })}>{`Setting ${String(decisions.options.setting ?? 'none')}`}</button>}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Setting none' }, { timeout: 10000 }))
    expect(await screen.findByRole('button', { name: 'Setting 30' })).toBeInTheDocument()
    // The resume seeding may save once too; the settings change is exactly one save carrying the option.
    const puts = server.calls.filter((call) => call.method === 'put' && JSON.parse(String(call.data)).decisions.options.setting === 30)
    expect(puts).toHaveLength(1)
  })
})

describe('ImportWizard, team steps only when in doubt (spec 125 amendment)', () => {
  const exactTeam = (key: string, id: string) => ({ key, value: key, step: 'RESOLVE' as const, rowNumbers: [14], candidates: [{ targetKind: 'OWN_TEAM', targetId: id, targetName: key, origin: null, confidence: 100, reasons: [], preselected: true }] })
  const settled = () => sampleBatch({ scopeMode: 'ALL', issues: [], counts: { ...sampleBatch().counts, errors: 0, warnings: 0 }, proposals: [exactTeam('Irene Villagers 2', 't-9'), exactTeam('Hilton', 't-8')] })
  const stepNames = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button').map((step) => step.getAttribute('aria-label'))

  it('goes from Check rows straight to Review when every name is settled, and Change teams opens the team step on demand', async () => {
    renderWizard({ batch: settled() })
    await screen.findByTestId('import-row-14', undefined, { timeout: 10000 })
    expect(stepNames()).toEqual(['Step 1: Upload (done)', 'Step 2: Check rows', 'Step 3: Review'])
    expect(screen.getByText('Step 2 of 3: Check rows')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByTestId('team-summary')).toHaveTextContent('Names: 2 matched, 0 new')
    fireEvent.click(screen.getByRole('button', { name: 'Change teams' }))
    expect(await screen.findByTestId('resolver-progress')).toHaveTextContent('2 of 2 names resolved')
    expect(stepNames()).toEqual(['Step 1: Upload (done)', 'Step 2: Check rows (done)', 'Step 3: Match teams', 'Step 4: Review'])
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByTestId('team-summary')).toBeInTheDocument()
    expect(stepNames()).toEqual(['Step 1: Upload (done)', 'Step 2: Check rows (done)', 'Step 3: Review'])
  })

  it('keeps the team step in the flow when a name still needs a decision', async () => {
    renderWizard({ batch: sampleBatch({ scopeMode: 'ALL', issues: [], counts: { ...sampleBatch().counts, errors: 0 }, proposals: [exactTeam('Hilton', 't-8'), { key: 'Zebras', value: 'Zebras', step: 'RESOLVE', rowNumbers: [70], candidates: [] }] }) })
    await screen.findByTestId('import-row-14', undefined, { timeout: 10000 })
    expect(stepNames()).toEqual(['Step 1: Upload (done)', 'Step 2: Check rows', 'Step 3: Match teams', 'Step 4: Review'])
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByTestId('resolver-progress')).toHaveTextContent('1 of 2')
  })
})

describe('ImportWizard, editable rows (spec 125)', () => {
  it('saves a name that first appears after an added row once, and does not loop', async () => {
    const irene = { key: 'Irene Villagers 2', value: 'Irene Villagers 2', step: 'RESOLVE' as const, rowNumbers: [1001], candidates: [{ targetKind: 'OWN_TEAM', targetId: 't-9', targetName: 'Irene Villagers 2', origin: null, confidence: 100, reasons: [], preselected: true }] }
    server = installFakeImportApi({ types: [SAMPLE_EDITABLE_TYPE], proposalsAfterSave: [irene] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ImportWizard clubId={SAMPLE_CLUB_ID} type={SAMPLE_TYPE.type} scope={{ params: { leagueId: 'l1' }, scopeMode: 'ALL' }} title="Import" scopeLabel="League" backTo="/manage" labels={{ startBlankLabel: 'Start with an empty schedule' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'No file? Start with an empty schedule' }, { timeout: 10000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add row' }))
    fireEvent.change(screen.getByLabelText('Home team, row new'), { target: { value: 'Irene Villagers 2' } })
    fireEvent.change(screen.getByLabelText('Away team, row new'), { target: { value: 'Irene Villagers 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(server.calls.filter((call) => call.method === 'put')).toHaveLength(2))
    const second = JSON.parse(String(server.calls.filter((call) => call.method === 'put')[1].data)) as { revision: number; decisions: { resolutions: Array<{ key: string; targetId: string }>; addedRows: unknown[] } }
    expect(second.revision).toBe(2)
    expect(second.decisions.resolutions).toEqual([expect.objectContaining({ key: 'Irene Villagers 2', targetId: 't-9' })])
    expect(second.decisions.addedRows).toHaveLength(1)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(server.calls.filter((call) => call.method === 'put')).toHaveLength(2)
  })

  it('starts with no rows only for an editable type, then saves one added row in one decisions call', async () => {
    server = installFakeImportApi({ types: [SAMPLE_EDITABLE_TYPE] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ImportWizard clubId={SAMPLE_CLUB_ID} type={SAMPLE_TYPE.type} scope={{ params: { leagueId: 'l1' }, scopeMode: 'ALL' }} title="Import" scopeLabel="League" backTo="/manage" labels={{ startBlankLabel: 'Start with an empty schedule', emptyRowsLabel: 'No rows yet. Add the first match.' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'No file? Start with an empty schedule' }, { timeout: 10000 }))
    expect(await screen.findByText('No rows yet. Add the first match.')).toBeInTheDocument()
    expect(server.calls.some((call) => call.method === 'post' && call.url.endsWith('/blank'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    fireEvent.change(screen.getByLabelText('Home team, row new'), { target: { value: 'CBC U13' } })
    fireEvent.change(screen.getByLabelText('Away team, row new'), { target: { value: 'Hilton' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByTestId('import-row-1001')).toBeInTheDocument()
    const puts = server.calls.filter((call) => call.method === 'put')
    expect(puts).toHaveLength(1)
    expect(JSON.parse(String(puts[0].data)).decisions.addedRows).toEqual([{ rowNumber: 1001, values: { home: 'CBC U13', away: 'Hilton' } }])
  })
})
