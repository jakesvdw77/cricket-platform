import { isProfileSubView } from './hubNav'

// docs/specs/146 section 8 and 5: where the ticker belongs, read from the address (the only navigation state of the Hub).
export interface TickerRoute {
  // The held player of /account/players/:key/...; null on the chooser, Find Players, Welcome, Account and the like.
  playerKey: string | null
  // The pathname's section ("availability", "results", ""); a change of it draws a new seed.
  routeKey: string
  // False on Watch Live and on an edit sub-view (a form is never next to moving text).
  visible: boolean
}

export function tickerRoute(pathname: string): TickerRoute {
  const found = /^\/account\/players\/([^/]+)((?:\/[^/]+){0,4})\/?$/.exec(pathname)
  if (!found) return { playerKey: null, routeKey: '', visible: false }
  const [section, sub, leaf, extra] = found[2].split('/').filter(Boolean)
  const watchLive = section === 'schedule' && sub === 'matches' && Boolean(leaf) && extra === 'watch'
  const editView = section === 'profile' && isProfileSubView(sub, leaf)
  return { playerKey: decodeURIComponent(found[1]), routeKey: section ?? '', visible: !watchLive && !editView }
}

// A new seed per route section and per session: the order feels different after the parent opens another page, and the same page view
// keeps the same order across re-renders and refetches.
let sessionCounter = Date.now() % 1_000_003

export function drawTickerSeed(routeKey: string): number {
  sessionCounter += 1
  let hash = 2166136261
  for (let index = 0; index < routeKey.length; index++) hash = Math.imul(hash ^ routeKey.charCodeAt(index), 16777619)
  return (hash ^ Math.imul(sessionCounter, 0x9e3779b1)) >>> 0
}
