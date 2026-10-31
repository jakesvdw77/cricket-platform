import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImportBatch } from '../../api/importApi'
import { installFakeImportApi } from '../ImportWizard/importFakes'
import type { FakeImportServer } from '../ImportWizard/importFakes'
import { SAMPLE_CLUB_ID, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportHistoryPanel } from './ImportHistoryPanel'

let server: FakeImportServer
afterEach(() => server.restore())

function renderPanel(history?: ImportBatch[]) {
  server = installFakeImportApi({ history })
  const onResume = vi.fn()
  const onOpenReport = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ImportHistoryPanel clubId={SAMPLE_CLUB_ID} open onClose={() => undefined} onOpenReport={onOpenReport} onResume={onResume} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onResume, onOpenReport }
}

describe('ImportHistoryPanel', () => {
  it('lists batches with their status and scope chips and resumes a preview', async () => {
    const { onResume, onOpenReport } = renderPanel()
    expect(await screen.findByText('schedule-2026.xlsx')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Ours only')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume schedule-2026\.xlsx/i }))
    expect(onResume).toHaveBeenCalledWith(expect.objectContaining({ id: 'batch-1' }))
    fireEvent.click(screen.getByRole('button', { name: /open report schedule-2025\.xlsx/i }))
    expect(onOpenReport).toHaveBeenCalledWith(expect.objectContaining({ id: 'batch-0' }))
  })

  it('hides ended batches until the switch is on and asks the server for them', async () => {
    renderPanel([sampleBatch(), sampleBatch({ id: 'batch-9', fileName: 'old.xlsx', status: 'DISCARDED' })])
    expect(await screen.findByText('schedule-2026.xlsx')).toBeInTheDocument()
    expect(screen.queryByText('old.xlsx')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /show deleted and discarded/i }))
    expect(await screen.findByText('old.xlsx')).toBeInTheDocument()
    expect(server.calls.some((call) => call.method === 'get' && call.params?.includeEnded === true)).toBe(true)
  })

  it('discards an in-progress import after confirming', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /discard schedule-2026\.xlsx/i }))
    expect(screen.getByText(/nothing has been saved from it/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(server.calls.some((call) => call.method === 'post' && call.url.endsWith('/discard'))).toBe(true))
  })
})
