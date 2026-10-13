import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageNav } from './PageNav'

describe('PageNav', () => {
  it('shows the page position and steps to the next and previous pages', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<PageNav page={1} totalPages={3} onPageChange={onPageChange} />)

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenLastCalledWith(0)
  })

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<PageNav page={0} totalPages={2} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    rerender(<PageNav page={1} totalPages={2} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('renders nothing for a single page', () => {
    const { container } = render(<PageNav page={0} totalPages={1} onPageChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
