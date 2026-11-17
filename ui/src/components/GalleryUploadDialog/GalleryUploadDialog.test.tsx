import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import { httpError, newQueryClient, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'
import { GalleryUploadDialog } from './GalleryUploadDialog'

vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../utils/gallery/resizePhoto', () => ({ resizePhoto: vi.fn(async () => ({ medium: new Blob(['m']), thumb: new Blob(['t']) })) }))
const http = api as unknown as ApiMock

// docs/specs/157: Add Photos. Up to 10 JPEG or PNG photos, one request per photo, one caption and one set of tags for the batch.
const photo = (name: string, type = 'image/jpeg') => new File([name], name, { type })

function renderDialog(overrides: Partial<Parameters<typeof GalleryUploadDialog>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={newQueryClient()}>
      <GalleryUploadDialog
        open
        onClose={onClose}
        scope={{ kind: 'hub', playerKey: 'k1' }}
        leagues={[{ id: 'l1', name: 'VCASA Club Champs' }]}
        teams={[{ id: 't1', name: 'Irene Veterans' }]}
        myPlayerName="Jaco"
        {...overrides}
      />
    </QueryClientProvider>,
  )
  return { onClose }
}
const choose = (files: File[]) => fireEvent.change(screen.getByTestId('gallery-file-input'), { target: { files } })
const strip = () => screen.queryByTestId('gallery-upload-strip')

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  routeApi(http, { 'POST /me/players/k1/gallery': { id: 'new' }, 'POST /manage/clubs/c1/gallery': { id: 'new' } })
})

describe('GalleryUploadDialog', () => {
  it('keeps only JPEG and PNG photos, at most ten, and says so', async () => {
    renderDialog()
    const files = Array.from({ length: 11 }, (_, i) => photo(`p${i}.jpg`))
    choose([...files, photo('anim.gif', 'image/gif')])
    expect(await screen.findByText(/Only JPEG and PNG photos are added, up to 10 at a time/)).toBeInTheDocument()
    expect((strip() as HTMLElement).querySelectorAll('img')).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Upload 10 Photos' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose Photos' })).toBeDisabled()
  })

  it('refuses a huge original with a clear message and keeps the other photos', async () => {
    renderDialog()
    const huge = photo('huge.jpg')
    Object.defineProperty(huge, 'size', { value: 31 * 1024 * 1024 })
    choose([huge, photo('ok.jpg')])
    expect(await screen.findByText(/One photo is too large to add \(over 30 MB\)/)).toBeInTheDocument()
    expect((strip() as HTMLElement).querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Upload 1 Photo' })).toBeEnabled()
  })

  it('sends each photo on its own with the caption and tags, then closes', async () => {
    const { onClose } = renderDialog()
    choose([photo('a.jpg'), photo('b.png', 'image/png')])
    await userEvent.type(screen.getByLabelText('Caption (optional)'), '  Final day  ')
    await userEvent.click(screen.getByRole('button', { name: 'Upload 2 Photos' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(http.post).toHaveBeenCalledTimes(2)
    const form = http.post.mock.calls[0][1] as FormData
    expect(http.post.mock.calls[0][0]).toBe('/me/players/k1/gallery')
    expect(form.get('caption')).toBe('Final day')
    expect(form.get('tagMyPlayer')).toBe('true')
    expect(form.get('medium')).toBeInstanceOf(Blob)
    expect(form.get('thumb')).toBeInstanceOf(Blob)
  })

  it('lets the Hub switch off tagging the held player', async () => {
    const { onClose } = renderDialog()
    choose([photo('a.jpg')])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tag Jaco' }))
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 Photo' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((http.post.mock.calls[0][1] as FormData).get('tagMyPlayer')).toBe('false')
  })

  it('keeps the dialog open, marks the failed photo and offers to send it again', async () => {
    routeApi(http, { 'POST /me/players/k1/gallery': httpError(400, { detail: 'photo is not a readable image' }) })
    const { onClose } = renderDialog()
    choose([photo('a.jpg')])
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 Photo' }))
    expect(await screen.findByText(/1 photo could not be sent/)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload 1 Photo' })).toBeEnabled()
  })

  it('shows a Players picker to a manager and sends the chosen player ids to the club path', async () => {
    const { onClose } = renderDialog({ scope: { kind: 'club', clubId: 'c1' }, myPlayerName: undefined, players: [{ id: 'p1', name: 'Willie Prinsloo' }] })
    expect(screen.queryByRole('checkbox', { name: /^Tag/ })).not.toBeInTheDocument()
    choose([photo('a.jpg')])
    await userEvent.click(screen.getByLabelText('Players (up to 5)'))
    await userEvent.click(await screen.findByRole('option', { name: 'Willie Prinsloo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 Photo' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(http.post.mock.calls[0][0]).toBe('/manage/clubs/c1/gallery')
    expect((http.post.mock.calls[0][1] as FormData).getAll('playerId')).toEqual(['p1'])
  })

  it('removes a chosen photo before sending, and has nothing to upload when none is chosen', async () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
    choose([photo('a.jpg'), photo('b.jpg')])
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[0])
    expect(screen.getByRole('button', { name: 'Upload 1 Photo' })).toBeEnabled()
  })
})
