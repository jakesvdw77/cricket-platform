# Plan 077 — Public Availability Form: Find Yourself and Confirm

Implements `docs/specs/077-public-availability-form-verification.md` (draft; design approved from https://claude.ai/artifact/LjZ8gyGQV1Rv9CYRMEq7b8, version 2 "verify first, then answer"; decisions in the spec's Decisions section). Branch `feature/077-public-availability-form` (holds the spec). Two PRs: slice 1 (date of birth), then slice 2 (the form, backend and frontend together). Agents: `backend-builder` and `frontend-builder`, with tests written by the builders as in 078 to 080 (a `test-writer` pass on the security rules).

## Context

Both public availability pages list every player and accept an unchecked answer for anyone, so anyone with a WhatsApp link can answer for anyone and sees the whole squad. The spec replaces that with: say who you are (first name, surname, date of birth), nothing shown or saved until they match a player who belongs to this poll, then answer and change the answer for about 30 minutes, with a device-only shortcut for returning players.

## What the code looks like today (findings)

- Backend: `PublicAvailabilityPollController` (`GET /api/v1/public/polls/{pollId}`, `PUT .../players/{playerProfileId}`) and `PublicSectionAvailabilityRoundController` (same shape for rounds, with a `windowId` per answer), services `PublicAvailabilityPollServiceImpl` and `PublicSectionAvailabilityRoundServiceImpl`; `SecurityConfig` has `.requestMatchers("/api/v1/public/**").permitAll()`.
- Audience rules already exist and are reused, not rewritten: squad poll = `AvailabilityPollSquadResolver.resolveSquadRows(teamId, seasonId)` (rows carry `playerProfileId`, first and last name, `squadJerseyNumber`); group poll = `audienceResolver.resolveAudience(round.getSectionId())` (rows carry the same plus `jerseyNumber`). The write paths already reject players outside those sets and closed polls (`PollClosedException`, `SectionAvailabilityWindowClosedException`).
- `Person.dateOfBirth` is a nullable `LocalDate`; `PlayerProfile` links to `Person`.
- There is no rate limiting or attempt-tracking infrastructure anywhere; `NotFoundException`, `ConflictException`, `ValidationException` and `GlobalExceptionHandler` are the exception pattern.
- Frontend: `ui/src/pages/view/PublicAvailabilityPoll.tsx` and `PublicSectionAvailabilityRound.tsx` (no shell, routes `/poll/:pollId` and `/section-availability/:roundId` in `App.tsx`), api files `publicPollApi.ts` and `publicSectionAvailabilityApi.ts`; `EmptyState`, MUI `ToggleButtonGroup` already used for the three statuses.
- Old links already sent in WhatsApp keep working because the page URLs do not change.

## Flags (decisions for you, none changes the spec)

1. **Per-address limit needs the client's real IP behind the proxy.** Plan: read it from the forwarded header with the standard Spring forwarded-headers setting; needs a check of how the app is deployed.
2. **A token signing secret is a new configuration value** (`cricketlegend.public-availability.token-secret`, with a dev default). Production needs a real value set.
3. **The attempts table is keyed by (poll, normalised name), not by player id** (spec Data Model note), plus one row per address for the per-address limit. Same table, a `scope_key` string.
4. **Pick screen for same name and same birthday:** a group poll's "team or section label" is the same for everyone in the round, so it does not separate players. Plan: shirt number plus, where cheap, the player's team in that section; otherwise shirt number alone. Very rare case.
5. **Existing players without a date of birth cannot answer** until a manager adds one. So slice 1 ships and the data is fixed before slice 2 goes live (a one-off report is part of slice 1).
6. **Manager "via link" marker** needs one small addition to the manager response DTOs (a nullable `viaLink` per answer); kept to the Responses pages, not the grids.

## Slice 1 (PR A): date of birth required first

**Backend (`backend-builder`).** Create and update of a player require `dateOfBirth` (validation in `PlayerServiceImpl` and the request DTO: not in the future, not before 1900-01-01 or implausibly old), error through `ValidationException`. No `NOT NULL` migration. A list filter `missingDateOfBirth=true` on the existing players list endpoint (`PlayerController` list, repository specification), plus a count in the list response only if the page already shows counts; `openapi.yaml` additions only. Tests: validation cases, the filter, existing player tests updated only where they create a player without a date.
**Frontend (`frontend-builder`).** `PlayerForm`/`PlayerFormPage`: date of birth required with the same sanity checks and clear error text; `PlayerList`: a "Missing date of birth" filter chip using the existing filter pattern (`usePersistedListFilters`, `ListToolbar`) showing the players to fix, `PlayerCard` marker when missing. "Add new player" in the Select players dialog and any other create path get the field. Tests updated and added.

## Slice 2 (PR B): the form, backend then frontend in one PR

**Backend (`backend-builder`, scratch-copy verification only).**
- Migration `NNN-public-availability.sql`: table `public_availability_attempt` (`scope_key varchar primary key`, `failed_count`, `window_started_at`, `locked_until`), and a `source varchar(16) not null default 'MANAGER'` column on `player_availability` and `section_availability_response` (`MANAGER` or `PUBLIC_LINK`), with the entities updated.
- New `PublicAvailabilityAccess` support (service.support): normalises names, loads the audience through the two existing resolvers, loads the date of birth for the matching players in one batch query (`PlayerProfile` to `Person`), compares, and issues/validates the token (HMAC-SHA256 over kind, poll id, player id and expiry, base64url, 30 minutes, secret from configuration, constant-time comparison). Attempts use an advisory-lock-free upsert on the attempts table: 5 wrong tries per (poll, name) lock for 15 minutes; a per-address window limit (for example 30 verify calls per 15 minutes) on the same table. A failed verify always returns the same generic body and the tries left; locked returns 423.
- Controllers and services (follow the existing skeleton): header-only `GET` for polls and rounds (no players, no responses; adds `clubId`), `POST .../verify`, `GET .../players/{playerId}/answers`, `PUT .../players/{playerId}/answers` for both kinds, with the token in an `Authorization`-style header (`X-Public-Token`), closed poll 409, bad or expired token 401, player not in the poll 404. The PUT saves all windows in one transaction and sets `source = PUBLIC_LINK`. The old per-player PUT endpoints and the response lists are removed.
- Manager side: add a nullable `viaLink` boolean to the answer entries the Responses pages already return (squad poll rows and group round status entries), mapped from `source`.
- `openapi.yaml` by hand (additions and the removed paths), `GlobalExceptionHandler` entries for the new exceptions (`PublicVerificationFailedException`, `PublicVerificationLockedException`, `InvalidPublicTokenException`).
- Tests: unit tests for the access support (name normalisation, matching, token round trip and tampering and expiry, lock counting and reset); Testcontainers integration tests for both poll kinds (verify success, wrong name, wrong date, player outside the poll, another club's player, inactive player, missing date of birth, same name and same date, same name different dates, lock after 5 and unlock after the window, closed poll, token for another poll or player rejected, multi-window atomic save, `source` set, no response ever contains a date of birth or anything outside the allowed fields); a statement-count guard on verify; removed endpoints return 404/405.

**Frontend (`frontend-builder`, after the backend shapes exist).**
- API: rewrite `publicPollApi.ts` and `publicSectionAvailabilityApi.ts` (header, verify, getAnswers, putAnswers) with a shared token header helper; types match the backend exactly.
- Shared components under `ui/src/components/PublicAvailability/` (each with the four-file anatomy): `IdentifyForm` (first name, surname, day/month/year numeric fields with clear validation), `AnswerForm` (group: one `ToggleButtonGroup` row per window; squad: one question), `PickPlayer`, `SavedSummary`, `RememberedPlayers`, `PublicPollHeader`, and a `useRememberedPlayers` hook over a small storage helper (all reads and writes in try/catch; names only; per club key from the header's `clubId`; at most 10 players; per-poll answered times for the last 10 polls; expiry about a year of non-use; remove, forget this device; automatic remember after a successful save).
- Pages: `PublicAvailabilityPoll.tsx` and `PublicSectionAvailabilityRound.tsx` become thin wrappers over one flow component driven by a small adapter (squad or group), covering screens 1 to 11 of the mockup: identify, generic failure with tries left, locked, answer, change (prefilled, token kept in memory for the 30 minutes), saved with "Change my answer" and "Answer for someone else", returning on the same device (remembered chips fill the name so only the date is asked), pick, no date on record, closed, link not valid. Mobile-first, MUI sx only, theme tokens, no shell.
- Manager Responses pages (`GroupPollResponsesPage`, `SquadPollResponsesPage` and their shared row components): show a small "via link" marker where `viaLink` is true.
- Tests: component tests for every component and state, the storage helper (unavailable, corrupt, caps, expiry), page tests for both flows, API tests; stories for the new components. Existing tests for the two pages are replaced.

## Reuse (do not rewrite)
`AvailabilityPollSquadResolver`, the section audience resolver, the existing closed-poll exceptions, `GlobalExceptionHandler`, `AbstractIntegrationTest` and the leagues-list statement-count guard technique, `EmptyState`, `usePersistedListFilters`/`ListToolbar`, `PlayerForm`.

## Out of scope
Email or phone confirmation, two-factor, parent accounts, manager-side changes beyond the marker, changing how polls are created or shared.

## Verification
- Backend: full `./mvnw -o clean test` in a fresh rsync'd scratch copy only (never in `backend/`), per slice.
- Frontend (Node 22 via nvm): `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, the full unit suite, and the Storybook project on the new components.
- Manual (you), at 375 px: open an old link, identify yourself, wrong date (tries left), a player not in the poll, same-name players, answer both a group and a squad poll, change the answer within 30 minutes, return later on the same phone (chips, only the date asked), clear storage, closed poll, and the manager Responses page marker. Before slice 2 goes live, use the missing date of birth filter to fix players.

## Commits and PRs
Slice 1: `feat(backend)`, `feat(ui)`, `test`. Slice 2: `feat(backend)` migration and public API, `test(backend)`, `feat(ui)` components and pages, `feat(ui)` manager marker, `docs` notes. Draft PRs, no merge until you say so.
