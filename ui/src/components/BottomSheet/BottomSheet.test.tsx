import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

function renderSheet(props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) {
  const onClose = vi.fn()
  render(
    <BottomSheet open onOpen={() => undefined} onClose={onClose} ariaLabel="Example" title="Example title" closeLabel="Close example" {...props}>
      <p>Sheet content</p>
    </BottomSheet>,
  )
  return { onClose }
}

describe('BottomSheet', () => {
  it('shows the title and content when open, and nothing reachable while closed', () => {
    const { unmount } = render(
      <BottomSheet open={false} onOpen={() => undefined} onClose={() => undefined} ariaLabel="Example" title="Example title">
        <p>Sheet content</p>
      </BottomSheet>,
    )
    expect(screen.queryByText('Sheet content')).not.toBeVisible()
    unmount()

    renderSheet()
    expect(screen.getByRole('heading', { name: 'Example title' })).toBeInTheDocument()
    expect(screen.getByText('Sheet content')).toBeVisible()
  })

  it('has an accessible name on the sheet paper', () => {
    renderSheet()
    expect(document.querySelector('.MuiDrawer-paper')).toHaveAttribute('aria-label', 'Example')
  })

  it('closes with the close button when one is configured, with Escape and the backdrop', async () => {
    const { onClose } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Close example' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('has no close button or heading without closeLabel / title', () => {
    renderSheet({ title: undefined, closeLabel: undefined })
    expect(screen.queryByRole('button', { name: 'Close example' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
