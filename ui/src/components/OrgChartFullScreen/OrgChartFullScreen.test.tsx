import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgChartFullScreen } from './OrgChartFullScreen'

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <OrgChartFullScreen
      open={open}
      onClose={() => {
        onClose()
        setOpen(false)
      }}
      title="Club structure"
    >
      <div>The chart</div>
    </OrgChartFullScreen>
  )
}

describe('OrgChartFullScreen', () => {
  it('renders nothing while closed', () => {
    render(
      <OrgChartFullScreen open={false} onClose={() => undefined} title="Club structure">
        <div>The chart</div>
      </OrgChartFullScreen>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a dialog named by its title, with the chart, in Fit mode at 100 percent', () => {
    render(<Harness />)
    expect(screen.getByRole('dialog', { name: 'Club structure' })).toBeInTheDocument()
    expect(screen.getByText('The chart')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('100%')
  })

  it('zooms in and out by 10 percent and leaves Fit mode', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('110%')
    expect(screen.getByTestId('org-chart-full-screen-canvas')).toHaveStyle({ transform: 'scale(1.1)' })
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('90%')
  })

  it('disables zoom out at 50 percent and zoom in at 200 percent', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    }
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('50%')
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled()

    for (let i = 0; i < 15; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('200%')
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
  })

  it('Fit to screen returns to the fit scale', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await user.click(screen.getByRole('button', { name: 'Fit to screen' }))
    expect(screen.getByTestId('zoom-percent')).toHaveTextContent('100%')
  })

  it('closes with the Close button and with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()

    const onClose2 = vi.fn()
    render(<Harness onClose={onClose2} />)
    await user.keyboard('{Escape}')
    expect(onClose2).toHaveBeenCalledTimes(1)
  })
})
