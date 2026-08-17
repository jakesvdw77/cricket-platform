import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders the current year and default product name', () => {
    render(<Footer />)

    const year = new Date().getFullYear()
    expect(screen.getByText(`© ${year} Cricket Legend Platform`)).toBeInTheDocument()
  })

  it('accepts a custom product name', () => {
    render(<Footer productName="Riverside CC" />)

    expect(screen.getByText(/Riverside CC/)).toBeInTheDocument()
  })
})
