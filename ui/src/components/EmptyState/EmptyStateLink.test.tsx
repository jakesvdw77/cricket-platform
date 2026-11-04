import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'
import { EmptyStateLink } from './EmptyStateLink'

describe('EmptyStateLink', () => {
  it('is the empty state action: an underlined link-styled button that calls onClick', async () => {
    const onClick = vi.fn()
    render(<EmptyState title="No seasons yet" action={<EmptyStateLink onClick={onClick}>Add Season</EmptyStateLink>} />)
    const link = screen.getByRole('button', { name: 'Add Season' })
    await userEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
