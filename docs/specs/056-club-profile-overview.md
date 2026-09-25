# 056 — Club Profile Overview & Dashboard Reorganization

**Depends on:** `020-club-manager-access.md` (`ManagerHome`'s Outlet `clubId` context every page here reads), `012-club-profile.md` (`ClubProfile`/`ClubForm`'s `profileOnly` mode — reused unchanged as the edit destination), `021-club-contacts.md`/`022-club-social-media.md` (`ClubContact`, `SocialLinksRow`), `023-sponsors.md` (`Sponsor`), `025-club-structure.md` (`Section`, `SectionTreeEditor`'s parent-grouping convention), `029-league-management.md`/`050-league-schedule-and-fixtures.md` (`League`/`Match`/`Season`, the `ManageFixturesHome` hub this spec dissolves), `036-view-first-record-detail-screens.md` (the view-first/edit-elsewhere posture this new page follows, though its own layout is a bento grid, not a single `RecordDetailScreen`). Approved via an interactive design-canvas mockup reviewed and confirmed by the user this session (dashboard card order + Club Profile Overview layout, including the icon-plus-quick-view-dialog pattern for Contacts/Sponsors) — this spec transcribes that approved design, it does not redesign it.

**Status:** approved.

## Problem & Goals

Reaching Leagues or Matches today takes three clicks (Dashboard → "Leagues and Fixtures" hub → Leagues/Matches), and the club-level admin surfaces (Profile, Contacts, Sponsors, Structure, Seasons) are five separate dashboard cards with no single place to see "everything about my club" at a glance — a club admin checking a sponsor's phone number has to leave whatever else they were looking at and land on a totally different screen.

**Goals**
- Promote Leagues and Matches to their own direct dashboard cards — one click instead of three.
- Replace the four separate club-level dashboard cards (Club Profile, Club Contacts, Club Sponsors, Club Structure) with a single "Club Profile" card that opens one consolidated, view-first overview page — branding/contact details, named contacts, sponsors, structure, and seasons all visible on one screen, each with a click-through to its own full edit surface when more than a glance is needed.
- Let an admin check a contact's or sponsor's details (email, phone, role) without leaving the overview page, via a click-to-open quick-view dialog rather than a full page navigation.
- Add two new placeholder dashboard cards, Gallery and Notifications, matching this codebase's existing "Coming soon" `EmptyState` precedent (e.g. `results`, `permissions`).

## Non-goals

- **No new entities, fields, or endpoints.** Every screen here composes existing `GET` endpoints (`getManagedClubProfile`, `listClubContacts`, `listSponsors`, `listSections`, `listSeasons`) — this is a navigation/composition restructuring, not a data model change.
- **No redirect from the dissolved `/manage/fixtures` hub route.** A bookmarked link to it 404s after this ships (the same posture every prior `/manage` restructuring spec has taken — no back-compat redirect layer exists in this codebase). `/manage/fixtures/leagues`, `/manage/fixtures/matches`, `/manage/fixtures/seasons` (and all of their own sub-routes) are unaffected — only the 3-card index hub page itself is removed.
- **No change to `ClubContactList`/`SponsorList`/`ClubStructure`/`SeasonList`/`LeagueList`/`MatchList`'s own CRUD behavior.** They stay exactly as built; this spec only changes how they're *reached* (their own `backTo` targets are the one small exception — see UI Requirements) and removes their standalone dashboard cards where the new overview page now covers that ground.
- **No overflow/pagination UI for the Contacts or Sponsors icon grid.** These are the same "small, bounded, no pagination" lists `ClubContactList`/`SponsorList` already treat them as — the icon row simply wraps (`flex-wrap`) rather than capping at N with a "show more" affordance. Revisit only if a real club's contact/sponsor count makes this impractical.
- **Gallery and Notifications are placeholders only** — an `EmptyState` "Coming soon" screen, identical in shape to `results`/`permissions`'s existing precedent. No photo upload, no notification delivery mechanism, designed here.
- **No change to the "Team manager" dashboard group** (Squads/Communication/Availability Polls) — out of scope.
- **The Structure section's read-only tree is a summary, not a second editor.** It has no add/rename/drag affordance of its own — every mutation happens on `ClubStructure` (`/manage/sections`), reached via this section's "Edit structure" button.

## User Stories

- As a club admin, I can reach Leagues or Matches from the dashboard in one click, not three.
- As a club admin, I can open one "Club Profile" screen and see my club's branding, contact details, address, and social links; its named contacts and sponsors as tappable icons; a read-only view of my club's structure; and its seasons — without navigating to five different screens.
- As a club admin, I can tap a contact's or sponsor's icon to see their full details in a small dialog, and from that dialog jump straight to editing that specific record.
- As a club admin, I can tell at a glance which season is current, and jump straight to adding a new one.
- As a club admin, every "edit more than this page shows" action (Edit profile, Manage contacts, Manage sponsors, Edit structure, Add/edit a season) takes me to the exact same real edit screen this codebase already has for that record — no new edit UI is introduced.
- As a club admin, I can see a "Gallery" and a "Notifications" card on my dashboard, clearly marked as coming soon, so I know they're planned without them doing anything yet.

## Data Model Changes

None. Every field this spec surfaces already exists on `ClubProfile`, `ClubContact`, `Sponsor`, `Section`, and `Season`.

## API Contract

No new endpoints. The new overview page composes existing calls unchanged: `getManagedClubProfile`, `listClubContacts`, `listSponsors`, `listSections`, `listSeasons` (all already used elsewhere in `ui/src/pages/manage`).

## UI Requirements

### Dashboard (`ui/src/pages/manage/ManagerDashboard.tsx`)

The "Club manager" `GROUPS` entry's `cards` array becomes, in this exact order (confirmed with the user against the approved mockup):

1. **Club Profile** — `to: '/manage/club-profile'` (now the new overview page, see below), icon unchanged (`BusinessOutlinedIcon`).
2. **Teams** — unchanged (`to: '/manage/teams'`).
3. **Players** — unchanged (`to: '/manage/players'`).
4. **Leagues** — new card, `to: '/manage/fixtures/leagues'` (a real, already-built route — this card just reaches it directly instead of through the hub), icon: an icon evoking a competition/trophy (mirror `ManageFixturesHome`'s own `EmojiEventsOutlinedIcon` choice for Leagues).
5. **Matches** — new card, `to: '/manage/fixtures/matches'`, icon: mirror `ManageFixturesHome`'s own `SportsCricketOutlinedIcon` choice for Matches.
6. **Results** — unchanged (`to: '/manage/results'`, still an `EmptyState` placeholder).
7. **Team Managers & Permissions** — unchanged (`to: '/manage/permissions'`, still an `EmptyState` placeholder).
8. **Gallery** — new card, `to: '/manage/gallery'`, description "Share photos and highlights from your club", icon evoking images/photos.
9. **Notifications** — new card, `to: '/manage/notifications'`, description "Announcements and reminders for your club", icon evoking a bell/alert.

Removed from the dashboard entirely (their pages stay, just no longer have their own top-level card — reached from the new Club Profile overview instead): **Club Contacts**, **Club Sponsors**, **Club Structure**, and the old combined **Leagues and Fixtures** card.

The "Team manager" group is untouched.

### Dissolving the Fixtures hub

- **`ui/src/pages/manage/ManageFixturesHome.tsx`** — deleted. Its `fixtures` index route in `App.tsx` is removed. `fixtures/leagues`, `fixtures/leagues/**`, `fixtures/matches`, `fixtures/matches/**`, `fixtures/seasons`, `fixtures/seasons/**` all stay registered exactly as they are today — only the index hub page goes.
- **`ui/src/pages/manage/LeagueList.tsx`** — `backTo="/manage/fixtures"`/`backLabel="Back to Fixtures"` become `backTo="/manage"`/`backLabel="Back to Dashboard"` (the hub it pointed to no longer exists; the dashboard is the real place a League list is now reached from).
- **`ui/src/pages/manage/MatchList.tsx`** — its `backTo`/`backLabel` props' *defaults* (`'/manage/fixtures'`/`'Back to Fixtures'`) become `'/manage'`/`'Back to Dashboard'`. Confirm no call site overrides these defaults with an explicit prop before assuming the default change is the whole fix.
- **`ui/src/pages/manage/SeasonList.tsx`** — `backTo="/manage/fixtures"`/`backLabel="Back to Fixtures"` become `backTo="/manage/club-profile"`/`backLabel="Back to Club Profile"` (Seasons is now reached from the Club Profile overview, not a fixtures hub).

### New page — `ui/src/pages/manage/ClubOverviewPage.tsx`, route `/manage/club-profile`

View-first, per `036`'s posture — reads `clubId` from `ManagerHome`'s Outlet context, same guard/loading/error shape every other `/manage` page in this codebase uses (`EmptyState` for not-authorized/error, `null` while loading). Fetches `getManagedClubProfile`, `listClubContacts`, `listSponsors`, `listSections`, `listSeasons`, each independently (no page-blocking on any single one beyond the profile fetch itself, which is required to render the header).

**Layout — a bento grid, not one long vertical stack** (the approved mockup's key structural decision, so more is visible without scrolling):

1. **Header row** — club logo (`ClubProfile.logoUrl`, `Avatar` fallback to two-letter initials of the club name, same `initialsFromName` util every other page uses), club name, a small chip showing `ClubProfile.type` (CLUB/ACADEMY/SCHOOL/OTHER, title-cased), and an "Edit profile" button on the right → `/manage/club-profile/edit`.
2. **Profile card** (full width) — `phone`/`email`/`website` as icon+label+value rows, each omitted when unset (mirror `SponsorDetailPage.tsx`'s identical omit-when-unset convention); `address` rendered as one row only when at least one `Address` field is set; `SocialLinksRow` rendered only when `socialLinks.length > 0`. No edit button on this card itself — the header's "Edit profile" already covers every field here (matches the approved mockup, which deliberately has no second edit control on this card).
3. **Contacts card** + **Sponsors card**, side by side (two-column grid, stacking to one column at mobile width per `docs/standards/frontend.md`'s mobile-first rule):
   - Each renders its list as a row of circular (Contacts) / rounded-square (Sponsors) icon-only buttons — `photoUrl`/`logoUrl` image when set, else initials (mirror `RecordCard`'s own `imageUrl`/`fallback` avatar convention, applied here to a plain `IconButton`-shaped control rather than a full `RecordCard`). Each button carries a native `title` tooltip (`"{name} — {role}"` / `"{name} — {category-ish label}"`) and a matching `aria-label` — no name text rendered outside the tooltip, per the approved mockup.
   - Clicking an icon opens the new **`RecordQuickViewDialog`** (below) populated with that record's fields.
   - A "Manage" button in the card header → `/manage/club-contacts` / `/manage/sponsors` (the existing list screens, unchanged).
   - Empty state (no contacts / no sponsors yet): a short `Typography` line, same tone as every other list page's empty state, no dialog machinery rendered.
4. **Structure card** + **Seasons card**, side by side (same two-column/mobile-stack shape):
   - **Structure**: a new small presentational read-only tree — group `Section[]` by `parentSectionId` (root = `null`), same grouping convention `SectionTreeEditor.tsx` already uses inline (mirror it, don't import the editor itself — this view has no interaction), rendered as nested `<ul>`s, each node showing its name (and, for a leaf with no children, nothing extra — no age/gender detail, this is a structural glance, not `SectionDetailPanel`'s full data). "Edit structure" button → `/manage/sections`. Empty state when the club has zero sections yet.
   - **Seasons**: each `Season` as a compact row (label, `startDate`–`endDate` formatted range, a "Current" chip when it's the club's current season — reuse `ui/src/utils/defaultSeason.ts`'s `pickDefaultSeasonId` so this never states a different "current" season than `LeagueFormPage`/`LeagueDetailPage` already do), with a small icon-only edit button per row → `/manage/fixtures/seasons/{id}/edit`. "Add season" button in the card header → `/manage/fixtures/seasons/new`. Empty state when the club has zero seasons yet.

**New reusable component — `ui/src/components/RecordQuickViewDialog/`** (four-file anatomy: `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`). Generic enough to serve both Contacts and Sponsors here (and any future "small record, quick look" need) rather than building two near-identical one-off dialogs:

```ts
export interface RecordQuickViewDialogField {
  icon: ReactNode
  label: string
  value: ReactNode
}

export interface RecordQuickViewDialogProps {
  open: boolean
  onClose: () => void
  avatar: { imageUrl?: string | null; fallback: ReactNode; shape: 'circular' | 'rounded' }
  title: string
  subtitle?: string
  fields: RecordQuickViewDialogField[]
  editTo: string
  editLabel?: string // defaults to "Edit"
}
```

An MUI `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions` shell (mirror `TeamSheetCommunicationDialog.tsx`'s or `ShareScheduleDialog.tsx`'s own real `Dialog` boilerplate for the exact structural precedent — this codebase has no existing generic dialog wrapper to extend, each of its six existing `*Dialog` components builds MUI's primitives directly, so this is the first, deliberately reusable one), rendering the avatar + title + subtitle at the top, each field as an icon+label+value row (visually consistent with `DetailFieldRow`, but this dialog doesn't use `RecordDetailScreen`'s `DetailFieldGrid` machinery since it's a small fixed-width dialog, not a full section), and a single primary "Edit" button (an `<a>`/`Link`-backed navigation to `editTo`, not a second copy of the edit form). `ClubOverviewPage.tsx` supplies each field list itself (Contacts: Email, Phone; Sponsors: Website, Email) — the dialog component has no knowledge of `ClubContact`/`Sponsor` shapes.

### Route changes (`ui/src/App.tsx`)

- `club-profile` — was `<ManageClubProfilePage />`, becomes `<ClubOverviewPage />` (new).
- `club-profile/edit` — new route, `<ManageClubProfilePage />` (the existing edit component, moved here unchanged).
- `gallery` — new, `<EmptyState title="Gallery" description="Coming soon." />` (mirrors `results`/`permissions`'s exact existing pattern).
- `notifications` — new, `<EmptyState title="Notifications" description="Coming soon." />`.
- `fixtures` (index) — removed (see Dissolving the Fixtures hub, above). `fixtures/leagues`, `fixtures/matches`, `fixtures/seasons` and their sub-routes are untouched.

### `ManageClubProfilePage.tsx` (existing edit page, unchanged apart from its back link)

`backTo="/manage"`/`backLabel="Back to Dashboard"` become `backTo="/manage/club-profile"`/`backLabel="Back to Club Profile"` — editing now returns to the new overview page it was opened from, not straight back to the dashboard, matching this codebase's existing edit-returns-to-where-it-was-reached-from convention (e.g. `LeagueFormPage`'s `backTo` pointing at the League list, not the dashboard).

**Mobile-first**, per `docs/standards/frontend.md`: the Contacts/Sponsors and Structure/Seasons two-column rows stack to a single column at `xs`; the icon grids wrap regardless of width.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `RecordQuickViewDialog.test.tsx` + Storybook story (open/closed, field rendering, Edit button's `href`/navigation target) — the new shared component. `ClubOverviewPage.test.tsx` (new) — header renders profile fields correctly (including every "omitted when unset" case); Contacts/Sponsors icon grids render, clicking an icon opens `RecordQuickViewDialog` with the right record's fields, "Manage" buttons navigate to the right list route; Structure renders the section tree correctly (including the zero-sections empty state) and its "Edit structure" button's target; Seasons renders each season with the correct "Current" chip logic (via `pickDefaultSeasonId`) and each row's edit link; every section's empty state renders when its list is empty. `ManagerDashboard.test.tsx` extended — the new 9-card order and destinations, Gallery/Notifications present and route to `EmptyState` placeholders. `LeagueList.test.tsx`/`MatchList.test.tsx`/`SeasonList.test.tsx` extended — updated `backTo`/`backLabel` assertions. |
| Contract | None — no API shape changed. |
| End-to-end | Extends the existing golden path rather than adding a new one: from the dashboard, open Club Profile, confirm all five sections render, open a contact's quick-view dialog, follow its Edit link, confirm it lands on that contact's real edit screen, navigate back. Not wired into CI, same precedent as every prior `/manage` spec. |

## Acceptance Criteria

- The dashboard's "Club manager" group shows exactly the 9 cards listed above, in that order, and no longer shows separate Club Contacts/Club Sponsors/Club Structure/"Leagues and Fixtures" cards.
- Clicking "Leagues" or "Matches" on the dashboard reaches the League/Match list in one click.
- `/manage/club-profile` shows the club's branding, contact details, address, and social links (each only when set), a Contacts section, a Sponsors section, a read-only Structure summary, and a Seasons section, with no separate page navigation required to see any of them.
- Clicking a contact or sponsor icon opens a dialog with that record's full details and a working "Edit" link into its real edit screen; closing the dialog returns to the overview page unchanged.
- "Edit profile," "Manage" (Contacts/Sponsors), "Edit structure," and "Add season" each navigate to the exact existing edit/list screen for that data — no new edit UI exists anywhere in this spec.
- A club with no contacts, no sponsors, no structure, or no seasons yet shows a clear empty state for that section instead of an error or a blank area.
- Gallery and Notifications appear as dashboard cards clearly marked "Coming soon" and route to placeholder screens, matching the existing `results`/`permissions` precedent exactly.
- Navigating to the old `/manage/fixtures` hub URL is not expected to work after this ships (no redirect) — its three destinations remain reachable via the dashboard and the Club Profile overview instead.

## Rollout Notes

- **Ships as one PR, frontend-only** — no backend change, no migration, so no build-order dependency on `backend-builder` at all; this is the first spec in the `League`/`Club` epic that's purely `frontend-builder` + `test-writer`.
- **No feature flag** — the dashboard/route changes are atomic (a club admin either has the old nav or the new one, no partial state), and every underlying screen this spec routes into already exists and is already tested.
- **Design already approved** — the layout, card order, and the icon-plus-quick-view-dialog interaction pattern were reviewed and confirmed via an interactive mockup before this spec was written (see "Depends on," above); the build should match that approved mockup's structure and copy, not reinterpret it.
- **`RecordQuickViewDialog` is a deliberate, real new shared component** (this codebase's first generic dialog wrapper, per the UI Requirements note that every existing `*Dialog` component builds MUI's primitives directly) — a human should note it in `docs/standards/design-system.md`'s component inventory once built, as future specs needing a similar "quick look at a small record" pattern should reuse it rather than building a seventh one-off dialog.
- A human should update `docs/roadmap.md`'s Active table once this ships.
