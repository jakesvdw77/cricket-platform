import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAdaptor, jsonAdaptor, makeCatalogue, makePreview, pdfAdaptor, renderImportPage } from './importTestUtils'

const getImportCatalogue = vi.fn()
const previewImport = vi.fn()
const resolveImport = vi.fn()

vi.mock('../../../../api/resultImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/resultImportApi')>()
  return {
    ...actual,
    getImportCatalogue: (clubId: string) => getImportCatalogue(clubId),
    previewImport: (clubId: string, request: unknown, file?: File | null) => previewImport(clubId, request, file),
    resolveImport: (clubId: string, request: unknown) => resolveImport(clubId, request),
  }
})

const failure = (status: number, data: unknown) => new AxiosError('failed', String(status), undefined, undefined, { status, data } as never)
const errorList = (count: number) => Array.from({ length: count }, (_, index) => ({ path: `innings[${index}].total`, code: 'BAD', message: `Total ${index} does not add up.` }))

beforeEach(() => {
  vi.clearAllMocks()
  // One source is selected from the start; the tests about choosing between sources register more.
  getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
  previewImport.mockResolvedValue(makePreview())
})

const sources = async () => within(await screen.findByRole('radiogroup', { name: 'Source' }))
const paste = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.click(await screen.findByRole('tab', { name: 'Paste' }))
  const box = screen.getByLabelText('Pasted result content')
  await user.click(box)
  await user.paste(text)
  return box
}

describe('Source step', () => {
  it('lists exactly the sources discovery returned, with no source named in the code', async () => {
    getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor, pdfAdaptor, fakeAdaptor]))
    renderImportPage()

    expect((await sources()).getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      expect.stringContaining('Cricket Legend JSON'),
      expect.stringContaining('Scorebook PDF'),
      expect.stringContaining('Fake Spreadsheet'),
    ])
    expect((await sources()).getByText('A source added by a test with no UI change.')).toBeInTheDocument()
  })

  it('selects a single source from the start and shows what it reads', async () => {
    getImportCatalogue.mockResolvedValue(makeCatalogue([fakeAdaptor]))
    renderImportPage()

    expect(await screen.findByRole('radio', { name: /Fake Spreadsheet/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'XLSX' })).toBeInTheDocument()
  })

  it('offers upload and paste for a text format, and upload only for a binary one', async () => {
    const user = userEvent.setup()
    getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor, pdfAdaptor]))
    renderImportPage()

    await user.click((await sources()).getByRole('radio', { name: /Cricket Legend JSON/ }))
    expect(screen.getByRole('tab', { name: 'Upload file' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Paste' })).toBeInTheDocument()

    await user.click((await sources()).getByRole('radio', { name: /Scorebook PDF/ }))
    expect(screen.queryByRole('tab', { name: 'Paste' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Pasted result content')).not.toBeInTheDocument()
    expect(screen.getByText('This source reads files, not pasted text.')).toBeInTheDocument()
  })

  it('switches between the formats of one source, hiding paste on its binary one', async () => {
    const user = userEvent.setup()
    getImportCatalogue.mockResolvedValue(makeCatalogue([fakeAdaptor]))
    renderImportPage()

    await screen.findByRole('tab', { name: 'Paste' })
    await user.click(screen.getByRole('button', { name: 'XLSX' }))
    expect(screen.queryByRole('tab', { name: 'Paste' })).not.toBeInTheDocument()
    expect(screen.getByText('Accepts .xlsx files up to 4 KB. Drop a file here or choose one.')).toBeInTheDocument()
  })

  it('shows the file extension and the size limit from the catalogue', async () => {
    getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
    renderImportPage()

    expect(await screen.findByText('Accepts .json files up to 1 MB. Drop a file here or choose one.')).toBeInTheDocument()
  })

  it('shows the paste length against the limit and refuses Continue past it', async () => {
    const user = userEvent.setup()
    getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor], 10))
    renderImportPage()

    await paste(user, '12345678901')
    expect(screen.getByText('11 / 10 (too long)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('disables Continue while nothing is provided and enables it for pasted text or a chosen file', async () => {
    const user = userEvent.setup()
    renderImportPage()

    const next = await screen.findByRole('button', { name: 'Continue' })
    expect(next).toBeDisabled()

    await paste(user, '{}')
    expect(next).toBeEnabled()
    await user.clear(screen.getByLabelText('Pasted result content'))
    expect(next).toBeDisabled()

    await user.click(screen.getByRole('tab', { name: 'Upload file' }))
    const file = new File(['{}'], 'match.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Result file file'), file)
    expect(screen.getByText('match.json')).toBeInTheDocument()
    expect(next).toBeEnabled()
  })

  it('refuses a file of the wrong type or over the limit before anything is sent', async () => {
    const user = userEvent.setup({ applyAccept: false })
    getImportCatalogue.mockResolvedValue(makeCatalogue([fakeAdaptor]))
    renderImportPage()

    await screen.findByRole('tab', { name: 'Upload file' })
    await user.upload(screen.getByLabelText('Result file file'), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('"notes.txt" isn\'t a supported document type')
    await user.upload(screen.getByLabelText('Result file file'), new File([new Uint8Array(3000)], 'big.csv', { type: 'text/csv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('over the 2 KB limit')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(previewImport).not.toHaveBeenCalled()
  })

  it('sends pasted text as content, with the chosen source and format, and moves to the Match step', async () => {
    const user = userEvent.setup()
    renderImportPage()

    await paste(user, '{"a":1}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('Which match is this?')
    expect(previewImport).toHaveBeenCalledWith('club-1', { adaptor: 'CRICKET_LEGEND_JSON', format: 'JSON', content: '{"a":1}' }, null)
  })

  it('sends a chosen file instead of content', async () => {
    const user = userEvent.setup()
    renderImportPage()

    await screen.findByRole('tab', { name: 'Upload file' })
    const file = new File(['{}'], 'match.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Result file file'), file)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('Which match is this?')
    expect(previewImport).toHaveBeenCalledWith('club-1', { adaptor: 'CRICKET_LEGEND_JSON', format: 'JSON' }, file)
  })

  it('Insert example fills the paste box from the catalogue', async () => {
    const user = userEvent.setup()
    renderImportPage()

    await user.click(await screen.findByRole('tab', { name: 'Paste' }))
    await user.click(screen.getByRole('button', { name: 'Insert example' }))
    expect(screen.getByLabelText('Pasted result content')).toHaveValue('{"schemaVersion":1}')
  })

  describe('after a failed preview the input is never lost', () => {
    const cases: Array<[string, () => Error, RegExp]> = [
      ['validation', () => failure(400, { detail: 'Not valid.', errors: errorList(2), totalErrors: 2 }), /is not valid for Cricket Legend JSON/],
      ['unsupported format', () => failure(400, { detail: 'No such format.', supported: ['JSON'] }), /This source does not read that format/],
      ['unreadable', () => failure(400, { detail: 'Not valid JSON at line 2, column 5.' }), /We couldn't read this/],
      ['too large', () => failure(413, { detail: 'That is over the limit.' }), /This is too large/],
      ['conflict', () => failure(409, { detail: 'Already imported.' }), /That did not work/],
      ['forbidden', () => failure(403, { detail: 'You cannot import.' }), /That did not work/],
      ['network', () => new AxiosError('offline'), /We couldn't reach the server/],
    ]
    it.each(cases)('keeps pasted text after a %s error', async (_name, makeError, title) => {
      const user = userEvent.setup()
      previewImport.mockRejectedValue(makeError())
      renderImportPage()

      const box = await paste(user, '{"keep":"me"}')
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByTestId('import-problem')).toHaveTextContent(title)
      expect(screen.getByTestId('import-problem')).toHaveTextContent('What you pasted is still here.')
      expect(box).toHaveValue('{"keep":"me"}')
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
      expect(screen.queryByText('Which match is this?')).not.toBeInTheDocument()
    })

    it.each(cases)('keeps the chosen file after a %s error', async (_name, makeError, title) => {
      const user = userEvent.setup()
      previewImport.mockRejectedValue(makeError())
      renderImportPage()

      await screen.findByRole('tab', { name: 'Upload file' })
      await user.upload(screen.getByLabelText('Result file file'), new File(['{}'], 'match.json', { type: 'application/json' }))
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByTestId('import-problem')).toHaveTextContent(title)
      expect(screen.getByTestId('import-problem')).toHaveTextContent('Your file is still chosen.')
      expect(screen.getByText('match.json')).toBeInTheDocument()
    })
  })

  it('lists the first 20 errors with their paths and "and N more" for the rest', async () => {
    const user = userEvent.setup()
    previewImport.mockRejectedValue(failure(400, { detail: 'Not valid.', errors: errorList(25), totalErrors: 25 }))
    renderImportPage()

    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const alert = await screen.findByTestId('import-problem')
    expect(within(alert).getAllByRole('listitem')).toHaveLength(20)
    expect(within(alert).getByRole('button', { name: 'Copy path innings[0].total' })).toBeInTheDocument()
    expect(within(alert).getByText('Total 19 does not add up.')).toBeInTheDocument()
    expect(within(alert).queryByText('Total 20 does not add up.')).not.toBeInTheDocument()
    expect(within(alert).getByText('and 5 more')).toBeInTheDocument()
  })

  it('counts errors the server capped before sending in "and N more"', async () => {
    const user = userEvent.setup()
    previewImport.mockRejectedValue(failure(400, { errors: errorList(3), totalErrors: 80 }))
    renderImportPage()

    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('and 77 more')).toBeInTheDocument()
  })

  it('names what the source reads when the format is refused', async () => {
    const user = userEvent.setup()
    previewImport.mockRejectedValue(failure(400, { detail: 'This source cannot read that.', supported: ['JSON', 'CSV'] }))
    renderImportPage()

    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText(/It reads: JSON, CSV\./)).toBeInTheDocument()
  })

  it('offers Try again after a network failure, and a retry that works moves on', async () => {
    const user = userEvent.setup()
    previewImport.mockRejectedValueOnce(new AxiosError('offline'))
    renderImportPage()

    await paste(user, '{}')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    await screen.findByText('Which match is this?')
    expect(previewImport).toHaveBeenCalledTimes(2)
  })

  it('shows the Convert with your own AI helper only when the selected source has a prompt', async () => {
    const user = userEvent.setup()
    getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor, pdfAdaptor]))
    renderImportPage()

    await user.click((await sources()).getByRole('radio', { name: /Cricket Legend JSON/ }))
    expect(screen.getByRole('button', { name: /Convert it with your own AI/ })).toBeInTheDocument()

    await user.click((await sources()).getByRole('radio', { name: /Scorebook PDF/ }))
    expect(screen.queryByRole('button', { name: /Convert it with your own AI/ })).not.toBeInTheDocument()
  })

  it('shows an empty state when no source is registered', async () => {
    getImportCatalogue.mockResolvedValue(makeCatalogue([]))
    renderImportPage()
    expect(await screen.findByText('No sources to import from')).toBeInTheDocument()
  })

  it('offers a retry when the catalogue cannot load', async () => {
    const user = userEvent.setup()
    getImportCatalogue.mockRejectedValueOnce(new Error('down'))
    renderImportPage()

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cricket Legend JSON/ })).toBeInTheDocument())
  })
})
