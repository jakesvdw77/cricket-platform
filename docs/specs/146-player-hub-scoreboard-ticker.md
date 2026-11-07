# 146: Player Hub Scoreboard Ticker: a rolling strip along the whole Hub console footer

**Depends on:** `121` (Hub frame, the footer bar and `hubBack`, `MyPlayerAccess`, phone and safe-area rules, Decision 15 "the footer holds the one Back"), `135` (`useMyPlayerMatches`, `MyMatchSummaryDto`, `MatchPhase`, the Hub match page, and its Non-goal "a scrolling ticker anywhere", which this spec amends for the footer only, see Problem & Goals), `145` (`useMyPlayerResults`, `MyResultDto`, the Show In Player Hub flag, the Hub Result page, Decision 12's `hub:menuAutoCollapse` preference and its `useHubMenuAutoCollapse` hook, Decision 13 "game feel", Decisions 6a and 7 on names), `034`/`064`-`066` and `119` (`useMyPlayerPolls`, `MyPoll`, the Hub availability page), `120` (no new hex literals; `brandTokens.ts`, `hubStyle.ts`), `docs/standards/frontend.md`, `docs/standards/design-system.md` ("Player Hub results"), `docs/standards/page-anatomy.md` (section 4 "the Hub differs only where the dark console and footer Back require it"), `docs/standards/testing.md`.
**Status:** approved for build by the owner 2026-11-07 (autonomous run; owner checks on return). Direction decided by the owner on 2026-11-06 from `docs/mockups/player-hub-ticker-round2-mockup.html`: **variant A, the classic rolling ticker, is chosen; D2 (scoreboard glass) is not.** The footer is taken over **entirely** by the ticker (owner). Not built yet. No code is written by this spec.

## Problem & Goals
The Player Hub is meant to feel like a scoreboard or a TV broadcast (`145` Decision 13), but the console footer is a bar that holds one Back button and otherwise sits empty. Everything a parent would like to glance at (the result that was just published, a match that is on now, the next fixture, an availability poll about to close) is a tap and a screen away, so nothing on the Hub moves or says "something is happening". A rolling strip along the bottom, like the one under a TV scoreboard, fills the space with what is current and links each item to the page it came from.

**Goals**
- **A. A scoreboard ticker that takes the whole Hub console footer**: a continuous, slow right-to-left scroll, a type chip on every item, paused on hover, touch and keyboard focus. The Back button, where a page has one, sits inside the footer at its left edge (as in the mockup).
- **B. Four item kinds built now**, all from reads that already exist: **results** (published and Show In Player Hub on), **live now**, **upcoming matches** (countdown label inside 24 hours) and **poll deadlines** (open polls closing soon).
- **C. A typed item contract and a kind registry** so each later kind (messages, sponsors, milestones, league standing, birthdays, weather, on this day, fun facts) is added as one source function plus one registry entry, without touching the ticker, the shuffle or the footer.
- **D. A pure, tested ordering**: a weighted shuffle that never puts the same kind twice in a row, allows a sponsor at most 1 in 5, and keeps a live match in the mix while it is on.
- **E. Quiet by choice and accessible**: a pause control reachable by keyboard, a static rotation under reduced motion, and a switch that turns it off on the **Preferences page** under Account (`hub:ticker`, a per-device preference).
- **F. No backend and no data model change.** Everything is composed in the browser from reads the Hub already makes.

**Amendment to `135`.** `135` rejected a scrolling ticker on the match rows because moving text that cannot be paused fails WCAG 2.2.2 and competes with a tap target. This spec does not reopen the rows (they stay static). The owner chose a ticker for the footer, a region with no tap-target competition, so the footer ticker ships with exactly the mitigations `135` said a ticker would need: a visible pause control, pause on hover, touch and focus, a static fallback under `prefers-reduced-motion`, and the off switch.

## Non-goals
- **The later kinds** (club messages, sponsors, milestones, league standing, birthdays, weather for the next match, on this day, fun facts). The contract and the registry are built so they plug in; none is built. The shuffle already enforces the sponsor 1-in-5 rule (and is tested with synthetic sponsor items) so the rule exists before the first sponsor does. See Rollout Notes for what each needs.
- **Sponsors as a product.** Who manages them, what the club pays, plate artwork, links and reporting need their own spec. No sponsor data model, screen or endpoint is created here.
- **A backend endpoint, a new table, a migration, an `openapi.yaml` change.** Decided below: none (a later aggregate read is possible if a kind needs server composition).
- **New data exposure.** Nothing is shown that the viewer's held players or club could not already see on the Results, Matches and Availability pages.
- **Live scores in the strip.** `NATIVE` live scoring is the later in-app scorecard (`135` seam); a live item shows the match and elapsed time, never a score, until that exists.
- **Push notifications, sounds, flashing or vibration.** The strip is passive and silent.
- **Per-account or per-club ticker settings, or a club switch to disable it for all its viewers.** The preference is per device (`hub:ticker`), like `hub:menuAutoCollapse`. A club-level switch arrives with the first club-authored kind (messages or sponsors), where it is needed.
- **The manager application.** The ticker is the Player Hub console only; whether managers get one is a separate decision.
- **Changing the header band, the menu auto-collapse or any Hub page body.** Only the footer changes.
- **The Preferences page itself.** Built before this spec (owner, 2026-11-07): `MyPreferencesPage` under Account (`/account/preferences`) with the ticker and menu auto-collapse switches, `hubPreferences.ts` and `useHubTickerPreference.ts`. This spec only reads the preference.

## User Stories
- As a parent, I see a slow strip along the bottom of the Hub that tells me what is happening for my player's club (a result, a match on now, the next match, a poll about to close), so the Hub feels alive.
- As a parent, I tap an item and land on the page it came from: a result opens the Hub Result page, a match opens the match page, a poll deadline opens Availability.
- As a parent, I can stop the strip (hover, touch and hold, keyboard focus, or the Pause button) so I can finish reading an item.
- As a parent who is sensitive to motion, I see one item at a time that changes slowly, not a scroll, and I can pause that too.
- As a parent who finds it distracting, I turn the ticker off on the Preferences page (Account, then Preferences) and the footer is just the Back button again, on this device.
- As a screen reader user, I can reach the items as an ordinary list of links, in a stable order, without a constantly announcing region.
- As a parent with a live match on, I see it in the strip every cycle, first, until it ends.
- As a parent with nothing current (no results shown, nothing upcoming), I see the footer exactly as today.
- As the club's platform owner, I can later add messages, sponsors, milestones and the rest as new item sources without rewriting the ticker.

## Data Model Changes
**None.** No entity, column or migration. The preference is a browser `localStorage` value (below). Nothing is stored server-side.

## API Contract
**No new or changed endpoint, and no `openapi.yaml` change (decision, stated explicitly).** The ticker is composed in the browser from reads the Hub already makes under `MyPlayerAccess.resolve`:

| Existing read | Hook | Feeds |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/matches` (`135`) | `useMyPlayerMatches` | live now, upcoming matches |
| `GET /api/v1/me/players/{playerKey}/results` (`145`; first page only, default scope) | `useMyPlayerResults` | results |
| `GET /api/v1/me/players/{playerKey}/polls` (`119`, existing) | `useMyPlayerPolls` | poll deadlines |

Why no endpoint: all four kinds already have a Hub read, each is small (the results read is paged and the ticker uses page 0 only), the access, junior and Show In Player Hub rules are applied server side once in those reads, and composing client-side keeps a single copy of the privacy rule. A later aggregate `GET .../ticker` is a fair idea once a kind needs server composition (league standing, milestones from `103`, a club's sponsor rotation); it is out of scope here and, if added, replaces a source function without changing the item contract.

The ticker adds no query key. Its data hook (`useTickerData`) only calls the three hooks above for the player in the route, passing `enabled` and a longer `staleTime` where the hook allows it (see Refresh rules).

## UI Requirements

### 1. Where it lives and how it is composed
Hub-local pieces in `ui/src/pages/view/myPlayers/` (the folder `145` uses), following the four-file anatomy of `frontend.md` voluntarily (component, test, stories, `index.ts`) because they are shared pieces, although the CI shape check applies to `components/**`:

| Piece | Kind | Responsibility |
|---|---|---|
| `HubFooter` | component | The whole footer band (replaces the footer markup inside `HubFrame`): the Back slot at the left (the existing `HubFooterButton`, unchanged behaviour, Escape and `hubBack` untouched), then the ticker filling the rest. Owns the empty state and the safe-area padding. |
| `HubTicker` | component | The strip: renders `TickerItem[]` as a marquee or a static rotation, the pause control, the pause-on-hover/touch/focus behaviour, the visually hidden list semantics. Knows nothing about matches, results or polls. |
| `tickerItems.ts` | pure | `buildTickerItems(ctx): TickerItem[]` composes the sources in the kind registry, applies per-kind caps and expiry. |
| `tickerKinds.ts` | data | The kind registry (below). |
| `weightedShuffle.ts` | pure | `orderTickerItems(items, { seed, caps })`: the ordering rules. |
| `tickerSources/` | pure | One file per source: `resultsSource.ts`, `liveSource.ts`, `upcomingSource.ts`, `pollsSource.ts`. |
| `useTickerData.ts` | hook | Calls the three existing hooks and returns the context the sources read. |
| `useHubTickerPreference.ts` | hook | Reads and writes `hub:ticker`, in step with other tabs and with the switch. |

`HubFrame` passes the Back slot to `HubFooter`; no page imports the ticker. The ticker is rendered once per Hub frame, so a route change inside the frame does not remount it (the animation keeps running; items re-order on the rules below).

### 2. The item contract
```ts
export type TickerKind =
  | 'result' | 'live' | 'upcoming' | 'poll'                    // built now
  | 'message' | 'sponsor' | 'milestone' | 'standing'
  | 'birthday' | 'weather' | 'onThisDay' | 'funFact'          // designed for, not built

export type TickerPart =                                       // typed text, never HTML
  | { type: 'strong'; text: string }                           // gold, the key words
  | { type: 'text'; text: string }
  | { type: 'muted'; text: string }
  | { type: 'plate'; text: string; logoUrl?: string | null }   // sponsors only

export interface TickerItem {
  kind: TickerKind
  id: string               // stable and unique within the kind, e.g. the matchId, resultId, pollId
  parts: TickerPart[]      // rendered in order, in one line
  to: string | null        // in-app path the item links to; null means not a link (a fun fact)
  weight: number           // relative chance of being picked next; > 0; defaults from the registry
  expiresAt?: string | null // ISO instant after which the item is dropped (a poll close time, kickoff)
  pinned?: boolean         // live match: always in the cycle, first
  label?: string           // plain-text sentence for the accessible list; built from parts when absent
}

export interface TickerKindDef {
  label: string            // the chip text, Title Case: "Result", "Live", "Next", "Poll"
  tone: 'win' | 'live' | 'next' | 'message' | 'sponsor' | 'info'   // maps to brandTokens/HUB, no inline hex
  defaultWeight: number
  maxPerCycle: number      // cap on how many items of this kind enter one cycle
  maxShare?: { inN: number } // sponsor: { inN: 5 } means at most 1 in any 5 consecutive items
  pinnedWhenPresent?: boolean
  source: (ctx: TickerContext) => TickerItem[]   // pure
}
export const TICKER_KINDS: Record<TickerKind, TickerKindDef | undefined>
```
A kind with no definition (the "designed for" ones) is simply absent from the registry: no item, no chip, no code path. **Adding a kind later is: add its `TickerKindDef` and its source file, add the chip tone if it is new. The ticker, the footer, the shuffle and the tests of the rules are not edited.** A test pins that `HubTicker` and `orderTickerItems` never import a source file.

`TickerContext` carries only what the sources need: the held player's key and first name, `now`, the three read results (or `undefined` while loading), and the route key. Sources never fetch.

### 3. The four built sources (privacy first)
Every source reads only data the matching Hub page already shows the same viewer, for the player selected in the route (`/account/players/:key/...`). On a route with no player (the chooser, Find Players, invitations) there is no context and no ticker.

| Kind | Source | Text (parts) | Link (`to`) | Notes |
|---|---|---|---|---|
| `result` | `useMyPlayerResults`, page 0, newest first | **Result** chip, the result line from `resultsFormat.ts` ("**Villagers** beat **Rovers** by 24 runs") then muted "Over 40, Sat" (league or Friendly, day) | `/account/players/:key/results/:matchId` (the Hub Result page) | Only results the read returns, i.e. published **and** Show In Player Hub on (`145` Decisions 2 and 8); at most **5**, none older than `TICKER_RESULT_MAX_AGE_DAYS` (14). Team names and scores only; no player figure, so no extra name is shown. If the read lists a junior's result it follows `145` Decision 7 (full names on the Hub result page); the ticker line never adds a player name. |
| `live` | `useMyPlayerMatches().live` | **Live** chip (pulsing dot, still under reduced motion, plus the word), "**Villagers v Rovers**" and muted "Started 1h 20m ago" (formatted by the existing elapsed helper, updated each minute) | `/account/players/:key/schedule/matches/:matchId` | `pinned: true`. Phase comes from the server (`MatchPhase`, `135`). No score until the `NATIVE` source exists. At most 3. |
| `upcoming` | `useMyPlayerMatches().upcoming` | **Next** chip, "Sat 14:00 **Villagers v Eagles**" and muted "Main Oval, starts in 2 days"; inside 24 hours the label is a countdown ("starts in 3h 10m", "starts in 45m") from the shared countdown helper | match page | The next **3** matches starting within `TICKER_UPCOMING_WINDOW_DAYS` (7). `expiresAt` is the start; a match that has started leaves the list on the next minute tick (it becomes a `live` item from the server phase). |
| `poll` | `useMyPlayerPolls` | **Poll** chip (label "Poll"), "Availability for **Saturday** closes **tonight**" ("closes in 5h", "closes tomorrow 18:00") | `/account/players/:key/availability` (the Hub availability page, the same destination as the Availability menu item) | Open polls with `scheduledCloseAt` within `TICKER_POLL_WINDOW_HOURS` (48) **and no answer yet from the held player** (default, Open question 4); at most 3. The held player's own answer is the only answer read; nobody else's. |

No source includes a junior's name beyond what the linked page shows; no source reads contacts, medical data, other players' availability, draft or unpublished results, or another club's data (they cannot: the three reads are scoped by `MyPlayerAccess`). Wording follows `145` Decision 6a: never "you" or "your"; a player is named by first name where one is needed (none of the four built kinds need one).

### 4. Ordering: the weighted shuffle (`orderTickerItems`)
A pure function: `orderTickerItems(items, { seed, rng? }) => TickerItem[]`, using a small seeded generator (mulberry32 or equivalent) so tests are deterministic. It orders **one cycle** (every item once; the strip then loops).

Rules, in priority order (a higher rule is never broken to satisfy a lower one):
1. **Per-kind caps** are applied before ordering (`maxPerCycle`), keeping the freshest items of the kind. The whole cycle is capped at `TICKER_MAX_ITEMS` (12): after kind caps, drop from the kinds with the most items first, never a pinned item.
2. **Pinned items lead.** Live items are always in the cycle and come first. When the cycle has 6 or more items the pinned items are repeated once near the middle of the cycle (two sightings per loop), so a live match is never far away. A repeated item keeps its `id`; the render key includes the position.
3. **Sponsor cap.** An item whose kind has `maxShare: { inN: 5 }` may not appear if another of that kind appeared in the previous 4 positions, **including across the loop seam** (the end of the cycle counts as before the start). A sponsor that cannot be placed without breaking this is dropped from this cycle, never placed anyway.
4. **Never the same kind twice in a row**, including across the loop seam. If only one kind remains (or the only remaining candidates are of the previous kind), the rule is relaxed for the rest of the cycle (the strip must still show everything it has): relaxing is allowed here and nowhere above.
5. **Weighted choice.** For each remaining position, pick among the candidates that satisfy rules 3 and 4 with probability proportional to `weight` (defaults: live 5 as pinned, result 3, upcoming 2, poll 2; a later kind sets its own).

Output is stable for a given `(items, seed)`. The seed comes from the route (below), not `Math.random()` at render time.

### 5. Refresh rules
- **Reads:** React Query through the existing hooks, with a ticker-specific `staleTime` where the hook accepts options: results 5 minutes, polls 2 minutes, matches the hook's own (it already refetches every 60 seconds while a live match exists, `135`). The ticker never polls on its own and adds no `refetchInterval`. Disabled (`enabled: false`, no requests at all) when the preference is off, on a route with no player, or on the Watch Live page.
- **Reshuffle on route change, not on every render.** The seed is derived from the route key (the pathname's section) and a per-session counter, held in `useMemo`/`useRef`, and the ordered list is memoised on `(item signature, seed)`. A re-render, a data refetch that returns the same items, a window focus refetch or a pause/resume do **not** reorder. A route change (the parent opens another Hub page) draws a new seed so the order feels different; the animation position continues, it is not restarted.
- **Item set changes** (a live match starts or ends, a result is published, a poll closes, a countdown crosses 24 hours) rebuild the list. Items that remain keep their relative order where the rules allow, new items are placed by the same rules; the marquee restarts only if the set of ids changed.
- **Time-based text** (countdowns, "started 1h 20m ago", "closes tonight") is recomputed once a minute from a single shared minute tick; the order is not affected by it.
- **Expiry:** an item with `expiresAt` in the past is dropped on the next tick without a refetch.

### 6. Behaviour of the strip (`HubTicker`)
- **Motion (variant A):** one track holding the cycle twice, translated from `0` to `-50%` by a CSS animation (`linear`, `infinite`), compositor-only (`transform`, `will-change: transform`), no JS per frame. Duration is measured track width divided by the named constant `TICKER_SPEED_PX_PER_S` (**50**, about as calm as the mockup's 9 s per item), recomputed with a `ResizeObserver` when items or width change. If the whole cycle fits inside the visible width, it does not scroll: items are laid out statically, centred, with the separators (no duplicated copy, no animation).
- **Look (the mockup's variant A):** dark band (`rgba(0,0,0,.42)` over the console, a `HUB.line` top hairline), the Back slot with a right hairline, 70 px edge fades beside the Back slot and at the right, Barlow Condensed 600, 20 px uppercase with 0.06em tracking on desktop (17 px below `sm`), key words (`strong`) in gold, muted tails in the muted cream, a 6 px gold separator dot with 26 px margins, a **type chip** on every item (Barlow Condensed 700, 12 px, 0.14em, uppercase, 3 px radius, 1 px border in the kind's tone, the tone text, colour never the only cue because the chip carries the word). Tones come from `brandTokens.ts`/`hubStyle.ts` only: the mockup's local colours (win green, live red, next blue, message violet, sponsor gold, info green) are added to `brandTokens.ts` as named tokens where one does not already exist; there is no inline hex (the `120` grep gate). Variant D2 (LED matrix or "scoreboard glass") is not built.
- **Pausing.** The animation is paused (`animation-play-state: paused`) while: the pointer is over the strip (hover-capable pointers); a touch is held on the strip (`touchstart` to `touchend`/`cancel`, with a 3 s grace so a tap on a link is not fought by a restart); keyboard focus is anywhere inside the strip (`:focus-within`); or the user has pressed the **Pause** button. The Pause button is a 44 px target at the right end of the strip (icon-only pause and play, `aria-pressed`, accessible name "Pause Ticker" / "Play Ticker", visible keyboard focus ring), always rendered while there is at least one item. Pause state is per page view (not stored). This is the WCAG 2.2.2 control.
- **Links.** Each item is one real link (`react-router` `Link`, the whole item: chip and text, one tap target, 44 px high, hover tint and gold focus ring as the Hub rows). The item `to` is the page it came from. The footer Back that appears on the destination is whatever `hubBack` already says (Results, Matches, Availability); **no new `from` value is introduced**. A `null` `to` renders the item as plain text.
- **Reduced motion (`prefers-reduced-motion: reduce`, read live with a `matchMedia` listener):** no scroll. The strip shows **one item at a time**, in the same order, changing every `TICKER_STATIC_MS` (6000) with no transition (an instant swap), centred and truncated with an ellipsis if too long (the full text is in the accessible list and as the link's title). A **Previous** and **Next** pair (44 px icon buttons) appears beside Pause; Pause stops the rotation. Pause on hover/focus/touch applies here too. The live item's pulse stands still.
- **Truncation:** in the marquee nothing is truncated (it scrolls); in the static rotation text is one line with an ellipsis.
- **Focus into the strip.** Tab moves through the Back button, then each ticker link in order, then Pause. When a link receives focus the strip pauses and brings that item fully into view (the track offset is set so a focused item is never off-screen). Tab order never lands in the duplicate copy (below).
- **Escape** still triggers the footer Back exactly as `121` Decision 15; the strip does not capture Escape.

### 7. Accessibility
- **One real list, one decorative copy.** The first copy of the cycle is the accessible list: a `<ul aria-label="Scoreboard ticker">` of `<li>` links in cycle order. The second copy (needed only for the seamless loop) is `aria-hidden="true"` with every link `tabIndex={-1}`, so assistive technology and keyboard users meet each item once. In the static rotation the same `<ul>` is rendered with only the current item visible and all items present in the DOM, visually hidden except the current one (`clip` pattern, not `display: none`, so the list stays readable).
- **No live region.** The strip is not `aria-live`; an always-updating region would talk over the page. Changes (new item set, live match starting) are not announced. (A one-shot, polite announcement when a live match starts is a possible later addition, not built.)
- **Pause control** reachable by keyboard and by touch, with `aria-pressed` and a visible state; hover and focus pause as above.
- **Names:** each link's accessible name is the item `label` (chip word then sentence, for example "Result: Villagers beat Rovers by 24 runs, Over 40, Saturday"), not the chip alone.
- **Contrast** checked once at the token stage: gold on the dark band, cream on the band and each chip tone on the band at 4.5:1 or better (a test over the tokens, as `PageCounters.test.tsx` does for `primary.main`).
- **Targets** 44 px; text scales (no fixed pixel heights that clip at 200 percent zoom; the band height is `min-height`).
- **Switch state on the Preferences page** is a real labelled MUI Switch (a checkbox input with an accessible name and description).

### 8. Footer geometry, phone and safe area
- **Height:** the footer band keeps the pinned `56 px` of `121` at every width (the mockup's phone band was 64 px; staying at 56 keeps the layout from jumping when items load and keeps `121`'s content-above-footer maths, Open question 5). Padding-bottom is `env(safe-area-inset-bottom)` added on top, as `121` already does for the footer on a phone.
- **Phone:** the footer is pinned to the bottom, always visible. The Back button keeps its label ("Back to Schedule", "Back to menu", `hubBack`), the ticker takes the remaining width, at least 120 px; below that width (a very narrow window) the ticker is not rendered and the footer is the Back button as today. Text size 17 px. The pause control stays at the right end.
- **No Back on the page** (for example the single-player main menu, `121` Decision 12): the ticker spans the full width of the band. If that screen also has no items, no footer renders, as today.
- **Hub pages where it is hidden:** the Watch Live page (`135`; moving text beside a video is distracting; also no ticker requests there) and the account chooser, Find Players and Welcome screens (no player context). A sub-view that replaces the console body (edit, hand over, leave) keeps the footer Back; the ticker is hidden there too so a form is never next to moving text.
- **Tablet and desktop:** the same band across the console's width (`min(1560px, 92vw)`, `145` Decision 16). Nothing about the menu auto-collapse changes.

### 9. Empty state
`buildTickerItems` returns an empty list when nothing qualifies (no flagged results in the last 14 days, nothing live or within 7 days, no poll closing soon, or all reads failed or are still loading). Then `HubTicker` renders **nothing** and `HubFooter` is exactly today's footer: just the Back button (or no footer where there is no Back). There is no placeholder, spinner or error text: a failed read simply contributes no items. Loading never shows a skeleton strip, so the footer does not jump.

### 10. The off switch and the preference
- **Key: `hub:ticker`** in `localStorage`, same convention as `hub:menuAutoCollapse`: the value `'off'` disables it; absent (or anything else, or storage unavailable) means on. Per device and browser, not per account. Read and written through `useHubTickerPreference()`, which wraps every storage access in `try/catch` (as `menuAutoCollapsePreference` does) and listens to the `storage` event plus an in-tab custom event, so flipping the switch updates the footer immediately in the same tab and in other open tabs. The key name is exported as the constant `TICKER_PREFERENCE_KEY` beside `MENU_AUTO_COLLAPSE_KEY`.
- **Where the switch is (decided, owner 2026-11-07):** the **Preferences page** under Account (`/account/preferences`, card on the Account page), already built with `useHubTickerPreference()` and `hubPreferences.ts` (`useSyncExternalStore` over `localStorage`, the `storage` event and an in-tab event). Account is a person-level screen reached from the page-corner link, not a Hub menu item or avatar menu entry. `TICKER_PREFERENCE_KEY` is the existing `HUB_TICKER_KEY` constant in `useHubTickerPreference.ts`.
- When off: no ticker requests are made, the footer is today's footer.

### 11. Components used
Existing: `HubFrame` and its footer (`HubFooterButton`), `hubStyle.ts` (`HUB`), `brandTokens.ts`, `resultsFormat.ts`, the countdown and elapsed-time helpers used by `HubMatchRow`, `LiveBadge`'s `PulseDot` (reused for the live chip), `AccountShell`, the shared compact `Button` (the Pause control is an icon button at the Hub's 44 px target; no raw MUI `Button`, no `fullWidth`, `docs/standards/page-anatomy.md` section 0.6). New: the pieces in section 1 and the named constants below. No new dependency.

Named constants (one file, `tickerConfig.ts`): `TICKER_SPEED_PX_PER_S = 50`, `TICKER_STATIC_MS = 6000`, `TICKER_MAX_ITEMS = 12`, `TICKER_RESULT_MAX_AGE_DAYS = 14`, `TICKER_UPCOMING_WINDOW_DAYS = 7`, `TICKER_COUNTDOWN_HOURS = 24`, `TICKER_POLL_WINDOW_HOURS = 48`, `TICKER_PREFERENCE_KEY = 'hub:ticker'`.

## Test Plan
Per `docs/standards/testing.md`. Following the owner's working rule, tests are written after the owner has checked the function; targeted runs per step, one full run at the end. **No backend tests are needed: no backend change.** Playwright is not run by this spec.

- **Unit (Vitest), `weightedShuffle.test.ts` (the heart of it):**
  - never the same kind twice in a row, over many seeds and mixed inputs, **including across the loop seam** (last versus first);
  - the rule relaxes only when one kind remains, and then every item is still present;
  - **sponsor at most 1 in 5:** with synthetic sponsor items and other kinds, in every window of 5 consecutive items (also across the seam) there is at most one sponsor, and a sponsor that cannot be placed is dropped, never placed in breach;
  - **live pinned:** live items are always present, always first, repeated once near the middle when the cycle has 6 or more items, never removed by the cycle cap or by kind caps;
  - weights: with a fixed seed set, a higher weight is picked first more often (a statistical check with a wide tolerance); determinism: same `(items, seed)` gives the same order, different seeds usually differ;
  - caps: `maxPerCycle` keeps the freshest, `TICKER_MAX_ITEMS` drops from the largest kind first;
  - degenerate inputs: empty, one item, two items of one kind, only pinned items.
- **Unit (Vitest), `tickerItems.test.ts` and each source:** results only from the read (a flag-off result is simply absent from the input; a test feeds only what the read returns), older than 14 days dropped, at most 5; live items pinned with the elapsed label; upcoming limited to 3 within 7 days, the countdown label appears only inside 24 hours and changes form at the boundary (23:59 versus 24:00); polls only open, closing within 48 hours, unanswered by the held player, at most 3; expiry drops an item at `expiresAt`; text parts contain no "you" or "your"; links are the exact paths in section 3; loading and failed reads (undefined inputs) yield no items; **the item builder never reads another player's data** (a test passes contexts for two players and asserts only the route player's items appear).
- **Unit (Vitest), contract guards:** `HubTicker` and `orderTickerItems` do not import any file from `tickerSources/` or from the matches, results or polls api modules (a grep-style test as `135` has for `scoringUrl`); every kind in `TickerKind` that is built has a registry entry and a tone, every "designed for" kind has none; every tone resolves to a token (no hex in the ticker files).
- **Unit (Vitest), `useHubTickerPreference`:** default on; `'off'` disables; corrupt or unavailable storage means on; a `storage` event and the in-tab event update the value.
- **Component (Testing Library), `HubTicker.test.tsx`:** renders the accessible list once and the duplicate with `aria-hidden` and `tabIndex={-1}` links; **pause** on hover, on `touchstart` and on focus (`animation-play-state` paused) and resumes after; the Pause button toggles `aria-pressed` and the name; **reduced motion** (mocked `matchMedia`) shows one item at a time, advances every `TICKER_STATIC_MS` (fake timers), shows Previous and Next, and the pulse is static; **links**: each item's `href` is the page it came from and clicking navigates (memory router); a `null` `to` is not a link; a focused link is brought into view; Tab never reaches the duplicate; **preference off** renders no ticker and makes no request (the three hooks are called with `enabled: false`); **empty** renders nothing; text that fits renders static without animation.
- **Component, `HubFooter.test.tsx`:** Back and ticker together (Back at the left, label from `hubBack`, Escape still triggers Back); no Back: ticker spans full width; no items and no Back: no footer; no items with Back: today's footer; the narrow-window case hides the ticker; hidden on the Watch Live route and on the chooser; the footer keeps 56 px and the safe-area padding.
- **Component, `MyPreferencesPage`:** already covered (the switch writes `hub:ticker`); a `HubFooter` test covers that the footer updates at once when the preference changes.
- **Storybook:** `HubTicker` stories: all four built kinds, plus a "future kinds" story using synthetic message, sponsor (with plate), milestone, standing, birthday, weather, on-this-day and fun-fact items to prove the contract needs no ticker change; live pinned; paused; reduced motion (static); a single item that fits; a long item; empty. `HubFooter` stories: with Back, without Back, with and without items, phone (375), tablet (768), desktop (1280). Per `design-system.md`, viewports 375, 768, 1280.
- **Manual (owner):** a 375 px sweep (footer height, safe-area, Back plus strip at 120 px minimum), keyboard pass (Tab order, pause, focus visible), a reduced-motion pass, 200 percent zoom, a real club with a live match, a flagged result and an open poll.

## Acceptance Criteria
1. The Hub console footer is one band: the Back button (where a page has one) at the left and the ticker filling the rest; nothing else is in the footer except the ticker's Pause control (and Previous and Next under reduced motion).
2. With results, a live match, upcoming matches and an open unanswered poll available, the strip shows items of those four kinds, each with a type chip (Result, Live, Next, Poll), scrolling continuously right to left at a slow constant speed.
3. A result appears only when the Hub results read returns it (published and Show In Player Hub on); turning the flag off removes it from the strip on the next refetch. No result older than 14 days appears.
4. A live match is in every cycle, first, with the LIVE chip and the word, until it ends; no score is shown.
5. An upcoming match inside 24 hours reads as a countdown; outside it reads as a day and time.
6. Only polls the held player has not answered, closing within 48 hours, appear.
7. Tapping an item opens the Hub Result page (result), the match page (live, upcoming) or the Availability page (poll); the footer Back there is the one `hubBack` already provides.
8. The order never has the same kind twice in a row (including at the loop seam) unless only one kind exists; a sponsor item, when one exists, is never within 4 positions of another sponsor; both are covered by unit tests with synthetic data.
9. The order does not change on a re-render or a refetch that returns the same items; it changes when the route changes.
10. Hover, touch and keyboard focus pause the strip; the Pause button pauses and resumes it and is reachable by keyboard.
11. Under `prefers-reduced-motion` the strip shows one item at a time, changing every 6 seconds, with no scroll, and can be paused and stepped.
12. Screen readers and keyboard users meet each item exactly once as a link in a list; the moving duplicate is hidden from them; there is no live region.
13. The "Scoreboard ticker" switch on the Preferences page turns the ticker off for this device (`hub:ticker` = `off`); when off the footer is today's footer and no ticker request is made; the setting survives a reload.
14. With nothing to show, or with every read failed or loading, the footer is exactly as before (just Back, or absent), with no placeholder.
15. No endpoint, migration or `openapi.yaml` change exists in the PR, and no data beyond what the Results, Matches and Availability pages show the same viewer is displayed.
16. No later kind (message, sponsor, milestone, standing, birthday, weather, on this day, fun fact) is implemented, and each can be added by one registry entry and one source file (proved by the Storybook "future kinds" story using the unchanged `HubTicker`).
17. The ticker is not shown on the Watch Live page, the chooser, Find Players, Welcome or an edit sub-view.

## Open questions (short, defaults apply)
1. **Where the switch lives.** Resolved 2026-11-07: the Preferences page under Account (built).
2. **Result freshness.** Default: results from the last 14 days, at most 5. Alternative: last 30 days.
3. **Hide on Watch Live.** Default: hidden (video page). Alternative: shown but paused.
4. **Which polls.** Default: only polls the held player has not answered. Alternative: every open poll closing soon.
5. **Phone band height.** Default: 56 px (`121`), not the mockup's 64 px. Alternative: 64 px when items exist.
6. **Speed.** Default: 50 px per second. Tune after the owner has seen it on a phone.

## Rollout Notes
- **One PR, frontend only.** Order: `tickerConfig.ts`, the item contract and registry, `weightedShuffle.ts` and its tests, the four sources and `tickerItems.ts`, `useTickerData`, `useHubTickerPreference`, `HubTicker`, `HubFooter` wired into `HubFrame`, the avatar menu switch, stories, then the owner's check; tests after the owner's function check (working rule), then a standards review and the full suite once at the end. No feature flag (the preference is the user-level off switch; there is nothing server side to flag).
- **Docs updated in the same change:** `docs/specs/121` (the footer now carries the ticker beside Back; Decision 15 unchanged), `docs/specs/135` Non-goals note (footer-only ticker, mitigations), `docs/standards/design-system.md` ("Player Hub ticker" paragraph: pieces, constants, contract) and `docs/standards/frontend.md` (the Hub reads ticker data only through its existing hooks; `hub:ticker`; no source import in the ticker), `docs/roadmap.md` (row `146` and the later kinds), and `docs/architecture.md` only if its Hub diagram lists the footer (it does not need an access change: no new read).
- **Later kinds and what each needs** (all slot into `TICKER_KINDS` plus one source file; the strip, shuffle and footer are not edited):

| Kind | Chip | What it needs first | Privacy and rules |
|---|---|---|---|
| Club messages | Message | The Updates feature live (a club-authored message with an audience, start and end, and a Hub read), plus a club switch to disable messages in the ticker | Audience-scoped by the Updates read; plain text only; links to the Updates page |
| Sponsors | Sponsor | **Its own spec**: who manages sponsors (club admin screen), what the club pays, plate artwork and size, the link target and its safety (`https` only, `rel="noopener sponsored"`), start and end dates, impression reporting if wanted; a Hub read for the active sponsors of the viewer's club | `maxShare` 1 in 5 (already enforced and tested), a plate (`plate` part), never on the first position, reduced motion safe; clearly marked as a sponsor by the chip |
| Milestones | Milestone | A server read of recent milestones for the held player (a fifty, a five-for, a hat-trick, a first wicket) from `103`/`145` stats, with thresholds in one rule file | Only the held player's own, first name only, from flagged results only (so it agrees with Results); no ranking against others |
| League standing | Table | A Hub read of the player's league table position for the current season (the `123` league page data) | Team names and points only; text such as "Division 1: Villagers top on 22 points" |
| Birthdays | Birthday | A club switch (**default off**), per-person consent, and a Hub read of birthdays among the viewer's teammates or club | First name only; never an age or a date of birth; juniors only with guardian consent; off unless the club turns it on |
| Weather for the next match | Weather | Nothing new on the server: the `133`/`135` Match Brief (`matchBrief.ts`, `useMatchWeather`) already supplies the range line for the next match within 6 days | Same range rule and "show nothing when out of range" |
| On this day | History | A Hub read of club history (results or events on this calendar day in past years) | Only results already visible to the Hub (flagged); team names and scores |
| Fun facts | Did You Know | A curated, club-neutral rule set computed from visible data (streaks, "most wins this season") or static copy, with a rule file | No names beyond what a Hub page shows; `to` may be null |

- **Also later:** an aggregate `GET .../ticker` if two or more kinds need server composition; a club-level switch (when the first club-authored kind lands); a one-shot polite announcement when a live match starts; the in-app live score in the live item once `NATIVE` exists (`135`).
