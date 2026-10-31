import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeImportApi } from '../ImportWizard/importFakes'
import type { FakeImportServer } from '../ImportWizard/importFakes'
import { SAMPLE_CLUB_ID, SAMPLE_TYPE } from '../ImportWizard/importFixtures'
import { ImportUploadStep } from './ImportUploadStep'
import type { ImportUploadStepProps } from './ImportUploadStep'

let server: FakeImportServer
beforeEach(() => {
  server = installFakeImportApi()
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => server.restore())

function renderStep(patch: Partial<ImportUploadStepProps> = {}) {
  const props: ImportUploadStepProps = {
    clubId: SAMPLE_CLUB_ID,
    type: SAMPLE_TYPE,
    scope: { params: { leagueId: 'l1' }, scopeMode: 'ALL', templateScope: 'OURS_AND_OTHERS' },
    onScopeChange: vi.fn(),
    file: null,
    onFileChange: vi.fn(),
    ...patch,
  }
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ImportUploadStep {...props} />
    </QueryClientProvider>,
  )
  return props
}

describe('ImportUploadStep', () => {
  it('lays the template card out as Lists in the template and Download, with help that follows the choice', () => {
    renderStep({ scope: { params: { leagueId: 'l1' }, scopeMode: 'ALL', templateScope: 'OURS_ONLY' } })
    expect(screen.getByText('Lists in the template')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getByText('Only your own teams appear in the drop-downs.')).toBeInTheDocument()
  })

  it('downloads the template in the chosen format with the scope params', async () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /csv template/i }))
    await waitFor(() => expect(server.calls.some((call) => call.url.endsWith('/template') && call.params?.format === 'csv' && call.params?.leagueId === 'l1' && call.params?.templateScope === 'OURS_AND_OTHERS')).toBe(true))
  })

  it('reports a scope change from the import scope switch', () => {
    const props = renderStep()
    fireEvent.click(screen.getByRole('button', { name: 'Ours only' }))
    expect(props.onScopeChange).toHaveBeenCalledWith({ scopeMode: 'OURS_ONLY' })
  })

  it('hides the scope choices for a type without an ours notion', () => {
    renderStep({ type: { ...SAMPLE_TYPE, supportsOursScope: false } })
    expect(screen.queryByRole('button', { name: 'Ours only' })).not.toBeInTheDocument()
  })

  it('shows a file-level error and the earlier import warning', () => {
    renderStep({ error: 'This is not the sample schedule template.', earlierImportWarning: 'This file was imported on 4 Oct.' })
    expect(screen.getByText('This is not the sample schedule template.')).toBeInTheDocument()
    expect(screen.getByText('This file was imported on 4 Oct.')).toBeInTheDocument()
  })
})

describe('ImportUploadStep, starting with no file (spec 125)', () => {
  it('shows the button only when a handler is given, with the consumer wording', () => {
    const onStartBlank = vi.fn()
    renderStep({ type: { ...SAMPLE_TYPE, editable: true }, onStartBlank, startBlankLabel: 'Start with an empty schedule' })
    fireEvent.click(screen.getByRole('button', { name: 'No file? Start with an empty schedule' }))
    expect(onStartBlank).toHaveBeenCalledTimes(1)
  })

  it('has no such button by default', () => {
    renderStep()
    expect(screen.queryByRole('button', { name: /start with/i })).not.toBeInTheDocument()
  })
})
