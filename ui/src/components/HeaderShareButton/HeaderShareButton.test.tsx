import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderShareButton } from './HeaderShareButton'

describe('HeaderShareButton', () => {
  it('is an outlined Share button that runs its action', async () => {
    const onClick = vi.fn()
    render(<HeaderShareButton onClick={onClick} testId="x" />)
    const button = screen.getByRole('button', { name: 'Share' })
    expect(button).toHaveAttribute('data-testid', 'x')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is 32 px high like the Manage button beside it', () => {
    render(<HeaderShareButton onClick={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Share' })).toHaveStyle({ minHeight: '32px' })
  })
})
