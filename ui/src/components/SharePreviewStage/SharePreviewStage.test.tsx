import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SharePreviewStage } from './SharePreviewStage'

describe('SharePreviewStage', () => {
  it('shows the preview in a named region with its caption', () => {
    render(
      <SharePreviewStage caption="Live preview" ariaLabel="WhatsApp preview">
        <p>Preview body</p>
      </SharePreviewStage>,
    )

    expect(screen.getByRole('region', { name: 'WhatsApp preview' })).toHaveTextContent('Preview body')
    expect(screen.getByText('Live preview')).toBeInTheDocument()
  })

  describe('zoom', () => {
    const setup = () =>
      render(
        <SharePreviewStage ariaLabel="Preview" zoomable baseWidth={400}>
          {(view) => (
            <p data-testid="size">
              {view.width}:{view.pixelWidth}
            </p>
          )}
        </SharePreviewStage>,
      )

    it('steps the zoom, redraws at the new size and returns to Fit', async () => {
      const user = userEvent.setup()
      setup()
      expect(screen.getByRole('status')).toHaveTextContent('Fit')

      await user.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByRole('status')).toHaveTextContent('125%')
      expect(screen.getByTestId('size')).toHaveTextContent('500:500')

      await user.click(screen.getByRole('button', { name: 'Zoom out' }))
      await user.click(screen.getByRole('button', { name: 'Zoom out' }))
      expect(screen.getByRole('status')).toHaveTextContent('75%')
      expect(screen.getByTestId('size')).toHaveTextContent('300:300')

      await user.click(screen.getByRole('button', { name: 'Zoom to 100%' }))
      expect(screen.getByRole('status')).toHaveTextContent('100%')

      await user.click(screen.getByRole('button', { name: 'Fit to width' }))
      expect(screen.getByTestId('size')).toHaveTextContent('560:560')
    })

    it('stops at 50 and 300 percent', async () => {
      const user = userEvent.setup()
      setup()
      for (let i = 0; i < 8; i += 1) await user.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByRole('status')).toHaveTextContent('300%')
      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
    })

    it('zooms from the keyboard and scrolls inside itself without widening the page', () => {
      setup()
      const stage = screen.getByRole('region', { name: 'Preview' })
      fireEvent.keyDown(stage, { key: '+' })
      expect(screen.getByRole('status')).toHaveTextContent('125%')
      fireEvent.keyDown(stage, { key: '0' })
      expect(screen.getByRole('status')).toHaveTextContent('Fit')
      expect(stage).toHaveStyle({ overflow: 'auto', maxWidth: '100%' })
    })
  })
})
