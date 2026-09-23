# 048 — Match Availability Wrap Layout

**Depends on:** `034-availability-polls-dashboard.md` (built `AvailabilityRespondentAvatars` — the `AvatarGroup`-based, `max={4}` compact avatar-plus-count component this spec extends with a second, additive layout mode, not redefines; also built `squadDisplayName`/`STATUS_COLOR`/`STATUS_LABEL`, reused unmodified), `036-view-first-record-detail-screens.md` (built `MatchDetailPage.tsx`'s `RecordDetailScreen`-based section-stack shape — Details/Home XI/Away XI/Availability — this spec reorders, and the `SideAvailability` local component this spec extends), `046-header-body-elevation-standard.md` (every `RecordDetailScreen` section, including Availability, already renders inside its own `ContentCard` — `bgcolor: 'background.paper'`, `boxShadow: 2`, no fixed height — confirmed below that the wrap layout's extra vertical height needs no special-casing there).
**Status:** draft.

## Problem & Goals

Live review of `MatchDetailPage.tsx`'s Availability section (screenshot-confirmed) found two real problems, not matters of taste:

1. **Section order.** The `sections` array passed to `RecordDetailScreen` (`ui/src/pages/manage/MatchDetailPage.tsx:232-300`) renders Details → Home XI → Away XI → Availability. A club admin's actual question when opening a match is "who's available," ahead of "who's been picked" — Availability belongs directly under Details, not after both XI sections.
2. **Avatar truncation.** `SideAvailability` (`MatchDetailPage.tsx:48-91`) renders each status bucket (Available/Unavailable/Unsure) via `AvailabilityRespondentAvatars`, which wraps MUI's `AvatarGroup` with `max={4}` — showing 3 real avatars plus a "+N" overflow bubble the moment a bucket exceeds 3 respondents (the screenshot shows "MO EM JA +6" for 9 Available players), even though `MatchDetailPage`'s full-width `ContentCard` section has ample horizontal *and* vertical room to show every respondent. `034` designed this truncation deliberately for a different, genuinely space-constrained context (see Non-goals) — carrying that same ceiling onto a screen with no such constraint is the actual defect.

**Goals**
- Reorder `MatchDetailPage`'s sections to Details → Availability → Home XI → Away XI.
- Give `AvailabilityRespondentAvatars` a second, opt-in layout mode that wraps every respondent's avatar onto as many lines as needed, filling the section's available width, rather than truncating into a "+N" bubble as soon as one row would overflow — falling back to a "+N" summary only past a generous, named cap sized well above any realistic squad.
- `MatchDetailPage`'s `SideAvailability` opts into the new mode for its three status clusters; `034`'s `AvailabilityPollsDashboard` — the one other call site — is untouched, in behaviour and in diff.

## Non-goals

- **`AvailabilityPollsDashboard.tsx` or its poll-card layout.** Confirmed by reading both call sites in full: `AvailabilityPollsDashboard`'s `pollFields()` renders `AvailabilityRespondentAvatars` as one of several `RecordCard` `fields` on a compact, grid-columned poll-summary card (`xs: 1fr`, `sm: repeat(2, 1fr)`, `md: repeat(3, 1fr)`) — genuinely narrow, multi-card-per-row real estate where today's `max={4}` truncated `AvatarGroup` is still the right, deliberate `034` design decision. This spec adds an opt-in second mode to the shared component; it does not change that call site's behaviour, appearance, or file — zero diff there, confirmed in Acceptance Criteria.
- **`PlayingXiSummary`, `MatchAvailabilityTab`, or any admin-override/response-editing behaviour.** This is a pure read-only rendering/layout change to `MatchDetailPage`'s own Availability section and to `AvailabilityRespondentAvatars`' container layout. No poll open/close, no response marking, no override control is touched, added, or relocated.
- **Any change to per-avatar content.** Tooltip text (`squadDisplayName(respondent)`), the `initialsFromName` fallback, and per-status tint (`STATUS_COLOR[status]`, `alpha(theme.palette[tone].main, 0.12)` background / `${tone}.dark` text) are unchanged in both layout modes — only the container's overlap/wrap/truncation behaviour changes.
- **Any backend change.** No entity, endpoint, DTO, or migration touched — every value rendered already comes from `032`/`034`'s existing `GET .../polls` / `GET .../polls/{pollId}/responses` reads, unmodified.
- **`SideAvailability`'s own data-fetching, loading, or empty-poll states.** `MatchDetailPage`'s `homePoll`/`awayPoll`/`homeResponsesQuery`/`awayResponsesQuery` wiring, and `SideAvailability`'s "Loading…"/"No availability poll open…" branches, are unchanged — only the `Stack`'s `alignItems` (see UI Requirements item 3) and the three `AvailabilityRespondentAvatars` calls' new `layout` prop are touched.
- **`RecordDetailScreen`/`ContentCard` themselves.** Confirmed by reading `046`: every section already renders inside its own `ContentCard`, a plain `bgcolor`/`boxShadow` wrapper with no fixed or max height and no internal scroll — a taller Availability section (from avatars wrapping onto more lines) grows the card exactly the way a longer `DetailFieldGrid` already does for other entities' Details sections today. No change needed there, and none is made.

## User Stories

- As a club admin opening a match's detail page, I see Availability directly below Details, above Home XI/Away XI — the question I actually came to answer first.
- As a club admin looking at a side's Available/Unavailable/Unsure clusters, I see every respondent's avatar (up to a generous cap), wrapped onto as many lines as needed, not a "+N" bubble the moment there are more than three or four responses.
- As a club admin looking at `AvailabilityPollsDashboard`'s open-poll cards, nothing changes — the compact, truncated avatar summary I already see there today looks and behaves identically.

## Data Model Changes

None. No entity, field, or migration.

## API Contract

None. No endpoint, request, or response shape is added or changed.

## UI Requirements

### 1. `MatchDetailPage.tsx` — section reorder

Move the `Availability` section block (`MatchDetailPage.tsx:275-299`, currently the last entry in `sections`, spread in under `...(hasAnyXiSide ? [...] : [])`) to immediately after the `Details` section and before the `Home XI` block. Resulting order: Details → Availability → Home XI → Away XI. This is a pure JSX-array-reorder:
- `Availability`'s own gating condition (`hasAnyXiSide` — Boolean(match.homeTeamId) || Boolean(match.awayTeamId)) is unchanged.
- `Home XI`'s (`match.homeTeamId`) and `Away XI`'s (`match.awayTeamId`) own gating conditions are unchanged.
- No section's `heading`, `content`, or internal component (`DetailFieldGrid`, `PlayingXiSummary`, `SideAvailability`) changes beyond the `layout="wrap"` prop addition in item 2/3 below.
- No change to `matchFields`, `iconForMatchField`, `PlayingXiSummary`, or any query/loading logic above the `return` statement.

### 2. `AvailabilityRespondentAvatars` — new, additive `layout` prop

Read in full at `ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.tsx` (58 lines) before building. New prop on `AvailabilityRespondentAvatarsProps`:

```ts
export interface AvailabilityRespondentAvatarsProps {
  status: AvailabilityStatus
  respondents: AvailabilityRespondent[]
  count: number
  // New, optional, additive. 'compact' (default) is today's exact AvatarGroup/max={4} rendering,
  // byte-for-byte — AvailabilityPollsDashboard.tsx passes no value and is fully unaffected.
  // 'wrap' — MatchDetailPage.tsx's SideAvailability opts in — replaces the single-row
  // max-truncation with a flex-wrap grid of individual, non-overlapping avatars that wraps onto as
  // many lines as needed to show every respondent, up to WRAP_LAYOUT_MAX (see below).
  layout?: 'compact' | 'wrap'
}
```

- **`layout` defaults to `'compact'`.** The existing `respondents.length > 0 && <AvatarGroup max={4} sx={{...}}>...</AvatarGroup>` block (lines 31-52 today) renders **identically to today, gated on `layout === 'compact'` (or the prop being absent/undefined)** — same overlapping-circle rendering, same `max={4}` overflow bubble, same per-avatar sizing (`28×28`, `0.6875rem`, `fontWeight: 600`, tint, `1px solid background.paper` border). Per `docs/standards/frontend.md`'s reuse rule, the per-avatar `sx` object is extracted into a single shared local const both `compact` (via `AvatarGroup`'s `& .MuiAvatar-root` selector) and `wrap` (applied directly per-`Avatar`, since there's no `AvatarGroup` wrapper to select through) reference — this moves *where the values live in source*, not what they render; `compact` mode's computed/rendered output must still be pixel-identical to today, just no longer required to be a literal, unrefactored copy-paste of the same object in two places. `AvailabilityPollsDashboard.tsx` requires **zero changes** — it calls the component with no `layout` prop today and continues to.
- **`layout="wrap"`** renders instead: a `Box` with `display: 'flex'`, `flexWrap: 'wrap'`, `gap: 1` (matching `theme.spacing(1)`, the same `8px` gutter `AvatarGroup`'s own overlap currently implies visually) in place of `AvatarGroup`. Each respondent renders its own individual `Avatar` (not overlapping — no `AvatarGroup`, no negative margin), the same shared avatar `sx` `compact` mode's avatars use (see above — one source of truth, not a duplicate), each still wrapped in its existing `Tooltip` showing `squadDisplayName(respondent)`, same `initialsFromName` fallback. Avatars wrap onto as many lines as the section's available width requires — no `max` truncation applied below the cap.
- **A cap, even in `wrap` mode: `WRAP_LAYOUT_MAX = 24`,** a module-level exported constant (`ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.tsx`) rather than a magic number inline. Reasoning, stated explicitly since no documented squad-size maximum exists anywhere in this codebase (confirmed by reading `026-teams.md`, `029-league-management.md`, `031-jersey-numbers.md` — `TeamSquadMember` carries no size cap; only `League.maxPlayingXiSize`/`11` caps the *XI*, a wholly different, smaller number this spec doesn't touch): a club cricket team's XI is 11, and a realistic full-season squad — everyone who's turned out for that team across a season, which is the actual pool `AvailabilityRespondentAvatars` draws its `respondents` from (a team's squad for the match's season, per `032`/`034`) — realistically tops out somewhere in the high teens to low twenties at recreational club level. `24` sits comfortably above that realistic ceiling (so the cap essentially never triggers for a normal squad, per the feature request's own framing) while still bounding a pathological or bulk-imported outlier squad from rendering unboundedly. If `respondents.length > WRAP_LAYOUT_MAX`, render the first `WRAP_LAYOUT_MAX` respondents' avatars plus one trailing "+N" summary `Avatar` (`N = respondents.length - WRAP_LAYOUT_MAX`), styled identically to `AvatarGroup`'s own default overflow avatar (neutral, non-tinted background, matching MUI's own convention) — this fallback is a rare-case safety net, not the default rendering path, and must not be reachable by any realistic squad size exercised in this spec's Test Plan.
- **The `count`/status-label `Typography` caption** (`"{count} {STATUS_LABEL[status]}"`, the trailing element in the outer `Stack direction="row" spacing={1} alignItems="center"`) is unchanged in both layout modes — same position, same source (`count` prop, not `respondents.length`), same styling.
- **`compact` mode's own rendered output is unchanged** — restated as its own explicit requirement so it's independently checkable: a diff of this PR against `AvailabilityRespondentAvatars.tsx`'s current `compact`-equivalent lines shows the new `layout === 'compact'` (or default) gate, and the per-avatar `sx` values moving into the shared const described above (same values, same effect) — but no change to `AvatarGroup`'s own props (`max={4}`), structure, or any other JSX in that branch. (Amended after the standards-review pass on the build: the original wording here said "byte-for-byte... zero changes to that branch's JSX or sx," which was too literal — it would have forced duplicating the same 7-property style object between `compact` and `wrap` instead of sharing it, contradicting `docs/standards/frontend.md`'s reuse rule. The binding requirement was always about rendered/behavioral equivalence, not literal source-diff emptiness; this wording now says that directly.)

### 3. `MatchDetailPage.tsx`'s `SideAvailability` — opt in, and settle the outer-`Stack` alignment question

- All three `AvailabilityRespondentAvatars` calls (Available/Unavailable/Unsure, `MatchDetailPage.tsx:83-85`) pass `layout="wrap"`.
- **Outer `Stack` `alignItems` — explicit call, not left implicit.** `SideAvailability`'s wrapping `Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap` (`MatchDetailPage.tsx:82`, grouping the three status clusters plus the "No response" count side by side) currently has no `alignItems` set, so it defaults to MUI `Stack`'s own default — `stretch` for `direction="row"` in a flex context, which in practice reads close to top-alignment for children of differing natural height but can still vertically center/stretch a short cluster oddly against a much taller one once one status cluster wraps to 2-3 lines and a sibling stays a single line. **Decision: add `alignItems: 'flex-start'` explicitly.** Each status cluster (a `Stack direction="row" spacing={1} alignItems="center"` internally, per item 2 above) is its own independent flex item in the outer row; `flex-start` anchors every cluster's top edge to the same baseline regardless of how many lines its own avatars wrap onto, so a 3-line `Available` cluster sitting next to a 1-line `Unavailable` cluster reads as natural, independent-height flex items side by side (a masonry-like wrap) rather than any cluster being vertically centered or stretched against the tallest sibling. The trailing `"{poll.noResponseCount} No response"` `Typography`, which already carries its own `sx={{ alignSelf: 'center' }}` override, is unaffected by this change — `alignSelf` on an individual flex item always wins over the container's `alignItems`, so that one caption keeps centering itself regardless of the row's new default.
- No other change to `SideAvailability`'s loading/empty-poll branches, its own `Typography` heading, or the `available`/`unavailable`/`unsure`/`poll.*Count` derivation.

**Mobile-first**, per `docs/standards/frontend.md`: `wrap` mode's `flexWrap: 'wrap'` container is inherently mobile-safe by construction — at 375px, fewer avatars fit per line, so the cluster simply wraps to more lines, never causing horizontal overflow or scroll; no breakpoint-specific styling is needed beyond the existing `flexWrap`/`gap`.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `AvailabilityRespondentAvatars.test.tsx` (extended): `layout` omitted (default) and `layout="compact"` both render an `AvatarGroup`-truncated cluster identical to today's behaviour for a 9-respondent input (asserts the "+N" overflow avatar is present, and no more than `max`'s worth of individual respondent avatars are rendered) — proving zero behaviour change for `AvailabilityPollsDashboard`'s call site. `layout="wrap"` with 9 respondents renders exactly 9 individual avatar elements, no "+N" summary avatar — asserted by counting rendered avatar/tooltip elements, not just "doesn't crash." `layout="wrap"` with `respondents.length` exactly at `WRAP_LAYOUT_MAX` (24) renders all 24, no summary avatar. `layout="wrap"` with `respondents.length` one above `WRAP_LAYOUT_MAX` (25) renders exactly `WRAP_LAYOUT_MAX` individual avatars plus one "+1" summary avatar. The `count`/status-label caption renders identically (same text, same position) in both modes regardless of `respondents.length`. |
| Component | `MatchDetailPage.test.tsx` (extended): asserts the rendered section heading order places `Availability` before `Home XI` and `Away XI` (querying rendered `<Typography variant="subtitle2">` heading text in DOM order, matching `RecordDetailScreen`'s existing section-heading rendering per `036`); asserts each of `SideAvailability`'s three `AvailabilityRespondentAvatars` renders in `wrap` mode for a fixture with more than 4 Available respondents (no "+N" overflow avatar present); asserts `SideAvailability`'s outer `Stack` computed `alignItems` is `flex-start`. |
| Component | `AvailabilityPollsDashboard.test.tsx` — **no new assertions needed, explicitly confirmed as a zero-diff file**; its existing test suite (unmodified) continues to pass unchanged, proving the `compact` default path is unaffected by this spec. |
| Contract | None — no endpoint touched. |
| End-to-end | None new. Existing `/manage` Playwright golden paths (not wired into CI, per `036`'s stated precedent) that reach `MatchDetailPage`/`AvailabilityPollsDashboard` are spot-checked for gross breakage (section renders, avatars render, no console error) — this is a layout/ordering change, not a new interaction. |

## Acceptance Criteria

- `MatchDetailPage`'s Availability section renders directly below Details and above Home XI/Away XI, for every match that has at least one real-`Team` side (`hasAnyXiSide`).
- No section's own gating condition, heading, or content component changed beyond the reorder itself and the `layout="wrap"` prop addition.
- `AvailabilityRespondentAvatars` renders every respondent's individual avatar, wrapped onto as many lines as needed, when `layout="wrap"` and `respondents.length <= 24` — no "+N" bubble appears below that count.
- `AvailabilityRespondentAvatars` falls back to a trailing "+N" summary avatar only when `respondents.length > 24` in `wrap` mode.
- `AvailabilityRespondentAvatars` called with no `layout` prop, or `layout="compact"`, renders identically to its pre-this-spec behaviour — `AvailabilityPollsDashboard.tsx` is unchanged, file and rendered output both.
- No avatar's tooltip content, initials fallback, or per-status tint differs from today's, in either layout mode.
- `SideAvailability`'s outer `Stack` renders with `alignItems: 'flex-start'`, so a status cluster that wraps to multiple lines does not visually center or stretch against a shorter sibling cluster.
- No backend file, endpoint, entity, or migration is touched.

## Rollout Notes

- **Flagged for a Claude Design pass before build**, per `docs/standards/design-system.md`'s Workflow step 4 ("A screen needing a new visual pattern spins that off as a library addition first, spec'd on its own") — the `wrap` layout (an individual-avatar flex-wrap grid replacing `AvatarGroup`'s overlapping-circle convention) and its `WRAP_LAYOUT_MAX` cap are genuine, un-mocked-up design decisions specific to this spec, not a copy of an already-approved pattern the way `047` was. Matching the precedent `036`/`032`/`034` each set for their own first-of-a-kind visual additions (`PlayingXiSummary`, `PublicAvailabilityPoll`, `AvailabilityRespondentAvatars` itself), this needs a design pass — exact gap/gutter value, wrapped-avatar sizing at 375px, and the "+N" fallback avatar's own visual treatment — before implementation, not just this spec's literal values taken as final.
- **Single small PR.** Files touched: `ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.tsx` (+ `.test.tsx`, `.stories.tsx` — a new `wrap`-mode story alongside the existing `compact` one), `ui/src/pages/manage/MatchDetailPage.tsx` (section reorder, `layout="wrap"` on `SideAvailability`'s three calls, `alignItems: 'flex-start'` on the outer `Stack`), and `MatchDetailPage.test.tsx`. `ui/src/pages/manage/AvailabilityPollsDashboard.tsx` and its own test file are confirmed **zero-diff** — not touched, not re-verified beyond its existing, unmodified test suite continuing to pass.
- No `docs/roadmap.md` entry needed — this spec fully resolves the two problems it names, with no deferred follow-on item.
