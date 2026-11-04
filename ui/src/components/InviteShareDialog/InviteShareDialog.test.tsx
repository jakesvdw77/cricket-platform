import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InviteShareDialog } from './InviteShareDialog'

const build = (emoji: boolean) => `${emoji ? '🏏 ' : ''}*Availability*\nTap your name:\nhttp://x/poll/1`

function renderDialog(onClose = vi.fn()) {
  render(<InviteShareDialog open onClose={onClose} buildText={build} link="http://x/poll/1" />)
  return onClose
}

describe('InviteShareDialog', () => {
  it('is the WhatsApp message template: a phone preview with the editable message, Send in WhatsApp, Copy Text and Copy Link', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Share Invite' })).toBeInTheDocument()
    expect((screen.getByLabelText('Message text') as HTMLTextAreaElement).value).toContain('🏏 *Availability*')
    expect(screen.getByRole('button', { name: 'Copy Text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument()
    expect(screen.getByText(/Send in WhatsApp/)).toBeInTheDocument()
  })

  it('the Emoji switch rebuilds the text without emoji', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('checkbox', { name: 'Emoji' }))
    expect((screen.getByLabelText('Message text') as HTMLTextAreaElement).value).not.toContain('🏏')
  })

  it('asks before replacing typed edits when the switch changes, and Restore Original Text brings the built text back', async () => {
    const user = userEvent.setup()
    renderDialog()
    const box = screen.getByLabelText('Message text') as HTMLTextAreaElement
    await user.type(box, ' EDITED')
    await user.click(screen.getByRole('checkbox', { name: 'Emoji' }))
    expect(await screen.findByText('Replace your edits?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(box.value).toContain('EDITED')

    await user.click(await screen.findByRole('button', { name: 'Restore Original Text' }))
    expect(box.value).not.toContain('EDITED')
  })

  it('closes from the Close button', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    await user.click(screen.getAllByRole('button', { name: 'Close' })[1])
    expect(onClose).toHaveBeenCalled()
  })
})
