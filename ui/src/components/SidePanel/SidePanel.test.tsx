import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SidePanel } from './SidePanel'

function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: !wide && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete window.matchMedia
})

function renderPanel(open = true, onClose = vi.fn()) {
  render(
    <SidePanel open={open} onClose={onClose} title="Polls" closeLabel="Close polls list">
      {(isPhone) => <div>{isPhone ? 'phone content' : 'desktop content'}</div>}
    </SidePanel>,
  )
  return onClose
}

describe('SidePanel', () => {
  it('is a right drawer with a title and close button from sm up', async () => {
    setViewport(true)
    const onClose = renderPanel()

    expect(screen.getByRole('presentation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Polls' })).toBeInTheDocument()
    expect(screen.getByText('desktop content')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close polls list' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    setViewport(true)
    const onClose = renderPanel()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('is a bottom sheet below sm and renders its content only while open', () => {
    setViewport(false)
    renderPanel()
    expect(screen.getByText('phone content')).toBeInTheDocument()
  })

  it('renders no content while closed on a phone', () => {
    setViewport(false)
    renderPanel(false)
    expect(screen.queryByText('phone content')).not.toBeInTheDocument()
  })

  it('renders nothing while closed on desktop', () => {
    setViewport(true)
    renderPanel(false)
    expect(screen.queryByText('desktop content')).not.toBeInTheDocument()
  })
})
