import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Countdown } from './Countdown'
import { describeCountdown } from './useCountdown'

const NOW = new Date('2030-06-01T08:00:00Z')
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function at(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString()
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  setHidden(false)
  vi.useRealTimers()
})

describe('Countdown wording', () => {
  it('shows days and hours while more than a day away, neutral', () => {
    render(<Countdown target={at(3 * DAY + 4 * HOUR + 30 * MIN)} phrase="left" />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('3 days 4 h left')
    expect(timer).toHaveAttribute('aria-label', 'Closes in 3 days 4 hours')
    expect(timer).toHaveAttribute('data-warn', 'false')
  })

  it('shows hours and minutes within a day, amber', () => {
    render(<Countdown target={at(5 * HOUR + 12 * MIN + 10_000)} phrase="left" />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('5 h 12 min left')
    expect(timer).toHaveAttribute('aria-label', 'Closes in 5 hours 12 minutes')
    expect(timer).toHaveAttribute('data-warn', 'true')
  })

  it('shows minutes only in the last hour', () => {
    render(<Countdown target={at(42 * MIN + 5000)} phrase="left" />)
    expect(screen.getByRole('timer')).toHaveTextContent('42 min left')
  })

  it('shows seconds in the last minute', () => {
    render(<Countdown target={at(45_000)} phrase="left" />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('45 s left')
    expect(timer).toHaveAttribute('aria-label', 'Closes in 45 seconds')
  })

  it('uses the singular for one day, hour, minute and second', () => {
    expect(describeCountdown(NOW.getTime() + DAY + HOUR, NOW.getTime()).spoken).toBe('1 day 1 hour')
    expect(describeCountdown(NOW.getTime() + DAY, NOW.getTime()).text).toBe('1 day')
    expect(describeCountdown(NOW.getTime() + HOUR + MIN, NOW.getTime()).spoken).toBe('1 hour 1 minute')
    expect(describeCountdown(NOW.getTime() + 1000, NOW.getTime()).spoken).toBe('1 second')
  })

  it("uses 'to go' and the 'Starts in' prefix for a starting countdown", () => {
    render(<Countdown target={at(2 * DAY + HOUR)} phrase="to go" ariaPrefix="Starts in" />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('2 days 1 h to go')
    expect(timer).toHaveAttribute('aria-label', 'Starts in 2 days 1 hour')
  })

  it('defaults the accessible prefix from the phrase', () => {
    render(<Countdown target={at(2 * HOUR + 30_000)} phrase="to go" />)
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Starts in 2 hours 0 minutes')
  })

  it('does not announce live updates', () => {
    render(<Countdown target={at(2 * HOUR)} phrase="left" />)
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live')
  })
})

describe('Countdown warning threshold', () => {
  it('turns amber exactly at warnWithinHours', () => {
    render(<Countdown target={at(24 * HOUR + 5 * MIN)} phrase="left" />)
    expect(screen.getByRole('timer')).toHaveAttribute('data-warn', 'false')
    act(() => {
      vi.advanceTimersByTime(5 * MIN + 100)
    })
    expect(screen.getByRole('timer')).toHaveAttribute('data-warn', 'true')
  })

  it('honours a custom threshold', () => {
    render(<Countdown target={at(5 * HOUR)} phrase="left" warnWithinHours={2} />)
    expect(screen.getByRole('timer')).toHaveAttribute('data-warn', 'false')
  })

  it('never turns amber when warnWithinHours is 0, even at the end', () => {
    render(<Countdown target={at(30_000)} phrase="left" warnWithinHours={0} />)
    expect(screen.getByRole('timer')).toHaveAttribute('data-warn', 'false')
    act(() => {
      vi.advanceTimersByTime(40_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('Closing now')
    expect(screen.getByRole('timer')).toHaveAttribute('data-warn', 'false')
  })
})

describe('Countdown ticking', () => {
  it('moves on by itself each minute and then each second in the last minute', () => {
    render(<Countdown target={at(2 * MIN + 30_000)} phrase="left" />)
    expect(screen.getByRole('timer')).toHaveTextContent('2 min left')

    act(() => {
      vi.advanceTimersByTime(30_000 + 100)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('1 min left')
    // Still inside the minute stage: no per-second ticking until the last minute begins.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('1 min left')
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('59 s left')
  })

  it('ticks per second only in the last minute', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    render(<Countdown target={at(10 * MIN)} phrase="left" />)
    const delay = setTimeoutSpy.mock.calls.at(-1)?.[1] as number
    expect(delay).toBeGreaterThan(MIN - 1000)

    act(() => {
      vi.advanceTimersByTime(9 * MIN + 30_500)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('29 s left')
    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('28 s left')
    setTimeoutSpy.mockRestore()
  })

  it("shows 'Closing now' at the target and stops ticking", () => {
    render(<Countdown target={at(3000)} phrase="left" />)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('Closing now')
    expect(timer).toHaveAttribute('aria-label', 'Closing now')
    expect(vi.getTimerCount()).toBe(0)
  })

  it("shows 'Starting now' for the 'to go' phrase when the target is already past", () => {
    render(<Countdown target={at(-5000)} phrase="to go" />)
    expect(screen.getByRole('timer')).toHaveTextContent('Starting now')
  })

  it('shares one timer between many countdowns', () => {
    render(
      <>
        <Countdown target={at(3 * HOUR)} phrase="left" />
        <Countdown target={at(4 * HOUR)} phrase="left" />
        <Countdown target={at(5 * HOUR)} phrase="left" />
      </>,
    )
    expect(vi.getTimerCount()).toBe(1)
  })

  it('cleans up its timer on unmount', () => {
    const { unmount } = render(<Countdown target={at(3 * HOUR)} phrase="left" />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pauses while the tab is hidden and resyncs when it is visible again', () => {
    render(<Countdown target={at(10 * MIN)} phrase="left" />)
    expect(screen.getByRole('timer')).toHaveTextContent('10 min left')

    act(() => setHidden(true))
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.setSystemTime(new Date(NOW.getTime() + 6 * MIN))
      setHidden(false)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('4 min left')
    expect(vi.getTimerCount()).toBe(1)
  })
})
