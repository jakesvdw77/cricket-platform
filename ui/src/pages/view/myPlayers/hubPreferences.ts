import { useSyncExternalStore } from 'react'

// Per-device Player Hub preferences (owner, 2026-11-06), kept in localStorage like 'hub:menuAutoCollapse': the value 'off' switches the
// preference off; absent, anything else or unavailable storage means on. Changes reach other tabs (the `storage` event) and the same tab
// (the event below), so a switch on the Preferences page and the screen it controls stay in step.
const CHANGE_EVENT = 'hub:preference'

// `defaultOn` is what an absent, unreadable or corrupt value means. A flag that is on by default stores only 'off'; one that is off by default
// (the idle menu collapse) stores only 'on'.
export function readHubFlag(key: string, defaultOn = true): boolean {
  try {
    const value = window.localStorage.getItem(key)
    if (value === 'off') return false
    if (value === 'on') return true
    return defaultOn
  } catch {
    return defaultOn
  }
}

export function writeHubFlag(key: string, on: boolean, defaultOn = true) {
  try {
    if (on === defaultOn) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // Storage unavailable: the choice just lasts for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(CHANGE_EVENT, listener)
  }
}

export function useHubFlag(key: string, defaultOn = true): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => readHubFlag(key, defaultOn), () => defaultOn)
  return [on, (value: boolean) => writeHubFlag(key, value, defaultOn)]
}
