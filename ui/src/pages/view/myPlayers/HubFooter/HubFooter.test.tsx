import { useState } from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { calls, renderWithProviders, routeApi } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { pollRow, resultRow, item } from '../../../../test/tickerFixtures'
import { HubFooterButton } from '../HubFrame'
import { writeHubFlag } from '../hubPreferences'
import { HubFooter } from './HubFooter'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/146 section 8 to 10: the footer band: Back at the left, the ticker filling the rest, and today's footer whenever the
// ticker has nothing to show or must be hidden.
const http = api as unknown as ApiMock
const HUB = '/account/players/k1/availability'
const back = <HubFooterButton onClick={() => undefined}>Back to menu</HubFooterButton>
const items = () => [
  item('result', 'r1', { parts: [{ type: 'strong', text: 'Villagers' }], to: '/account/players/k1/results/r1' }),
  item('poll', 'p1', { parts: [{ type: 'text', text: 'Poll text' }], to: '/account/players/k1/availability' }),
]
const footer = () => screen.queryByTestId('hub-footer')
const isoDaysAgo = (days: number) => {
  const day = new Date(Date.now() - days * 86_400_000)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  routeApi(http, {})
})
afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('with items given', () => {
  it('puts Back at the left and the ticker beside it', () => {
    renderWithProviders(<HubFooter back={back} fill items={items()} />, HUB)
    const band = within(footer() as HTMLElement)
    expect(band.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
    expect(band.getByRole('list', { name: 'Scoreboard ticker' })).toBeInTheDocument()
    const back$ = screen.getByTestId('hub-footer-back')
    const slot = screen.getByTestId('hub-footer-ticker')
    expect(back$.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(back$).toContainElement(screen.getByRole('button', { name: 'Back to menu' }))
  })

  it('does not capture Escape: the key still reaches the page handler that runs Back', async () => {
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey)
    renderWithProviders(<HubFooter back={back} fill items={items()} />, HUB)
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard('{Escape}')
    window.removeEventListener('keydown', onKey)
    const escape = onKey.mock.calls.map((call) => call[0] as KeyboardEvent).find((event) => event.key === 'Escape')
    expect(escape).toBeDefined()
    expect(escape?.defaultPrevented).toBe(false)
  })

  it('lets the ticker span the whole band when the page has no Back', () => {
    renderWithProviders(<HubFooter fill items={items()} />, HUB)
    expect(screen.getByRole('list', { name: 'Scoreboard ticker' })).toBeInTheDocument()
    expect(screen.queryByTestId('hub-footer-back')).toBeNull()
  })

  it('renders no footer with no items and no Back', () => {
    const { container } = renderWithProviders(<HubFooter fill items={[]} />, HUB)
    expect(container).toBeEmptyDOMElement()
  })

  it('is exactly today\'s footer with no items: just the Back button', () => {
    renderWithProviders(<HubFooter back={back} fill items={[]} />, HUB)
    expect(footer()).toHaveAttribute('data-ticker', 'false')
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByTestId('hub-footer-back')).toBeNull()
    expect(within(footer() as HTMLElement).getByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
    expect(getComputedStyle(footer() as HTMLElement).minHeight).toBe('56px')
  })

  it('keeps the 56 px band and the safe-area padding with the ticker', () => {
    renderWithProviders(<HubFooter back={back} fill items={items()} />, HUB)
    const row = (footer() as HTMLElement).firstElementChild as HTMLElement
    expect(getComputedStyle(row).minHeight).toBe('56px')
    const css = Array.from(document.querySelectorAll('style')).map((style) => style.textContent).join('\n')
    expect(css).toContain('env(safe-area-inset-bottom)')
  })

  it('hides the ticker when under 120 px is left for it', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: () => void) {}
        observe() {
          this.callback()
        }
        disconnect() {}
      },
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
    renderWithProviders(<HubFooter back={back} fill items={items()} />, HUB)
    expect(screen.queryByRole('list')).toBeNull()
    expect(footer()).toHaveAttribute('data-ticker', 'false')
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
  })

  it.each([
    ['Watch Live', '/account/players/k1/schedule/matches/m1/watch'],
    ['the account chooser', '/account'],
    ['Find Players', '/welcome'],
    ['the profile chooser', '/choose-profile'],
    ['an edit sub-view', '/account/players/k1/profile/contact/edit'],
    ['the agents edit view', '/account/players/k1/profile/agents/edit'],
  ])('is just the Back button on %s', (_name, path) => {
    renderWithProviders(<HubFooter back={back} fill items={items()} />, path)
    expect(screen.queryByRole('list')).toBeNull()
    expect(footer()).toHaveAttribute('data-ticker', 'false')
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
  })

  it('shows the ticker on the match page and the Results page', () => {
    renderWithProviders(<HubFooter back={back} fill items={items()} />, '/account/players/k1/schedule/matches/m1')
    expect(screen.getByRole('list', { name: 'Scoreboard ticker' })).toBeInTheDocument()
  })

  it('follows the preference at once, in the same tab', () => {
    renderWithProviders(<HubFooter back={back} fill items={items()} />, HUB)
    expect(screen.getByRole('list', { name: 'Scoreboard ticker' })).toBeInTheDocument()
    act(() => writeHubFlag('hub:ticker', false))
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByRole('button', { name: 'Back to menu' })).toBeInTheDocument()
    act(() => writeHubFlag('hub:ticker', true))
    expect(screen.getByRole('list', { name: 'Scoreboard ticker' })).toBeInTheDocument()
  })
})

describe('reading the three Hub reads', () => {
  const routes = () => ({
    'GET /me/players/k1/matches': { live: [], upcoming: [], recent: [] },
    'GET /me/players/k1/polls': [pollRow({ scheduledCloseAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), matchDate: isoDaysAgo(-3) })],
    'GET /me/players/k1/results': {
      scope: {},
      page: { number: 0, size: 20, totalElements: 1, hasMore: false },
      rows: [resultRow({ matchId: 'r9', matchDate: isoDaysAgo(2) })],
    },
  })

  it('shows what the reads return, as links to the pages they came from', async () => {
    routeApi(http, routes())
    renderWithProviders(<HubFooter back={back} fill />, HUB)
    const list = await screen.findByRole('list', { name: 'Scoreboard ticker' })
    const hrefs = within(list).getAllByRole('link').map((link) => link.getAttribute('href')).sort()
    expect(hrefs).toEqual(['/account/players/k1/availability', '/account/players/k1/results/r9'])
    expect(calls(http.get, '/me/players/k1/matches')).toHaveLength(1)
    expect(calls(http.get, '/me/players/k1/results')[0][1]).toMatchObject({ params: { page: 0 } })
  })

  it('is today\'s footer while the reads are loading or when they fail', async () => {
    routeApi(http, {})
    renderWithProviders(<HubFooter back={back} fill />, HUB)
    await waitFor(() => expect(http.get).toHaveBeenCalled())
    expect(screen.queryByRole('list')).toBeNull()
    expect(footer()).toHaveAttribute('data-ticker', 'false')
  })

  it('makes no request with the preference off', async () => {
    routeApi(http, routes())
    window.localStorage.setItem('hub:ticker', 'off')
    renderWithProviders(<HubFooter back={back} fill />, HUB)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(http.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('starts reading when the preference is switched on', async () => {
    routeApi(http, routes())
    window.localStorage.setItem('hub:ticker', 'off')
    renderWithProviders(<HubFooter back={back} fill />, HUB)
    expect(http.get).not.toHaveBeenCalled()
    act(() => writeHubFlag('hub:ticker', true))
    await screen.findByRole('list', { name: 'Scoreboard ticker' })
  })

  it.each([
    ['Watch Live', '/account/players/k1/schedule/matches/m1/watch'],
    ['a screen with no player', '/account'],
    ['an edit sub-view', '/account/players/k1/profile/contact/edit'],
  ])('makes no request on %s', async (_name, path) => {
    routeApi(http, routes())
    renderWithProviders(<HubFooter back={back} fill />, path)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(http.get).not.toHaveBeenCalled()
  })

  it('does not reorder on a re-render of the same page', async () => {
    routeApi(http, routes())
    function Harness() {
      const [count, setCount] = useState(0)
      return (
        <>
          <button onClick={() => setCount(count + 1)}>rerender {count}</button>
          <HubFooter back={back} fill />
        </>
      )
    }
    renderWithProviders(<Harness />, HUB)
    const list = await screen.findByRole('list', { name: 'Scoreboard ticker' })
    const first = within(list).getAllByRole('link').map((link) => link.getAttribute('href'))
    for (let step = 0; step < 4; step++) await userEvent.click(screen.getByRole('button', { name: /^rerender/ }))
    expect(within(screen.getByRole('list', { name: 'Scoreboard ticker' })).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(first)
  })
})
