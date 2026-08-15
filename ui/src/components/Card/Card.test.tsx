import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders a title and its content', () => {
    render(<Card title="Season 2026">Riverside CC · Open 1st XI</Card>)

    expect(screen.getByRole('heading', { name: 'Season 2026' })).toBeInTheDocument()
    expect(screen.getByText('Riverside CC · Open 1st XI')).toBeInTheDocument()
  })

  it('renders a footer when provided', () => {
    render(<Card footer={<span>Updated today</span>}>Content</Card>)

    expect(screen.getByText('Updated today')).toBeInTheDocument()
  })
})
