# 038 — Move Deactivate/Reactivate to the Edit Screen

**Depends on:** `008-product-catalog.md` (`RecordCard`/`RecordFormScreen`, the `ListToolbar`/`RecordCard`/`RecordFormScreen` pattern this spec relocates one action within, unchanged as a pattern; `ProductFormPage.tsx`'s inline `confirmingRetire` state — the one existing precedent this spec's Non-goals evaluates and deliberately does not reuse), `036-view-first-record-detail-screens.md` (made "View" the card's primary footer action for these same eight entities and moved "Edit" off the list card entirely onto the new view screen — this spec continues that same view/edit separation one step further by moving the one remaining mutating action off the list card too; the permission-gating this spec's Problem statement explicitly does NOT claim to be is `036`'s own still-open Non-goal, restated here rather than re-argued), `021-club-contacts.md`/`023-sponsors.md`/`024-sponsor-contacts.md` (`ClubContact`/`Sponsor`/`SponsorContact`'s existing deactivate/reactivate endpoints, unchanged), `025-club-structure.md`/`026-teams.md` (`Team`'s existing deactivate/reactivate endpoint and its two List call sites, `TeamDirectory.tsx`/`TeamList.tsx`, both unchanged), `028-players.md` (`Player`'s existing deactivate/reactivate endpoint, unchanged), `029-league-management.md` (`League`/`Season`/`Match`'s existing deactivate/reactivate endpoints, unchanged), `030-team-sheet-communication.md`/`037-match-improvements.md` (`MatchList`'s `RecordCard.secondaryActions` array — "Communicate Team Sheet" and "Select Team" — which this spec explicitly leaves in place on the card, the one entity where the card keeps non-Deactivate actions), `001-tenancy-identity-model.md`/`015-person-status-and-role-assignment.md` (`RoleAssignmentRole` enum — `CLUB_ADMIN`, `MANAGER`, `PLAYER` — and `AccessService.canAdministerClub`, cited in Problem & Goals to ground this as an information-architecture fix, not a permissions fix).
**Status:** draft.

## Problem & Goals

Every "disable, never delete" entity in `/manage` — League, Season, Team, Match, Player, ClubContact, Sponsor, SponsorContact — exposes its Deactivate/Reactivate toggle as a `RecordCard.secondaryAction` directly on that entity's own list screen, confirmed by reading all eight List files (`ClubContactList.tsx`, `LeagueList.tsx`, `MatchList.tsx`, `PlayerList.tsx`, `SeasonList.tsx`, `SponsorContactList.tsx`, `SponsorList.tsx`, `TeamDirectory.tsx`/`TeamList.tsx`). `036` already made "View" — a read-only entry point — the card's primary action for every one of these same eight entities, on the reasoning that a passive browse surface shouldn't double as a mutation surface. Deactivate/Reactivate sitting one click away in that same card's footer, with no extra navigation and (confirmed by reading `MatchList.tsx`'s `deactivate`/`reactivate` mutations, representative of all eight) no confirmation step of any kind, blurs the exact view/edit line `036` drew.

**This is an information-architecture fix, not a permissions fix, and the spec is deliberately honest about that distinction.** `001`/`015`'s `RoleAssignmentRole` enum has exactly three values — `CLUB_ADMIN`, `MANAGER`, `PLAYER` — and no distinct "view-only" role exists anywhere in this codebase today; every backend endpoint these list/toggle actions hit is gated by `@access.canAdministerClub`, the same administrative-scope check for every `/manage` list and mutation alike (confirmed against `021`/`023`/`024`/`026`/`028`/`029`'s own API Contract tables). Nobody who can reach one of these lists today is prevented from deactivating a record by anything this spec builds — moving the button doesn't close an access gap, because there isn't a narrower-access caller to close it against yet (that's `036`'s own still-open Non-goal, unresolved here too). What this spec does fix is a passive browsing surface silently doubling as a one-click mutation surface, independent of who's looking at it.

**Goals**
- Deactivate/Reactivate for all eight entities moves from `RecordCard.secondaryAction` on the list card into that entity's own edit screen (`*FormPage.tsx`, built on `RecordFormScreen`) as a button in the screen's actions bar — the exact "Retire-style button" `RecordFormScreen`'s own doc comment already anticipates.
- Every list card keeps its "Inactive" muted badge exactly as-is — informational display stays on the browse surface; only the mutating control moves.
- Match's list card keeps its other two `secondaryActions` ("Select Team," "Communicate Team Sheet," `037`) exactly where they are — this spec touches only the Deactivate/Reactivate action.
- A new small shared component carries the Deactivate/Reactivate control itself, since all eight call sites render byte-for-byte identical label/icon/pending text today — one shape, not eight near-copies pasted into eight `*FormPage.tsx` files.
- For the four entities whose edit screen is a tabbed `RecordFormScreen` (League, Team, Player, Match), the Deactivate/Reactivate button renders regardless of which tab is active — deactivation is a property of the whole record, not of whichever tab happens to be open.

## Non-goals

- **A new confirmation-dialog component.** Today, Deactivate/Reactivate is a single click with zero confirmation anywhere (confirmed directly: `ClubContactList.tsx`/`LeagueList.tsx`/`MatchList.tsx`/etc.'s `deactivate`/`reactivate` `useMutation` calls fire on `onClick` with no intermediate state). The only existing confirmation pattern in this codebase for a status-mutating action is `ProductFormPage.tsx`'s inline `confirmingRetire` state (`008`) — and that pattern exists specifically because `Product.RETIRED` is a **one-way** transition (`008`'s own validation rules: "a `RETIRED` product cannot transition back to `DRAFT`/`ACTIVE` in this spec"). Deactivate/Reactivate on every one of these eight entities is a **reversible toggle** — the opposite action is one click away on the same screen, today and after this spec. Given that, and given that relocating the button from a zero-friction list card into a deliberate edit-screen context is itself real, added friction over today's behaviour, this spec does not add a confirm step of any kind — no new `Dialog`, no inline confirm state mirroring `ProductFormPage`'s. If real usage later shows this is still too easy to click by accident, that's a separate, narrower follow-up, not bundled here.
- **Permission-based gating of who sees the Deactivate/Reactivate button.** Exactly as `036` left this open, this spec leaves it open — see Problem & Goals. Anyone who can reach `/manage` today sees exactly the same action they see today, just relocated.
- **Any change to which eight entities have Deactivate/Reactivate**, or to the deactivate/reactivate business rules themselves (an already-`RETIRED`-equivalent inactive record can still be reactivated, unchanged; no entity gains or loses this lifecycle).
- **Any backend change.** Every deactivate/reactivate endpoint used here already exists (`021`/`023`/`024`/`026`/`028`/`029`) and is called exactly as it is today — only which frontend screen calls it changes.
- **Match's other `RecordCard.secondaryActions`** ("Select Team," "Communicate Team Sheet") or `SquadPicker.tsx`'s own reuse of `MatchList` — both untouched; `SquadPicker` inherits this spec's change automatically since it renders `MatchList` unmodified.
- **Any cross-linked/nested card's own secondary action** — `LeagueFormPage.tsx`'s `AffiliatedTeamCard` ("Unaffiliate"), `TeamFormPage.tsx`'s `TeamContactCard`/`TeamSponsorCard` ("Unlink") and `SquadPlayerCard` ("Remove") are a different action on a different relationship (link/unlink, not deactivate/reactivate the linked record itself) and are unmodified.
- **Adding a "Cancel" button to any `*FormPage.tsx` that doesn't already have one.** None of the eight (`ClubContactFormPage`/`LeagueFormPage`/`SeasonFormPage`/`SponsorFormPage`/`SponsorContactFormPage`/`TeamFormPage`/`PlayerFormPage`/`MatchFormPage`) render a Cancel action today — only `ProductFormPage.tsx` does. Out of scope; this spec only adds Deactivate/Reactivate to the existing actions bar.
- **`docs/standards/design-system.md`'s own text.** This spec changes an established, documented convention (see Rollout Notes for exactly what needs to change there) but does not edit that file itself — a human applies that follow-up.

## User Stories

- As a club admin browsing any of League, Season, Team, Match, Player, Club Contact, Sponsor, or Sponsor Contact's list, I see each record's card as a read-only summary (title, badge — including "Inactive" for a deactivated record — key fields) with no mutating action beyond navigating into it; deactivating or reactivating a record means opening it and using the action there, not a stray button next to search results.
- As a club admin editing any of these eight records, I see a Deactivate button (or Reactivate, if the record is already inactive) in the edit screen's actions bar, alongside Save — clicking it toggles the record's status immediately and the button relabels to reflect the new state.
- As a club admin editing a Match, League, Team, or Player — the four entities whose edit screen is tabbed — I see the same Deactivate/Reactivate button in the actions bar no matter which tab I'm currently on (Details, Home XI, Contacts, Sections, etc.), since I shouldn't have to click back to a specific tab just to deactivate the record.
- As a club admin browsing Matches, I still see "Select Team" and "Communicate Team Sheet" directly on each match's card, exactly as before — only that same card's Deactivate/Reactivate button is gone, moved into the match's own edit screen alongside the other seven entities.

## Data Model Changes

None. No entity, field, or migration changes — every deactivate/reactivate endpoint already exists (`021`/`023`/`024`/`026`/`028`/`029`) and is called exactly as it is today; only the frontend screen that calls it changes.

## API Contract

None. This is purely a frontend relocation of an existing control — no new endpoint, no changed request/response shape, no changed `@PreAuthorize` expression on any of the eight existing deactivate/reactivate endpoints below (listed for reference, all unchanged):

| Endpoint pattern | Entities |
|---|---|
| `POST .../{id}/deactivate`, `POST .../{id}/reactivate` | `ClubContact` (`021`), `Sponsor` (`023`), `SponsorContact` (`024`), `Team` (`026`), `Player` (`028`), `League`/`Season`/`Match` (`029`) |

## UI Requirements

**One new shared component: `ui/src/components/RecordStatusToggle/`** (four-file anatomy per `docs/standards/frontend.md`). Extracted because all eight existing call sites render byte-for-byte identical strings and icons today (`ToggleOffOutlinedIcon`/`ToggleOnOutlinedIcon`, "Deactivate"/"Reactivate", "Deactivating…"/"Reactivating…") — `docs/standards/frontend.md`'s reuse rule treats this degree of duplication as an immediate extraction, not a follow-up. No Claude Design pass needed: it reuses the shared `Button` component and icon convention exactly as already established (`ProductFormPage.tsx`'s `variant="danger"` for a status-downgrading action, `ToggleOffOutlinedIcon`/`ToggleOnOutlinedIcon` per `docs/standards/design-system.md`'s existing icon table), not a new visual pattern.

```ts
export interface RecordStatusToggleProps {
  active: boolean       // the record's current .active value
  pending: boolean       // the in-flight deactivate/reactivate mutation's isPending
  onClick: () => void
}
```

Renders one `Button`: when `active`, `variant="danger"`, `startIcon={<ToggleOffOutlinedIcon fontSize="small" />}`, label `"Deactivate"` (`"Deactivating…"` + `disabled` while `pending`); when `!active`, `variant="secondary"`, `startIcon={<ToggleOnOutlinedIcon fontSize="small" />}`, label `"Reactivate"` (`"Reactivating…"` + `disabled` while `pending`) — the exact same four strings every one of the eight `RecordCard.secondaryAction` objects passes today, now defined once.

**Every one of the eight List files loses its card's `secondaryAction` — nothing else on that card changes.** `badgeFor()` (or its inline equivalent) keeps rendering the "Inactive" muted badge exactly as today; only the `secondaryAction={{ label: contact.active ? 'Deactivate' : ... }}` block is deleted from each `*Card` function. The `deactivate`/`reactivate` `useMutation` calls and their `toggle` variable move to the corresponding `*FormPage.tsx` (see below) rather than staying in the List file — nothing left in the List's own card needs them once the button is gone.

| Entity | List file(s), card loses `secondaryAction` only | Edit `*FormPage.tsx` gains `RecordStatusToggle` | Tab-gating of the edit screen's `actions` prop | Query key(s) invalidated by the new toggle mutation |
|---|---|---|---|---|
| Club Contact | `ClubContactList.tsx` (`ClubContactCard`) | `ClubContactFormPage.tsx` | None — single always-rendered `actions` bar | `['managed-club', clubId, 'contacts']` |
| Sponsor | `SponsorList.tsx` (`SponsorCard`) | `SponsorFormPage.tsx` | None | `['managed-club', clubId, 'sponsors']` |
| Sponsor Contact | `SponsorContactList.tsx` (`SponsorContactCard`) | `SponsorContactFormPage.tsx` | None | `['managed-club', clubId, 'sponsors', sponsorId, 'contacts']` |
| Season | `SeasonList.tsx` (`SeasonCard`) | `SeasonFormPage.tsx` | None | `['managed-club', clubId, 'seasons']` |
| League | `LeagueList.tsx` (`LeagueCard`) | `LeagueFormPage.tsx` | **Restructured — see below.** Save is gated `activeTab === 0` (Details/Affiliations); the toggle must render on both tabs. | `['managed-club', clubId, 'leagues']` |
| Team | `TeamDirectory.tsx` **and** `TeamList.tsx` (both `TeamCard`s) | `TeamFormPage.tsx` | **Restructured — see below.** Save is gated `activeTab === 0` (Details/Contacts/Sponsors/Squad); the toggle must render on every tab. | Both `['managed-club', clubId, 'teams']` and `['managed-club', clubId, 'sections', sectionId, 'teams']` — matching `TeamCard`'s own existing dual invalidation today |
| Player | `PlayerList.tsx` (`PlayerCard`) | `PlayerFormPage.tsx` | **Restructured — see below.** Save is gated `activeTab !== 3` (visible on Basic/Contact/Cricket Info, hidden on Sections); the toggle must render on all four tabs, including Sections. | `['managed-club', clubId, 'players']` |
| Match | `MatchList.tsx` (`MatchCard`) — loses only `secondaryAction`; `secondaryActions` ("Select Team," "Communicate Team Sheet") is unchanged | `MatchFormPage.tsx` | **Restructured — see below.** Save is gated `activeTab === 0` (Details/Home XI/Away XI/Availability); the toggle must render on every tab. | `['managed-club', clubId, 'matches']` — the base key; React Query's default partial-key invalidation covers both `MatchList`'s paginated query and `MatchFormPage`'s own `['managed-club', clubId, 'matches', matchId]` single-record query with one call, matching `MatchFormPage`'s existing `saveMutation.onSuccess` precedent exactly |

Every `*FormPage.tsx` renders `RecordStatusToggle` only in edit mode (`isEdit && <entity>`, the same guard already used for e.g. `SponsorContactFormPage`'s own edit-only affordances) — a brand-new, not-yet-saved record has no status to toggle. The toggle mutation itself is a plain `useMutation` in the `*FormPage` component, structurally identical to the one being removed from each `*Card` (same `deactivate`/`reactivate` API calls, same `toggle = <entity>.active ? deactivate : reactivate` selection) — this is a relocation of existing code, not new mutation logic.

**Tab-gated `actions` restructuring — the exact contract, for all four tabbed edit screens (League, Team, Player, Match), not Match alone.** Investigation against the real code found this problem is broader than a single screen: `LeagueFormPage.tsx`, `TeamFormPage.tsx`, and `MatchFormPage.tsx` all gate their `actions` prop to `activeTab === 0 ? (<Save-and-error Stack>) : null`; `PlayerFormPage.tsx` gates on `activeTab !== 3`. In every one of the four, `RecordFormScreen`'s `actions` prop is currently an all-or-nothing `ReactNode` — either the full Save/error `Stack`, or `null` — so naively appending `RecordStatusToggle` inside that same conditional would make it disappear on every tab except the gated one(s), exactly the opposite of what "deactivation is a property of the whole record" requires. The fix, identical in shape across all four: split the two elements at the top of `actions`'s expression instead of gating the whole `Stack`, e.g. (League/Team/Match's `activeTab === 0` case):

```tsx
actions={
  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
    {activeTab === 0 && (
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

`PlayerFormPage.tsx`'s equivalent swaps the `activeTab === 0` condition for `activeTab !== 3`; `MatchFormPage.tsx`'s is otherwise identical to League/Team's. The outer `Stack` itself is now always rendered (never `null`), with its two children each independently conditional — Save/error only on the record's "main" tab(s), the status toggle unconditionally. This is a deliberate, explicit divergence from how the investigation was originally framed (as a Match-only problem) — League's and Team's edit screens have the identical `activeTab === 0`-gated shape as Match's, and Player's has the analogous `activeTab !== 3` variant; treating only `MatchFormPage.tsx` would have shipped the exact same bug on three other screens.

**Mobile-first**, per `docs/standards/frontend.md`: `RecordStatusToggle` is a single `Button`, already mobile-safe at 375px via the existing `Button`/`RecordFormScreen` actions-bar `flexWrap`; no new layout work needed.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `RecordStatusToggle.test.tsx` (new, + Storybook story): renders "Deactivate" + `ToggleOffOutlinedIcon` when `active`, calls `onClick` on click; renders "Reactivate" + `ToggleOnOutlinedIcon` when `!active`; shows the pending label and disables the button while `pending`. |
| Component | Each of the eight existing `*List.test.tsx` files extended: asserts the rendered card's footer no longer contains a "Deactivate"/"Reactivate" button; `MatchList.test.tsx` additionally asserts "Select Team" and "Communicate Team Sheet" still render on the card, unaffected. |
| Component | Each of the eight existing `*FormPage.test.tsx` files extended: in edit mode, the actions bar renders "Deactivate" for an active fixture record (or "Reactivate" for an inactive one), clicking it calls the corresponding deactivate/reactivate API function and, on success, invalidates the query key(s) from the table above; the button is absent when rendering the page in create mode (no `:id`/`:playerId`/etc. param). `LeagueFormPage.test.tsx`/`TeamFormPage.test.tsx`/`PlayerFormPage.test.tsx`/`MatchFormPage.test.tsx` additionally assert the button still renders when a non-Details/non-tab-0 tab is active (e.g. League's Affiliations tab, Player's Sections tab, Match's Home XI tab), while Save itself keeps its existing tab-gated visibility unchanged. |
| End-to-end | Extends one existing `/manage` Playwright golden path (e.g. `028`'s Player flow): from `PlayerList`, click a player card, land on `PlayerDetailPage` (`036`), click Edit, land on `PlayerFormPage`, click Deactivate in the actions bar, confirm the button relabels to "Reactivate," navigate back to `PlayerList` and confirm the card now shows the "Inactive" badge and no longer carries any Deactivate/Reactivate control itself. Not wired into CI, matching every prior `/manage` spec's stated precedent. |

## Acceptance Criteria

- No `RecordCard` footer for League, Season, Team, Match, Player, Club Contact, Sponsor, or Sponsor Contact renders a Deactivate/Reactivate action anywhere in `/manage` — the "Inactive" muted badge still renders on every such card exactly as before.
- Every one of these eight entities' edit `*FormPage.tsx` renders a Deactivate (if the record is currently active) or Reactivate (if currently inactive) button in its actions bar, in edit mode only — never on the corresponding "new"/create form.
- For League, Team, Player, and Match — the four tabbed edit screens — the Deactivate/Reactivate button renders identically no matter which tab is currently active; each screen's own existing Save-button tab-gating is otherwise unchanged.
- Match's `RecordCard` still renders "Select Team" and "Communicate Team Sheet" exactly as before `037` — only that same card's Deactivate/Reactivate action is gone.
- Clicking Deactivate or Reactivate from an edit screen updates the same underlying record that entity's list screen reads from — navigating back to the list immediately shows the new Active/Inactive badge state without a manual page refresh.
- No backend endpoint, DTO, or database migration changes anywhere in this spec.

## Rollout Notes

- Ships as one PR across all eight entities' List + FormPage pairs, plus the new `RecordStatusToggle` shared component — the same "ship together, not staggered" reasoning `036`'s own Rollout Notes gives: a half-migrated state (some cards still carrying the toggle, others not) would read as an inconsistent product, not a deliberate phase.
- **A human should update `docs/standards/design-system.md`'s "Record list / create-edit pattern" section once this ships.** Its `RecordCard` row currently documents the card's footer as carrying "Edit/secondary actions" and specifically calls out "`ToggleOff`/`ToggleOn` for deactivate/reactivate" as an established example of a footer action — that line needs to be corrected to describe Deactivate/Reactivate as living on the edit screen's actions bar (via the new `RecordStatusToggle`) instead, not the card footer. The general "footer/secondary actions render a leading icon" framing itself stays accurate for whatever *does* remain on a card footer (e.g. Match's "Select Team"/"Communicate Team Sheet," or Unlink/Unaffiliate/Remove on nested cards) — only the Deactivate/Reactivate-specific example sentence is now wrong.
- **A human should also update `docs/roadmap.md`** to note this spec resolved the "mutating action on a passive browse surface" concern flagged in conversation during `036`'s own rollout, and that `036`'s still-open permission-gating item is unaffected/unresolved by this spec.
- **Judgment call, flagged for reviewer sign-off:** the task that produced this spec framed the tab-gating problem as `MatchFormPage.tsx`-only ("the one FormPage where naive treatment breaks"). Direct inspection of the other three tabbed edit screens found the identical `activeTab === 0`-gated `actions` shape on `LeagueFormPage.tsx` and `TeamFormPage.tsx`, and the analogous `activeTab !== 3` variant on `PlayerFormPage.tsx` — so this spec's UI Requirements restructures all four, not one, to avoid shipping the same bug on three screens a narrower reading would have missed.
- **Judgment call, flagged for reviewer sign-off:** extracting `RecordStatusToggle` as a new shared component (rather than inlining the same `Button` in all eight `*FormPage.tsx` files) was not explicitly requested by the originating task — it follows from `docs/standards/frontend.md`'s own duplication-extraction rule given all eight call sites are identical today. Flagged in case a reviewer would rather see this inlined per FormPage for this pass and extracted only if a ninth call site ever appears.
- **Judgment call, flagged for reviewer sign-off:** no confirmation dialog is added (see Non-goals) — reversible-toggle friction is judged sufficient given the relocation itself, unlike `ProductFormPage.tsx`'s one-way Retire. Revisit only if real usage shows accidental deactivation is still a recurring problem after this ships.
