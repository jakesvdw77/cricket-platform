import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareFormatScreen } from './ShareFormatScreen'

describe('ShareFormatScreen', () => {
  it('shows the title, the controls, the preview and the actions', () => {
    render(
      <ShareFormatScreen
        title="WhatsApp"
        controls={<p>Controls here</p>}
        preview={<p>Preview here</p>}
        actions={<button type="button">Copy text</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'WhatsApp' })).toBeInTheDocument()
    expect(screen.getByText('Controls here')).toBeInTheDocument()
    expect(screen.getByText('Preview here')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument()
  })
})
