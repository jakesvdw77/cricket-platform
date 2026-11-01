# 134: Fields pages revamp (list, field page, field form, platform admin variants)

**Status:** approved 2026-11-01 (owner accepted all five proposed answers in Documentation gaps; recorded in page-anatomy section 6b). Build before 133.
**Depends on:** `099-fields-directory.md` (the Fields pages, verification, who may edit, merge, home link), `129`/`130` (the pattern), `126` (Manage menu), `127` (`returnTo`). Spec `133` (field location and directions) builds on this spec.

## Problem & Goals

The Fields pages predate the page standard (page-anatomy section 9: "Not reviewed, Field page has five tiles"). The list has a floating filter bar, a "Showing N fields" line, a switch and sort link outside the toolbar, raised cards with a three-button footer bar and a raised table. The field page uses `PageHeaderBand` with Back above Open in maps and a filled Edit, a 72 px icon-tile strip, and the admin page adds Status and Merge as separate buttons. The form says "Add field" and "Save changes" and goes only to the field's page.

Goals: the Fields list, field page and form follow section 6b exactly as Leagues, Seasons and Matches do, for the manager screens and their platform admin twins, with every action kept and reachable.

## Non-goals

- **No backend change, no migration, no endpoint change** (UI only). Location and directions are spec `133`.
- **No change to what actions do:** verify, reject, reopen, merge, add to or remove from our fields, edit rules (`fieldEditState`), the duplicate "Did you mean" panel and the confirm dialogs keep their behaviour and disabled reasons.
- **No change to filters' meaning, the "Show only our fields" default logic, quick filter, saved filters or paging.** Only layout moves.
- **No change to field form fields or validation** (`FieldFormFields`, `useFieldForm`), the "This is one of our fields" choice, or the saved payload.
- **No Share.** No share content exists for a field, so Share is omitted from every Manage menu (page-anatomy section 5); not invented here.
- **No Season pill:** fields are not season-scoped (page-anatomy section 8, open note).
- **No change to `PageCounters`, `ManageMenu`, `ToolbarCard`, `FilterBar`, `AddCard`, `RecordCard`, `FieldStatusMenu`, `FieldMergeDialog` internals;** no breadcrumbs.
- **No change to other pages that show a field** (match page Venue card, Player Hub field cards `HubFieldCard`, match form picker).

## User Stories

- As a club admin, I use the Fields list like the Leagues, Seasons and Matches lists, with one Actions button per field.
- As a club admin, on a field page I see Back alone, the title with its badges and ONE Manage Field menu with everything I can do.
- As a club admin, Back, Cancel and Save return me to where I opened the field from.
- As a platform admin, I verify, reject, merge and edit from one Manage Field menu on the field page and from one kebab on the list.

## Data Model Changes

None.

## API Contract

No new or changed endpoints; no `openapi.yaml` change.

## UI Requirements

### What differs today (current code)

| Area | Today | Standard |
|---|---|---|
| List header | `ManageScreenHeader` plus filled Add field (leading icon, sentence case) | Title Case "Add Field", no icon (page-anatomy 5), 16 px between bands (24 px gap goes) |
| Count text | `ContentControlsLine` "Showing N fields" | none (section 3) |
| Toolbar | Separate `FilterBar`, then a content line holding `SortLink`, Cards or List and "Show only our fields" switch; a "Quick filter" row and removable chip | One fused toolbar: search, Type, Country, Province, City, toggle chip, Sort, Cards or List last; Unverified remains the counter quick filter |
| Table and cards | Raised `FieldCard` with `cardGridSx`, three footer buttons, Link, Edit, View, Status; `FieldTable` with its own actions | Flat cards (`RecordCard`-style hairline), no footer bar, one kebab, `dynamicCardGridSx`, dashed Add Field card; flat table, zebra parity, no chevron |
| Empty states | Messages with advice text | No action buttons in the message; `BrandIcon` for fields |
| Field page header | `PageHeaderBand`, Back above the actions, 80 px avatar, Open in maps, Status and Merge buttons (admin), filled Edit disabled with a tooltip | Back alone; title row with badges, ONE filled Manage Field at `MANAGE_BUTTON_WIDTH` |
| Field page figures | `KeyFigureTile` strip of five or six tiles | Static compact `PageCounters`, no icons |
| Field page cards | `FieldNotice`, `FieldInfoCards` with a "Add to our fields" button in Details | Flat `InfoCard flat`; the unverified notice stays (it is a state message, not a layout card) |
| Form | "Add field", "Save changes", Cancel only, always returns to the field page | `RecordFormScreen compact`, Title Case, standard footer, `returnTo` |
| Return navigation | Links built with plain paths | `withReturnTo(..., currentOrigin(location), label)` |

### Fields list (`FieldsPage`, `FieldCard`, `FieldTable`; admin twin `AdminFieldsPage`)

- **Header:** page name "Fields" (admin: "Fields To Verify"), the one filled compact **Add Field** right-aligned (manager list only). No subtitle or count text.
- **Counters:** `PageCounters density="compact"` unchanged in meaning (Our Fields, In The Directory, Unverified as the quick filter; admin counters unchanged), labels Title Case.
- **Toolbar:** one `FilterBar` (`bare inCard viewControlsInline`): search, Type, Country, Province, City, then on the right the **Our Fields Only** toggle chip (manager list; replaces the switch and keeps the saved and auto default), **Sort** (`ToolbarSortButton`: "Name, A To Z", "Name, Z To A"), **Cards | List** last. List view: the toolbar is the top of the table card. Cards view: a standalone `ToolbarCard` above the grid and the empty message. The "Quick filter" row and chip go (the Unverified counter shows its selected ring; the toolbar's Clear All also clears it).
- **List view:** flat card, tinted header, first row white, second tinted, no chevron, kebab at the row's right end; whole row opens the field.
- **Cards view:** flat record cards with the hairline and hover lift, no footer bar (`footerActions={null}` equivalent), one kebab top right; the zebra detail rows (Owner, City, Country, Matches, Map or admin Captured, Clubs, Similar) stay as the card body; the Open in maps row stays as a link. `dynamicCardGridSx`; dashed **Add Field** card at the end (manager list).
- **Kebab** (`pages/manage/fields/FieldRowMenu.tsx`, after `LeagueRowMenu`; "Actions for {field name}", dense). Manager: **Open Field**, **Edit Field** (disabled with the reason from `fieldEditState` as one small line), **Open In Maps** (when a map link exists, new tab), **Add To Our Fields** or **Remove From Our Fields**. Admin (`/admin/fields`): **Open Field**, **Edit Field**, **Verify** or **Reject** or **Reopen** per `FIELD_STATUS_ACTIONS` (same confirm dialogs, disabled with `VERIFIED_FIELD_NO_ACTIONS` when none applies), **Merge Into...** is on the field page only (see below), **Open In Maps**. No Share (none exists).
- **Pagination** stays inside the content band.
- **Return navigation:** Add Field, row, card and every kebab destination carry `withReturnTo(..., currentOrigin(location), 'Fields')`.

### Field page (`FieldDetailPage`; admin twin `AdminFieldDetailPage`)

Skeleton, 16 px between bands (12 px phone); `PageHeaderBand` goes.

1. **Top row:** Back alone, quiet ("Back to Fields" or "Back to {label}" via `useBackLink`).
2. **Title row:** the field's `LogoAvatar`-style tile (soft green initials, no 80 px halo), the name (display face, 32 px, 26 px phone, own capitals), ONE status badge inline (the verification badge; Type and "Our Field" move to the counters), then ONE filled **Manage Field** `ManageMenu` at `MANAGE_BUTTON_WIDTH`, full width on a phone. Open in maps leaves the header; it is an inline link under the title (icon then text) and a menu item.
3. **Notice:** `FieldNotice` stays as a flat message under the title row (it is state, not a figure).
4. **Figures:** static compact `PageCounters`, no icons, no pointer: **Type**, **Owner**, **City**, **Matches Here** (admin: **Matches Using It**), and for admin **Clubs Using It**; manager **Our Field** (Yes or No). Text values allowed. `FieldKeyFigures` becomes a `PageCounters` builder.
5. **Info cards:** `FieldInfoCards` flat with hairline (`InfoCard flat`: Address, Details, Verification); the Add to our fields button leaves the Details card (it is in Manage Field). Admin Possible Duplicates card stays flat and keeps its links (with `returnTo`).

**Manage Field** (one group "Field"; Share omitted, none exists):
- Manager: **Edit Field** first (disabled with the `fieldEditState` reason), **Add To Our Fields** or **Remove From Our Fields** (existing confirm), **Open In Maps** (when a map link exists).
- Admin: **Edit Field** first, **Verify** (unverified only, replaces the filled Verify button of the notice), **Reject**, **Reopen** per `FIELD_STATUS_ACTIONS` (each with the existing confirm dialog, whole item disabled with `VERIFIED_FIELD_NO_ACTIONS` when none applies, replacing the Status button and menu), **Merge Into...** (opens `FieldMergeDialog`), **Open In Maps**.
- Group order: Edit, status actions, Merge, links. Nothing is removed; the old Status button, Merge button and filled Verify move into this menu.

**Return navigation:** every link that leaves the page (Edit, duplicates, Open Field after merge, matches) carries the page as origin, label the field name within 60 characters; the page never copies its own `returnTo` forward.

### Field form (`FieldFormPage`; admin twin `AdminFieldFormPage`)

- `RecordFormScreen compact`, title "Add Field" or "Edit Field", Back "Back to Fields" by default, "Back to {label}" with a valid `returnTo` (the default Back of an edit is the field page, as today).
- **Card:** one flat card, compact headings, 36 px fields, three columns from `md`, two at `sm`, one on a phone; fields, validation, duplicate panel and payload unchanged. "This is one of our fields" stays on add, as a toggle in the card.
- **Footer (one band, one filled button):** Cancel (white), **Save Changes** (**Create Field** on add). No Deactivate or Delete exist for a field (`099`: verification, not an Active flag), so none is added. A field that cannot be edited opens read-only with its reason and no Save, as today.
- Back, Cancel and Save honour `returnTo` through `useAfterSave`; without one, Save goes to the field page, as today.

### Components and files

- Changed: `FieldsPage.tsx`, `AdminFieldsPage.tsx`, `FieldDetailPage.tsx`, `AdminFieldDetailPage.tsx`, `FieldFormPage.tsx`, `AdminFieldFormPage.tsx`, `FieldKeyFigures.tsx`, `FieldInfoCards.tsx`, `FieldNotice.tsx` (action prop removed), `components/FieldCard`, `components/FieldTable`.
- New: `pages/manage/fields/FieldRowMenu.tsx` (manager and admin variants), a Manage Field groups builder shared by the two field pages.
- Reused unchanged: `PageCounters`, `FilterBar`, `ToolbarCard`, `ToolbarSortButton`, `ToolbarToggleChip`, `ListViewToggle`, `ManageMenu`, `AddCard`, `dynamicCardGridSx`, `InfoCard`, `RecordFormScreen`, `FieldStatusMenu` (kept for status choices if the menu items reuse it), `FieldMergeDialog`, `useFieldHomeLink`, `useFieldStatusActions`, `utils/returnTo`, `hooks/useReturnTo`.
- Removed from these pages: `PageHeaderBand`, `ContentControlsLine`/`SortLink`, `KeyFigureTile` strip, card footer bar, loose Open in maps, Status and Merge buttons, the Quick filter row, `cardGridSx`.

## Test Plan

Tiers per `docs/standards/testing.md`; UI only (no backend or contract tier). Per the owner's standing rule, tests are written after the owner's browser check.

- **List (manager and admin):** counters still filter, no FILTER tag; toolbar fused in List, standalone in Cards; Our Fields Only chip keeps the saved and auto default; Sort then Cards | List last; no "Showing" text; no chevron; kebab "Actions for ..." with the listed items and disabled reasons, never navigates the row; no card footer; dashed Add card; zebra parity; `returnTo` on every outgoing link; empty states have no button.
- **Field page:** Back alone; one filled Manage Field at `MANAGE_BUTTON_WIDTH` with Edit first and no Share; static compact figures; Open in maps as an inline link; every previous action reachable (edit with disabled reason, add or remove from our fields, verify, reject, reopen, merge, duplicates); flat cards; `returnTo` on leaving links.
- **Form:** one compact card; footer labels; read-only with reason when not editable; Cancel and Save go to `returnTo` or the default; invalid `returnTo` ignored; payload unchanged.
- **Phone (375 px)** for all; **Storybook** for `FieldRowMenu`, flat `FieldCard`, `FieldTable`; existing tests (`FieldsPage`, `FieldDetailPage`, `FieldFormPage`, admin twins, `FieldCard`) updated, not weakened.

## Acceptance Criteria

1. The Fields list has no count text, a fused toolbar with Our Fields Only, Sort, then Cards | List last, flat table and cards, no chevron, one kebab per row and card, a dashed Add Field card.
2. The field page top row holds Back alone; the title row holds the name, one badge and ONE filled Manage Field menu; no separate Edit, Status, Merge, Verify or Open in maps button.
3. Figures are static compact cards without icons; info cards are flat.
4. Every previous action (edit, add or remove from our fields, verify, reject, reopen, merge, open duplicate, open in maps) is reachable from Manage Field or the list kebab, with the same dialogs and disabled reasons.
5. The form is one compact card with Cancel and Save Changes (Create Field); Back, Cancel and Save honour `returnTo`.
6. Labels Title Case, UK spelling, no em dashes; no field, validation, endpoint, permission or backend change; checked at 375 px.

## Rollout Notes

UI only, one change, no flag. Order: (1) `FieldRowMenu`, `FieldCard`, `FieldTable`; (2) lists (manager, admin); (3) field pages with Manage Field; (4) forms. Then update `page-anatomy.md` section 9 (Fields list and Field page rows), the `design-system.md` paragraphs on the 099 field card and tiles, and `docs/roadmap.md`. Copy the section 10 checklist into the PR. **Build this spec first; spec `133` is built on top, on the same branch, UI revamp before the migration.**

## Documentation gaps

1. **Admin page placement of Merge.** Merge is destructive and platform-only; assumed a Manage Field item (field page only, not the kebab) to keep kebabs light. Belongs in 6b (which actions may be kebab-only or page-only).
2. **Manage menu with no Share.** Section 8 says Share last; assumed omitted when no share exists (as the coordinator's brief says). Belongs in section 8.
3. **Status actions as Manage items.** Verify, Reject and Reopen are state transitions with confirm dialogs, not in 6b's item order. Assumed they sit after Edit. Belongs in 6b.
4. **Edit disabled, not hidden.** 099 requires a disabled Edit with the reason; assumed this holds as a menu item with its reason line. Belongs in 6b.
5. **Our Fields Only as a toggle chip** replacing the switch; the section 3 text says switches become chips; assumed. Confirm.
