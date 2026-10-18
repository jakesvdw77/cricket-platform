import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { FacebookPostPreview } from './FacebookPostPreview'
import { WhatsAppPhonePreview } from './WhatsAppPhonePreview'

const file = new File(['png'], 'result.png', { type: 'image/png' })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:result')
  URL.revokeObjectURL = vi.fn()
})

function renderWith(element: React.ReactElement) {
  return render(<ThemeProvider theme={baseTheme}>{element}</ThemeProvider>)
}

describe('WhatsAppPhonePreview', () => {
  it('shows the generated image and the editable text in the bubble when attached', () => {
    renderWith(<WhatsAppPhonePreview clubName="Riverside" text="Hello" onTextChange={() => {}} attachImage image={file} />)

    expect(screen.getByText('Riverside · Everyone')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Result image attached to the message' })).toHaveAttribute('src', 'blob:result')
    expect(screen.getByRole('textbox', { name: 'Message text' })).toHaveValue('Hello')
  })

  it('shows no image when attach is off and a generic header without a club name', () => {
    renderWith(<WhatsAppPhonePreview clubName={null} text="Hello" onTextChange={() => {}} attachImage={false} image={file} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Share preview · Everyone')).toBeInTheDocument()
  })
})

describe('FacebookPostPreview', () => {
  it('shows the club, the image and the action row when attached', () => {
    renderWith(<FacebookPostPreview clubName="Riverside" text="Won!" onTextChange={() => {}} attachImage image={file} />)

    expect(screen.getByText('Just now')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Result image attached to the post' })).toHaveAttribute('src', 'blob:result')
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('Won!')
    expect(screen.getByText('Like')).toBeInTheDocument()
  })

  it('shows no image when attach is off', () => {
    renderWith(<FacebookPostPreview clubName="Riverside" text="Won!" onTextChange={() => {}} attachImage={false} image={file} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
