import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeletionCheck } from '../../api/importApi'
import { installFakeImportApi } from '../ImportWizard/importFakes'
import type { FakeImportServer } from '../ImportWizard/importFakes'
import { BLOCKED, SAMPLE_CLUB_ID, committedBatch } from '../ImportWizard/importFixtures'
import { ImportResultReport } from './ImportResultReport'

let server: FakeImportServer
afterEach(() => server.restore())

function renderReport(deletion?: DeletionCheck, batch = committedBatch()) {
  server = installFakeImportApi({ deletion })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ImportResultReport clubId={SAMPLE_CLUB_ID} batch={batch} resultLinks={[{ label: 'View the schedule', to: '/manage/fixtures/matches' }]} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ImportResultReport', () => {
  it('shows the figures and the link to the imported data', () => {
    renderReport()
    expect(screen.getByTestId('report-created-value')).toHaveTextContent('3')
    expect(screen.getByTestId('report-not-ours-value')).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: 'View the schedule' })).toHaveAttribute('href', '/manage/fixtures/matches')
  })

  it('runs the deletion check and asks to confirm a deletable import', async () => {
    renderReport()
    fireEvent.click(screen.getByRole('button', { name: /delete import/i }))
    expect(await screen.findByText('Delete this import?')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Will be deleted/)).toBeInTheDocument())
    expect(server.calls.some((call) => call.method === 'post' && call.url.endsWith('/delete'))).toBe(false)
  })

  it('lists the blockers, with no way to delete, when something is in use', async () => {
    renderReport(BLOCKED)
    fireEvent.click(screen.getByRole('button', { name: /delete import/i }))
    expect(await screen.findByText('This import cannot be deleted')).toBeInTheDocument()
    expect(screen.getByText('CBC U15 v Glenwood, 11 Oct')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open it' })).toHaveAttribute('href', '/manage/fixtures/matches/m-1')
  })
})

describe('ImportResultReport, typed in the wizard (spec 125)', () => {
  it('states how many rows were typed in or edited and names a blank batch', () => {
    const batch = committedBatch({ source: 'MANUAL', fileName: 'Typed in the wizard', counts: { ...committedBatch().counts, added: 3, edited: 2 } })
    renderReport(undefined, batch)
    expect(screen.getByTestId('report-typed')).toHaveTextContent('3 typed in, 2 edited.')
    expect(screen.getByText(/Typed in the wizard/)).toBeInTheDocument()
  })
})
