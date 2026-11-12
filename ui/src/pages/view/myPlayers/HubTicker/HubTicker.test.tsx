import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocationProbe } from '../../../../test/LocationProbe'
import { item, SYNTHETIC_KINDS } from '../../../../test/tickerFixtures'
import { TICKER_STATIC_MS, TICKER_TOUCH_GRACE_MS } from '../tickerConfig'
import type { TickerItem } from '../tickerTypes'
import { TICKER_SPEED_PX_PER_S } from '../tickerConfig'
import { HubTicker } from './HubTicker'

// docs/specs/146 section 6 and 7: the strip. It renders what it is given; these tests never touch a source.
const BASE = '/account/players/k1'
const items = (): TickerItem[] => [
  item('result', 'r1', { parts: [{ type: 'strong', text: 'Villagers' }, { type: 'text', text: ' beat ' }, { type: 'strong', text: 'Rovers' }, { type: 'muted', text: 'Over 40, Sat' }], to: `${BASE}/results/r1` }),
  item('live', 'm1', { parts: [{ type: 'strong', text: 'Villagers v Rovers' }, { type: 'muted', text: 'Started 20m ago' }], to: `${BASE}/schedule/matches/m1`, pinned: true }),
  item('upcoming', 'u1', { parts: [{ type: 'strong', text: 'Villagers v Eagles' }], to: `${BASE}/schedule/matches/u1` }),
  item('poll', 'p1', { parts: [{ type: 'text', text: 'Availability for ' }, { type: 'strong', text: 'Saturday' }], to: `${BASE}/availability` }),
]

function show(list: TickerItem[] = items(), props: { kinds?: typeof SYNTHETIC_KINDS } = {}) {
  return render(
    <MemoryRouter initialEntries={[`${BASE}/availability`]}>
      <HubTicker items={list} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const strip = () => screen.getByTestId('hub-ticker')
const viewport = () => screen.getByTestId('ticker-viewport')

function reducedMotion(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the accessible list', () => {
  it('renders the cycle once as a list of links and a hidden duplicate with no tab stops', () => {
    show()
    const list = screen.getByRole('list', { name: 'Scoreboard ticker' })
    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.getAttribute('data-to'))).toEqual([`${BASE}/results/r1`, `${BASE}/schedule/matches/m1`, `${BASE}/schedule/matches/u1`, `${BASE}/availability`])
    const copy = screen.getByTestId('ticker-copy')
    expect(copy).toHaveAttribute('aria-hidden', 'true')
    const copied = Array.from(copy.querySelectorAll('[data-testid="ticker-link"]'))
    expect(copied).toHaveLength(4)
    for (const link of copied) expect(link).toHaveAttribute('tabindex', '-1')
    // Assistive technology meets each item once.
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('names each link with the chip word and the sentence, and has no live region', () => {
    show()
    expect(screen.getByRole('link', { name: 'Result: Villagers beat Rovers, Over 40, Sat' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Live: Villagers v Rovers, Started 20m ago' })).toBeInTheDocument()
    expect(strip().querySelector('[aria-live]')).toBeNull()
    expect(strip().querySelector('[role="status"], [role="alert"]')).toBeNull()
  })

  it('shows a type chip on every item, with a pulse on Live', () => {
    show()
    expect(within(screen.getByTestId('ticker-list')).getAllByTestId('ticker-chip').map((chip) => chip.textContent)).toEqual(['Result', 'Live', 'Next', 'Poll'])
    expect(within(screen.getByTestId('ticker-list')).getAllByTestId('pulse-dot')).toHaveLength(1)
  })

  it('renders nothing for an empty list and skips an item of a kind it has no rules for', () => {
    const { container } = show([])
    expect(container.querySelector('[data-testid="hub-ticker"]')).toBeNull()
    show([item('birthday', 'b1'), item('result', 'r1')])
    expect(within(screen.getByTestId('ticker-list')).getAllByRole('link')).toHaveLength(1)
  })

  it('renders an item without a link as plain text', () => {
    show([item('result', 'r1'), item('funFact', 'f1', { to: null, parts: [{ type: 'text', text: 'A fun fact' }] })], { kinds: SYNTHETIC_KINDS })
    const list = screen.getByTestId('ticker-list')
    expect(within(list).getAllByRole('link')).toHaveLength(1)
    expect(within(list).getByText('A fun fact')).not.toHaveAttribute('href')
  })

  it('opens the page an item came from', async () => {
    show()
    await userEvent.click(screen.getByRole('link', { name: /^Result:/ }))
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/results/r1`)
  })

  it('never lets Tab reach the duplicate copy', async () => {
    show()
    const user = userEvent.setup()
    const reached: Element[] = []
    for (let step = 0; step < 6; step++) {
      await user.tab()
      reached.push(document.activeElement as Element)
    }
    const copy = screen.getByTestId('ticker-copy')
    expect(reached.some((element) => copy.contains(element))).toBe(false)
    expect(reached.filter((element) => element.getAttribute('data-testid') === 'ticker-link')).toHaveLength(4)
    expect(reached.some((element) => element.getAttribute('aria-label') === 'Pause Ticker')).toBe(true)
  })
})

describe('pausing', () => {
  it('pauses on hover and resumes on leave', async () => {
    show()
    expect(strip()).toHaveAttribute('data-paused', 'false')
    expect(screen.getByTestId('ticker-track').style.animationPlayState).toBe('running')
    await userEvent.hover(viewport())
    expect(strip()).toHaveAttribute('data-paused', 'true')
    expect(screen.getByTestId('ticker-track').style.animationPlayState).toBe('paused')
    await userEvent.unhover(viewport())
    expect(strip()).toHaveAttribute('data-paused', 'false')
  })

  it('pauses on a held touch and resumes a grace period after it lifts', () => {
    vi.useFakeTimers()
    show()
    fireEvent.touchStart(viewport())
    expect(strip()).toHaveAttribute('data-paused', 'true')
    fireEvent.touchEnd(viewport())
    act(() => void vi.advanceTimersByTime(TICKER_TOUCH_GRACE_MS - 100))
    expect(strip()).toHaveAttribute('data-paused', 'true')
    act(() => void vi.advanceTimersByTime(200))
    expect(strip()).toHaveAttribute('data-paused', 'false')
  })

  it('pauses while keyboard focus is on an item and resumes when it leaves', async () => {
    show()
    const user = userEvent.setup()
    await user.tab()
    expect(strip()).toHaveAttribute('data-paused', 'true')
    await user.tab({ shift: true })
    expect(strip()).toHaveAttribute('data-paused', 'false')
  })

  it('has a Pause button that toggles aria-pressed and its name', async () => {
    show()
    const button = screen.getByRole('button', { name: 'Pause Ticker' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(strip()).toHaveAttribute('data-paused', 'true')
    const play = screen.getByRole('button', { name: 'Play Ticker' })
    expect(play).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(play)
    expect(screen.getByRole('button', { name: 'Pause Ticker' })).toHaveAttribute('aria-pressed', 'false')
    expect(strip()).toHaveAttribute('data-paused', 'false')
  })

  it('keeps the Pause button a 44 px target', () => {
    show()
    expect(getComputedStyle(screen.getByRole('button', { name: 'Pause Ticker' })).width).toBe('44px')
  })
})

describe('layout', () => {
  function measured(cycle: number, view: number) {
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
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(cycle)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(view)
  }

  it('scrolls (a marquee, the cycle twice) when the cycle is wider than the strip', () => {
    measured(2000, 600)
    show()
    expect(strip()).toHaveAttribute('data-mode', 'marquee')
    expect(screen.getByTestId('ticker-track')).toBeInTheDocument()
    expect(screen.getByTestId('ticker-copy')).toBeInTheDocument()
  })

  it('does not scroll when the whole cycle fits: centred, no duplicate, no animation', () => {
    measured(400, 900)
    show()
    expect(strip()).toHaveAttribute('data-mode', 'static')
    expect(screen.queryByTestId('ticker-track')).toBeNull()
    expect(screen.queryByTestId('ticker-copy')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Pause Ticker' })).toBeInTheDocument()
  })

  it('moves a focused item into view by setting the paused animation to where the item starts', () => {
    measured(2000, 400)
    show()
    const animation = { currentTime: 0 }
    const track = screen.getByTestId('ticker-track') as unknown as { getAnimations: () => unknown[] }
    track.getAnimations = () => [animation]
    const link = screen.getAllByRole('link')[2]
    vi.spyOn(viewport(), 'getBoundingClientRect').mockReturnValue({ left: 0, right: 400, top: 0, bottom: 56, width: 400, height: 56, x: 0, y: 0, toJSON: () => ({}) })
    vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({ left: 900, right: 1200, top: 0, bottom: 56, width: 300, height: 56, x: 900, y: 0, toJSON: () => ({}) })
    Object.defineProperty(link, 'offsetLeft', { value: 900, configurable: true })
    act(() => link.focus())
    // (900 - 70 px fade) / 2000 px cycle of the duration (2000 / TICKER_SPEED_PX_PER_S s).
    expect(animation.currentTime).toBeCloseTo((830 / 2000) * (2000 / TICKER_SPEED_PX_PER_S) * 1000)
  })
})

describe('reduced motion', () => {
  it('shows one item at a time, centred, with all of them in the list', () => {
    reducedMotion(true)
    show()
    expect(strip()).toHaveAttribute('data-mode', 'rotate')
    expect(screen.queryByTestId('ticker-track')).toBeNull()
    const entries = within(screen.getByTestId('ticker-list')).getAllByRole('listitem')
    expect(entries).toHaveLength(4)
    expect(entries.map((entry) => entry.dataset.current)).toEqual(['true', 'false', 'false', 'false'])
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('changes item every TICKER_STATIC_MS with no transition, and can step and pause', async () => {
    reducedMotion(true)
    vi.useFakeTimers()
    show()
    const current = () => within(screen.getByTestId('ticker-list')).getAllByRole('listitem').findIndex((entry) => entry.dataset.current === 'true')
    expect(current()).toBe(0)
    act(() => void vi.advanceTimersByTime(TICKER_STATIC_MS))
    expect(current()).toBe(1)
    act(() => void vi.advanceTimersByTime(TICKER_STATIC_MS))
    expect(current()).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: 'Next Item' }))
    expect(current()).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Next Item' }))
    expect(current()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Previous Item' }))
    expect(current()).toBe(3)

    fireEvent.click(screen.getByRole('button', { name: 'Pause Ticker' }))
    act(() => void vi.advanceTimersByTime(TICKER_STATIC_MS * 3))
    expect(current()).toBe(3)
  })

  it('pauses the rotation on hover, and keeps the live pulse dot (which stands still by its own media query)', async () => {
    reducedMotion(true)
    vi.useFakeTimers()
    show()
    fireEvent.pointerEnter(viewport())
    act(() => void vi.advanceTimersByTime(TICKER_STATIC_MS * 2))
    expect(within(screen.getByTestId('ticker-list')).getAllByRole('listitem')[0].dataset.current).toBe('true')
    expect(screen.getAllByTestId('pulse-dot')).toHaveLength(1)
  })

  it('shows Previous and Next only under reduced motion', () => {
    show()
    expect(screen.queryByRole('button', { name: 'Next Item' })).toBeNull()
  })
})

describe('later kinds', () => {
  // The contract needs no change to the strip: synthetic message, sponsor, milestone, standing, birthday, weather, on this day and fun fact.
  it('renders items of kinds it was never written for, given their rules', () => {
    const kinds = {
      ...SYNTHETIC_KINDS,
      milestone: { label: 'Milestone', tone: 'win', defaultWeight: 1, maxPerCycle: 2 },
      standing: { label: 'Table', tone: 'next', defaultWeight: 1, maxPerCycle: 1 },
      birthday: { label: 'Birthday', tone: 'message', defaultWeight: 1, maxPerCycle: 1 },
      weather: { label: 'Weather', tone: 'next', defaultWeight: 1, maxPerCycle: 1 },
      onThisDay: { label: 'History', tone: 'info', defaultWeight: 1, maxPerCycle: 1 },
    } as const
    const later: TickerItem[] = [
      item('message', 'a', { parts: [{ type: 'text', text: 'Nets moved to 5pm' }] }),
      item('sponsor', 'b', { parts: [{ type: 'plate', text: 'Acme Hardware', logoUrl: 'https://example.com/logo.png' }, { type: 'muted', text: 'Proud sponsor' }], to: null }),
      item('milestone', 'c'),
      item('standing', 'd'),
      item('birthday', 'e'),
      item('weather', 'f'),
      item('onThisDay', 'g'),
      item('funFact', 'h', { to: null }),
    ]
    show(later, { kinds })
    expect(within(screen.getByTestId('ticker-list')).getAllByTestId('ticker-chip').map((chip) => chip.textContent)).toEqual(['Message', 'Sponsor', 'Milestone', 'Table', 'Birthday', 'Weather', 'History', 'Did You Know'])
    expect(within(screen.getByTestId('ticker-list')).getByText('Acme Hardware')).toBeInTheDocument()
  })
})
