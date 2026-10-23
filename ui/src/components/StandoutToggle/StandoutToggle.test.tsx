import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StandoutToggle } from './StandoutToggle'
import { StandoutHeader } from './StandoutHeader'

describe('StandoutToggle', () => {
  it('is pressed for a suggested row and a tap writes HIDE', async () => {
    const onChange = vi.fn()
    render(<StandoutToggle suggested override={null} onChange={onChange} playerLabel="A. Smith" />)

    const star = screen.getByRole('button', { name: 'Featured, A. Smith' })
    expect(star).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(star)
    expect(onChange).toHaveBeenCalledWith('HIDE')
  })

  it('a tap on an unfeatured row writes FEATURE, and on a hidden suggestion returns to null', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<StandoutToggle suggested={false} override={null} onChange={onChange} playerLabel="B. Jones" />)
    expect(screen.getByRole('button', { name: 'Featured, B. Jones' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Featured, B. Jones' }))
    expect(onChange).toHaveBeenLastCalledWith('FEATURE')

    rerender(<StandoutToggle suggested override="HIDE" onChange={onChange} playerLabel="B. Jones" />)
    expect(screen.getByRole('button', { name: 'Featured, B. Jones' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Featured, B. Jones' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('is read-only on a published result: no button, the frozen flag in the name', () => {
    const onChange = vi.fn()
    render(<StandoutToggle suggested override={null} onChange={onChange} playerLabel="A. Smith" readOnly />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Featured, A. Smith: yes' })).toBeInTheDocument()
  })
})

describe('StandoutHeader', () => {
  it('names the star column and carries the help text', () => {
    render(<StandoutHeader />)
    expect(screen.getByTestId('standout-header')).toHaveAttribute('title', expect.stringContaining('Tap a star to remove or add one'))
    expect(screen.getByLabelText('Standout')).toBeInTheDocument()
  })
})
