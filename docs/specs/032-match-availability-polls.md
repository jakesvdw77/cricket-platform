# 032 — Match Availability Polls

**Depends on:** `029-league-management.md` (`Match`, `MatchSide`, `MatchSidePlayer`, `TeamSquadMember`, `Season`, `League` — this spec's poll reads a `Team`'s squad the same season-scoped way `MatchSideTab`/`PlayingXiBuilder` already do, `listSquad(clubId, teamId, seasonId)`, and shows up as a new tab alongside `029`'s existing Details/Home XI/Away XI tabs on `MatchFormPage`; this spec also reuses, unmodified, `029`'s own established precedent that `MatchSide`/XI-selection authorization is scoped to the `Match`'s own owning `club_id`, not each side's `Team`'s own club — the identical rule applies here to poll authorization, not re-litigated), `030-team-sheet-communication.md` (the "Communicate Team Sheet" dialog and `RecordCard.secondaryActions` pattern, cited for shape only; its Non-goals explicitly deferred a "WhatsApp text template" as future work — this spec is that future work, but for a poll-invite message, a new and distinct dialog, not a reuse of `TeamSheetCommunicationDialog` itself), `028-players.md` (`PlayerProfile` — confirms adding a player creates no login capability, no Keycloak account, and no `RoleAssignmentRole.PLAYER` grant, reserved but ungranted — the reason this spec's response flow can't assume a real player session), `006-post-login-home-shells.md` (confirms `/player`'s Availability tab stays an unguarded `EmptyState` stub, and that `/manage/availability` is already routed in `ui/src/App.tsx` to `<EmptyState title="Availability Polls" description="Coming soon." />` — this spec is what wires that up for real), `020-club-manager-access.md` (the `/api/v1/manage/**` + `@access.canAdministerClub` pattern this spec's admin-facing endpoints reuse unmodified — no new auth model for the admin side).
**Status:** draft.

## Problem & Goals

`029`'s own Non-goals named this explicitly as deliberately trimmed-out scope: "Availability polls, AI-assisted XI suggestion, an 'Announce Team' lock/notify/email workflow, or public/shareable team-sheet graphics... this spec is a deliberately trimmed-down rebuild — squad and playing-XI selection only, none of the above. Real future work, not forgotten." `030` closed the "get a team sheet in front of the team" half of that future work with a client-generated, manually-shared PDF/text. This spec closes the other half: finding out who's actually available *before* an admin builds that XI. `006` shipped both halves of the placeholder for this exactly a day-one stub each — `/manage/availability` (club admin) and `/player`'s "Availability" tab (player) — and both are still `EmptyState` today.

The blocker every prior spec in this area has respected is that **no player login exists yet** — `028` was explicit that adding a player creates no Keycloak account and grants no `RoleAssignmentRole.PLAYER`. A poll that required a real player session to respond simply isn't buildable on top of what this codebase has today. This spec's scope is therefore split deliberately in two: a data model that's identity-agnostic from day one (so a future login-bearing spec can adopt it with zero schema rework), and, for this pass specifically, a **public, unauthenticated, self-select response flow** — a squad member reaches a poll via an unguessable link and sets their own status by tapping their own row, no login, no session, no separate "who are you" step.

**Goals**
- A club admin can open an availability poll for either side of a `Match` that's a real `Team` (home or away), from a new Availability tab on `MatchFormPage`, and close it again later — reversibly, at any time.
- A club admin can see, per open or closed poll, a response-count summary (Available/Unavailable/Unsure/No response) and the full squad's current status, without leaving `MatchFormPage`.
- A club admin can generate a channel-agnostic, copy-paste-ready invite message (a poll-invite text, mirroring the legacy Cricket Legend app's WhatsApp-text-generation shape) embedding the poll's public link, and share it themselves through whatever channel they choose.
- Anyone holding a poll's link can open a public, no-login page listing every squad member for that side, and set their own status (Available/Unavailable/Unsure) by tapping their own row — defaulting to their current stored response if any.
- Closing a poll makes that public page read-only; reopening it accepts new responses again.
- The data model (`player_profile_id`-keyed, not session-derived) is forward-compatible with a future spec that grants real player login and wires a genuine "My Availability" view against these same two tables, without changing either one.

## Non-goals

- **Full player login, Keycloak provisioning, or an `RoleAssignmentRole.PLAYER` grant.** Still exactly as reserved-but-ungranted as `028`/`015` left it. This spec's response flow works entirely without it (see Problem & Goals) — a future spec, not this one, provisions real player accounts (mirroring `016`'s pattern) and wires a logged-in "My Availability" view against the tables this spec creates.
- **Automated delivery of any kind** — no automated email send, no push notification, no in-app notification system. Legacy's `PlayerNotification` table, `getMyNotifications`/`getUnreadCount`/`markAllRead`/`clearAll` endpoints, and `resendPollNotifications` action are explicitly not built here. Delivery is entirely manual: an admin generates invite text and copies it into whatever channel they choose themselves (see Rollout Notes and UI Requirements).
- **Resend/reminder notifications.** Legacy's `resendPollNotifications` is moot with no automated delivery to resend in the first place.
- **Per-player response privacy or identity verification in the no-login flow.** Considered and deliberately rejected in this pass: the alternative — hiding other players' responses from a given visitor — is incoherent without a real session to know "which row is you." Every squad member's name and current status is visible to anyone holding the poll's link, same as every other squad member's own name and status; see Data Model Changes/API Contract for the "unguessable link" security posture this trades into, stated explicitly as a considered, deliberate tradeoff, not a silent gap.
- **Any verification that the person tapping a given squad member's row actually is that person.** The poll's `id` (an unguessable UUID) is the only thing gating access and the only thing distinguishing "whose row is whose" — anyone holding the link can set any squad member's status. Accepted as the same trust level as an "anyone with the link" shared document, not a bug to fix later in this pass.
- **Auto-linking poll responses into playing-XI selection.** The new Availability tab and the existing Home XI/Away XI tabs (`029`) stay fully independent — no "auto-add players who said Available" automation, matching `029`'s own explicit Non-goal on AI-assisted XI suggestion. An admin reads the Availability tab and still manually builds the XI in the existing `PlayingXiBuilder`.
- **Any change to `Match`/`MatchSide`/`MatchSidePlayer`/`TeamSquadMember`'s own schema.** This spec adds exactly two new tables and touches none of `029`'s existing ones.
- **A `/platform` mirror.** Same established reasoning every spec since `020` has given — `canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**`.
- **A `TeamSheetCommunicationDialog` reuse for the invite message.** `030`'s dialog is PDF/print-shaped and match-scoped to both sides at once; this spec's share dialog is a new, poll-scoped, plain-text dialog — a related shape (an editable/regenerable text area embedding a link), not a shared component.
- **Editing a poll's response data from the admin side.** The Availability tab is read-only for individual player statuses — an admin can open/close the poll and read the summary/squad list, but cannot directly set or override a specific player's status from `/manage`. Only the public link's self-select flow writes a `PlayerAvailability` row in this pass; a manager-override endpoint (legacy had one) is real, identifiable future scope once a real need for it shows up, not built here.
- **Bulk/CSV anything, or any poll-level configuration beyond open/closed.** One poll per `(match, team)`, toggled open or closed, nothing else configurable (no close date, no reminder schedule).

## User Stories

- As a club admin, from a match's Availability tab, I can open a poll for either side that's a real `Team`, so squad members can be asked whether they're available.
- As a club admin, I can close a poll at any time (making its public page read-only) and reopen it later without losing any of the responses already collected.
- As a club admin, I can see a running Available/Unavailable/Unsure/No-response count and the full squad's individual current status for a poll, without leaving `MatchFormPage`.
- As a club admin, I can open a "Share invite" dialog that generates an editable, regenerable, plain-text invite message embedding the poll's public link, and copy it myself into whatever channel I use (WhatsApp, SMS, email, a team group chat).
- As a squad member (or anyone holding the poll link), I can open the poll's public page, see every squad member's name and current status, and set my own status by tapping my own row — no login, no password, no separate "who are you" step.
- As a squad member visiting a closed poll's link, I can still see everyone's current status, but I can't change anything — the page is read-only.
- As anyone visiting a poll link that doesn't exist (a bad or stale id), I see a clean "not found" message rather than a broken page.
- As a club admin for club X, I cannot open, close, or view response data for a poll on club Y's match, even by guessing an id — enforced server-side.

## Data Model Changes

**New entity — `MatchAvailabilityPoll`**, one per `(match, team)` — mirrors the legacy Cricket Legend app's own `MatchAvailabilityPoll` entity shape (`(match_id, team_id)`-unique), adapted to this codebase's UUID PKs and season-scoped `TeamSquadMember` model instead of legacy's flat `Team.squadPlayerIds`:

```
MatchAvailabilityPoll {
    uuid      id
    uuid      match_id     -- FK match.id, not null
    uuid      team_id      -- FK team.id, not null — must equal this match's own home_team_id or
                             -- away_team_id (the same rule 029's MatchSide creation already
                             -- enforces for exactly the same reason: a free-text opponent has no
                             -- roster to poll)
    boolean   open         -- not null, default true — a poll starts open the moment it's created;
                             -- this is the entity's own lifecycle (Open/Closed), not this codebase's
                             -- usual Active/Inactive "disable, never delete" flag, which doesn't map
                             -- to anything here — deliberately no `active` column
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

Unique on `(match_id, team_id)` — a side gets at most one poll per match, matching legacy's own uniqueness exactly.

**New entity — `PlayerAvailability`**, one per `(poll, player)` — mirrors legacy's own `PlayerAvailability` entity shape, keyed against this codebase's `PlayerProfile` (club-scoped player record, `028`) rather than legacy's flat `Player`:

```
PlayerAvailability {
    uuid               id
    uuid               poll_id            -- FK match_availability_poll.id, not null
    uuid               player_profile_id  -- FK player_profile.id, not null — deliberately
                                            -- player-identity-agnostic, not session-derived (see
                                            -- Rollout Notes on forward-compatibility with real
                                            -- player login)
    AvailabilityStatus status             -- enum AVAILABLE | UNAVAILABLE | UNSURE, not null —
                                            -- fresh, clearer names than legacy's own YES/NO/UNSURE,
                                            -- since this is a new entity, not a literal port
    timestamp          created_at
    timestamp          updated_at
    uuid               updated_by         -- always null in this pass — the public write path has
                                            -- no authenticated identity to attribute it to; kept
                                            -- nullable rather than omitted so a future login-aware
                                            -- write path can populate it without a schema change
}
```

Unique on `(poll_id, player_profile_id)` — one status per squad member per poll; a repeat write from the same squad member updates the existing row rather than creating a second one (an upsert, not an append-only log — no historical trail of status changes, matching this codebase's default posture toward mutable fields elsewhere).

**Migration** (next sequential file after `031`'s `022-add-jersey-numbers.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/023-add-availability-polls.sql

CREATE TABLE match_availability_poll (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES match(id),
    team_id     UUID NOT NULL REFERENCES team(id),
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (match_id, team_id)
);

CREATE INDEX ix_match_availability_poll_match ON match_availability_poll(match_id);
CREATE INDEX ix_match_availability_poll_team ON match_availability_poll(team_id);

CREATE TABLE player_availability (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id            UUID NOT NULL REFERENCES match_availability_poll(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID,
    UNIQUE (poll_id, player_profile_id)
);

CREATE INDEX ix_player_availability_poll ON player_availability(poll_id);
CREATE INDEX ix_player_availability_player ON player_availability(player_profile_id);
```

**Business rule, enforced server-side (both admin creation and any future consumer):** `MatchAvailabilityPoll.team_id` must equal whichever of the parent `Match`'s own `home_team_id`/`away_team_id` matches it — a free-text opponent side never gets a poll, since there's no roster in this system to poll. A `ValidationException` (`400`) on a mismatch, unnamed subclass — the same plain-`ValidationException` treatment `029` gives the identical rule for `MatchSide` creation, not a new dedicated exception, since this is the same recurring shape already established, not a new one.

**A closed poll rejects a write** — a dedicated, named exception, matching `029`'s own precedent of a specific subclass for a specific, recurring failure mode: `PollClosedException extends ConflictException` (`409`), thrown by the public status-set endpoint when `MatchAvailabilityPoll.open == false`.

## API Contract

**Admin surface — entirely the existing `/api/v1/manage/**` + `@access.canAdministerClub` pattern (`020`), unmodified.** Consistent with `029`'s own established precedent, poll authorization is scoped to the `Match`'s own owning `club_id` regardless of which side (home or away, whichever club's `Team` it references) the poll is for — not re-litigated here.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls` | `@access.canAdministerClub` | Lists every poll for the match (0, 1, or 2 — one per real-`Team` side): `{id, teamId, open, availableCount, unavailableCount, unsureCount, noResponseCount}` |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls` | same | Creates a poll for a side, `open = true` from the moment it's created. Body: `{teamId}` — `400` if `teamId` isn't equal to this match's own `homeTeamId`/`awayTeamId`, or if that side is a free-text opponent; `409` if a poll for that team already exists on this match |
| `POST .../polls/{pollId}/open` | same | Reopens a closed poll — accepts new/changed public responses again. `409` if already open |
| `POST .../polls/{pollId}/close` | same | Closes an open poll — the public page immediately becomes read-only, no new or changed responses accepted. Reversible at any time via the `open` action above. `409` if already closed |
| `GET .../polls/{pollId}/responses` | same | The full squad for that poll's `team_id`+the match's own `season_id` (every `TeamSquadMember`, same season-scoped resolution `listSquad` already performs), each with their current `PlayerAvailability` status or `null` for no response yet, plus the response-count summary and the poll's public path (`/poll/{pollId}`) for the admin to build a share link from |

Every endpoint above is scoped to `clubId` first — `404` if `matchId`/`pollId` is real but belongs to a different club, matching every prior spec's isolation posture.

**Public surface — the second consumer of `/api/v1/public/**` (`SecurityConfig`'s existing `.requestMatchers("/api/v1/public/**").permitAll()`, today only served by `PublicClubController`'s club search) — and the first to serve real per-record tenant data and accept a public write.** Flagged explicitly as a new precedent, not glossed over: every endpoint below is reachable by anyone, with no bearer token, no `clubId` in the URL, and no server-side identity check beyond "does this `pollId` exist" — the poll's own UUID is the entire access boundary (see Data Model Changes/Non-goals for the deliberate security tradeoff this represents).

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/public/polls/{pollId}` | `permitAll` | Resolves the poll's match context (home/away names, date, venue, league/season name if set — the same fields `MatchList`'s cards already surface), `open`/`closed` state, and the full squad list — every `TeamSquadMember` for that poll's `team_id`+the match's own `season_id`, each with their name, `squadJerseyNumber` (`031`, shown for free since it's already on the same row, not a new fetch) and current status or `null`. `404` (`NotFoundException`) if `pollId` doesn't exist. The response carries only this one poll's own match/team/squad data — no cross-club or cross-match data is reachable through this shape |
| `PUT /api/v1/public/polls/{pollId}/players/{playerProfileId}` | `permitAll` | Sets that squad member's status. Body: `{status: AVAILABLE \| UNAVAILABLE \| UNSURE}` — upserts the `PlayerAvailability` row. `404` (`NotFoundException`) if `pollId` doesn't exist, or if `playerProfileId` isn't part of that poll's own squad (not a `TeamSquadMember` for the poll's `team_id`+season); `409` (`PollClosedException`) if the poll is currently closed |

## UI Requirements

**Two genuinely new visual patterns — flagged for a Claude Design pass before build (`docs/workflow.md` Step 2), same precedent `029` set for `PlayingXiBuilder`.** Nothing in `components/**` today renders a public, no-chrome, self-select response list, and nothing renders a per-player status list with inline status-setting on the admin side either (the admin side is read-only, but the response-count summary + per-row status chip layout is still a new pattern, not a near-miss on an existing component).

- **`ui/src/components/MatchAvailabilityTab/`** (new, four-file anatomy) — the admin-facing panel for one side's poll, rendered inside `MatchFormPage`'s new Availability tab (below): an Open/Close toggle (calling the `open`/`close` actions, with the current state reflected immediately, not just optimistically — refetch on success), a response-count summary row (four chips or a compact stat row — Available/Unavailable/Unsure/No response, counts from `GET .../polls/{pollId}/responses`), the full squad list (one row per `TeamSquadMember`, name + status chip, no inline editing per Non-goals), and a "Share invite" action opening `PollShareDialog` (below). If no poll exists yet for that side, renders a simple "Open a poll for this side" prompt/button that calls the create endpoint (`open = true` immediately, matching the API's own default). Props are data-and-callback only, server state fetched by the page via React Query, matching `docs/standards/frontend.md`'s convention.
- **`ui/src/components/PollShareDialog/`** (new, four-file anatomy) — mirrors the legacy Cricket Legend app's `PollWhatsAppDialog.tsx` shape (a `Dialog` with an editable, regenerable plain-text area embedding the poll's public link) for the *pattern* only, not its literal content — this spec's own message copy/branding is a fresh design decision, matching `030`'s own footer-branding precedent of not blindly copying legacy's vendor-specific text. Channel-agnostic: the generated text is plain, copy-paste-into-any-chat shaped (WhatsApp, SMS, email alike), not an actual WhatsApp API integration. Props: `open`, `onClose`, `match`, `team`, `pollId`. On open, generates text embedding `${window.location.origin}/poll/{pollId}` plus the match's basic context (opponent, date, venue); a "Regenerate" action rebuilds it; a "Close" action dismisses. No send/copy-to-clipboard automation required beyond the text being selectable/editable in the field — the admin does the actual sharing themselves, per Non-goals and Rollout Notes.
- **`ui/src/pages/manage/MatchFormPage.tsx`** (`029`/`030`, existing, extended) — gains a fourth tab, **Availability** (edit mode only, alongside the existing Details/Home XI/Away XI tabs, rendered only when at least one side is a real `Team` — same `hasXiTabs`-style gating `029` already established), with one sub-tab per real-`Team` side (e.g. "Home"/"Away", matching the Home XI/Away XI sub-tab precedent exactly), each rendering `MatchAvailabilityTab` for that side.
- **`ui/src/pages/view/PublicAvailabilityPoll.tsx`** (new page, no shared four-file anatomy required since `pages/**` don't need it — still gets its own component test per the Test Plan) — the public, no-chrome self-select response screen, reachable at a new top-level route with no `/manage` or `/player` shell wrapper (no `AppShell`/`GridNavShell`/`BottomTabShell`, since it must be reachable pre-login): a simple header (match context — teams, date, venue), an "open"/"closed" banner (closed = a plain `Alert` stating the poll is closed and read-only), and a full squad list — one row per member, name (+ `squadJerseyNumber` if set) and a `ToggleButtonGroup` (Available/Unavailable/Unsure, exclusive) reflecting that member's current status; tapping a value on *any* row calls the `PUT` endpoint for that `playerProfileId` directly — no separate "who are you" step, no confirmation dialog. Every row's toggle is disabled when the poll is closed. A `404`/unknown `pollId` renders a clean "Poll not found" message, not a broken page. Still composed from this codebase's existing MUI theme/shared primitives (`Card`, `Chip`, `ToggleButtonGroup`, `Alert`) where they fit — not a bespoke design system, just no page-level shell chrome.
- **`ui/src/api/matchAvailabilityApi.ts`** (new) — `listPolls`, `createPoll`, `openPoll`, `closePoll`, `getPollResponses`, thin wrappers over the `/manage` endpoints above.
- **`ui/src/api/publicPollApi.ts`** (new) — `getPoll`, `setAvailability`, thin wrappers over the `/api/v1/public/polls/**` endpoints — built on the same shared axios instance (`ui/src/api/axiosConfig.ts`) as every other resource file, per `docs/standards/frontend.md`, even though these particular calls carry no auth token.
- **`ui/src/App.tsx`** — the existing `/manage/availability` route's element changes from `<EmptyState title="Availability Polls" description="Coming soon." />` to a redirect/landing note pointing admins at a match's own Availability tab (no standalone poll-list screen is built in this pass — polls are managed per-match, from `MatchFormPage`, not from a separate `/manage/availability` list; the nav card and route stay, but its destination becomes a short explanatory `EmptyState`-style panel rather than a real list screen, since there is no cross-match poll list in this spec's scope). A new **top-level, unguarded** route `/poll/:pollId` renders `<PublicAvailabilityPoll />` directly, outside both the `/manage` and `/player` route trees, with no auth guard.
- **`ui/src/pages/view/PlayerHome.tsx`** (`006`) — no change. Its "Availability" tab stays exactly the unguarded `EmptyState` stub `006` left it — real future work once a real player login exists (see Rollout Notes), not touched by this spec.

**Mobile-first**, per `docs/standards/frontend.md` — `MatchAvailabilityTab`'s summary/squad list and `PublicAvailabilityPoll`'s squad rows/toggle groups all stack full-width and stay usable at 375px, since the public page in particular is realistically opened from a phone, mid-chat, most of the time.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `MatchAvailabilityPollServiceImplTest` — create (the `teamId`-must-match-a-real-side `400`, the duplicate-poll `409`), open/close transitions and their `409`s, `getResponses` resolves the full season-scoped squad with correct counts including zero-response members; `PublicAvailabilityPollServiceImplTest` — `getPoll` happy path and unknown-`pollId` `NotFoundException`, `setAvailability` happy path (insert and update-in-place for a repeat call from the same `playerProfileId`), the not-in-this-poll's-squad `NotFoundException`, and the closed-poll `PollClosedException` |
| Integration | New repository tests (Testcontainers) for both new tables — migration `023-add-availability-polls.sql` applies cleanly against existing `029`/`028` tables, both unique constraints (`(match_id, team_id)`, `(poll_id, player_profile_id)`) reject a duplicate at the DB level; new controller integration tests for every admin endpoint — real `CLUB_ADMIN` success for the caller's own club, `403`/`404` for a different club, `platform_admin` superset success, every documented `409`/`400`/`404` proven through real HTTP; **new controller integration tests for both public endpoints, proven with no `Authorization` header at all** — a real `200` round-trip for `GET`/`PUT` with no bearer token, a closed poll's `PUT` rejected with `409`, an unknown `pollId` cleanly `404`s on both `GET` and `PUT`, and the public `GET` response shape confirmed to carry only that one poll's own match/team/squad data (no sibling club/match/poll data reachable through the same shape) |
| Contract | Every new endpoint (both `/manage` and `/public`) + the new poll/response DTOs documented in the checked-in OpenAPI schema — including the `/api/v1/public/**` pair, this codebase's first documented public write |
| Component | `MatchAvailabilityTab.test.tsx` + Storybook story — open/close wiring, response-count summary rendering, squad list rendering, "Share invite" opens `PollShareDialog`; `PollShareDialog.test.tsx` + Storybook story — text generation embeds the poll link, "Regenerate" rebuilds it; `PublicAvailabilityPoll.test.tsx` + Storybook story — squad rows render with correct initial status, tapping a status calls the `PUT` endpoint for that row only, closed-poll state disables every row's toggle group, unknown-poll `404` renders the "not found" message; `MatchFormPage.test.tsx` extended — the new Availability tab and its per-side sub-tabs render only in edit mode and only for real-`Team` sides, matching the existing Home XI/Away XI gating tests |
| End-to-end | Extends `029`'s existing golden path: after building a side's playing XI, open that side's availability poll from the new Availability tab, generate and inspect the share text, open the poll's public link in a fresh (unauthenticated) browser context, tap a squad member's row to set Available, reload the admin tab and confirm the response count updated, close the poll, reload the public page and confirm it's now read-only, reopen it and confirm it accepts changes again. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can open and close an availability poll for either real-`Team` side of a match, from a new Availability tab on `MatchFormPage`, reversibly, at any time.
- A club admin can see a live response-count summary and the full squad's individual current status for a poll without leaving `MatchFormPage`.
- A club admin can generate a channel-agnostic invite text embedding the poll's public link and copy it out themselves — no automated send of any kind happens.
- Anyone holding a poll's link can view every squad member's name and current status and set their own status by tapping their own row, with no login step.
- A closed poll's public page shows every response but accepts no new or changed ones; reopening it restores write access without losing any previously collected response.
- A write against a closed poll, or against an unknown `pollId`, is rejected cleanly (`409`/`404` respectively) on both the public `GET` and `PUT` endpoints, proven with no `Authorization` header present.
- A club admin for club X gets `403`/`404` attempting to reach or modify club Y's polls, even by guessing an id.
- `PlayerAvailability`/`MatchAvailabilityPoll` are keyed by `player_profile_id`, not any session-derived identity, and carry no coupling to the no-login flow that would block a future login-aware consumer from reading or writing the same rows.

## Rollout Notes

- **This spec is the second consumer of `/api/v1/public/**` and the first to serve real per-record tenant data and accept a public write.** `PublicClubController`'s existing club search returns only `{id, name, slug}` for `ACTIVE` clubs, never a real per-record detail and never a write. This spec's `PublicAvailabilityPollController` is a materially different kind of public surface — flagged here explicitly, not glossed over, so a future reviewer treats it as the precedent it is, not an oversight.
- **The "unguessable link" security posture is a deliberate, named tradeoff, not a gap.** A poll's `id` is a UUID (already stronger than legacy's own `BIGSERIAL`-keyed link) and is the *only* thing gating access to a poll's public page. There is no verification that the person tapping a given squad member's row actually is that person, and every squad member's name and status is visible to anyone holding the link. The alternative — hiding other players' own responses — was considered and rejected as incoherent without a real session to know "which row is you." This trust level matches an "anyone with the link" shared document, and is explicitly revisited once real player login exists (see below).
- **Forward-compatible with real player login, but that login is explicitly not built here.** `PlayerAvailability.player_profile_id` is a plain FK, not derived from any session — once a future spec grants `RoleAssignmentRole.PLAYER` and provisions real player Keycloak accounts (mirroring `016`'s pattern), that future spec can wire `/player`'s still-stubbed "Availability" tab (a list of open polls for the logged-in player's own squads, resolved via their own `PlayerProfile`) against the *exact same* `PlayerAvailability`/`MatchAvailabilityPoll` tables this spec creates — zero schema rework anticipated. This is the entire reason this spec's data model was designed identity-agnostic rather than session-scoped, even though only the public/no-login path is wired to it in this pass.
- **Legacy's `MatchPollController`/`MatchPollServiceImpl` was read in full as prior art, not ported wholesale.** Every player-facing endpoint there assumes a real JWT (`jwt.getClaimAsString("email")`), and the controller also carries automated email notifications on poll-open and a full `PlayerNotification`/`getMyNotifications`/`getMyOpenPolls`/unread-count in-app system — none of that exists in this codebase and none of it is built here (see Non-goals). Legacy is prior art for the *shape* of the poll/availability concept only (the `(match, team)`-unique poll, the `(poll, player)`-unique response, the open/close toggle, the WhatsApp-text-generation dialog pattern), not a spec to copy verbatim.
- **`AvailabilityStatus`'s enum names (`AVAILABLE`/`UNAVAILABLE`/`UNSURE`) are a fresh, clearer choice than legacy's own `YES`/`NO`/`UNSURE`**, since this is a new entity in this codebase, not a literal port — no functional difference, just a naming improvement made once, up front.
- **`TeamSquadMember` gained its first mutable field and its first real update endpoint in `031`, not this spec.** This spec reads `TeamSquadMember`/`listSquad`'s existing season-scoped resolution as-is (including `031`'s `squadJerseyNumber`, shown on both the admin response list and the public page for free) — no further change to that entity here.
- **No standalone `/manage/availability` poll-list screen is built in this pass.** Polls are managed per-match, from each match's own Availability tab — there is no cross-match "all my open polls" admin view. If that turns out to be a real want once clubs are running several concurrent polls, it's a natural, scoped future addition (a paginated list mirroring `MatchList`'s own shape), not built here.
- **Two Claude Design items, both flagged above and both genuinely new:** the public, no-chrome, self-select squad response page (`PublicAvailabilityPoll`), and the admin-facing per-side availability panel (`MatchAvailabilityTab`)'s response-count-summary-plus-squad-list layout. Neither is a near-miss on an existing component.
- Ships as its own PR, on top of `029`'s already-built `Match`/`MatchSide`/`TeamSquadMember`, `028`'s already-built `PlayerProfile`, `031`'s already-built `squadJerseyNumber`, and `020`'s `/api/v1/manage/**` namespace.
- A human should update `docs/roadmap.md`'s "Everything `006` named and hasn't built" line once this ships — "availability polls" is resolved for the club-admin + public-link case; "player profile/results/fixtures views" (the login-gated `/player` side of this same feature) remains open, now explicitly pointed at this spec's own `PlayerAvailability`/`MatchAvailabilityPoll` tables as the target schema for whichever future spec grants real player login.
