import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DocumentUpload } from './DocumentUpload'

// docs/specs/050-league-schedule-and-fixtures.md item 23: mirrors MediaUpload.test.tsx's own
// structure, the injected onUpload prop stands in for MediaUpload's fixed uploadMedia/
// uploadManagedMedia import, since DocumentUpload deliberately keeps its upload delegate generic.
describe('DocumentUpload', () => {
  it('renders "No document uploaded yet" and an "Upload" button in the empty state', () => {
    render(
      <DocumentUpload label="Playing Conditions" value={null} onUpload={vi.fn()} onUploaded={vi.fn()} />,
    )

    expect(screen.getByText('No document uploaded yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument()
  })

  it('renders the filename, upload date, and a Replace + View button once a value is set', () => {
    render(
      <DocumentUpload
        label="Playing Conditions"
        value={{ documentUrl: '/media/2f6a1c9e-playing-conditions.pdf', uploadedAt: '2026-02-01T09:00:00Z' }}
        onUpload={vi.fn()}
        onUploaded={vi.fn()}
      />,
    )

    expect(screen.getByText('2f6a1c9e-playing-conditions.pdf')).toBeInTheDocument()
    expect(screen.getByText(/Uploaded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument()
  })

  it('shows displayName instead of the stored file name when provided', () => {
    render(
      <DocumentUpload
        label="Playing Conditions"
        value={{ documentUrl: '/media/2f6a1c9e-playing-conditions.pdf', uploadedAt: '2026-02-01T09:00:00Z' }}
        displayName="Playing Conditions.pdf"
        onUpload={vi.fn()}
        onUploaded={vi.fn()}
      />,
    )

    expect(screen.getByText('Playing Conditions.pdf')).toBeInTheDocument()
    expect(screen.queryByText('2f6a1c9e-playing-conditions.pdf')).not.toBeInTheDocument()
    expect(screen.getByText(/Uploaded/)).toBeInTheDocument()
  })

  it('rejects a non-PDF file client-side without ever calling onUpload', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onUpload = vi.fn()
    const onUploaded = vi.fn()

    render(<DocumentUpload label="Playing Conditions" value={null} onUpload={onUpload} onUploaded={onUploaded} />)

    const file = new File(['not a pdf'], 'photo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Playing Conditions file'), file)

    expect(
      await screen.findByText('"photo.png" isn\'t a supported document type. Upload a PDF file instead.'),
    ).toBeInTheDocument()
    expect(onUpload).not.toHaveBeenCalled()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('uploads a selected PDF via the injected onUpload prop and calls onUploaded with the resulting URL', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue('/media/new-playing-conditions.pdf')
    const onUploaded = vi.fn()

    render(<DocumentUpload label="Playing Conditions" value={null} onUpload={onUpload} onUploaded={onUploaded} />)

    const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Playing Conditions file'), file)

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('/media/new-playing-conditions.pdf'))
    expect(onUpload).toHaveBeenCalledWith(file)
  })

  it('shows an inline error when onUpload itself rejects', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockRejectedValue(new Error('network error'))

    render(<DocumentUpload label="Playing Conditions" value={null} onUpload={onUpload} onUploaded={vi.fn()} />)

    const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Playing Conditions file'), file)

    expect(
      await screen.findByText('Something went wrong uploading "playing-conditions.pdf". Please try again.'),
    ).toBeInTheDocument()
  })

  it('clicking View opens the document\'s own URL in a new tab', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <DocumentUpload
        label="Playing Conditions"
        value={{ documentUrl: '/media/2f6a1c9e-playing-conditions.pdf', uploadedAt: '2026-02-01T09:00:00Z' }}
        onUpload={vi.fn()}
        onUploaded={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View' }))

    expect(openSpy).toHaveBeenCalledWith('/media/2f6a1c9e-playing-conditions.pdf', '_blank')
    openSpy.mockRestore()
  })
  describe('inline layout (docs/specs/095)', () => {
    const value = { documentUrl: '/media/2f6a1c9e-playing-conditions.pdf', uploadedAt: '2026-02-01T09:00:00Z' }

    it('shows only an Upload button and no card text when nothing is stored', () => {
      render(<DocumentUpload layout="inline" label="Playing Conditions" value={null} onUpload={vi.fn()} onUploaded={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
      expect(screen.queryByText('No document uploaded yet')).not.toBeInTheDocument()
      expect(screen.queryByText('PDF, up to 5MB.')).not.toBeInTheDocument()
    })

    it('shows a button named displayName that opens the document, beside Replace', async () => {
      const user = userEvent.setup()
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      render(
        <DocumentUpload layout="inline" label="Playing Conditions" displayName="Playing Conditions.pdf" value={value} onUpload={vi.fn()} onUploaded={vi.fn()} />,
      )

      expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Playing Conditions.pdf' }))
      expect(openSpy).toHaveBeenCalledWith('/media/2f6a1c9e-playing-conditions.pdf', '_blank', 'noopener')
      openSpy.mockRestore()
    })

    it('uploads a PDF through the same onUpload delegate and shows a rejected type inline', async () => {
      const user = userEvent.setup({ applyAccept: false })
      const onUpload = vi.fn().mockResolvedValue('/media/new.pdf')
      const onUploaded = vi.fn()

      render(<DocumentUpload layout="inline" label="Playing Conditions" value={null} onUpload={onUpload} onUploaded={onUploaded} />)

      await user.upload(screen.getByLabelText('Playing Conditions file'), new File(['x'], 'photo.png', { type: 'image/png' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('"photo.png" isn\'t a supported document type')
      expect(onUpload).not.toHaveBeenCalled()

      const file = new File(['%PDF-1.4'], 'conditions.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText('Playing Conditions file'), file)
      await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('/media/new.pdf'))
      expect(onUpload).toHaveBeenCalledWith(file)
    })
  })

  // docs/specs/104: mode="select" only holds the chosen file for the import wizard; nothing is uploaded.
  describe('select mode', () => {
    const renderSelect = (props: { file?: File | null; accept?: string[]; maxBytes?: number } = {}) => {
      const onFileChange = vi.fn()
      render(<DocumentUpload mode="select" label="Result file" accept={props.accept ?? ['.json']} maxBytes={props.maxBytes ?? 100} file={props.file ?? null} onFileChange={onFileChange} />)
      return onFileChange
    }

    it('holds a chosen file of an accepted extension, whatever its case, without uploading anything', async () => {
      const user = userEvent.setup({ applyAccept: false })
      const onFileChange = renderSelect()
      const file = new File(['{}'], 'Match.JSON', { type: '' })
      await user.upload(screen.getByLabelText('Result file file'), file)
      expect(onFileChange).toHaveBeenCalledWith(file)
    })

    it('refuses a file of another type or over the size limit, in words, and never replaces the held file', async () => {
      const user = userEvent.setup({ applyAccept: false })
      const onFileChange = renderSelect({ maxBytes: 4 })
      await user.upload(screen.getByLabelText('Result file file'), new File(['x'], 'notes.txt', { type: 'text/plain' }))
      expect(screen.getByRole('alert')).toHaveTextContent('"notes.txt" isn\'t a supported document type. Upload a .json file instead.')
      await user.upload(screen.getByLabelText('Result file file'), new File(['0123456789'], 'big.json'))
      expect(screen.getByRole('alert')).toHaveTextContent('"big.json" is 10 B, over the 4 B limit.')
      expect(onFileChange).not.toHaveBeenCalled()
    })

    it('shows the chosen file with its size and lets it be removed', async () => {
      const user = userEvent.setup()
      const onFileChange = renderSelect({ file: new File([new Uint8Array(2048)], 'match.json') })
      expect(screen.getByText('match.json')).toBeInTheDocument()
      expect(screen.getByText('2 KB')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Remove' }))
      expect(onFileChange).toHaveBeenCalledWith(null)
    })

    it('accepts a file dropped on it, under the same rules', () => {
      const onFileChange = renderSelect()
      const file = new File(['{}'], 'dropped.json')
      const zone = screen.getByText('Result file').closest('div[class*="MuiBox"]')?.parentElement as HTMLElement
      fireEvent.drop(zone, { dataTransfer: { files: [file] } })
      expect(onFileChange).toHaveBeenCalledWith(file)
    })
  })
})
