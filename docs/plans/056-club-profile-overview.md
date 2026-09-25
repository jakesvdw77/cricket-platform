# Plan: 056 — Club Profile Overview & Dashboard Reorganization

## Context

`docs/specs/056-club-profile-overview.md` (approved) transcribes an interactive mockup the user already reviewed and confirmed this session: Leagues/Matches get their own dashboard cards, the four club-level cards (Profile/Contacts/Sponsors/Structure) collapse into one "Club Profile" card leading to a new consolidated, view-first overview page, and Gallery/Notifications join as "Coming soon" placeholders. This is a **frontend-only** spec — no entities, fields, or endpoints change, so there is no `backend-builder` slice at all.

**Verified directly against current source this session**: the exact current `App.tsx` `/manage` route block (confirmed exact insertion points and that `SquadPicker.tsx`'s own `<MatchList backTo="/manage" .../>` call site already passes explicit props, so changing `MatchList`'s *default* `backTo`/`backLabel` only affects the one call site that relies on the default — the direct `fixtures/matches` route), `ManagerDashboard.tsx`/`NavTile.tsx` (the card shape to extend), `ManageFixturesHome.tsx` (confirmed no `.test.tsx` exists for it — nothing extra to clean up on deletion), `LeagueList.tsx`/`SeasonList.tsx`'s current `backTo`/`backLabel` values, `TeamSheetCommunicationDialog.tsx` (the real `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions` boilerplate to mirror structurally for the new `RecordQuickViewDialog`), `ui/src/components/Card/Card.tsx` (the shared `Card` shell — confirmed `ClubStructure.tsx` already builds its own header row manually inside `Card`'s children rather than using `Card`'s own `title` prop, since that prop has no room for an action button; `ClubOverviewPage`'s sections follow the same established pattern, not `Card`'s `title` prop), `initialsFromName` (`ui/src/utils/initials.ts`), and the real field names on `ClubContact`/`Sponsor`/`Season`/`ClubProfile` (`photoUrl`, `logoUrl`, `label`/`startDate`/`endDate`, `type`/`address`/`socialLinks`).

## Files to touch, in order

### Frontend (`frontend-builder`) — entire spec, no backend slice

1. **`ui/src/components/RecordQuickViewDialog/`** (new, four-file anatomy: `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`) — exact props shape from the spec's UI Requirements (`open`, `onClose`, `avatar`, `title`, `subtitle?`, `fields: {icon, label, value}[]`, `editTo`, `editLabel?`). Structurally mirrors `TeamSheetCommunicationDialog.tsx`'s real `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions` (`fullWidth maxWidth="xs"`), not its content — this dialog has no tabs/toggle/textarea, just an avatar+title+subtitle header, a field list (icon+label+value rows, visually consistent with `DetailFieldRow` without importing `RecordDetailScreen`'s grid machinery), and a single primary "Edit" button that's a router `Link` styled as the dialog's primary `Button`, targeting `editTo`.

2. **`ui/src/pages/manage/ClubOverviewPage.tsx`** (new) — the bento-grid page. Reads `clubId` from `ManagerHome`'s Outlet context (same guard/loading/error shape as every other `/manage` page — `EmptyState` for not-authorized/error, `null` while loading, gated on the profile fetch specifically since the header needs it). Independent `useQuery`s: `getManagedClubProfile`, `listClubContacts`, `listSponsors`, `listSections`, `listSeasons`.
   - Header: `Avatar` (`ClubProfile.logoUrl`, fallback `initialsFromName(profile.name)` — `ClubProfile` itself carries `name`, confirmed, no second fetch needed), a `Chip` for `type`, "Edit profile" button (`Link` to `/manage/club-profile/edit`).
   - Profile card (`Card`, manual header row, no edit button on the card itself): `phone`/`email`/`website` rows omitted when unset (mirror `SponsorDetailPage.tsx`'s exact omit-when-unset conditional shape), one `address` row only when any `Address` field is set, `SocialLinksRow` only when `socialLinks.length > 0`.
   - Contacts + Sponsors cards, two-column grid (`display:grid; grid-template-columns: repeat(2, minmax(0,1fr))`, stacking to one column at `xs` per `docs/standards/frontend.md`): each a manual header row (section label + "Manage" button to `/manage/club-contacts` / `/manage/sponsors`), then a flex-wrap row of icon-only avatar buttons (`photoUrl`/`logoUrl` image when set else `initialsFromName` — mirror `RecordCard`'s own avatar image/fallback convention, applied to a plain circular/rounded `IconButton`-shaped `button`), each with `title`/`aria-label` = `"{name} — {role/category}"`, `onClick` opens local `openContactId`/`openSponsorId` state. Local state renders `RecordQuickViewDialog` with that record's fields (Contacts: Email, Phone; Sponsors: Website, Email) and `editTo` set to that record's real edit route. Empty-state `Typography` per card when its list is empty.
   - Structure + Seasons cards, same two-column shape: Structure groups `Section[]` by `parentSectionId` (root = `null`) inline — mirror `SectionTreeEditor.tsx`'s own existing grouping convention rather than importing it, since this view is read-only with no interaction — rendered as nested `<ul>`s, name-only per node, "Edit structure" button to `/manage/sections`, empty state for zero sections. Seasons renders each as a compact row (label, formatted `startDate`–`endDate`, a "Current" `Chip` computed via `pickDefaultSeasonId` from `ui/src/utils/defaultSeason.ts` so it never disagrees with `LeagueFormPage`/`LeagueDetailPage`'s own "current season" signal), a small icon-button per row to `/manage/fixtures/seasons/{id}/edit`, "Add season" button to `/manage/fixtures/seasons/new`, empty state for zero seasons.

3. **`ui/src/pages/manage/ManagerDashboard.tsx`** — replace the "Club manager" group's `cards` array with the 9-entry list from the spec's UI Requirements, in that exact order (Club Profile → Teams → Players → Leagues → Matches → Results → Team Managers & Permissions → Gallery → Notifications), removing the old Club Contacts/Club Sponsors/Club Structure/"Leagues and Fixtures" entries. New icons for Leagues/Matches mirror `ManageFixturesHome.tsx`'s own existing `EmojiEventsOutlinedIcon`/`SportsCricketOutlinedIcon` choices; Gallery/Notifications get a new photo-stack/bell-style icon each (any reasonable `@mui/icons-material` outlined icon, e.g. `PhotoLibraryOutlinedIcon`/`NotificationsNoneOutlinedIcon`). "Team manager" group untouched.

4. **`ui/src/pages/manage/ManageFixturesHome.tsx`** — deleted (no `.test.tsx` exists for it, confirmed — nothing else to remove).

5. **`ui/src/App.tsx`**:
   - `club-profile` route's element changes from `<ManageClubProfilePage />` to `<ClubOverviewPage />` (new import).
   - New route `club-profile/edit` → `<ManageClubProfilePage />` (existing import, just a second route entry).
   - New routes `gallery` → `<EmptyState title="Gallery" description="Coming soon." />`, `notifications` → `<EmptyState title="Notifications" description="Coming soon." />` (mirror `results`/`permissions`'s exact existing inline-`EmptyState` pattern — no new component).
   - Remove the `fixtures` index route and the `ManageFixturesHome` import. Every other `fixtures/*` route stays untouched, in place.

6. **`ui/src/pages/manage/LeagueList.tsx`** — `backTo="/manage/fixtures"` → `backTo="/manage"`, `backLabel="Back to Fixtures"` → `backLabel="Back to Dashboard"`.

7. **`ui/src/pages/manage/MatchList.tsx`** — the component's own prop *defaults* (`backTo = '/manage/fixtures'`, `backLabel = 'Back to Fixtures'`) become `backTo = '/manage'`, `backLabel = 'Back to Dashboard'`. `SquadPicker.tsx`'s explicit override is unaffected and needs no change.

8. **`ui/src/pages/manage/SeasonList.tsx`** — `backTo="/manage/fixtures"` → `backTo="/manage/club-profile"`, `backLabel="Back to Fixtures"` → `backLabel="Back to Club Profile"`.

9. **`ui/src/pages/manage/ManageClubProfilePage.tsx`** — `backTo="/manage"` → `backTo="/manage/club-profile"`, `backLabel="Back to Dashboard"` → `backLabel="Back to Club Profile"`.

### Tests (`test-writer`, after the frontend build finishes)

- `RecordQuickViewDialog.test.tsx` + Storybook story — open/closed state, field rendering, avatar image-vs-fallback, the Edit button's link target.
- `ClubOverviewPage.test.tsx` (new) — header fields (incl. every omit-when-unset case), Contacts/Sponsors icon click → correct dialog content → correct `editTo`, "Manage" button targets, Structure tree rendering (incl. zero-section empty state), Seasons rendering (incl. "Current" chip logic via `pickDefaultSeasonId` and the zero-season empty state), every section's own empty state.
- `ManagerDashboard.test.tsx` extended — new 9-card order/destinations, Gallery/Notifications present.
- `LeagueList.test.tsx`/`MatchList.test.tsx`/`SeasonList.test.tsx` — updated `backTo`/`backLabel` assertions.
- Confirm no other test file asserts against the now-deleted `ManageFixturesHome` or the removed `fixtures` index route (grep before deleting).

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22.12.0 && cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test: dashboard shows the 9 new cards in order; Leagues/Matches reach their lists in one click; Club Profile opens the new overview with all five sections populated; clicking a contact/sponsor icon opens the quick-view dialog and its Edit button reaches the real edit screen; Structure and Seasons render correctly and their edit/add actions work; a club with no contacts/sponsors/sections/seasons shows each section's empty state cleanly.
