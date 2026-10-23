import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WizardFooter } from './WizardFooter'

describe('WizardFooter', () => {
  it('renders back, save and primary actions and calls their handlers', async () => {
    const back = vi.fn()
    const save = vi.fn()
    const next = vi.fn()
    render(<WizardFooter back={{ label: 'Back', onClick: back }} secondary={{ label: 'Save draft', onClick: save }} primary={{ label: 'Next: Toss', onClick: next }} note="Note" />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next: Toss' }))
    expect([back, save, next].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1])
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('honours disabled and omits absent actions', () => {
    render(<WizardFooter primary={{ label: 'Publish', onClick: () => {}, disabled: true }} />)
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })
})
