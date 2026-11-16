import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareImageActions } from './ShareImageActions'

// Download PNG and Share can ask for another size (Square, Portrait, Story) at the moment of use: the other sizes are listed under a caret
// and each is made when picked, so the preview is never changed.
const downloadFile = vi.fn()
vi.mock('../../utils/share/downloadFile', () => ({ downloadFile: (...args: unknown[]) => downloadFile(...args) }))

const file = new File(['png'], 'result.png', { type: 'image/png' })
const made = new File(['png2'], 'result - Story 9:16.png', { type: 'image/png' })
const sizes = (make = vi.fn().mockResolvedValue(made)) => ({
  current: 'SQUARE',
  options: [
    { id: 'SQUARE', label: 'Square 1080', make: vi.fn() },
    { id: 'PORTRAIT', label: 'Portrait 4:5', make: vi.fn() },
    { id: 'STORY', label: 'Story 9:16', make },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ShareImageActions: sizes', () => {
  it('downloads the size in the preview from the main button and lists the other sizes under the caret', async () => {
    render(<ShareImageActions file={file} shareTitle="A v B" error={null} sizes={sizes()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    expect(downloadFile).toHaveBeenCalledWith(file)

    await userEvent.click(screen.getByRole('button', { name: 'More options for Download PNG' }))
    expect(screen.getByRole('menuitem', { name: 'Download Portrait 4:5' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Download Story 9:16' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Download Square 1080' })).not.toBeInTheDocument()
  })

  it('makes the picked size when asked, downloads that file and leaves the preview file alone', async () => {
    const make = vi.fn().mockResolvedValue(made)
    render(<ShareImageActions file={file} shareTitle="A v B" error={null} sizes={sizes(make)} />)

    await userEvent.click(screen.getByRole('button', { name: 'More options for Download PNG' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Download Story 9:16' }))

    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(made))
    expect(make).toHaveBeenCalledTimes(1)
    // only the made file was handed out, never the one the preview shows (identity, not equality: two Files compare alike)
    expect(downloadFile.mock.calls.every(([handed]) => handed === made)).toBe(true)
  })

  it('says so, and keeps the screen, when a size cannot be made', async () => {
    const make = vi.fn().mockRejectedValue(new Error('no canvas'))
    render(<ShareImageActions file={file} shareTitle="A v B" error={null} sizes={sizes(make)} />)

    await userEvent.click(screen.getByRole('button', { name: 'More options for Download PNG' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Download Story 9:16' }))

    expect(await screen.findByText('That size could not be made. Try again.')).toBeInTheDocument()
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('lists the other sizes under Share too, where the browser can share files, and shares the made file', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share, clipboard: undefined })
    const make = vi.fn().mockResolvedValue(made)
    render(<ShareImageActions file={file} shareTitle="A v B" error={null} sizes={sizes(make)} />)

    await userEvent.click(screen.getByRole('button', { name: 'More options for Share' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Share Story 9:16' }))

    await waitFor(() => expect(share).toHaveBeenCalledWith({ files: [made], title: 'A v B' }))
  })

  it('stays a plain Download PNG button for a format with one size', () => {
    render(<ShareImageActions file={file} shareTitle="A v B" error={null} />)
    expect(screen.queryByRole('button', { name: 'More options for Download PNG' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument()
  })
})
