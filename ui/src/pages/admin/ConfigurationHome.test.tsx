import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ConfigurationHome from './ConfigurationHome'

const EXPECTED_CARDS: Array<{ title: string; to: string }> = [
  { title: 'Products', to: '/admin/configuration/products' },
  { title: 'Subscriptions', to: '/admin/configuration/subscriptions' },
  { title: 'Discounts & Promotions', to: '/admin/configuration/discounts' },
  { title: 'Invoicing', to: '/admin/configuration/invoicing' },
  { title: 'System Settings', to: '/admin/configuration/settings' },
]

describe('ConfigurationHome', () => {
  it('renders all 5 cards with the correct navigation targets', () => {
    render(
      <MemoryRouter initialEntries={['/admin/configuration']}>
        <ConfigurationHome />
      </MemoryRouter>,
    )

    EXPECTED_CARDS.forEach(({ title, to }) => {
      const link = screen.getByRole('link', { name: new RegExp(title) })
      expect(link).toHaveAttribute('href', to)
    })
  })
})
