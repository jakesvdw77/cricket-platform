import { useSyncExternalStore } from 'react'

// Per-device Player Hub preferences (owner, 2026-11-06), kept in localStorage like 'hub:menuAutoCollapse': the value 'off' switches the
// preference off; absent, anything else or unavailable storage means on. Changes reach other tabs (the `storage` event) and the same tab
// (the event below), so a switch on the Preferences page and the screen it controls stay in step.
const CHANGE_EVENT = 'hub:preference'

export function readHubFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

export function writeHubFlag(key: string, on: boolean) {
  try {
    if (on) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, 'off')
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

export function useHubFlag(key: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => readHubFlag(key), () => true)
  return [on, (value: boolean) => writeHubFlag(key, value)]
}
