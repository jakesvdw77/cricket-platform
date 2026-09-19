# Implementation Plan — 038: Move Deactivate/Reactivate to the Edit Screen

## Context

`docs/specs/038-move-deactivate-to-edit-screen.md` (status: draft) relocates the Deactivate/
Reactivate toggle for all eight "disable, never delete" entities — League, Season, Team, Match,
Player, Club Contact, Sponsor, Sponsor Contact — off each entity's list `RecordCard` (a passive
browse surface, since `036-view-first-record-detail-screens.md` made "View" the card's primary
action) and into that entity's own edit `*FormPage.tsx` (built on `RecordFormScreen`) as a button
in the actions bar. `RecordFormScreen.tsx`'s own doc comment already anticipates a "Retire-style"
button there — this completes an already-anticipated pattern. Pure frontend relocation: no backend
change, no new/changed endpoint (every deactivate/reactivate endpoint already exists), no DTO
change.

Verified directly against the current code for every one of the 8 entities before writing this
plan (not just the spec's own claims):
- **All 8 List cards are byte-for-byte the same shape today**: `ClubContactList.tsx`
  (`ClubContactCard`), `LeagueList.tsx` (`LeagueCard`), `SeasonList.tsx` (`SeasonCard`),
  `SponsorList.tsx` (`SponsorCard`), `SponsorContactList.tsx` (`SponsorContactCard`),
  `PlayerList.tsx` (`PlayerCard`), `TeamDirectory.tsx`/`TeamList.tsx` (`TeamCard` ×2 call sites) —
  each has its own `deactivate`/`reactivate` `useMutation`, a `toggle = entity.active ? deactivate
  : reactivate`, and a `RecordCard.secondaryAction` object with the identical four strings
  ("Deactivate"/"Reactivate"/"Deactivating…"/"Reactivating…") and `ToggleOffOutlinedIcon`/
  `ToggleOnOutlinedIcon`. `MatchList.tsx`'s `MatchCard` is the one exception: it has this same
  `secondaryAction`, PLUS a separate `secondaryActions` array ("Select Team," "Communicate Team
  Sheet," `037`) that must NOT move.
- **`Team` has two distinct list call sites with two distinct invalidation shapes**:
  `TeamDirectory.tsx` invalidates both `CLUB_TEAMS_QUERY_KEY(clubId)` and `['managed-club', clubId,
  'sections', team.sectionId, 'teams']`; `TeamList.tsx` invalidates only `TEAMS_QUERY_KEY(clubId,
  sectionId)`. `TeamFormPage.tsx` (the single edit screen both lists route into) must invalidate
  all the keys either list depends on, since the admin may have arrived from either one.
- **All 8 edit `*FormPage.tsx` files fetch their record via a list+`find` `useQuery` `select`**
  (no single-record GET endpoint exists for any of these 8 entities) — confirmed variable names:
  `league`, `team`, `player`, `season`, `sponsor`, `contact` (Club/Sponsor Contact) — every one
  already carries `.active` once loaded, and `isEdit && <entity>` is the existing guard pattern
  (matches `SponsorContactFormPage.tsx`'s existing edit-only-affordance convention).
- **Tab-gating confirmed broader than Match alone**, exactly as the spec found: `LeagueFormPage.tsx`
  and `TeamFormPage.tsx` both gate their entire `actions` prop with `activeTab === 0 ? (<Stack>) :
  null`; `PlayerFormPage.tsx` gates with `activeTab !== 3`; `MatchFormPage.tsx` gates with
  `activeTab === 0`, same shape as League/Team. `ClubContactFormPage.tsx`, `SponsorFormPage.tsx`,
  `SponsorContactFormPage.tsx`, `SeasonFormPage.tsx` all render a single, always-visible `actions`
  `Stack` (no tabs at all) — read `SeasonFormPage.tsx` in full as the reference shape for these four.
- **`Button`'s `danger` variant already exists** (`ui/src/components/Button/Button.tsx`:
  `danger: { variant: 'contained', color: 'error' }`) — the spec's proposed `RecordStatusToggle`
  reuses it for the "Deactivate" state, no new variant needed.
- **No confirmation-dialog precedent applies here** — the only existing one, `ProductFormPage.tsx`'s
  inline `confirmingRetire` state, exists specifically because `Product.RETIRED` is a one-way
  transition; Deactivate/Reactivate on all 8 entities here is reversible. Per the spec's Non-goals,
  no confirm dialog is added.

## Approach

One slice — `frontend-builder` only (no backend change, no migration).

### 1. New shared component: `ui/src/components/RecordStatusToggle/`

Four-file anatomy (`RecordStatusToggle.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`), matching
`ui/src/components/ListToolbar/`'s file shape as the template to follow.

```ts
export interface RecordStatusToggleProps {
  active: boolean
  pending: boolean
  onClick: () => void
}
```

Renders one `Button` (from `ui/src/components/Button`): `active` → `variant="danger"`,
`startIcon={<ToggleOffOutlinedIcon fontSize="small" />}`, label `pending ? 'Deactivating…' :
'Deactivate'`, `disabled={pending}`; `!active` → `variant="secondary"`, `startIcon={<ToggleOnOutlinedIcon
fontSize="small" />}`, label `pending ? 'Reactivating…' : 'Reactivate'`, `disabled={pending}` — the
exact four strings every one of the 8 existing `secondaryAction` objects already uses, defined once.

### 2. Strip `secondaryAction` from all 8 List cards (9 call sites — Team has 2)

For each of `ClubContactList.tsx`, `LeagueList.tsx`, `SeasonList.tsx`, `SponsorList.tsx`,
`SponsorContactList.tsx`, `PlayerList.tsx`, `TeamDirectory.tsx`, `TeamList.tsx`:
- Delete the `secondaryAction={{ ... }}` block from the `RecordCard` in that file's `*Card`
  function.
- Delete the now-unused `deactivate`/`reactivate` `useMutation`s, the `toggle` variable, the
  `invalidate` helper (if nothing else in that card uses it), and the now-unused
  `ToggleOffOutlinedIcon`/`ToggleOnOutlinedIcon` imports and `deactivate<Entity>`/`reactivate<Entity>`
  API imports — this logic relocates to the corresponding `*FormPage.tsx`, it isn't duplicated.
- `badgeFor()` (or its inline equivalent) and everything else on the card is unchanged — the
  "Inactive" muted badge stays exactly as today.
- `MatchList.tsx`'s `MatchCard`: same removal of `secondaryAction` only — its `secondaryActions`
  array ("Select Team," "Communicate Team Sheet") is untouched.

### 3. Add `RecordStatusToggle` to all 8 edit `*FormPage.tsx` files' actions bar

For the four non-tabbed FormPages (`ClubContactFormPage.tsx`, `SponsorFormPage.tsx`,
`SponsorContactFormPage.tsx`, `SeasonFormPage.tsx`) — simple case, follow `SeasonFormPage.tsx`'s
exact current shape:
- Add the relocated `deactivate`/`reactivate` `useMutation`s (moved verbatim from the List file
  removed in step 2, same mutation fn/`onSuccess` invalidation) and a `toggle` variable.
- Add `{isEdit && <entity> && (<RecordStatusToggle active={<entity>.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />)}` inside the existing `actions`
  `Stack`, alongside the Save button — the `Stack` itself doesn't need restructuring since it's
  already always-rendered (no tab-gating) for these four.

For the four tabbed FormPages (`LeagueFormPage.tsx`, `TeamFormPage.tsx`, `PlayerFormPage.tsx`,
`MatchFormPage.tsx`) — the `actions` prop currently gates its ENTIRE contents (`activeTab === 0 ?
(<Stack>...) : null`, or `activeTab !== 3` for Player), which would make `RecordStatusToggle`
vanish on every non-Details tab if simply added inside that same conditional. Fix (identical shape
across all four, per the spec's UI Requirements): restructure so the outer `Stack` always renders,
with Save/error conditional inside it and the status toggle unconditional:

```tsx
actions={
  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
    {activeTab === 0 && (   // or `activeTab !== 3` for PlayerFormPage
      <>
        {saveMutation.isError && <Typography variant="body2" color="error.main">…</Typography>}
        <Button type="submit" form={LEAGUE_FORM_ID} disabled={saveMutation.isPending}>…</Button>
      </>
    )}
    {isEdit && league && (
      <RecordStatusToggle active={league.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
    )}
  </Stack>
}
```

Apply the same restructuring to `TeamFormPage.tsx` (`activeTab === 0`), `PlayerFormPage.tsx`
(`activeTab !== 3`), and `MatchFormPage.tsx` (`activeTab === 0`) — each gets its own relocated
`deactivate`/`reactivate` mutations and `toggle` variable, matching the query-key invalidation
table below.

**Query keys invalidated by each relocated toggle mutation** (moved verbatim from the List file
being stripped, or — for `TeamFormPage.tsx` — combining both `TeamDirectory`'s and `TeamList`'s
keys since the admin may arrive from either):

| Entity | FormPage | Query key(s) invalidated |
|---|---|---|
| Club Contact | `ClubContactFormPage.tsx` | `['managed-club', clubId, 'contacts']` |
| Sponsor | `SponsorFormPage.tsx` | `['managed-club', clubId, 'sponsors']` |
| Sponsor Contact | `SponsorContactFormPage.tsx` | `['managed-club', clubId, 'sponsors', sponsorId, 'contacts']` |
| Season | `SeasonFormPage.tsx` | `['managed-club', clubId, 'seasons']` |
| League | `LeagueFormPage.tsx` | `['managed-club', clubId, 'leagues']` |
| Team | `TeamFormPage.tsx` | Both `CLUB_TEAMS_QUERY_KEY(clubId)` and `['managed-club', clubId, 'sections', team.sectionId, 'teams']` (union of `TeamDirectory`'s and `TeamList`'s own keys) |
| Player | `PlayerFormPage.tsx` | `['managed-club', clubId, 'players']` (prefix-matches `PlayerList`'s own `[..., 'players', sectionId]` via React Query's default fuzzy key matching) |
| Match | `MatchFormPage.tsx` | `['managed-club', clubId, 'matches']` (prefix-matches both `MatchList`'s paginated query and this same page's own single-record query, matching `saveMutation`'s existing invalidation precedent already in this file) |

### 4. Files touched

New: `ui/src/components/RecordStatusToggle/{RecordStatusToggle.tsx,RecordStatusToggle.test.tsx,RecordStatusToggle.stories.tsx,index.ts}`

Modified (List — remove `secondaryAction` + now-unused mutation/imports):
`ui/src/pages/manage/{ClubContactList,LeagueList,SeasonList,SponsorList,SponsorContactList,PlayerList,TeamDirectory,TeamList,MatchList}.tsx`

Modified (FormPage — add relocated mutation + `RecordStatusToggle`, restructure `actions` for the
4 tabbed ones): `ui/src/pages/manage/{ClubContactFormPage,SponsorFormPage,SponsorContactFormPage,SeasonFormPage,LeagueFormPage,TeamFormPage,PlayerFormPage,MatchFormPage}.tsx`

### 5. Tests — same `frontend-builder` pass, per `docs/standards/testing.md`'s "new/changed shared component → component test + story, same PR"

- `RecordStatusToggle.test.tsx` (new): renders "Deactivate"/icon when `active`, calls `onClick`;
  renders "Reactivate"/icon when `!active`; shows pending label and `disabled` while `pending`.
- Each of the 9 `*List.test.tsx` files (`ClubContactList`, `LeagueList`, `SeasonList`, `SponsorList`,
  `SponsorContactList`, `PlayerList`, `TeamDirectory`, `TeamList`, `MatchList`): update/remove any
  existing assertion that a Deactivate/Reactivate button renders on the card; add an assertion it
  no longer does. `MatchList.test.tsx` additionally asserts "Select Team"/"Communicate Team Sheet"
  still render, unaffected.
- Each of the 8 `*FormPage.test.tsx` files: in edit mode, assert the actions bar renders
  "Deactivate" (active record) or "Reactivate" (inactive record), clicking it calls the right
  API function and invalidates the right query key(s); assert the button is absent in create mode.
  For the 4 tabbed pages, additionally assert the button still renders on a non-Details/non-tab-0
  tab (League's Affiliations tab, Team's Contacts/Sponsors/Squad tabs, Player's Sections tab,
  Match's Home XI tab) while Save's own existing tab-gated visibility is unchanged.
- Run `cd ui && npm run test`, `npm run build`, `npm run lint` and confirm all green before
  finishing.

## Verification

- `cd ui && npm run test` (Vitest, all `*List`/`*FormPage`/`RecordStatusToggle` suites),
  `npm run build`, `npm run lint`.
- Manual/visual: for at least 2-3 of the 8 entities (recommend one non-tabbed — e.g. Sponsor — and
  the two trickiest tabbed ones, League and Match), open the list, confirm no Deactivate/Reactivate
  button on any card but the "Inactive" badge still shows for an inactive record; open Edit, confirm
  the Deactivate/Reactivate button renders in the actions bar and toggles correctly; for League/
  Team/Player/Match specifically, switch to a non-Details tab and confirm the button is still there.
- Run the `review` skill (standards-compliance pass) before opening the PR, per `docs/workflow.md` —
  pay particular attention to whether all 9 List call sites and all 8 FormPage call sites were
  actually touched (easy to miss one of nine near-identical files), and whether
  `docs/standards/design-system.md`'s "Record list / create-edit pattern" table still needs its
  own follow-up edit per the spec's Rollout Notes (out of scope for this implementation PR, flagged
  for a human, not silently done here).
