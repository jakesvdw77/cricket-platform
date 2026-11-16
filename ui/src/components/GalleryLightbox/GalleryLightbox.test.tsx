import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GalleryImage } from '../../api/galleryApi'
import { GalleryLightbox } from './GalleryLightbox'

const image = (id: string, overrides: Partial<GalleryImage> = {}): GalleryImage => ({
  id, thumbUrl: `/t-${id}.jpg`, mediumUrl: `/m-${id}.jpg`, caption: `Caption ${id}`, uploadedAt: '2026-11-16T21:32:00Z',
  uploadedByName: null, mine: false, tags: [{ type: 'TEAM', id: 't1', name: 'Irene Veterans' }], ...overrides,
})
const IMAGES = [image('a'), image('b', { mine: true }), image('c')]

function renderBox(index: number | null, extra: Partial<Parameters<typeof GalleryLightbox>[0]> = {}) {
  const onIndexChange = vi.fn()
  const onClose = vi.fn()
  render(<GalleryLightbox images={IMAGES} index={index} onIndexChange={onIndexChange} onClose={onClose} {...extra} />)
  return { onIndexChange, onClose }
}

// docs/specs/157: one photo large with Previous and Next across the loaded photos, caption, tags, and Delete when allowed.
describe('GalleryLightbox', () => {
  it('renders nothing when no photo is chosen', () => {
    renderBox(null)
    expect(screen.queryByTestId('gallery-lightbox-image')).not.toBeInTheDocument()
  })

  it('shows the medium copy, the caption, the tags and the position', () => {
    renderBox(1)
    expect(screen.getByTestId('gallery-lightbox-image')).toHaveAttribute('src', '/m-b.jpg')
    expect(screen.getByText('Caption b')).toBeInTheDocument()
    expect(screen.getByText('Irene Veterans')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('goes to the previous and next photo, and stops at both ends', async () => {
    const { onIndexChange } = renderBox(1)
    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
  })

  it('disables Previous on the first photo and Next on the last', () => {
    const { unmount } = render(<GalleryLightbox images={IMAGES} index={0} onIndexChange={() => undefined} onClose={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()
    unmount()
    render(<GalleryLightbox images={IMAGES} index={2} onIndexChange={() => undefined} onClose={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled()
  })

  it('moves with the arrow keys', () => {
    const { onIndexChange } = renderBox(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
  })

  it('offers Delete only for a photo the caller may delete, and hands that photo to onDelete', async () => {
    const onDelete = vi.fn()
    renderBox(1, { canDelete: (photo) => photo.mine, onDelete })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('shows no Delete on a photo the caller may not delete', () => {
    renderBox(0, { canDelete: (photo) => photo.mine, onDelete: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('closes from the Close button', async () => {
    const { onClose } = renderBox(0)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
