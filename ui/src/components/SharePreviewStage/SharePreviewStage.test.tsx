import { render, screen } from '@testing-library/react'
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
})
