import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { HubClubInfo } from './HubClubInfo'
import { httpError, renderRoutes, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { makeClubInfo, makeContact, makeContactPage } from '../../../test/clubInfoFixtures'
import { LocationProbe } from '../../../test/LocationProbe'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/148: the Club info page shows the pills the server sent, selects one from ?tab=, and has a friendly empty state.
const http = api as unknown as ApiMock
const INFO = '/me/players/k1/club-info'

function show(entry: string, routes: Record<string, unknown>) {
  routeApi(http, { [`GET ${INFO}/contacts`]: makeContactPage([makeContact()]), ...routes })
  return renderRoutes(entry, <Route path="/info" element={<><HubClubInfo playerKey="k1" /><LocationProbe /></>} />)
}
const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent)

beforeEach(() => vi.clearAllMocks())

describe('HubClubInfo tabs', () => {
  it('draws only the tabs the server sent, with counts where the server gave a number', async () => {
    show('/info', { [`GET ${INFO}`]: makeClubInfo({ tabs: [{ id: 'about', count: null }, { id: 'links', count: 2 }] }) })

    await screen.findByRole('tab', { name: /About/ })
    expect(tabNames()).toEqual(['About', 'Links2'])
    expect(screen.queryByRole('tab', { name: /Contacts/ })).not.toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Club info sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /About/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('hub-club-about')).toBeInTheDocument()
  })

  it('uses ?tab= to select a tab and writes the choice back to the url', async () => {
    const user = userEvent.setup()
    show('/info?tab=links', { [`GET ${INFO}`]: makeClubInfo() })

    expect(await screen.findByTestId('hub-club-links')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Links/ })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: /About/ }))
    expect(await screen.findByTestId('hub-club-about')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('tab=about')
  })

  it('falls back to the first visible tab for an unknown value, or for a tab the server did not send', async () => {
    const { unmount } = show('/info?tab=nonsense', { [`GET ${INFO}`]: makeClubInfo() })
    expect(await screen.findByTestId('hub-club-about')).toBeInTheDocument()
    unmount()

    show('/info?tab=contacts', { [`GET ${INFO}`]: makeClubInfo({ tabs: [{ id: 'links', count: 2 }] }) })
    expect(await screen.findByTestId('hub-club-links')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Links/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the club name beside the Club Info heading', async () => {
    show('/info', { [`GET ${INFO}`]: makeClubInfo() })

    expect(await screen.findByText('Riverside CC', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Club Info' })).toBeInTheDocument()
  })
})

describe('HubClubInfo states', () => {
  it('has a friendly empty state when the server sent no tabs', async () => {
    show('/info', { [`GET ${INFO}`]: makeClubInfo({ tabs: [], about: null, links: null, logos: null, directory: null }) })

    const empty = await screen.findByTestId('club-info-empty')
    expect(empty).toHaveTextContent('Nothing to Show Yet')
    expect(empty).toHaveTextContent('The club has not shared its details here yet. Check back soon.')
    expect(empty).not.toHaveTextContent(/none yet/i)
    expect(empty).not.toHaveTextContent(/\byou(r)?\b/i)
    expect(empty.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('shows a loading placeholder before the answer', () => {
    routeApi(http, { [`GET ${INFO}`]: new Promise(() => undefined) })
    http.get.mockImplementation(() => new Promise(() => undefined))
    renderRoutes('/info', <Route path="/info" element={<HubClubInfo playerKey="k1" />} />)

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByTestId('club-info-empty')).not.toBeInTheDocument()
  })

  it('shows an error with Retry that asks again', async () => {
    const user = userEvent.setup()
    show('/info', { [`GET ${INFO}`]: httpError(500) })

    expect(await screen.findByText('We could not load the club details. Please try again.')).toBeInTheDocument()
    routeApi(http, { [`GET ${INFO}`]: makeClubInfo({ tabs: [{ id: 'about', count: null }] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByTestId('hub-club-about')).toBeInTheDocument())
  })
})
