# 049 — Record List Edit-Action Rollout

**Depends on:** `036-view-first-record-detail-screens.md` (built `RecordCard`'s `viewTo`/`editTo` dual-render support — "If `editTo` is ALSO passed, both render side by side (View, then Edit)" per the prop's own doc comment — and made every list card `viewTo`-only, deliberately dropping Edit down one click into `RecordDetailScreen`; also the spec whose Non-goals first flagged permission-gating the Edit action as real future scope, not yet actioned — see this spec's own Non-goals).

**Status:** draft. **Amended after initial build**: the original draft scoped this to the seven top-level list screens only and explicitly excluded cross-linked `RecordCard`s inside a `*DetailPage` (old Non-goals bullet, now removed). Two gaps surfaced once the first seven were live: (1) `TeamDirectory.tsx` (`/manage/teams`, the club-wide Teams directory) was missed entirely — `TeamList.tsx` (`/manage/sections/:sectionId/teams`) is a *second*, section-nested list screen for the same entity, and only that one was in scope originally; (2) the user, looking at `TeamDetailPage`'s Squad card, confirmed the intent was broader than "top-level list screens" — every `RecordCard` for these entity types should get Edit, including the four cross-linked cards inside `TeamDetailPage.tsx`/`LeagueDetailPage.tsx`. This amendment folds both into scope. See the updated Goals/Non-goals/UI Requirements/Test Plan below — sections not mentioned as amended are unchanged from the original draft.

## Problem & Goals

`036` made every `/manage` `RecordCard` view-only: pass `viewTo`, not `editTo`, so the only footer action is "View," with Edit reached one click further in from `RecordDetailScreen`. `MatchList.tsx` has since diverged from that pattern — confirmed directly in the code, `ui/src/pages/manage/MatchList.tsx` around line 216-224, its `RecordCard` call passes `editTo` *and* `viewTo` together, rendering View and Edit side by side on the card itself. `RecordCard` already supports this rendering unconditionally (`ui/src/components/RecordCard/RecordCard.tsx`, `viewTo`'s own doc comment); no other list screen uses it. No spec documents why Match regained the shortcut — it's simply the de facto current gold standard, and the user wants it replicated everywhere else, not re-litigated.

Seven other `/manage` list screens still only ever expose View: Club Contacts, Sponsors, Sponsor Contacts, Teams, Players, Leagues, Seasons. Every one of their edit routes and `*FormPage` screens already exists and is already reachable today, one click further in from each entity's own `RecordDetailScreen`/`*DetailPage`'s own Edit action — this spec adds a second, faster entry point to an already-built screen, nothing more.

**Amendment**: two more locations render the same `viewTo`-only `RecordCard` for these entity types and are now in scope too:
- `TeamDirectory.tsx` (`/manage/teams`) — the club-wide Teams directory, a second top-level list screen for Team alongside `TeamList.tsx` (Team is section-nested, so it uniquely has two list screens; every other entity in this spec has exactly one, confirmed by reading every route in `App.tsx`).
- Four cross-linked `RecordCard`s inside two `*DetailPage`s, each showing a related record with only a "peek" View action today: `TeamDetailPage.tsx`'s Contacts card, Sponsors card, and Squad card (Players), and `LeagueDetailPage.tsx`'s Affiliated Teams card.

**Goals**
- `ClubContactList`, `SponsorList`, `SponsorContactList`, `TeamList`, `TeamDirectory`, `PlayerList`, `LeagueList`, and `SeasonList` each pass `editTo` alongside their existing `viewTo` on their `RecordCard` call, rendering View and Edit side by side — byte-for-byte the same shape `MatchList.tsx` already has.
- `TeamDetailPage.tsx`'s Contacts/Sponsors/Squad cards and `LeagueDetailPage.tsx`'s Affiliated Teams card get the same `editTo` addition, so a cross-linked "peek" card offers the same Edit shortcut as its entity's own top-level list card.
- Every `RecordCard` anywhere in `/manage` for these entity types becomes indistinguishable, in footer shape, from `MatchList.tsx` — no card is a View-only exception to this pattern once this ships (except where a future permission model narrows it — see Non-goals).

## Non-goals

- **No permission-based gating of the Edit action.** Per the user's own framing of this request: "will later add the permissions around these buttons." Every user who can reach `/manage` today sees the Edit button on every card, unconditionally — identical to how Match's own Edit button has no gating today. This is the second time this exact deferral has been flagged: `036`'s own Non-goals flagged it first, for the View/Edit split itself ("Deciding who *doesn't* get an Edit action, and hiding it accordingly, is real, identifiable future scope... flag for `docs/roadmap.md` once this ships"), but that roadmap entry was never actually added — confirmed by grep against the current `docs/roadmap.md`. This spec flags it again, now that Edit is becoming universally visible on the card a second time, and recommends (Rollout Notes) that the entry finally land this time.
- **No new route, no new `*FormPage`, no new backend work.** Every edit route this spec wires up (`.../edit`) and its target form page already exists, already has its own `<Route>` in `App.tsx`, and is already reachable today via each entity's own `RecordDetailScreen`/`*DetailPage` Edit action. This spec only adds a second `RouterLink` to an existing destination.
- **`MatchList.tsx`/`MatchDetailPage.tsx`/`MatchFormPage.tsx` are not touched.** Match already has this exact pattern; it's the precedent being copied, not a target of this change.
- **No change to `RecordCard` itself.** Its `viewTo`+`editTo` dual-render behaviour, built by `036`, already does exactly what this spec needs, unconditionally, for any call site that passes both. No new prop, no new variant.
- **No change to any list screen's toolbar, sort, filter, search, or data-fetching logic**, and no change to any `RecordCard`'s fields/badges/avatar/other props beyond adding `editTo` — the amendment above adds `editTo` to five more specific, named call sites; it does not reopen every `RecordCard` in the codebase (e.g. `SquadPicker.tsx`'s `viewTo={null}` picker cards are a different pattern entirely and are not touched).
- **No visual or component-library change.** `RecordCard`'s existing View/Edit footer markup (`ui/src/components/RecordCard/RecordCard.tsx` lines ~253-277) is reused exactly as `MatchList.tsx` already exercises it — no new icon, label, or layout.

## User Stories

- As a club admin viewing the Club Contacts, Sponsors, Sponsor Contacts, Teams (either list screen), Players, Leagues, or Seasons list, I can click Edit directly from the card and land on that record's existing edit form, without first landing on its read-only view screen.
- As a club admin looking at a Team's own detail page (its Contacts, Sponsors, or Squad section) or a League's detail page (its Affiliated Teams section), I can click Edit directly on the related record's card, without first navigating into its own view screen.
- As a club admin, the View action remains available on every one of these cards, unchanged, so I can still choose to look before I touch.
- As a club admin, this shortcut behaves identically across every `RecordCard` in `/manage` for these entity types — no card is the odd one out anymore.

## Data Model Changes

None. No entity, field, migration, or endpoint is touched.

## API Contract

None. No endpoint is added, changed, or newly called — every edit route this spec links to already fetches its data exactly as it does today, reached from a different click path.

## UI Requirements

Seven files, each getting one additive change to its existing `RecordCard` call — add an `editTo` prop with the value already used by that entity's existing `.../edit` route (confirmed live and reachable today via each entity's own `*DetailPage` Edit action, and already declared in `App.tsx`):

| File | Existing `viewTo` (unchanged) | New `editTo` |
|---|---|---|
| `ui/src/pages/manage/ClubContactList.tsx` | `` `/manage/club-contacts/${contact.id}` `` | `` `/manage/club-contacts/${contact.id}/edit` `` |
| `ui/src/pages/manage/SponsorList.tsx` | `` `/manage/sponsors/${sponsor.id}` `` | `` `/manage/sponsors/${sponsor.id}/edit` `` |
| `ui/src/pages/manage/SponsorContactList.tsx` | `` `/manage/sponsors/${sponsorId}/contacts/${contact.id}` `` | `` `/manage/sponsors/${sponsorId}/contacts/${contact.id}/edit` `` |
| `ui/src/pages/manage/TeamList.tsx` | `` `/manage/sections/${sectionId}/teams/${team.id}` `` | `` `/manage/sections/${sectionId}/teams/${team.id}/edit` `` |
| `ui/src/pages/manage/PlayerList.tsx` | `` `/manage/players/${player.id}` `` | `` `/manage/players/${player.id}/edit` `` |
| `ui/src/pages/manage/LeagueList.tsx` | `` `/manage/fixtures/leagues/${league.id}` `` | `` `/manage/fixtures/leagues/${league.id}/edit` `` |
| `ui/src/pages/manage/SeasonList.tsx` | `` `/manage/fixtures/seasons/${season.id}` `` | `` `/manage/fixtures/seasons/${season.id}/edit` `` |

**Amendment — five more call sites**, same additive shape:

| File / card | Existing `viewTo` (unchanged) | New `editTo` |
|---|---|---|
| `ui/src/pages/manage/TeamDirectory.tsx` (`TeamCard`) | `` `/manage/sections/${team.sectionId}/teams/${team.id}` `` | `` `/manage/sections/${team.sectionId}/teams/${team.id}/edit` `` |
| `ui/src/pages/manage/LeagueDetailPage.tsx` (Affiliated Teams card) | `` `/manage/sections/${team.sectionId}/teams/${team.id}` `` | `` `/manage/sections/${team.sectionId}/teams/${team.id}/edit` `` |
| `ui/src/pages/manage/TeamDetailPage.tsx` (Contacts card) | `` `/manage/club-contacts/${contact.id}` `` | `` `/manage/club-contacts/${contact.id}/edit` `` |
| `ui/src/pages/manage/TeamDetailPage.tsx` (Sponsors card) | `` `/manage/sponsors/${sponsor.id}` `` | `` `/manage/sponsors/${sponsor.id}/edit` `` |
| `ui/src/pages/manage/TeamDetailPage.tsx` (Squad card) | `` `/manage/players/${member.playerProfileId}` `` | `` `/manage/players/${member.playerProfileId}/edit` `` |

`editLabel` is left at its default (`'Edit'`) in every case, matching `MatchList.tsx`'s own `editLabel="Edit"` call (redundant with the prop's own default, but kept explicit there for clarity — either is acceptable here since the rendered label is identical). No other prop on any of these twelve `RecordCard` calls changes.

Mobile-first: no new layout risk — `RecordCard`'s footer already wraps (`flexWrap: 'wrap'`) and already renders View+Edit together on `MatchList` at every breakpoint down to 375px; this spec reuses that same footer, not a new one.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | Each of the seven list screens' existing test file (`ClubContactList.test.tsx`, `SponsorList.test.tsx`, `SponsorContactList.test.tsx`, `TeamList.test.tsx`, `PlayerList.test.tsx`, `LeagueList.test.tsx`, `SeasonList.test.tsx`) gets one new assertion mirroring `MatchList.test.tsx`'s own existing coverage of this exact behaviour (`MatchList.test.tsx`, `'renders View and Edit together on a card, both pointing at the match's own routes'`): `screen.getByRole('link', { name: 'View' })` and `screen.getByRole('link', { name: 'Edit' })` both resolve, with `toHaveAttribute('href', ...)` asserting each against that entity's own View/Edit route from the table above. None of the seven files currently assert on the View link at all (confirmed by inspection — only `MatchList.test.tsx` does today), so each new test also adds the View assertion alongside the new Edit one, rather than only extending an existing one. Each test's `MemoryRouter`/`Routes` wrapper needs a sibling `.../edit` route added (most currently only declare the list route plus a `.../new` route — e.g. `ClubContactList.test.tsx`'s wrapper has `club-contacts` and `club-contacts/new` but no `club-contacts/:id/edit`) so the `Edit` link's target actually resolves inside the test, matching how `MatchList.test.tsx`'s own wrapper already declares `matches/:matchId/edit`. **Amendment**: the same View+Edit link/href assertion pattern is added to `TeamDirectory.test.tsx` (one new test, one new sibling `.../edit` route in its wrapper) and to `TeamDetailPage.test.tsx`/`LeagueDetailPage.test.tsx` (one new test per card section — Contacts, Sponsors, Squad in the former; Affiliated Teams in the latter — each needing its own sibling `.../edit` route added to that test's wrapper). |
| Contract | None — no endpoint touched. |
| End-to-end | None new — no existing e2e spec targets any of these screens specifically; not introduced here, consistent with this being a small, mechanical, low-risk change to an already-reachable destination, not new golden-path behaviour. |

## Acceptance Criteria

- Each of `ClubContactList`, `SponsorList`, `SponsorContactList`, `TeamList`, `TeamDirectory`, `PlayerList`, `LeagueList`, and `SeasonList` renders both a "View" and an "Edit" link on every `RecordCard`, in that order, matching `MatchList.tsx`'s existing footer shape exactly.
- `TeamDetailPage.tsx`'s Contacts/Sponsors/Squad cards and `LeagueDetailPage.tsx`'s Affiliated Teams card each render the same View+Edit pair.
- Each new "Edit" link's `href` matches that entity's existing, already-shipped `.../edit` route — no new route is introduced anywhere.
- The "View" link on every one of these cards is unchanged in target and behaviour.
- No card anywhere else in `/manage` (e.g. `SquadPicker.tsx`'s picker cards, or `MatchList.tsx` itself) is touched.
- No new prop, component, endpoint, or migration is introduced.

## Rollout Notes

- Ships as one PR touching twelve `RecordCard` call sites across nine page files, plus matching test coverage — no shared component, route, or backend file is touched.
- **A human should add the `docs/roadmap.md` entry `036` first asked for and that never landed**: permission-gated visibility for the Edit action, now doubly relevant since Edit is universally visible again across every `/manage` list card, not just Match's. This is the second spec to flag the same gap without resolving it — a third pass finding it unflagged a second time should be treated as a process miss, not a new discovery.
