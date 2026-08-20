import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MediaUpload } from './MediaUpload'

const uploadMedia = vi.fn()

vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MediaUpload', () => {
  it('renders the empty state with an "Upload <label>" button', () => {
    render(<MediaUpload label="Logo" value={null} onUploaded={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Upload Logo' })).toBeInTheDocument()
    expect(screen.getByText('PNG, JPEG, or WebP, up to 5MB.')).toBeInTheDocument()
  })

  it('renders a "Replace" button, not "Upload", once a value is set', () => {
    render(<MediaUpload label="Logo" value="/media/logo.png" onUploaded={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload Logo' })).not.toBeInTheDocument()
  })

  it('uploads a selected image file and calls onUploaded with the resulting URL', async () => {
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    uploadMedia.mockResolvedValueOnce({ url: '/media/new-logo.png' })

    render(<MediaUpload label="Logo" value={null} onUploaded={onUploaded} />)

    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logo file'), file)

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('/media/new-logo.png'))
    expect(uploadMedia).toHaveBeenCalledWith(file)
  })

  it('rejects a non-image file client-side without ever calling uploadMedia', async () => {
    // A real OS file picker's "All files" override still lets an admin pick a file the
    // `accept` attribute would otherwise filter out — disable user-event's own accept
    // filtering here to exercise that same case, rather than testing the browser's own
    // (already-trusted) accept-attribute behaviour.
    const user = userEvent.setup({ applyAccept: false })
    const onUploaded = vi.fn()

    render(<MediaUpload label="Logo" value={null} onUploaded={onUploaded} />)

    const file = new File(['not an image'], 'document.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Logo file'), file)

    expect(
      await screen.findByText(
        '"document.pdf" isn\'t a supported image type. Upload a PNG, JPEG, or WebP file instead.',
      ),
    ).toBeInTheDocument()
    expect(uploadMedia).not.toHaveBeenCalled()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it('shows an inline error when the upload request itself fails', async () => {
    const user = userEvent.setup()
    uploadMedia.mockRejectedValueOnce(new Error('network error'))

    render(<MediaUpload label="Banner" value={null} onUploaded={vi.fn()} variant="banner" />)

    const file = new File(['banner'], 'banner.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Banner file'), file)

    expect(
      await screen.findByText('Something went wrong uploading "banner.png". Please try again.'),
    ).toBeInTheDocument()
  })
})
