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
})
