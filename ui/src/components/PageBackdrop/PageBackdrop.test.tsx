import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageBackdrop } from './PageBackdrop'

describe('PageBackdrop', () => {
  it('renders its children over decorative, aria-hidden art', () => {
    render(<PageBackdrop>Hello</PageBackdrop>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByTestId('page-backdrop').querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })

  it('draws the supplied photo behind an overlay', () => {
    render(<PageBackdrop imageUrl="/x.jpg">Hi</PageBackdrop>)
    const art = screen.getByTestId('page-backdrop').querySelectorAll('[data-backdrop-art]')
    expect(art).toHaveLength(2)
  })
})
