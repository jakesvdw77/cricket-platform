import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TestimonialCard } from './TestimonialCard'

describe('TestimonialCard', () => {
  it('renders the quote and attribution', () => {
    render(<TestimonialCard quote="Great platform." name="Riaan Coetzee" role="Chairman, Riverside CC" />)

    expect(screen.getByText('Great platform.')).toBeInTheDocument()
    expect(screen.getByText('Riaan Coetzee')).toBeInTheDocument()
    expect(screen.getByText('Chairman, Riverside CC')).toBeInTheDocument()
  })

  it('falls back to initials when no avatar is supplied', () => {
    render(<TestimonialCard quote="No avatar here." name="Sarah Mokoena" role="Fixtures Secretary" />)

    expect(screen.getByText('SM')).toBeInTheDocument()
  })
})
