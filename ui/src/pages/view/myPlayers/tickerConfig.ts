import { HUB_TICKER_KEY } from './useHubTickerPreference'

// docs/specs/146 section 11: the named constants of the Player Hub scoreboard ticker, in one file.
export const TICKER_SPEED_PX_PER_S = 30
export const TICKER_STATIC_MS = 6000
export const TICKER_MAX_ITEMS = 12
export const TICKER_RESULT_MAX_AGE_DAYS = 14
export const TICKER_UPCOMING_WINDOW_DAYS = 7
export const TICKER_COUNTDOWN_HOURS = 24
export const TICKER_POLL_WINDOW_HOURS = 48
export const TICKER_PREFERENCE_KEY = HUB_TICKER_KEY

// Not in the spec's list but tied to it: how long a touch keeps the strip paused after the finger lifts (a tap on a link must not be
// fought by a restart), the narrowest the strip is allowed to be before it is not drawn, and the default marquee time per item.
export const TICKER_TOUCH_GRACE_MS = 3000
export const TICKER_MIN_WIDTH_PX = 120
export const TICKER_FALLBACK_S_PER_ITEM = 9
