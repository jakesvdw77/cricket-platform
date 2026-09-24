import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DocumentUpload } from './DocumentUpload'

// docs/specs/050-league-schedule-and-fixtures.md item 23: mirrors MediaUpload.test.tsx's own
// structure — the injected onUpload prop stands in for MediaUpload's fixed uploadMedia/
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
})
