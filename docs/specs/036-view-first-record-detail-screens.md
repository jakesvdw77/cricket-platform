# 036 — View-First Record Detail Screens

**Depends on:** `008-product-catalog.md` (the `ListToolbar`/`RecordCard`/`RecordFormScreen` record-list pattern this spec extends with a fourth shape, not replaces — `docs/standards/design-system.md`'s Record list / create-edit pattern table), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace and `@access.canAdministerClub` gate every view screen below reads through, unchanged), `021-club-contacts.md`/`023-sponsors.md`/`024-sponsor-contacts.md` (`ClubContact`/`Sponsor`/`SponsorContact`, three of the eight entities this spec adds a view screen for), `025-club-structure.md`/`026-teams.md`/`027-team-profile.md` (`Section`-nested `Team` routes and `TeamFormPage`'s existing Details/Contacts/Sponsors tab structure, collapsed here), `028-players.md` (`PlayerFormPage`'s existing Basic Info/Contact Info/Cricket Info/Sections tab structure, collapsed here), `029-league-management.md` (`League`/`Season`/`Match`/`TeamSquadMember`, `LeagueFormPage`'s Details/Affiliations tabs and `MatchFormPage`'s Details/Home XI/Away XI/Availability tabs, both collapsed here; `PlayingXiBuilder`, reused for its data shape only — see Non-goals), `032-match-availability-polls.md`/`033-availability-aware-xi-builder.md`/`034-availability-polls-dashboard.md` (`MatchAvailabilityTab`'s tinted-status convention and `034`'s `AvailabilityRespondentAvatars` component, both reused verbatim for this spec's Match Availability section; `034`'s own stated design note — *"`RecordFormScreen` wraps a create/edit form. This screen has no form — every field is read-only, and the one action (Edit) navigates away rather than opening one"* — is the direct precedent this spec generalises from one dashboard card to every record type), `035-section-scoped-access.md` (confirms `Team`'s route always carries `sectionId`, reused for this spec's own Team view route).
**Status:** draft.

## Problem & Goals

Every record in `/manage` — Player, Team, Match, League, Season, Club Contact, Sponsor, Sponsor Contact — is reached the same way: click a `RecordCard`, land directly on `RecordFormScreen`, a live edit form. There is no read-only way to look at a record. For four of these (Player, Team, Match, League) that edit form is also a tabbed screen (`Tabs`/`Tab` from `@mui/material`), so even *reading* a record's full picture means clicking through three or four tabs one at a time. Confirmed directly against the code during this spec's own discovery pass, not assumed: `RecordCard` (`ui/src/components/RecordCard/RecordCard.tsx:220-235`) renders exactly one footer action, and it's always Edit — `editTo`/`onEdit`, no `viewTo`/`onView` alternative exists anywhere in this codebase today.

This matters beyond convenience: not every person who will eventually reach `/manage` should be able to edit everything they can see — a section-scoped admin, a future team manager, or any narrower role this platform adds later needs a real "look, don't touch" mode to land in. This spec does not build that permission model (see Non-goals) — it builds the screen shape a future permission spec will gate, so that work is a visibility check on an existing screen, not a screen this codebase doesn't have yet.

**Goals**
- A new shared component, `RecordDetailScreen`, the read-only counterpart to `RecordFormScreen` — single page, no tab layout, an explicit Edit action.
- Every `RecordCard` for a Player, Team, Match, League, Season, Club Contact, Sponsor, or Sponsor Contact — whether on that entity's own list screen or a cross-link from another entity's own detail screen — opens this new view screen instead of jumping straight into the edit form.
- Player's, Team's, Match's, and League's existing tabbed edit forms each get a single-page, sectioned `RecordDetailScreen` counterpart that shows the same information without tabs.
- Every existing edit form (`PlayerFormPage`, `TeamFormPage`, `MatchFormPage`, `LeagueFormPage`, `SeasonFormPage`, `ClubContactFormPage`, `SponsorFormPage`, `SponsorContactFormPage`) is reached only via the new view screen's Edit action (or a list's existing "Add" action, for creating a record that doesn't exist yet to view) — and is otherwise **completely unchanged**, tabs and all.

## Non-goals

- **Permission-based gating of the Edit action.** This spec is pure UI restructuring — anyone who can reach `/manage` today sees exactly the same Edit action they see today, just one click further in. `RoleAssignmentRole.MANAGER` stays exactly as unresolved as `035` left it. Deciding who *doesn't* get an Edit action, and hiding it accordingly, is real, identifiable future scope this spec deliberately sets up for but does not build — flag for `docs/roadmap.md` once this ships.
- **Club Profile.** `ManageClubProfilePage.tsx` is a singleton `RecordFormScreen` — there's exactly one Club Profile record, no list, and it's already "yours to edit" the moment you can reach it. Nothing about the view-first problem (picking the wrong record to edit, or wanting to look without a list of alternatives to browse) applies to a screen with no list. Stays exactly as it is.
- **Availability Polls Dashboard.** `AvailabilityPollsDashboard.tsx`'s card action is "Manage responses," which deep-links into `MatchAvailabilityTab` — a response-management workflow, not a record-edit form (`034`'s own Non-goals already established this dashboard has no form of its own). Out of scope, unchanged.
- **Club Structure.** `ClubStructure.tsx` is built on `SectionTreeEditor`, an entirely different component family (a tree/org-chart editor, not `RecordCard`/`RecordFormScreen`). A view-first pattern for it, if ever wanted, is its own spec — not a drop-in of this one.
- **Any backend change.** Every view screen reads exactly the data its corresponding edit form already fetches, through the same existing endpoints. No new entity, field, migration, DTO, or endpoint.
- **Rebuilding `PlayingXiBuilder` or `MatchAvailabilityTab` as read-only, or changing their editing behaviour in any way.** Match's Home XI/Away XI/Availability tabs stay real, interactive, editable tabs on `MatchFormPage`, exactly as `029`/`032`/`033` built them. The Match view screen shows their current *outcome* — who's in the XI, in what order, who's responded how — using new, genuinely read-only display components (see UI Requirements), not the editors themselves in a disabled state.
- **Changing what a linked/nested card's action does on an edit form.** `TeamFormPage`'s Contacts/Sponsors/Squad tabs keep their existing link/unlink/add mutations exactly as built — those are editing actions and belong on the edit form. Only the *view* screen's read-only rendering of those same lists is new (see UI Requirements); the edit form's own tabs are untouched.
- **Search, sort, or any other `ListToolbar` change.** Every list screen (`PlayerList`, `TeamList`/`TeamDirectory`, `MatchList`, `LeagueList`, `SeasonList`, `ClubContactList`, `SponsorList`, `SponsorContactList`) keeps its existing `ListToolbar` and `RecordCard` grid exactly as-is — only each card's footer action target changes (Edit → View).

## User Stories

- As a club admin, I can click a Player/Team/Match/League/Season/Club Contact/Sponsor/Sponsor Contact card from its list and land on a single, read-only page showing that record's full details — no tabs to click through, no fields editable by accident.
- As a club admin looking at a Team's view page, I see its current Contacts, Sponsors, and Squad (for the selected Season) as read-only lists, each entry a real card I can click into that record's own view page — a Team Contact's card takes me to that Club Contact's own view, not into an edit form.
- As a club admin looking at a Match's view page, I see the match's details, both sides' currently-selected Playing XIs (batting order, captain, wicketkeeper, twelfth man, role tags), and each side's availability response summary (avatars-plus-count per status, matching `034`'s dashboard) — all read-only, in one page, no tabs.
- As a club admin who wants to make a change, I click the one, clearly-labelled Edit action on any view screen and land exactly on that record's existing edit form — nothing about that form has changed.
- As a club admin, creating a new record still takes me straight to the existing "new" form (there's nothing to view yet) — only records that already exist get a view screen first.

## Data Model Changes

None. Every field rendered on a view screen already exists and is already fetched by that record's existing edit form (`getMatch`/`listPlayers`/`listTeamsForClub`/`listLeagues`/`listSeasons`/`listClubContacts`/`listSponsors`/`listSponsorContacts`, plus `listPolls`/`getPollResponses`/`listMatchSides` for Match's Availability/XI sections) — this spec adds no new backend call.

## API Contract

None. Every view screen is a new read-only *rendering* of data an existing endpoint already returns — no new endpoint, no changed response shape. (Explicitly re-confirmed for Match: `getMatch`, `listMatchSides`, `listPolls`/`getPollResponses` are all pre-existing, unmodified reads.)

## UI Requirements

**One new shared component: `ui/src/components/RecordDetailScreen/`** (four-file anatomy — `.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`), the read-only sibling `docs/standards/design-system.md`'s Record list / create-edit pattern table is missing today. Shape:
- A visible Back action above the title, identical to `RecordFormScreen`'s (reused, not reinvented).
- A header mirroring `RecordCard`'s own: optional avatar (same `RecordCardAvatar` shape — photo/logo or initials fallback), title, optional status badge.
- One primary **Edit** action in the header area (`editTo: string`, rendered as a filled/outlined button with `EditOutlined`, matching `RecordCard`'s existing icon convention) — the only mutating affordance on the whole screen.
- A vertical stack of labelled **sections** (`{ heading: string; content: ReactNode }[]`) in place of tabs — each section a plain `<Typography variant="subtitle2">` heading followed by its content, stacked top-to-bottom on one scrollable page. A section's content is typically a responsive field grid (reusing `RecordCard`'s own field-row visual: `caption` label + bold `body2` value, in the same `{ xs: '1fr', md: '1fr 1fr' }` grid `RecordFormScreen` already uses) or, for a cross-linked list (Team's Contacts/Sponsors/Squad, League's Affiliations), a grid of read-only `RecordCard`s.

Flagged for a Claude Design pass before build (`docs/workflow.md` Step 2, same precedent `029`/`032` set for `PlayingXiBuilder`/`PublicAvailabilityPoll`) — `RecordDetailScreen`'s section layout is a genuinely new visual pattern, not a near-miss on `RecordFormScreen`'s field-grid shape.

**`RecordCard` gets one new, additive prop: `viewTo?: string`.** When present, it becomes the card's primary footer action ("View", no icon change needed beyond swapping `EditOutlined` for an eye icon — `VisibilityOutlined`, matching the icon-per-action convention `design-system.md` already establishes), and `editTo`/`onEdit` — if still passed — is dropped from the footer entirely (Edit now lives only on the view screen it leads to, not duplicated on the card). This is purely additive: any `RecordCard` call site not touched by this spec keeps behaving exactly as it does today.

**Per-entity mapping** (route convention: the new view route is the existing edit route's bare `:id`, no `/edit` suffix — mirrors this codebase's own already-consistent `App.tsx` pattern, where `new` is always a separate literal segment so there's no ambiguity with a dynamic `:id`):

| Entity | List screen(s) updated | New view route | New view page | Tabs collapsed into sections |
|---|---|---|---|---|
| Player | `PlayerList.tsx` | `players/:playerId` | `PlayerDetailPage.tsx` | Basic Info, Contact Info, Cricket Info, Sections |
| Team | `TeamList.tsx`, `TeamDirectory.tsx` | `sections/:sectionId/teams/:teamId` | `TeamDetailPage.tsx` | Details, Contacts, Sponsors, Squad (season-selected, same `Season` `Select` as today, filtering only — not an edit action) |
| Match | `MatchList.tsx` | `fixtures/matches/:matchId` | `MatchDetailPage.tsx` | Details, Home XI, Away XI, Availability (see below) |
| League | `LeagueList.tsx` | `fixtures/leagues/:leagueId` | `LeagueDetailPage.tsx` | Details, Affiliations (season-selected, filtering only) |
| Season | `SeasonList.tsx` | `fixtures/seasons/:seasonId` | `SeasonDetailPage.tsx` | (already untabbed — one Details section) |
| Club Contact | `ClubContactList.tsx` | `club-contacts/:id` | `ClubContactDetailPage.tsx` | (one Details section) |
| Sponsor | `SponsorList.tsx` | `sponsors/:id` | `SponsorDetailPage.tsx` | (one Details section) |
| Sponsor Contact | `SponsorContactList.tsx` | `sponsors/:sponsorId/contacts/:contactId` | `SponsorContactDetailPage.tsx` | (one Details section) |

**Cross-links change too, not just the eight list screens above.** Any `RecordCard` elsewhere that currently points at one of these eight entity types switches from `editTo` to `viewTo`:
- `TeamDetailPage`'s Contacts section: each `ClubContact` card → `viewTo` into `ClubContactDetailPage`, not `ClubContactFormPage`.
- `TeamDetailPage`'s Sponsors section: each `Sponsor` card → `viewTo` into `SponsorDetailPage`.
- `TeamDetailPage`'s Squad section: each squad member's card → `viewTo` into that `Player`'s `PlayerDetailPage`.
- `LeagueDetailPage`'s Affiliations section: each affiliated `Team` card → `viewTo` into `TeamDetailPage`.
- `PlayerDetailPage`'s Sections section: unchanged in kind (already a read-only `SectionTree`/breadcrumb display, not a `RecordCard`).

The corresponding editing UI (link/unlink, create-and-link, add-to-squad) is **not** duplicated on the view screen — it stays exactly where it is today, on the entity's own edit form (`TeamFormPage`'s Contacts/Sponsors/Squad tabs, `LeagueFormPage`'s Affiliations tab), reached via the view screen's single Edit action.

**Match's Home XI / Away XI sections — one new, genuinely read-only component**, since `PlayingXiBuilder` (`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx`) has no read-only mode today — confirmed directly: every prop is data-plus-mutation-callback, there is no `readOnly`/`disabled` prop to reuse. New component `ui/src/components/PlayingXiSummary/` (four-file anatomy, flagged for the same Claude Design pass above): an ordered list of the side's selected XI — batting order, name, captain/wicketkeeper/twelfth-man badges, batsman/bowler/all-rounder role chip — reusing `TeamSquadMember`'s existing display fields and `PlayingXiBuilder`'s existing badge/chip visual language, with no add/remove/reorder controls. Renders an `EmptyState` ("No XI selected yet") if the side has no `MatchSide` built.

**Match's Availability section** reuses `034`'s existing `AvailabilityRespondentAvatars` component and DTO shape verbatim (`GET .../matches/{matchId}/polls` + `GET .../polls/{pollId}/responses`, already fetched by `MatchAvailabilityTab` today) — a per-side, per-status avatar-plus-count summary, identical to what `034`'s dashboard card already renders, with no admin-override control (that stays on `MatchAvailabilityTab`, reached via Edit).

**Routing (`ui/src/App.tsx`)** — one new bare-`:id` `<Route>` per entity, sibling to its existing `:id/edit` route, e.g.:
```tsx
<Route path="players/:playerId" element={<PlayerDetailPage />} />
<Route path="players/:playerId/edit" element={<PlayerFormPage />} />
```
repeated for all eight entities per the table above (Team's nested under `sections/:sectionId/teams/:teamId`, Sponsor Contact nested under `sponsors/:sponsorId/contacts/:contactId`, matching each entity's existing edit-route nesting exactly).

## Test Plan

- **Component** — `RecordDetailScreen.test.tsx`: renders header (avatar/title/badge), sections in order, Edit button links to `editTo`, Back action links to `backTo`. `RecordCard.test.tsx` (extended): `viewTo` renders a View action and suppresses Edit; existing `editTo`/`onEdit` call sites unaffected. `PlayingXiSummary.test.tsx`: renders an ordered XI with badges/chips; renders the empty state with no `MatchSide`.
- **Component** — one test per new `*DetailPage.tsx`, extending each entity's existing `*FormPage.test.tsx` sibling: loads the record's existing data, renders every section, Edit action's `href`/`to` matches the existing edit route, cross-linked cards (Team's Contacts/Sponsors/Squad, League's Affiliations) render with `viewTo` targets, not `editTo`.
- **End-to-end** — one golden path extending an existing `/manage` Playwright spec: from `PlayerList`, click a player card, land on the read-only view (assert no editable input is present), click Edit, land on the existing tabbed edit form, save, navigate back, confirm the view reflects the change. Not wired into CI, matching every prior `/manage` spec's stated precedent.

## Acceptance Criteria

- Clicking any Player, Team, Match, League, Season, Club Contact, Sponsor, or Sponsor Contact card from its list lands on a single-page, tab-free, read-only view of that record — no input, select, or other editable control is rendered on that page.
- Every such view page has exactly one Edit action, and it navigates to the existing, functionally unchanged edit form for that record.
- Team's, League's, and Player's cross-linked record lists (Contacts, Sponsors, Squad, Affiliations) render as read-only cards on the view page, and clicking one of those cards navigates to *that* record's own view page, not an edit form.
- Match's view page shows both sides' currently-selected Playing XI and availability summary without exposing any add/remove/reorder/override control.
- Creating a new record (any "Add"/"New" action) is unchanged — it still opens the create form directly, with no view screen in between.
- No new backend endpoint, DTO, or database migration is introduced.

## Rollout Notes

Ships as one pass across all eight entities together, not staggered per entity — the new `RecordDetailScreen`/`PlayingXiSummary` components and the `RecordCard.viewTo` prop are shared infrastructure every entity depends on identically, and shipping (for example) Player's view screen alone while every other card still jumps straight to Edit would read as an inconsistent, half-migrated product rather than a deliberate phase.

**A human should update `docs/roadmap.md` once this ships**, adding an explicit open item for permission-gated Edit visibility (this spec's own Non-goals) — the screen shape now exists for a future spec to gate, it should be named as ready-to-build rather than re-discovered from scratch.
