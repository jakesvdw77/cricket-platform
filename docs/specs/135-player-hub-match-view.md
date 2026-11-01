# 135: Player Hub Match View

**Depends on:** `121-player-hub-menu-and-fields.md` (Hub menu, `hubNav.ts`, `hubBack`, footer Back, phone rules, `MyPlayerAccess`), `123-player-hub-leagues.md` (league page, `MyLeagueFixtureDto` rows, `MyLeagueServiceImpl`, "Your game" highlight; it left fixture pages and Schedule > Matches to this spec), `124` (Hub league rows), `133-field-location-and-directions.md` (`HubFixtureLocation`, `useMatchWeather`, `GetDirectionsButton`), `129`-`134` and `docs/standards/page-anatomy.md` (manager Matches round), `040-announce-team.md` (`MatchSide.announced`, whose Non-goals say the flag exists to gate this view), `076-team-selection.md`, `034`/`064`-`066` (availability polls), `119` (`/api/v1/me/players`, poll answer save), `122`/`114` (junior initials via `shareName`), the manager Match's existing `scoringUrl` and `streamingUrl` fields (`130`, `MatchDetailPage`), `docs/standards/*.md`.
**Status:** draft. Owner decisions of 2026-11-01 are recorded under "Decisions". No code is written by this spec. Mockup: `docs/mockups/player-match-view-mockup.html`.

## Problem & Goals

The manager Matches pages follow `page-anatomy.md` (`130`-`134`), but a parent, player or agent in the Player Hub has no page for a match and no list of their matches. The only match rows are league fixtures with no tap target; `schedule.matches` in `hubNav.ts` is a Soon item. A parent cannot tell what is on now, whether the player is selected, where to follow the score, or watch a stream the club already provides (the manager Match has a scoring link and a streaming link that only managers see).

Goals:

- **A. Schedule > Matches goes live**: Live Now, Upcoming and Recent sections for the selected linked player.
- **B. A player-facing match page** (upcoming and live states).
- **C. Live score and Watch Live entries**, with an in-app TV-style Watch Live page; live scoring is a **replaceable slot** (see "The LiveScore seam").
- **D. Hub rows consistent with the manager lists**, privacy by construction, one scoped backend read set.

## Non-goals

- **Sharing from the player view** (owner). No Share button, dialog or team-sheet share.
- **Editing selection**, announcing, releasing, availability management or any manager action. The availability answer is saved by the existing poll flow (`119`).
- **An in-app live scorecard now.** Today the live score is the external scoring link (Follow Live Score). The owner has said our own scoring app view replaces it later; that is a separate spec that plugs into the seam below. This spec builds the seam, not the scorecard, and shows no ball-by-ball, scorecards or player performances. A played match shows the published result line only.
- **Hosting, relaying, recording or proxying video.** The app embeds the provider's own player; it never touches the stream.
- **Chat, comments, reactions, notifications or "match started" push.** A later spec.
- **Embedding arbitrary HTML or arbitrary sites.** Only the allow-listed providers below; anything else is a button.
- **Other players' availability**, counts, notes and any manager-only data.
- **Training sessions and non-match events.**
- **Results and Team sheets Hub items** (still Soon; they can reuse `MyMatchDto` later).
- **Per-club time zones** (known gap: South Africa assumed, so "started" uses that zone).

## Decisions

1. **Open questions 1, 2, 3 and 5 of the first draft stay at their defaults (owner, 2026-11-01):** (1) a side's XI is visible only after the manager announced it; (2) the opposing side's XI is shown once announced; (3) a league row that is not the player's team's game opens no match page; (5) a twelfth man reads "Selected (12th)".
2. **Schedule > Matches is live now (this spec)** and separates upcoming from live matches.
3. No sharing in the player view.
4. **Live scoring is a replaceable slot (owner, 2026-11-01):** external link today, our own in-app live scorecard later, with no external-link assumption anywhere outside the slot.

## User Stories

- As a parent, I open Schedule > Matches and see a match that is on now at the top, clearly marked LIVE, with how long ago it started.
- As a parent, I see upcoming matches with a countdown and recent matches with their result, tucked away until I want them.
- As a parent, I tap a match and see when, where, who plays, whether my player is selected ("Not announced yet" until the manager announces) and my availability answer with a link to change it while the poll is open.
- As a parent, I follow the live score: today a button opens the club's scoring site in a new tab; later the score shows in the app.
- As a parent, when the club has set a stream and the match is live, I tap Watch Live and see it in a TV-style page in the app; if the stream cannot be embedded, I tap Open Stream.
- As a parent of a junior team, I see other juniors as initials only.
- As an agent, I see only matches of players I am linked to.

## Data Model Changes

None. `MatchSide.announced` (`040`), `Match.scoringUrl` and `Match.streamingUrl` (existing manager fields) are read. The lifecycle phase is computed, not stored.

## API Contract

**Finding (flagged, not assumed):** new reads are required. `MyLeagueFixtureDto` carries no players, selection, answer or links, `MyPoll` lists open polls only with no match id, and no endpoint accepts a fixture's `matchId`. The brief named `MyScheduleItemDto`; that type does not exist in `backend/` or `ui/src`, so the position fields `133` added on `MyLeagueFixtureDto` are reused instead.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/matches` | Authenticated; `MyPlayerAccess.resolve` only | The held player's matches as `MyMatchListDto` (Live, Upcoming, Recent) |
| `GET /api/v1/me/players/{playerKey}/matches/{matchId}` | Same | One match as `MyMatchDto` |

Failures, both: key not held, malformed key or dropped-out player is **404**; SUSPENDED is **403**; a `matchId` that is not a match of one of the held player's teams (squad row for the match's season, home or away by `team_id` or its league team) or is another club's, is **404**, never 403 or an empty body. Both are added to `MePlayersController` (thin, delegating to a new `MyMatchService` interface and impl, `@Transactional(readOnly = true)`, the shape of `MyLeagueService`), reuse the existing match, side, poll answer and published-result read logic through internal read methods, and map to `My*` DTOs; manager controllers and DTOs are untouched. `openapi.yaml` is regenerated by hand. The caller supplies no club.

**Live rule (server side, one place, `MatchPhase`).** A match is `LIVE` when all hold: it is not cancelled, postponed or inactive; its start (`date` + `time`, Open question 6 for no time) is at or before now; now is before start plus **`LIVE_WINDOW_HOURS`** (a constant, default **8**, Open question 7); and it has **no published result**. Otherwise it is `UPCOMING` when the start is in the future, and `RECENT` when it has a published result or the window has passed (a match past the window without a result reads "Result pending"). The presence of a scoring or streaming link does **not** define live (a match with no links is still on); links only decide which entries are offered. The server computes `phase` and `startedAt` with its own clock so every device agrees; the client only formats elapsed time.

**`MyMatchListDto`:** `live` (list), `upcoming` (list, soonest first, the current season, capped at 20), `recent` (list, newest first, capped at 10). Each item `MyMatchSummaryDto`: `matchId`, `phase`, `date`, `time`, `startedAt` (live only), home and away `{ name, logoUrl }`, `league` name or null, `venue`, `mine`, `selection`, `hasLiveScore` (see the seam), `hasStream` (true only when live and a stream is set), `result` summary (recent only).

**`MyMatchDto`** (response only; a test asserts the exact JSON keys)

| Property | Type | Notes |
|---|---|---|
| `matchId`, `date`, `time`, `startedAt` | | `startedAt` live only |
| `phase`, `status` | `LIVE`, `UPCOMING`, `RECENT`; `UPCOMING`, `PLAYED`, `CANCELLED`, `POSTPONED` | Phase per the rule above |
| `league`, `season` | `{ id, name }` | League null for a friendly |
| `venue`, `playingAreaId`, `playingAreaName`, coordinates, access point and note | as `MyLeagueFixtureDto` (`133`) | Feeds `fieldFromMatch`, `useMatchWeather`, `directionsTarget` |
| `home`, `away` | `{ name, logoUrl, mine, announced, players[] }` | `players` empty unless that side is announced; each `{ name, role, captain, keeper }`, junior names already initials |
| `selection` | `SELECTED`, `NOT_SELECTED`, `NOT_ANNOUNCED` | For the held player; `SELECTED` includes the twelfth man |
| `availability` | `{ answer, pollId, pollOpen }` or null | The held player's own answer only |
| `liveScore` | `LiveScoreSource` or null | The one live-score field; see the seam. Present while live or upcoming; null otherwise |
| `stream` | `{ url, provider, embedUrl }` or null | Present **only while live**, `https` only. `provider` is `YOUTUBE`, `VIMEO`, `FACEBOOK` or `OTHER`; `embedUrl` is null for `OTHER` and for any link that does not parse |
| `result` | `{ homeScore, awayScore, resultLine }` or null | Published only |

**Embed URL (server builds, never trusts HTML).** A pure `StreamEmbed` helper parses the pasted link with `java.net.URI`, requires `https`, matches the host against an allow-list, extracts an id and **constructs** the embed URL from a fixed template; nothing from the link beyond the validated id or encoded `href` is copied. Templates: YouTube (`watch?v=`, `youtu.be/`, `/live/`, `/embed/`) to `https://www.youtube-nocookie.com/embed/{id}`; Vimeo (`vimeo.com/{id}`) to `https://player.vimeo.com/video/{id}`; Facebook video links to `https://www.facebook.com/plugins/video.php?href={url-encoded original}&show_text=false`. Anything else: `embedUrl` null. The client renders what the server returns and never builds its own URL.

**Deliberately absent:** others' responses and counts, notes, draft results, contacts, active flags, squads beyond the announced XI, audit and import data, any stream on a match that is not live.

**Privacy (server).** An unannounced side's `players` is empty. Juniors (held or listed player under 18, or a league with `maxAge` at or below 18, per `122`) appear as initials through the `shareName` rule applied server side. The held player's name is not repeated.

## The LiveScore seam (owner, 2026-11-01)

Live scoring is **one replaceable slot**, so the later in-app scorecard changes one component and one data read, nothing else.

- **Data:** `MyMatchDto.liveScore` (and `hasLiveScore` on list items) is a discriminated `LiveScoreSource`, built in one server method `LiveScoreResolver`. Today it returns `{ kind: 'EXTERNAL', url, host }` from `Match.scoringUrl` (https only, null otherwise). The future scoring spec adds `{ kind: 'NATIVE', summary: { homeScore, awayScore, overs, striker, nonStriker, lastBalls[], status } }` filled from our own scoring data (and may drop `EXTERNAL`). The wire shape of every other field is unchanged. Names and numbers in a `NATIVE` summary pass the same junior initials rule.
- **UI:** one Hub-local component `LiveScore` (`HubLiveScore.tsx`) takes `source` and a `variant` (`row`, `card`, `tv`) and is the **only** place that knows what a score source is. Today `EXTERNAL` renders the **Follow Live Score** button (new tab, `noopener noreferrer`, https only, never framed) with the "Scores are kept on {host}" line; `NATIVE` (later) renders the summary strip (score, overs, batters, last balls). It sits in exactly three places: the **Live Now row**, the **match page** and the **Watch Live page** (below the scoreboard strip, inside the TV surround). Nothing else in the Hub reads `scoringUrl`, mentions an external site or opens a scoring link; list rows, figures, filters and tests use `hasLiveScore` and the component, never the URL.
- **Polling:** the existing 60 s refetch while live is the only update mechanism; a native scorecard may later raise it or add a stream, inside the seam.
- **Not decided here:** the scorecard's data model, how scores are captured, and whether `EXTERNAL` stays as a per-match fallback. The mockup shows the `NATIVE` variant as "later" for review only.

## UI Requirements

Composed from `HubFrame`, `hubStyle.ts` (`HUB`, `hubHeading`, `darkFieldSx`), `HubFixtureLocation`, `LeagueLogo`, `leagueFormat.ts`, `LinkedPollCard` wording, the compact `Button`, `BrandIcon`. Dark console, `HUB` and `brandTokens.ts` only, no new hex literals (`120` gate); the pulse uses the existing gold, disabled under `prefers-reduced-motion`. Hub-local components: `HubMatches.tsx` (list), `HubMatchRow.tsx`, `HubMatch.tsx` (page), `HubMatchFigures.tsx`, `HubMatchSide.tsx`, `HubWatchLive.tsx`, `HubLiveScore.tsx`, `LiveBadge.tsx`, `streamFrame.ts`. No shared component.

### 1. Schedule > Matches (`HubMatches.tsx`)

`schedule.matches` loses `soon` and `soonCopy` (label stays "Matches"; six top-level items unchanged). Route `/account/players/:key/schedule/matches`. Switching player re-fetches. Footer Back "Back to Schedule" on a phone, "Back to menu" otherwise (as Leagues, `123`).

Sections, in order:

1. **Live Now** (only when a match is live; pinned to the top): the heading carries a small pulsing gold dot. Each live card has a **LIVE badge** (gold fill, ink text, a pulsing dot, the text "LIVE" so colour is never the only cue), a **gold left edge 4 px and a gold tint** (the "Your game" language of `123`, one step stronger), the teams, the league, "Started 1h 20m ago" (updates each minute, from `startedAt`), the player's selection status, the **`LiveScore` slot (`row` variant)** and **Watch Live** when `hasStream`. The card body opens the match page; the inner controls sit outside the stretched link.
2. **Upcoming**: rows grouped by date, each with the time, teams, league, venue, countdown ("in 3 days", "today", "tomorrow"), the selection status as a text tag, and the forecast and Get Directions from `HubFixtureLocation` within 7 days (`133`).
3. **Recent**: **collapsed by default** behind a "Recent Matches" disclosure (button, `aria-expanded`), then newest first, each with the scores and result line ("Result pending" when past the window with no result). Played rows dimmed slightly as in `123`.

Rows follow the manager lists' rules: the whole row is one tap target (44 px, hover tint, pointer, gold focus ring), **no chevron, no kebab** (the Hub has no row actions, so a kebab would be a lone control), Title Case labels, "-" for missing values, no count text. States: skeleton, error with retry, and the empty state "No matches for {player} yet" with the brand icon.

Hub league rows (`HubLeagueGames`): a `mine` Schedule or Results row becomes one tap target opening the match page (Decision 1.3: a non-`mine` row opens nothing and has no tap cue). Get Directions stays inside the row, outside the stretched link (`133`).

### 2. Match page (`HubMatch.tsx`)

Route `/account/players/:key/schedule/matches/:matchId`, with `?from=` (`matches` or `league:{id}`) so footer Back reads "Back to Matches" or "Back to {league} schedule". Footer Back is the only Back.

1. **Title row:** logos, "Home versus Away" in the display face, **one** status badge inline: Upcoming, Played, Cancelled, Postponed, or the pulsing **LIVE**. No Manage menu.
2. **Figures:** static compact counters (no icons, not clickable): **When** (date and time; countdown when upcoming; "Started 1h 20m ago" when live), **Where**, **League And Season** ("Friendly" when none), **Your Status** (Selected, Not Selected, Not Announced Yet; "Played" with a result).
3. **Live entries:** the **`LiveScore` slot (`card` variant)**, shown while live, and while upcoming when a source exists. For `EXTERNAL` it is a flat hairline card with the club's name and logo, "Scores are kept on {host}" and an outlined **Follow Live Score** button. Then, when live and `stream` is set, a **Watch Live** card with a small poster and a gold **Watch Live** button to the Watch Live page.
4. **Location row:** forecast badge and Get Directions from `HubFixtureLocation`, upcoming only.
5. **Your Availability** panel: the answer in words; when `pollOpen`, an outlined "Answer Availability" button into the existing Hub poll answering; closed shows "Poll closed". Hidden when `availability` is null.
6. **Teams:** two flat hairline panels, "Your team" text tag on the player's side; announced XI (initials for juniors, "(C)", "(WK)") or "Team not announced yet".
7. **Result** (played): scores and result line, no scorecard.

States: skeleton per band, 404 "This match is not available", error with retry.

### 3. Watch Live page (`HubWatchLive.tsx`)

Route `/account/players/:key/schedule/matches/:matchId/watch`. Footer Back "Back to Match". Shown only while the match is live and `stream` is set; otherwise the page shows "The stream is not on right now" with the Back (no stream link is ever returned for a non-live match).

- **TV surround:** a dark panel (`HUB.menu` ground, `HUB.line` hairline, 4 px radius, no shadow) with a thin gold top rule. Inside, from top: the **scoreboard strip** (home logo and name, "versus", away logo and name in the display face on one line, the league and venue beneath in `HUB.sand`, the LIVE badge at the right), the **16:9 frame** (`aspect-ratio: 16 / 9`, full width, black ground, a dark surround of about 12 px so it reads as a screen), then the **`LiveScore` slot (`tv` variant)** directly under the frame, and under that "Open Stream" (outlined, always present as the fallback, new tab).
- **Player frame:** when `embedUrl` is set, a **click-to-play poster first** ("Tap To Watch", the live badge, the provider name): no third-party request is made until the user taps (Open question 8). After the tap an `<iframe>` loads `embedUrl` with `sandbox="allow-scripts allow-same-origin allow-presentation"`, `referrerpolicy="strict-origin-when-cross-origin"`, `allow="autoplay; fullscreen; picture-in-picture"`, `loading="lazy"`, a `title` naming the match, and `allowfullscreen`. No `allow-top-navigation`, no `allow-popups`.
- **Fallback:** when `embedUrl` is null the frame area shows "This stream opens on {host}" and a gold **Open Stream** button, in the same TV surround; nothing is embedded.
- **Embed refusal:** a provider can refuse a frame without the page being told. The always-visible Open Stream button covers that, with the helper text "Not loading? Open the stream in a new tab."
- Not shown: chat, comments, sharing, any control that is not the provider's own player or the `LiveScore` slot.

### 4. Where the Hub differs from the manager standard, and why

The Hub is a dark console with a footer Back (`121`), so: no top-row Back, no filled Manage menu (nothing to manage), no kebab (no actions), no Season pill (one season in context), badges and figure counters are drawn in `HUB` tokens, and "Only my games" keeps its Hub form. Shared rules that carry over: flat hairline surfaces, compact static counters without icons, Title Case labels, no chevron, one tap target per row, 44 px touch targets, no lone control rows.

### 5. Security and operations items (open, not decided here)

- **CSP `frame-src`.** If the platform sets a Content-Security-Policy (not verified in this spec; the nginx or Spring config must be checked), `frame-src` must allow `https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com`, and nothing wider. Open question 9.
- **Privacy.** Loading a provider iframe discloses the viewer's IP and cookies to that provider; the click-to-play poster and `youtube-nocookie.com` reduce this but do not remove it. Streams of junior matches are the club's responsibility; a per-club switch is Open question 10.
- **Stored links are manager input.** The server accepts only `https` and re-validates on read; a `javascript:`, `data:` or `http` link yields null. A test covers each.

### 6. API client and docs

`myPlayersApi.ts` gains `MyMatchListDto`, `MyMatchDto`, `LiveScoreSource`, `useMyPlayerMatches(key)` (refetch every 60 s while a live match is present), `useMyPlayerMatch(key, matchId)` (same), `retry: false`. The match query is invalidated after a poll answer is saved. Docs updated in the same change: `page-anatomy.md` ("Player Hub differences" note and review log row), `docs/roadmap.md` (`123` follow-up resolved; Results and Team sheets items remain; the in-app live scorecard added as a Later item), `040`'s Rollout Notes pointer, `design-system.md` only if a component changes, `docs/standards/frontend.md` (Hub reads matches only through `myPlayersApi`; iframes only in `HubWatchLive`; scoring only through `HubLiveScore`).

## Test Plan

Per `docs/standards/testing.md`; tests are written after the owner has checked the function.

- **Unit (JUnit 5):** `MatchPhase`: just before start is upcoming, at start live, one minute before the window ends live, at the window upcoming-to-recent, a published result ends live early, cancelled and postponed never live, no time set; `StreamEmbed`: each provider's accepted shapes, `http`, `javascript:`, `data:`, unknown host, host spoofing (`youtube.com.evil.example`, userinfo tricks), malformed ids, output host always on the allow-list; `LiveScoreResolver`: `EXTERNAL` for an https link, null for others; `MyMatchServiceImpl`: 404 for another team, club or unknown id; selection states; empty XI when unannounced; junior initials; own answer only; `stream` null unless live.
- **Integration (Testcontainers):** authorisation matrix (key not held, malformed, dropped-out, another account's key, manager role without link: 404; unauthenticated 401; SUSPENDED 403); exact JSON keys, no manager-only data; a two-club parent gets no cross-club match; a non-live match never returns `stream`.
- **Contract:** hand-regenerated `openapi.yaml` diff, two paths and their schemas (`liveScore` as a discriminated type), additions only; ArchUnit layering.
- **Unit (Vitest):** `hubBack` states; countdown and elapsed formatters; row rules; `streamFrame` never builds a URL itself; a grep-style test that only `HubLiveScore` reads `liveScore.url`.
- **Component and Storybook:** list with and without a live match (pinned, LIVE badge text, order, Recent collapsed), empty and error; match page upcoming and live, each selection state, answer panel open and closed; `LiveScore` in all three variants for `EXTERNAL` (new tab, `noopener`) and a `NATIVE` story; Watch Live with an embed (poster first, no iframe before the tap, iframe attributes after), with the fallback, and non-live; no Share, Manage or Edit; one Back. Stories at 375, 768, 1280. Reduced motion removes the pulse.
- **E2E (Playwright):** parent opens Schedule, Matches, sees the live card, taps Watch Live, taps the poster and sees the frame; taps Follow Live Score and a new page opens; opens an upcoming match and answers availability.
- **Manual:** three sweeps, keyboard pass, 200 percent zoom, a real YouTube and a real Facebook link, a link that refuses embedding, a junior team.

## Acceptance Criteria

1. Schedule > Matches is live (not Soon), six top-level items unchanged, with Live Now (pinned, only when a match is live), Upcoming (with countdown) and Recent (collapsed by default, with result).
2. A live match shows a LIVE badge (text, not colour alone), the accent edge and tint, and the elapsed time; the rule is the one stated and is computed server side.
3. `mine` league rows and every Matches row open the match page by tapping anywhere except an inner button; no chevron, no kebab; a non-`mine` league row has no tap cue.
4. The match page shows one status badge, four static compact figures, the `LiveScore` slot and Watch Live entry when they apply, the forecast and Get Directions, the availability panel, both teams and the result when played.
5. Your Status reads Not Announced Yet until the player's side is announced; no XI is returned or drawn for an unannounced side; juniors are initials server side.
6. Live score appears in exactly three places (Live Now row, match page, Watch Live page) through one component and one DTO field; today it opens the scoring link in a new tab with `noopener` and the external site is never embedded; no other Hub code reads `scoringUrl`.
7. Watch Live appears only while the match is live and a stream is set; it shows the TV surround, scoreboard strip and a 16:9 frame; no third-party request happens before the tap; an unlisted or unparsable link shows Open Stream and embeds nothing; Open Stream is always available.
8. The embed URL comes only from the server's allow-listed templates; non-`https` links yield no `liveScore`, `stream` or `embedUrl`.
9. The responses contain no manager-only data; the endpoints answer 404 outside the held player's teams or club, 403 suspended, 401 unauthenticated.
10. No Share, Edit, Manage, chat or in-app scoring entry exists beyond the seam; the footer Back is the only Back; no new table or migration; "children" appears nowhere.

## Rollout Notes

- **Order:** `MatchPhase`, `StreamEmbed` and `LiveScoreResolver`, the two reads and `openapi.yaml`, API client, list, match page, Watch Live page, row changes, docs. The CSP check (Open question 9) must be done before Watch Live is released; the list and match page can ship without it. No feature flag unless Open question 10 is answered yes.
- **Later:** (1) **the in-app live scorecard** replaces the external scoring link through the LiveScore seam: a new spec adds the `NATIVE` source and summary strip (score, overs, batters, last balls) on the Live Now row, match page and TV page, with no change elsewhere; (2) Results and Team sheets Hub items reusing `MyMatchDto`; (3) "match started" notifications; (4) a club switch for streams; (5) sharing from the player view if asked.

## Documentation gaps

- `page-anatomy.md` has no rule for Hub (dark console) pages; section 4 is the working interpretation, to be recorded there once agreed.
- No existing spec says which poll covers a match for the "answer" lookup (`034`). Default: the held player's answer on the match's team squad poll, else the group poll including the match; confirm against `PollAnswer` before building.
- Whether a CSP is set anywhere today is unverified (Open question 9).

## Open questions (defaults apply)

6. **Match with no start time:** default treat as `09:00` for the live rule; alternative never live without a time.
7. **`LIVE_WINDOW_HOURS`:** default **8** (covers a T20 or a one-day game); alternative per-format or per-league.
8. **Click-to-play before the iframe loads:** default yes (privacy); alternative load on page open.
9. **CSP and `frame-src`:** to be checked; default allow only the three provider hosts.
10. **Per-club switch to hide streams in the Hub:** default no switch; alternative a club setting, off until switched on, given junior viewers.
11. **Live match with no live-score source or stream:** default still shows LIVE with elapsed time and no buttons; alternative show it as Upcoming-style until a link exists.
