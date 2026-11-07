import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHubScope } from './HubScopeControls'
import { filtersWithOneChoice } from '../../../test/statsPageTestUtils'
import { makeResultFilters } from '../../../test/statsFixtures'
import type { MyResultFilters } from '../../../api/meResultsApi'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/147: the scope controls extracted from Results. Results keeps its behaviour (Filters only when there is a choice); the Stats pages pass
// alwaysShowFilters so the button is there even for a one-league, one-team player.
function Harness({ filters, always }: { filters: MyResultFilters; always?: boolean }) {
  const controls = useHubScope({ playerKey: 'k1', storageKey: 'test:scope', filters, alwaysShowFilters: always })
  return <div>{controls.actions}<span data-testid="has-choice">{String(controls.hasChoice)}</span></div>
}
const renderHarness = (props: { filters: MyResultFilters; always?: boolean }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><Harness {...props} /></MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => localStorage.clear())

describe('useHubScope Filters button', () => {
  it('is hidden on Results when the player has one league and one team to choose from', () => {
    renderHarness({ filters: filtersWithOneChoice() })
    expect(screen.getByTestId('has-choice')).toHaveTextContent('false')
    expect(screen.queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
  })

  it('is shown on Results as soon as there is a choice of team', () => {
    renderHarness({ filters: makeResultFilters() })
    expect(screen.getByTestId('has-choice')).toHaveTextContent('true')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
  })

  it('is always shown when alwaysShowFilters is set, as on the Stats pages', () => {
    renderHarness({ filters: filtersWithOneChoice(), always: true })
    expect(screen.getByTestId('has-choice')).toHaveTextContent('false')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
  })
})
