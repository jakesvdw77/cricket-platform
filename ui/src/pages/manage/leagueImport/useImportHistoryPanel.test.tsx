import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { installFakeImportApi } from '../../../components/ImportWizard/importFakes'
import type { FakeImportServer } from '../../../components/ImportWizard/importFakes'
import { sampleBatch } from '../../../components/ImportWizard/importFixtures'
import { useImportHistoryPanel } from './useImportHistoryPanel'

let server: FakeImportServer | null = null
afterEach(() => server?.restore())

function Probe({ seasonId }: { seasonId: string }) {
  const history = useImportHistoryPanel('club-1', 'l1', seasonId)
  return (
    <>
      <button type="button" onClick={history.open}>{history.label}</button>
      {history.panel}
    </>
  )
}

function renderProbe(seasonId: string) {
  server = installFakeImportApi({ history: [sampleBatch({ status: 'COMMITTED' })] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Probe seasonId={seasonId} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('useImportHistoryPanel', () => {
  it('counts the imports and opens the history panel', async () => {
    renderProbe('s1')
    const button = await screen.findByRole('button', { name: 'Import History (1)' })
    fireEvent.click(button)
    expect(await screen.findByTestId('history-batch-1')).toBeInTheDocument()
  })

  it('has no count without a season', () => {
    renderProbe('')
    expect(screen.getByRole('button', { name: 'Import History' })).toBeInTheDocument()
  })
})
