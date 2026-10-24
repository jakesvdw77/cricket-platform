# Plan: 121 Player Hub menu and Field Directory

Spec: `docs/specs/121-player-hub-menu-and-fields.md` (approved 2026-10-24). Nothing here redefines an entity, an API shape or a scope rule. Standing rules: build first, the owner hand-checks between checkpoints, tests and the standards review come after the owner approves, no `mvn` inside the live `backend/` (use an rsync'd scratch copy and hand-edit `openapi.yaml`), `nvm use 22.12.0` before any `ui/` command.

## Flags for the owner (spec gaps, not guessed)

1. **Cap marker.** Decision 21 wants a "showing the first 200" note, but the API Contract returns a bare `List<FieldDto>`, which cannot carry a truncated flag. Plan: the 200 cap is server side and the UI shows the note when `length === 200`. A real `truncated` flag is a contract change and needs a spec edit first.
2. **Active matches.** The spec does not say whether away fields come from active matches only. Plan: `m.active = true`, as `countActiveByPlayingAreaIds` does. Confirm.
3. **Owner nullability.** `owner_name` is non-null in the entity but `FieldDto.owner` is nullable: map a blank value to null.
4. **DTO name.** A `FieldDto` clash check is the first step in B. Fall back to `MyFieldDto`, as the spec allows.

## Checkpoint A: menu model, navigation, layouts (no data, no backend)

Agents: frontend-builder only. The test-writer waits for the owner's approval.

**Create**
- `ui/src/pages/view/myPlayers/hubNav.ts`: exports `HubNavItem`, `HubNavContext` (player, person, `clubSwitches: {}`), `HUB_NAV` (the spec table verbatim), `visibleItems(ctx)`, `defaultChild(item)` (first non-Soon child, else the first), `resolveRoute(section, item)` (unknown means availability), `LEGACY_REDIRECTS` (requests to account/requests, schedule to matches/schedule, stats to stats/mine), `bubblePill(item, counts)` and `hubBack(state)`, a pure function returning `{ label, target } | null` with state `{ layout, section, item, sub, many }` and the spec's label table. Mirrors `components/ManagerShell/managerNav.ts` for shape and doc comment.
- `HubMenu.tsx`: the main and sub list, roving tabindex, Up/Down/Home/End/Enter/Space, focus restore, pills, the dashed Soon pill, the chevron and accessible names. `barSx` moves here from `MyPlayerPage.tsx`.
- `HubSoonPanel.tsx` (the dashed panel), `HubPlayerCard.tsx` (the card in the menu column, extracted from `MyPlayerPage.tsx`) and `HubFields.tsx` as a Soon-style placeholder until B.

**Change**
- `MyPlayerPage.tsx` becomes a thin composer over `hubNav`, `HubMenu`, `hubBack` and the panels. It loses the header Back, the "Find more players" footer and the `requests`, `schedule` and `stats` sections. Sections: `availability`, `profile` (keeps `:sub`) and `matches|stats|club|account` with `:item`. Keeps `LegacyDetailsRedirect`, adds the legacy redirects, and one Escape handler runs the same `hubBack` target as the footer.
- `HubFrame.tsx` gets an opt-in `fill` (the hub sets it; the picker and Find players do not): height is 100vh minus the top offset minus 24 px, minimum 560, width `min(1400px, 90vw)`, menu column 300 px from `md` and 220 px from 600 to 899, the menu column and the content scroll independently, the solid ground becomes `rgba(5, 30, 22, 0.92)` through tokens (no new hex), the footer is pinned on phone with safe-area padding and a 56 px height, and there is no pitch strip on desktop.
- `AgentViews.tsx` and `MyPlayerEditForm.tsx` (dark): remove their own Back buttons and `onBack` props, because the footer reads "Back to Profile".
- `App.tsx`: add the `/:section/:item` route beside `/:section/:sub`; keep `/account/invitations`, and make the `account/invitations` item render the invitations body.
- `MyInvitationsPage.tsx`: extract the body so the panel can reuse it; the standalone page keeps its route and its own Back.
- `MyLinkRequests` renders as is under `account/requests`. Sign out reuses the existing logout path (`auth/signOut.ts`), with no new auth code.

**Data and API:** none. Pill counts reuse `useMyPlayerPolls`, `useMyInvitations` and `useMyLinkRequests` (pending for the club, Decision 18).

**Tests (after approval, test-writer):** `hubNav.test.ts` (list, order, six at most, no third level, Soon flags, `visibleWhen`, club switch, default child, legacy map, pill bubbling), `hubBack.test.ts` (every table row, the single-player null), `HubMenu.test.tsx`, the one-Back-in-the-footer matrix at 375, 768 and 1280 with a mocked `matchMedia`; update `MyPlayerPage.test.tsx`, `HubProfile.test.tsx`, `AgentViews.test.tsx` and `MyPlayerEditForm.test.tsx`; stories for the menu, the footer states and the Soon panel.

**Risks:** `HubFrame` is shared with the picker and Find players (so `fill` must be opt-in and those two screens need a visual check); the phone footer must not cover content (use `100dvh`); Escape must not fire while a MUI Select or Menu is open (check `defaultPrevented`), and the Field Directory search clears its text first; locked items stay focusable; a phone sub menu does not auto-open a page while desktop and tablet open the first non-Soon child (test both); `phoneTitle="hidden"` stays for the hub; the player name moves into the compact phone header now the old header Back is gone.

**Owner checks:** desktop (full height, the card on top, Club opens on the Field Directory placeholder, one Back), phone (three screens, pinned footer, "Back to Club"), a Profile edit sub view ("Back to Profile"), the old URLs, the Account items and a single-player account.

**Order:** `hubNav.ts` and `hubBack` (pure), then `HubMenu`, then `HubFrame fill`, then the `MyPlayerPage` rewrite, then the Back removals, then the redirects.

## Checkpoint B: Field Directory endpoint and screen

Agents: backend-builder and frontend-builder in parallel against the spec contract; the test-writer follows after approval. B's backend has no dependency on A and can start while A is under review.

**Backend** (`backend/src/main/java/com/cricketlegend/`)
- `dto/FieldDto.java` as a record with the 11 spec keys exactly (`MyFieldDto` if there is a clash); `mapper/MyFieldMapper.java` (MapStruct from `PlayingArea`, `home` as an extra source parameter, address lines flattened, reusing `PlayingAreaMapper.toDto(Address)` through `uses`).
- `service/MyFieldService.java` and `service/impl/MyFieldServiceImpl.java`, `@Transactional(readOnly = true)`: the club comes from `MyPlayerAccess.resolve(auth, key).profile().getClubId()`; home fields from `ClubPlayingAreaRepository` (new `findByClubIdAndHomeTrue`); the current season from `SeasonResolution.currentSeasonId(seasonRepository.findByClubId(clubId))`; away fields from a new `MatchRepository` query for the distinct non-null `playingAreaId` of that club's active matches in the current season. Merged-away ids resolve to `mergedIntoId`; REJECTED, merged and non-`CRICKET_FIELD` rows are excluded; the rest is loaded with `PlayingAreaRepository.findAllById`. Home is de-duplicated against away, ordered home first then by case-insensitive name, and capped at 200. Reuse `PlayingAreaMatchResolver` for the merge-target logic if it exposes it; do not copy it.
- `controller/MePlayersController.java`: add `GET /{playerKey}/fields` and the `MyFieldService` parameter, with no `@PreAuthorize`, as for the other methods there.
- `backend/openapi/openapi.yaml` by hand: one path and one schema. No migration and no new exception type.

**Frontend**
- `ui/src/api/myPlayersApi.ts`: the `FieldDto` type and `useMyPlayerFields(playerKey)` with key `['my-players', playerKey, 'fields']`.
- `HubFields.tsx` (replacing the placeholder) and a hub-local `HubFieldCard.tsx`; `fieldFormat.ts` for the pure helpers `isHttpsUrl`, `joinAddress`, `countryName` (grep for an existing utility first) and `matchesSearch`.
- The search uses `darkFieldSx`, buttons use the compact `Button` with `hubOutlineButton`, and Directions is an `<a target="_blank" rel="noopener noreferrer">`. States: the existing `Skeleton`, an `Alert` with retry, the two empty copies, a note that is always shown, and the 200 note when the list length is 200.
- In `hubNav.ts`, `club.fields` loses its `soon` flag. Client side search over the unpaged list is allowed because the spec fixes the contract as unpaged and capped.

**Tests (after approval):** JUnit `MyFieldServiceImplTest` (merge of home and away, de-duplication, exclusions, ordering, the cap, a null season); integration `MePlayersFieldsIT` (home and away rows, a free-text venue adds nothing, a field in a non-current season is excluded, a merged field resolves, REJECTED is excluded, UNVERIFIED is returned with `verified=false`, two-club isolation, 404 for a foreign, malformed, dropped-out or manager-but-unlinked key, 401 without a token, 403 when SUSPENDED, the exact key set with no manager-only fields); `LayeringRulesTest` unchanged; Vitest `fieldFormat.test.ts` and `HubFields.test.tsx` (cards, tags, owner hidden, Directions, search, the states, the refetch on player change, no Edit or Add); stories; a hand review of the `openapi.yaml` diff.

**Risks:** the match query (indexed by club and season) needs a performance check; a null `ownerName`; `mapUrl` scheme re-validated in the UI; the "Field Directory" label wrapping in the 220 px column.

**Owner checks:** real club data with home and away fields, a verified and an unverified field, Directions opening a new tab, and a two-club parent switching players.

**Order:** repository queries, then service and mapper, then controller and `openapi.yaml` (backend); in parallel `fieldFormat`, then the API hook, then `HubFields` (frontend); then integrate and run both.

## Checkpoint C: tablet and responsive pass, tests, docs

Agents: frontend-builder (polish), test-writer (everything above not yet written, plus the Playwright golden path), the main session (docs).

- Tablet 600 to 899 px polish: the 220 px column, long labels wrapping, and the keyboard, focus and reduced-motion pass. Sweeps at 375, 768 and 1280 px and at 200 percent zoom.
- Playwright golden path in `ui/e2e` (written, not run by default): Club, Field Directory, search, the Directions `href`, and the footer labels at 375 px.
- Docs: `docs/standards/design-system.md` ("Player Hub menu and layout"), `docs/standards/frontend.md` (the Account area bullets: the new route shape, the one-typed-list rule, the removal of the header Back), `docs/roadmap.md` (the Later items and a pointer from the Player hub idea), and `docs/architecture.md` only if it lists Hub sections.
- Standards review (`standards-reviewer`), then the PR.
- Verification: `npm run lint`, `npm run build`, vitest on `myPlayers` and `view` only, and a backend scratch copy for `LayeringRulesTest` and the integration tests. No new dependency; the spec 120 hex grep gate must pass.
