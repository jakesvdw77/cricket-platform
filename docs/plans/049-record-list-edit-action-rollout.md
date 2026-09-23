# Plan: 049 — Record List Edit-Action Rollout

## Amendment (post-build)

The original plan below (items 1–14) is fully built, tested, and standards-reviewed with no findings. Two gaps surfaced afterward, confirmed directly with the user:

1. `TeamDirectory.tsx` (`/manage/teams`) — a second, club-wide list screen for Team (alongside the section-nested `TeamList.tsx`, which was already covered) — was missed from the original file list.
2. The user confirmed the intent is broader than "top-level list screens": four cross-linked `RecordCard`s inside `TeamDetailPage.tsx` (Contacts, Sponsors, Squad) and `LeagueDetailPage.tsx` (Affiliated Teams) — previously deliberately excluded by the original plan/spec — should get `editTo` too.

Both are now folded into `docs/specs/049-record-list-edit-action-rollout.md` via an in-place amendment (see that file's own amendment note). New items 15–19 below cover the five additional call sites; items 1–14 are unchanged, already shipped in the same working tree, and not repeated here beyond the table.

### New files/call sites (items 15–19)

| # | File / card | Existing `viewTo` (unchanged) | New `editTo` |
|---|---|---|---|
| 15 | `ui/src/pages/manage/TeamDirectory.tsx` (`TeamCard`) | `` `/manage/sections/${team.sectionId}/teams/${team.id}` `` | `` `/manage/sections/${team.sectionId}/teams/${team.id}/edit` `` |
| 16 | `ui/src/pages/manage/LeagueDetailPage.tsx` (Affiliated Teams card) | `` `/manage/sections/${team.sectionId}/teams/${team.id}` `` | `` `/manage/sections/${team.sectionId}/teams/${team.id}/edit` `` |
| 17 | `ui/src/pages/manage/TeamDetailPage.tsx` (Contacts card) | `` `/manage/club-contacts/${contact.id}` `` | `` `/manage/club-contacts/${contact.id}/edit` `` |
| 18 | `ui/src/pages/manage/TeamDetailPage.tsx` (Sponsors card) | `` `/manage/sponsors/${sponsor.id}` `` | `` `/manage/sponsors/${sponsor.id}/edit` `` |
| 19 | `ui/src/pages/manage/TeamDetailPage.tsx` (Squad card) | `` `/manage/players/${member.playerProfileId}` `` | `` `/manage/players/${member.playerProfileId}/edit` `` |

For each: add `editTo` immediately after the existing `viewTo` line in that `RecordCard` call, same interpolation style already in scope, no other prop/import changed. `TeamDetailPage.tsx` gets three separate one-line additions (items 17–19), one per card section — not a shared refactor, since each card already lives in its own independent `.map()` block.

### Matching test coverage (items 20–22)

- `TeamDirectory.test.tsx` — add a sibling `.../edit` route to its router wrapper, plus one new test mirroring `MatchList.test.tsx`'s View+Edit precedent (same query shape items 8–14 already used).
- `TeamDetailPage.test.tsx` — add three sibling `.../edit` routes (club-contacts, sponsors, players) to its wrapper, plus one new View+Edit assertion per card section (Contacts, Sponsors, Squad) using a fixture with at least one row in each section.
- `LeagueDetailPage.test.tsx` — add a sibling `sections/:sectionId/teams/:teamId/edit` route to its wrapper, plus one new View+Edit assertion for the Affiliated Teams card.

### Agent assignment (amendment)

1. **`frontend-builder`** — items 15–19.
2. **`test-writer`** (after) — items 20–22.
3. **`standards-reviewer`** (after) — re-review the full diff (original + amendment) before PR.

### Flags for your review (amendment)

None substantive — same shape as the original plan, just five more already-existing-route wire-ups. `SquadPicker.tsx`'s `viewTo={null}` cards are a genuinely different pattern (a picker, not a record card) and stay out of scope, per the spec's amended Non-goals.

### Verification (amendment)

- `cd ui && npm run build && npm run lint && npm run test`.
- Manual smoke test: `/manage/teams` (club-wide directory) shows Edit; a Team's own detail page (`/manage/sections/:sectionId/teams/:teamId`) shows Edit on its Contacts/Sponsors/Squad cards; a League's detail page (`/manage/fixtures/leagues/:leagueId`) shows Edit on its Affiliated Teams card.

---

## Original plan (items 1–14, already shipped)

## Context

`docs/specs/049-record-list-edit-action-rollout.md` (draft, approved) closes a gap `036-view-first-record-detail-screens.md` opened: every `/manage` list card today passes `viewTo` only to `RecordCard`, so Edit is reachable only one click deeper, from inside that record's `RecordDetailScreen`. `MatchList.tsx` has since diverged — its `RecordCard` call passes both `viewTo` and `editTo`, rendering View and Edit side by side, using `RecordCard`'s own existing, unconditional dual-render support (`ui/src/components/RecordCard/RecordCard.tsx`, `viewTo`'s doc comment: "If `editTo` is ALSO passed, both render side by side"). The user wants that same shape replicated on the seven other list screens: Club Contacts, Sponsors, Sponsor Contacts, Teams, Players, Leagues, Seasons — permission-gating deliberately deferred (now tracked in `docs/roadmap.md`'s "Known tech debt" section, added this session).

Direct reading confirmed for every file below:
- `RecordCard` itself needs **zero changes** — the dual-render footer is already built and already exercised by `MatchList.tsx`.
- Every target `.../edit` route already exists in `ui/src/App.tsx` and already has a working `*FormPage` behind it (each entity's own `*DetailPage`'s Edit action already navigates there today) — this plan only adds a second `RouterLink` to an already-reachable destination, per file:

| List file | Existing `viewTo` (unchanged) | New `editTo` |
|---|---|---|
| `ClubContactList.tsx` | `` `/manage/club-contacts/${contact.id}` `` | `` `/manage/club-contacts/${contact.id}/edit` `` |
| `SponsorList.tsx` | `` `/manage/sponsors/${sponsor.id}` `` | `` `/manage/sponsors/${sponsor.id}/edit` `` |
| `SponsorContactList.tsx` | `` `/manage/sponsors/${sponsorId}/contacts/${contact.id}` `` | `` `/manage/sponsors/${sponsorId}/contacts/${contact.id}/edit` `` |
| `TeamList.tsx` | `` `/manage/sections/${sectionId}/teams/${team.id}` `` | `` `/manage/sections/${sectionId}/teams/${team.id}/edit` `` |
| `PlayerList.tsx` | `` `/manage/players/${player.id}` `` | `` `/manage/players/${player.id}/edit` `` |
| `LeagueList.tsx` | `` `/manage/fixtures/leagues/${league.id}` `` | `` `/manage/fixtures/leagues/${league.id}/edit` `` |
| `SeasonList.tsx` | `` `/manage/fixtures/seasons/${season.id}` `` | `` `/manage/fixtures/seasons/${season.id}/edit` `` |

- `MatchList.test.tsx`'s own precedent test (`'renders View and Edit together on a card, both pointing at the match's own routes'`, lines ~131-140) is the exact query shape to mirror: `screen.getByRole('link', { name: 'View' })`/`'Edit'` + `toHaveAttribute('href', ...)`.
- None of the seven target test files currently assert on the View link at all — confirmed by grep. Each test file's `MemoryRouter`/`Routes` wrapper currently declares only its list route and a `.../new` route (`SponsorContactList.test.tsx` is the one partial exception — it already has a sibling `sponsors/:id/edit` route, but that's for the sponsor-level "Back to Sponsor" link, not the contact-level edit route this plan needs) — every wrapper needs a new sibling `.../edit` route added so the new Edit link's target actually resolves in-test.

## Files to touch, in order

### 1–7. Seven list page files (each edited, same one-line-ish shape)

`ClubContactList.tsx`, `SponsorList.tsx`, `SponsorContactList.tsx`, `TeamList.tsx`, `PlayerList.tsx`, `LeagueList.tsx`, `SeasonList.tsx`.

In each file's `RecordCard` call, add `editTo` immediately after the existing `viewTo` line, using that file's own value from the table above (string-template, matching the existing `viewTo` line's own interpolation style exactly — same `contact.id`/`sponsor.id`/`sponsorId`/`contact.id`/etc. variables already in scope). No other prop, import, or line changes in any of the seven files — `editLabel` stays at its default (`'Edit'`), matching the spec's own call (`MatchList.tsx` passes `editLabel="Edit"` explicitly but the spec confirms either is acceptable since the default is identical).

### 8–14. The same seven files' test files (each edited)

For each of `ClubContactList.test.tsx`, `SponsorList.test.tsx`, `SponsorContactList.test.tsx`, `TeamList.test.tsx`, `PlayerList.test.tsx`, `LeagueList.test.tsx`, `SeasonList.test.tsx`:
- Add a new sibling `<Route path=".../edit" element={<div>...</div>} />` to the existing `MemoryRouter`/`Routes` wrapper (same nesting level as the existing `.../new` route), using that file's own new `editTo` path segment from the table above.
- Add one new test mirroring `MatchList.test.tsx`'s precedent exactly: render the list with one fixture record, assert `screen.getByRole('link', { name: 'View' })` and `screen.getByRole('link', { name: 'Edit' })` both resolve, each `toHaveAttribute('href', <that file's own View/Edit path for the fixture's id>)`.

## Agent assignment

Frontend-only, mechanical, no shared component/route/backend changes (spec's Data Model / API Contract both "None").

1. **`frontend-builder`** — items 1–7 (the seven `editTo` additions). Brief it explicitly: this is a pure prop addition, one line per file, using the exact `viewTo`-adjacent value already given per-file in the plan's table — not a place to restructure any card, and `RecordCard`/`MatchList.tsx`/`MatchFormPage.tsx` are not touched at all.
2. **`test-writer`** (after `frontend-builder`) — items 8–14. Brief it to read `MatchList.test.tsx`'s existing View+Edit test first and mirror its exact assertion shape onto each of the seven files' own existing fixture-building helpers (`makeContact`, etc.) and `renderList`-style wrappers, adding the one new sibling `.../edit` route each wrapper needs.

## Flags for your review

None substantive — same low-risk, high-precedent shape as `047`. One thing worth restating: per the spec's own Non-goals, no cross-linked `RecordCard` inside any `*DetailPage` (e.g. `TeamDetailPage`'s Contacts/Sponsors/Squad cards) is touched — those stay `viewTo`-only. Only the seven top-level list screens named by the user change.

## Verification

- `cd ui && npm run build && npm run lint && npm run test`.
- Manual smoke test on each of the seven list screens (`/manage/club-contacts`, `/manage/sponsors`, `/manage/sponsors/:id/contacts`, `/manage/sections/:sectionId/teams`, `/manage/players`, `/manage/fixtures/leagues`, `/manage/fixtures/seasons`) at 375px and desktop: every card shows View and Edit side by side, Edit navigates straight to that record's existing edit form, View is unchanged.
