import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceTile } from './ChoiceTile'

describe('ChoiceTile', () => {
  it('shows the label and description and calls onClick', async () => {
    const onClick = vi.fn()
    render(<ChoiceTile icon={<span />} label="Squad Poll" description="Ask one squad." onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: /Squad Poll/ }))
    expect(screen.getByText('Ask one squad.')).toBeInTheDocument()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<ChoiceTile icon={<span />} label="Copy" description="d" onClick={onClick} disabled />)
    const tile = screen.getByRole('button', { name: /Copy/ })
    expect(tile).toBeDisabled()
    fireEvent.click(tile)
    expect(onClick).not.toHaveBeenCalled()
  })
})
