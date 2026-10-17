import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WhatsAppSendActions } from './WhatsAppSendActions'
import { WHATSAPP_LINK_MAX_CHARS } from '../../utils/whatsappLink'

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
})

describe('WhatsAppSendActions', () => {
  it('Send in WhatsApp opens the wa.me link with the encoded text in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<WhatsAppSendActions text={'Hello *team*\nhttps://x.test/poll/1'} />)

    await userEvent.click(screen.getByRole('button', { name: 'Send in WhatsApp' }))

    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent('Hello *team*\nhttps://x.test/poll/1')}`,
      '_blank',
      'noopener',
    )
  })

  it('Copy message copies the text and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<WhatsAppSendActions text="Hello" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy message' }))

    expect(writeText).toHaveBeenCalledWith('Hello')
    expect(await screen.findByRole('status')).toHaveTextContent('Message copied.')
  })

  it('hides Send in WhatsApp for a message too long for the link and says why', () => {
    render(<WhatsAppSendActions text={'a'.repeat(WHATSAPP_LINK_MAX_CHARS + 1)} />)

    expect(screen.queryByRole('button', { name: 'Send in WhatsApp' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeInTheDocument()
    expect(screen.getByText(/too long to send straight to WhatsApp/i)).toBeInTheDocument()
  })

  it('shows Share only where the browser can share, and sends the text', async () => {
    const { unmount } = render(<WhatsAppSendActions text="Hello" />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    unmount()

    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    // A desktop browser (fine pointer): text-only native share is not offered, Send in WhatsApp covers it.
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true })
    const desktop = render(<WhatsAppSendActions text="Hello" />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    desktop.unmount()

    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true })
    render(<WhatsAppSendActions text="Hello" />)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(share).toHaveBeenCalledWith({ text: 'Hello' })
  })

  it('with a file, shows Share only when the browser can share files, and ignores a cancelled share', async () => {
    const file = new File(['x'], 'result.png', { type: 'image/png' })
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
    const { unmount } = render(<WhatsAppSendActions text="Hello" file={file} />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    unmount()

    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    render(<WhatsAppSendActions text="Hello" file={file} />)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(share).toHaveBeenCalledWith({ text: 'Hello', files: [file] })
  })

  it('offers WhatsApp Web with the full text on a desktop only', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true })
    const desktop = render(<WhatsAppSendActions text="Hello there" />)
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp Web' }))
    expect(open).toHaveBeenCalledWith('https://web.whatsapp.com/send?text=Hello%20there', '_blank', 'noopener')
    desktop.unmount()

    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true })
    render(<WhatsAppSendActions text="Hello there" />)
    expect(screen.queryByRole('button', { name: 'WhatsApp Web' })).not.toBeInTheDocument()
    open.mockRestore()
  })
})

// docs/specs/114-share-result.md (Send to WhatsApp, Test Plan): which buttons render where.
describe('WhatsAppSendActions button sets', () => {
  const setPointer = (coarse: boolean) =>
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: coarse }), configurable: true })
  const stubClipboard = (writeText = vi.fn().mockResolvedValue(undefined)) => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    return writeText
  }
  const file = new File(['x'], 'result.png', { type: 'image/png' })
  const names = () => screen.getAllByRole('button').map((button) => button.textContent)

  it('on a desktop without files: Send in WhatsApp, WhatsApp Web and Copy message, no Share', () => {
    setPointer(false)
    render(<WhatsAppSendActions text="Hello" />)

    expect(names()).toEqual(['Send in WhatsApp', 'WhatsApp Web', 'Copy message'])
  })

  it('on a touch device with text only: Send in WhatsApp, Share and Copy message, no WhatsApp Web', () => {
    setPointer(true)
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    render(<WhatsAppSendActions text="Hello" />)

    expect(names()).toEqual(['Send in WhatsApp', 'Share', 'Copy message'])
  })

  it('on a desktop that can share files: Share appears for the file with WhatsApp Web beside it', () => {
    setPointer(false)
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    render(<WhatsAppSendActions text="Hello" file={file} />)

    expect(names()).toEqual(['Send in WhatsApp', 'WhatsApp Web', 'Share', 'Copy message'])
  })

  it('hands the text, title and file to the share sheet together and never passes a separate url', async () => {
    setPointer(true)
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    render(<WhatsAppSendActions text={'Vote here\nhttps://x.test/poll/1'} file={file} shareTitle="Riverside 1 v Pretoria CC" />)

    await userEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(share).toHaveBeenCalledWith({ text: 'Vote here\nhttps://x.test/poll/1', title: 'Riverside 1 v Pretoria CC', files: [file] })
    expect(share.mock.calls[0][0]).not.toHaveProperty('url')
  })

  it('does not offer Share when canShare throws or says no for the file', () => {
    setPointer(true)
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
    const { unmount } = render(<WhatsAppSendActions text="Hello" file={file} />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    unmount()

    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    render(<WhatsAppSendActions text="Hello" file={file} />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('swallows a share that fails for another reason as well as a cancelled one', async () => {
    setPointer(true)
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new Error('boom')), configurable: true })
    render(<WhatsAppSendActions text="Hello" />)

    await userEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
  })

  it('too long for a link: no Send, no WhatsApp Web, Copy is the primary action and the reason is shown', () => {
    setPointer(false)
    render(<WhatsAppSendActions text={'é'.repeat(WHATSAPP_LINK_MAX_CHARS)} />)

    // Each accented letter encodes to six characters, so the encoded length is over the limit although the text is short.
    expect(names()).toEqual(['Copy message'])
    expect(screen.getByText(/too long to send straight to WhatsApp/i)).toBeInTheDocument()
  })

  it('still offers Send at exactly the limit of the encoded text', () => {
    setPointer(false)
    render(<WhatsAppSendActions text={'a'.repeat(WHATSAPP_LINK_MAX_CHARS)} />)

    expect(screen.getByRole('button', { name: 'Send in WhatsApp' })).toBeInTheDocument()
    expect(screen.queryByText(/too long/i)).not.toBeInTheDocument()
  })

  it('Copy message sends the current text, reports the outcome and says so in the status line', async () => {
    setPointer(false)
    const writeText = stubClipboard()
    const onCopyResult = vi.fn()
    render(<WhatsAppSendActions text="My edited text" onCopyResult={onCopyResult} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy message' }))

    expect(writeText).toHaveBeenCalledWith('My edited text')
    expect(onCopyResult).toHaveBeenCalledWith(true)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('reports a failed copy and shows the manual-copy message', async () => {
    setPointer(false)
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    document.execCommand = vi.fn().mockReturnValue(false)
    const onCopyResult = vi.fn()
    render(<WhatsAppSendActions text="Hello" onCopyResult={onCopyResult} copyLabel="Copy text" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy text' }))

    expect(onCopyResult).toHaveBeenCalledWith(false)
    expect(await screen.findByRole('status')).toHaveTextContent(/copy it manually/i)
  })

  it('disables every action when disabled', () => {
    setPointer(false)
    render(<WhatsAppSendActions text="Hello" disabled />)

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('Send in WhatsApp always uses the current text after a re-render with an edit', async () => {
    setPointer(false)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { rerender } = render(<WhatsAppSendActions text="First" />)
    rerender(<WhatsAppSendActions text={'Second *bold* & #tag é\nnext'} />)

    await userEvent.click(screen.getByRole('button', { name: 'Send in WhatsApp' }))

    const sent = open.mock.calls[0][0] as string
    expect(decodeURIComponent(sent.split('text=')[1])).toBe('Second *bold* & #tag é\nnext')
  })
})
