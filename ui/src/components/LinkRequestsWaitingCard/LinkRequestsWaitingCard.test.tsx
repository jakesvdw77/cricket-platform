import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LinkRequestsWaitingCard } from './LinkRequestsWaitingCard'

const renderCard = (waiting: number | undefined) =>
  render(
    <MemoryRouter>
      <LinkRequestsWaitingCard waiting={waiting} />
    </MemoryRouter>,
  )

describe('LinkRequestsWaitingCard', () => {
  it('shows the count and a Review requests link', () => {
    renderCard(2)
    expect(screen.getByText('2 link requests waiting')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review requests' })).toHaveAttribute('href', '/manage/permissions/player-accounts')
  })

  it('renders nothing at zero or while loading', () => {
    const { container } = renderCard(0)
    expect(container).toBeEmptyDOMElement()
    const loading = renderCard(undefined)
    expect(loading.container).toBeEmptyDOMElement()
  })
})
