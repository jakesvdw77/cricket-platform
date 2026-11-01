import type { Coordinates } from '../api/weatherApi'

// docs/specs/133 (Get Directions): the links that hand a destination to the user's own map app. Only the coordinates leave the
// browser: no user data, no key, no routing call.
const pair = (point: Coordinates): string => `${point.lat},${point.lng}`

export const googleMapsDirectionsUrl = (point: Coordinates): string => `https://www.google.com/maps/dir/?api=1&destination=${pair(point)}`
export const appleMapsDirectionsUrl = (point: Coordinates): string => `https://maps.apple.com/?daddr=${pair(point)}`
export const wazeDirectionsUrl = (point: Coordinates): string => `https://waze.com/ul?ll=${pair(point)}&navigate=yes`

// Apple Maps is offered on iOS only. iPadOS reports itself as a Mac, so a Mac with a touch screen counts.
export function isIosDevice(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav) return false
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1
}

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

export function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
