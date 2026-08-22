import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ConfigurationHome from './ConfigurationHome'

const EXPECTED_CARDS: Array<{ title: string; to: string }> = [
  { title: 'Products', to: '/admin/configuration/products' },
  { title: 'Email', to: '/admin/configuration/email' },
  { title: 'Discounts & Promotions', to: '/admin/configuration/discounts' },
  { title: 'Invoicing', to: '/admin/configuration/invoicing' },
  { title: 'System Settings', to: '/admin/configuration/settings' },
]

describe('ConfigurationHome', () => {
  it('renders all 5 cards with the correct navigation targets, no longer including Subscriptions (promoted to its own top-level nav item)', () => {
    render(
      <MemoryRouter initialEntries={['/admin/configuration']}>
        <ConfigurationHome />
      </MemoryRouter>,
    )

    EXPECTED_CARDS.forEach(({ title, to }) => {
      const link = screen.getByRole('link', { name: new RegExp(title) })
      expect(link).toHaveAttribute('href', to)
    })
    expect(screen.queryByRole('link', { name: /Subscriptions/ })).not.toBeInTheDocument()
  })
})
