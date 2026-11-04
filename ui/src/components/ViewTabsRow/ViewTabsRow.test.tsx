import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ViewTabsRow } from './ViewTabsRow'

const tabs = [
  { value: 'one', label: 'One', to: '/one' },
  { value: 'two', label: 'Two', to: '/two' },
]

describe('ViewTabsRow', () => {
  it('is a nav landmark with the active tab marked current', () => {
    render(
      <MemoryRouter>
        <ViewTabsRow aria-label="Views" value="two" tabs={tabs} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('tab', { name: 'One' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('href', '/one')
  })

  it('renders its actions on the same row', () => {
    render(
      <MemoryRouter>
        <ViewTabsRow aria-label="Views" value="one" tabs={tabs}>
          <button type="button">Jump</button>
        </ViewTabsRow>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Views' })).toContainElement(screen.getByRole('button', { name: 'Jump' }))
  })
})
