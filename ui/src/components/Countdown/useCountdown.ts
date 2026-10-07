import { useCallback, useSyncExternalStore } from 'react'

// docs/specs/082-poll-card-improvements.md: the countdown arithmetic and the one shared ticker that
// every Countdown on a page subscribes to - a single timeout chain for the whole page, not a timer
// per card. It fires only when some subscriber's text can actually change (each minute boundary, or
// each second in the last minute), stops when nobody is subscribed or a subscriber's time has
// passed, pauses while the tab is hidden and resyncs on visibility.

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type CountdownStage = 'none' | 'days' | 'hours' | 'minutes' | 'seconds' | 'expired'

export interface CountdownState {
  stage: CountdownStage
  // The short wording without its phrase, e.g. '3 days 4 h', '5 h 12 min', '42 min', '45 s'. Empty for
  // 'none' (no target) and 'expired'.
  text: string
  // The spoken form of the same duration, e.g. '3 days 4 hours', '5 hours 12 minutes'.
  spoken: string
  // True from `warnWithinHours` before the target (and after it has passed); never when that is 0.
  warn: boolean
  remainingMs: number
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

export function describeCountdown(targetMs: number | null, nowMs: number, warnWithinHours = 24): CountdownState {
  if (targetMs === null || Number.isNaN(targetMs)) {
    return { stage: 'none', text: '', spoken: '', warn: false, remainingMs: 0 }
  }
  const remainingMs = targetMs - nowMs
  const warn = warnWithinHours > 0 && remainingMs <= warnWithinHours * HOUR
  if (remainingMs <= 0) {
    return { stage: 'expired', text: '', spoken: '', warn, remainingMs }
  }
  if (remainingMs < MINUTE) {
    const seconds = Math.max(1, Math.floor(remainingMs / SECOND))
    return { stage: 'seconds', text: `${seconds} s`, spoken: plural(seconds, 'second'), warn, remainingMs }
  }
  if (remainingMs < HOUR) {
    const minutes = Math.floor(remainingMs / MINUTE)
    return { stage: 'minutes', text: `${minutes} min`, spoken: plural(minutes, 'minute'), warn, remainingMs }
  }
  if (remainingMs < DAY) {
    const hours = Math.floor(remainingMs / HOUR)
    const minutes = Math.floor((remainingMs % HOUR) / MINUTE)
    return {
      stage: 'hours',
      text: `${hours} h ${minutes} min`,
      spoken: `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`,
      warn,
      remainingMs,
    }
  }
  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  return {
    stage: 'days',
    text: hours === 0 ? plural(days, 'day') : `${plural(days, 'day')} ${hours} h`,
    spoken: hours === 0 ? plural(days, 'day') : `${plural(days, 'day')} ${plural(hours, 'hour')}`,
    warn,
    remainingMs,
  }
}

// Milliseconds until this target's wording next changes: each second in the last minute, otherwise at
// the next whole minute boundary of the remaining time; Infinity once it has passed (nothing left to
// tick). A few ms of slack so the timeout lands just after the boundary, not just before it.
const SLACK_MS = 20

function nextChangeIn(remainingMs: number): number {
  if (remainingMs <= 0) {
    return Infinity
  }
  const step = remainingMs <= MINUTE ? SECOND : MINUTE
  return (remainingMs % step || step) + SLACK_MS
}

interface Subscriber {
  targetMs: number
  notify: () => void
}

const subscribers = new Set<Subscriber>()
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function schedule() {
  clearTimer()
  if (typeof document !== 'undefined' && document.hidden) {
    return
  }
  const now = Date.now()
  let delay = Infinity
  subscribers.forEach((subscriber) => {
    delay = Math.min(delay, nextChangeIn(subscriber.targetMs - now))
  })
  if (delay === Infinity) {
    return
  }
  timer = setTimeout(() => {
    timer = null
    subscribers.forEach((subscriber) => subscriber.notify())
    schedule()
  }, delay)
}

// Tab hidden: stop ticking. Visible again: re-render everything from the real clock and restart.
function onVisibilityChange() {
  if (document.hidden) {
    clearTimer()
    return
  }
  subscribers.forEach((subscriber) => subscriber.notify())
  schedule()
}

function subscribeTarget(targetMs: number, notify: () => void): () => void {
  const subscriber: Subscriber = { targetMs, notify }
  if (subscribers.size === 0 && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  subscribers.add(subscriber)
  schedule()
  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0) {
      clearTimer()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    } else {
      schedule()
    }
  }
}

// The countdown to an ISO time (null = no countdown: stage 'none', no subscription). Re-renders only
// when the wording or the warning flag changes, driven by the shared ticker above.
export function useCountdown(target: string | null | undefined, warnWithinHours = 24): CountdownState {
  const targetMs = target ? new Date(target).getTime() : null
  const valid = targetMs !== null && !Number.isNaN(targetMs)

  const subscribe = useCallback(
    (notify: () => void) => (valid ? subscribeTarget(targetMs as number, notify) : () => undefined),
    [valid, targetMs],
  )
  const snapshot = () => {
    const state = describeCountdown(valid ? targetMs : null, Date.now(), warnWithinHours)
    return `${state.stage}|${state.text}|${state.warn}`
  }
  useSyncExternalStore(subscribe, snapshot, snapshot)

  return describeCountdown(valid ? targetMs : null, Date.now(), warnWithinHours)
}
