import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { editKeyHandler } from './editKeyHandler'

function setup() {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <div onKeyDown={editKeyHandler(onSave, onCancel)}>
      <input aria-label="field" />
      <button type="button">Other</button>
    </div>,
  )
  return { onSave, onCancel }
}

describe('editKeyHandler', () => {
  it('Enter in an input saves and Escape cancels', () => {
    const { onSave, onCancel } = setup()
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('leaves Enter on a button to the button, and ignores other keys', () => {
    const { onSave, onCancel } = setup()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Other' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'a' })
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Escape cancels even from a button', () => {
    const { onCancel } = setup()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Other' }), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
