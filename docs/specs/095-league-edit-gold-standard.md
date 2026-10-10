# 095: League Edit Gold Standard: Shell, Teams, Schedule, Playing Conditions, Contacts

**Depends on:** 029 (league management), 050 (schedule), 052 and 055 (playing conditions, season config), 053 (extended profile), 054 (contacts), 062 and 072 (the league page), 070 (league teams, their dialogs and copy action), 089 (the Match page and form, the user's reference for compact), 091 (Leagues gold standard; this spec finishes what its Non-goals deferred), 092 (Teams gold standard), 093 (the Match edit page becoming Details only, Deactivate living with Details), and the "Record detail page" and "Compact forms and switches" paragraphs of `docs/standards/design-system.md`.
**Status:** draft, written 2026-10-10 from the user's feedback on the built 091: "The League edit page does not conform to the standards, I find it difficult to use. It is very bloated, not compact as for instance a Match. The Teams page is an example, it just feels all over the place." Spec `094` (club structure and seasons) lives on another open branch and is not in this tree; this spec assumes nothing from it (see Open Questions). **Needs mockups of the Teams tab (and the shell) before the plan**, see Rollout Notes.

## Problem & Goals

`091` restyled only the **Details** tab of the League edit page and said the Teams, Schedule, Playing conditions and Contacts tabs "keep their content; they pick up the compact spacing only". In the browser that was not enough. `LeagueFormPage.tsx` (about 715 lines) still reads as a different product from the Match edit page:

- A bordered tab bar inside a large padded card, with a footer bar that is empty (or holds only the Active toggle) on four of the five tabs.
- Every season-scoped tab repeats its own full-width 280 px **Season** select above the content.
- **Teams** is the worst: two big `RecordCard`s for "Our teams" (logo tile, name, text buttons Unaffiliate and Edit bottom right) and a "League teams" block with an outlined chip, helper text beside it, a filled **Add league team**, an outlined **Copy teams from...**, then more big `RecordCard`s with three different icon buttons. Two card shapes, three button styles, actions scattered, a lot of empty space.
- **Schedule** is a date-grouped list of bordered rows that the league page already shows better (zebra table, 091 C). **Playing conditions** is a long single column of uppercase subtitles, helper text under every field, plain checkboxes and a Save button buried at the bottom. **Contacts** is a card grid with a stray outlined Add button.

Goals:

- **A. Shell:** make the whole edit experience (all five tabs and the create flow) as compact and consistent as the Match page: one header, one tab strip, the shared Season pill instead of per-tab selects, a footer only where there is something to save, Deactivate with Details.
- **B. Teams tab:** two compact, matching sections (our affiliated teams, league teams) with one action pattern, one consistent primary button per section and tidied count and helper text.
- **C. Schedule and Playing conditions tabs:** reuse the league page's fixtures table and the sectioned compact form pattern.
- **D. Contacts tab:** a compact list on the same row pattern as Teams.
- Every slice changes presentation only. Same data, endpoints, dialogs, validation and payloads.

## Non-goals

- **No new fields, endpoints, permissions or migrations.** What a league, an affiliation, a league team, a season's playing conditions or a contact is does not change. The share outputs (PDF, poster, calendar, conditions PDF) are untouched.
- **The Details tab is not redone.** `LeagueForm` already is the 091 sectioned card (Basic info, Contact, Branding and social). It is only checked against the compact shell (spacing, footer) and left as built.
- **The Contact, Season and Playing conditions screens reached from here** (the contact create/edit and view pages, the `LeagueTeamFormDialog`, `CopyLeagueTeamsDialog`, `LinkExistingRecordDialog`, `ShareScheduleDialog`, `PlayingConditionsShareDialog`) keep their own content. Only their trigger buttons change.
- **No toolbar counters, list view or Cards | List switch** on the edit page: it is a form, not a list page.
- **No change to the league page** (view). It is the reference this page is made coherent with, not a target. Where a piece is shared, the shared piece changes in a way the league page already shows.
- **No results, standings or bulk import** of league teams (still the `070` deferrals).
- **Not a rework of `RecordFormScreen` for every form.** Only two optional, backwards compatible additions (see UI Requirements); no other form is restyled.

## User Stories

- As a manager, I can open Edit League and move between Details, Teams, Schedule, Playing conditions and Contacts on a page as compact as the Match page, so that nothing feels bloated.
- As a manager, I choose the season once at the top of the page and every season-scoped tab follows it, so that I never set it again per tab.
- As a manager, I can see the club's affiliated teams and the league's opponent teams as two tidy lists, each with one Add action and the same row actions, so that I know where to click.
- As a manager, I can edit, deactivate or remove a league team, and copy teams from another league or season, without hunting for the button.
- As a manager, I can edit playing conditions in sections that match the other forms, and save them from a footer I can always find.
- As a manager, I can open a given tab directly from a link (`?tab=teams`), so that the match form's "add league teams" hint can take me there.
- As a manager, I can add a league, from the same compact card, without the tabs I do not need yet.

## Data Model Changes

None.

## Shell (slice A)

**Today** (`LeagueFormPage.tsx`): `RecordFormScreen` (title "Edit League" / "Add League", Back to Leagues) wrapping `Tabs` (`Details`, `Teams`, `Schedule`, `Playing Conditions`, `Contacts`; scrollable, `mb: 2`, bottom border) inside the shared `ContentCard`, a `1fr 1fr` grid with `gap: 3` and a footer of Cancel and Save (Details only) plus `RecordStatusToggle` (every tab). The selected season is one piece of state, but three tabs each render their own `Input select`.

**Changes:**

1. **Tabs stay, as a compact strip** (recommendation; alternative below). Same five tabs and same content ownership, but: sentence case "Playing conditions"; the league page's tab styling (underline, 40 px high, no heavy bottom margin) rather than a default MUI strip with `mb: 2`; the strip sits **on the page wash directly under the title row**, and the card below holds only the active tab's content, with the 091 compact padding (16 px, 20 px from `md`). If the league page's tab line is inline in `LeagueViewLayout`, extract its styling to a shared helper rather than copying it.
2. **One Season pill** (`HeaderSeasonSelect`, no "All") in `RecordFormScreen`'s `headerAction` slot, shown **only on the season-scoped tabs** (Teams, Schedule, Playing conditions) and hidden on Details and Contacts. It replaces the three per-tab selects. Default and fallback: `pickDefaultSeasonId`, as now. The "Create a season first" message stays when the club has no season and the pill is then not shown.
3. **Footer only where it has a job.** `RecordFormScreen.actions` becomes optional; with none, no divider and no footer padding are rendered. Details keeps Cancel and Save changes / Create league (and the error text). Playing conditions gets its own footer (slice C). Teams, Schedule and Contacts have none (their actions sit in their own section headers).
4. **Deactivate / Reactivate moves to the Details footer only** (`RecordStatusToggle`, as on the Match page after 093). It is a record action and today floats alone in an otherwise empty footer on every other tab.
5. **Deep link:** the active tab is carried in `?tab=details|teams|schedule|conditions|contacts` (default Details; unknown value falls back to Details). This resolves the `070` roadmap item "a `?tab=` deep link into the league's Teams tab", and lets the Match form's empty-list hint link to Teams instead of Details. Season stays in local state as today (the `?seasonId=` of the league page is not read here, see Open Questions).
6. **Create flow (Add League):** no tab strip, no pill, no deactivate toggle: the Details card with the Cancel and Create league footer, exactly as built in 091. Nothing else changes.
7. **Title and Back:** unchanged ("Edit League" / "Add League", "Back to Leagues"); Cancel still returns to the league page (edit) or the list (add).

**Alternative considered: sections instead of tabs.** One long scrolling page of Details, Teams, Conditions and Contacts as stacked `InfoCard`-style sections with a sticky in-page nav. Against: three of the sections are season-scoped and heavy (two team lists, a long conditions form), so one page would be long and the Season control would apply to only part of it; Save would have to mean "save this section" in a page with several forms; and the Match page's precedent (a page that is the form) is not a multi-section record. For: no hidden content, one scroll. Not recommended; mockup A shows tabs, and an optional mockup shows sections if the user wants to compare.

**Stays functionally identical:** all data queries and their keys, the season default rule, the save, deactivate and reactivate mutations, the Cancel target, and the dialogs mounted by the page (`LinkExistingRecordDialog`, `ShareScheduleDialog`, `PlayingConditionsShareDialog`). The page's mega-component is split per tab (see UI Requirements) with no change to what it fetches.

## Details tab (checked in slice A, no restyle)

`components/LeagueForm/LeagueForm.tsx`: three `FormSectionHeading` sections, three-column grid, "(optional)" labels, validation under the field. Slice A only confirms it sits correctly in the compact shell (no double padding from the new card, the footer from item 3). If the browser check finds spacing differences from `MatchForm`, they are fixed in `LeagueForm` as part of slice A, not deferred.

## Teams tab (slice B)

**Today**

- `LeagueFormPage.tsx` tab 1: a 280 px Season select; "Our teams" `h2`; either "No teams affiliated for this season yet." or a two-column grid of `AffiliatedTeamCard` (a `RecordCard`: 56 px logo tile, name, an Edit link to the team's edit page, a **Unaffiliate** secondary action that fires `unaffiliateLeagueTeam` at once with no confirmation); an outlined small **Add team** (opens `LinkExistingRecordDialog`, club teams not yet affiliated that season) below the grid.
- `leagueTeams/LeagueTeamsSection.tsx`: "League teams" `h2`, an outlined chip "N teams", the caption "Opponents you pick on matches, for this season only", a **filled** "Add league team" and an **outlined** "Copy teams from..." (side by side, stacked on a phone), an inline `Alert` for outcomes and errors, an `EmptyState` when empty, then a three-across grid of `LeagueTeamCard` (a `RecordCard`: logo tile, name, Abbreviation, "Used in N matches" fields, an Inactive badge, muted content when inactive, and three footer text-and-icon buttons Edit, Deactivate / Reactivate, Remove).
- Dialogs: `LeagueTeamFormDialog` (create / edit), `CopyLeagueTeamsDialog`, `ConfirmDialog` for Remove (delete, or deactivate when the team is used by matches). Mutations in `useLeagueTeamMutations`.

**What is wrong:** two card shapes for the same kind of thing (a team), three unrelated action treatments (text buttons, an outlined Add, icon-and-text footer buttons), a count chip and a helper sentence competing in the heading, and the Season select taking a row of its own.

**Proposed design (recommendation A, "two compact lists")**

The tab body is two full-width, bordered panels stacked with a 12 px gap, the same panel look as the league page's section cards (`InfoCard` shell: solid 32 px icon tile and uppercase heading), each with a header row and a zebra body.

1. **Our teams panel.** Heading "Our teams" with the count folded in ("Our teams · 2", the separate chip goes). One **filled** primary action at the right of the header: **Add team** (opens the existing `LinkExistingRecordDialog`). Body: compact zebra rows (`zebraTint`, 44 px, 56 px on a phone): a 32 px logo (solid `avatarSx`, as the league page shows own teams), the team name, then right-aligned **icon buttons with tooltips and aria-labels**: **Edit team** (pencil, goes to the team's edit page as now) and **Unaffiliate** (link-off). Empty: the existing line "No teams affiliated for this season yet." as a quiet row, with the Add team button still in the header.
2. **League teams panel.** Heading "League teams · 3". Under it one caption line "Opponents you pick on matches, for this season only" (the sentence kept verbatim, shown once, in the secondary colour; on a phone it moves to an info icon with a tooltip). Header actions: **filled Add league team** (opens `LeagueTeamFormDialog`) and an **outlined "Copy from..."** (opens `CopyLeagueTeamsDialog`; label shortened, aria-label keeps "Copy teams from another league or season"). One filled button per panel, always the create action; outlined is always the secondary. Body: a compact zebra table `LeagueTeamTable`: **Team** (a 32 px tinted logo, as the league page shows league teams, and the name), **Abbreviation**, **Used in** ("3 matches", "-" muted when none), **Status** (an Active or Inactive chip, `badgeSx`, `muted` for Inactive), and **icon buttons** Edit, Deactivate / Reactivate (toggle icon, tooltip says which), Remove. An inactive team's row text is muted (the actions stay at full strength), which also covers the "inactive styling not designed" gap `092` left for teams. Phone: Team (abbreviation and "3 matches" under the name), the status chip, and one three-dot row menu holding Edit, Deactivate / Reactivate and Remove with 44 px targets.
3. **Feedback and errors:** the existing inline `Alert` (outcome of remove, copy, deactivate) and the load-error alert move directly under the League teams header, unchanged in wording.
4. **Season:** the header pill (shell item 2). Changing it remounts the League teams section as today (`key={selectedSeasonId}`).

**Alternative B ("chips for our teams").** Our teams as a wrapping row of removable chips (logo, name, an X to unaffiliate, click opens the team's edit page) with Add team as a trailing chip, and only the league teams as a table. More compact still, but two different patterns on one tab (which is what the user disliked), no room for a second action beyond remove, and a small touch target on a phone. Shown as the second variant on the mockup so the user can compare; not recommended.

**Reuses, does not redefine:** the dialogs and mutations from 070 (`useLeagueTeamMutations`, `LeagueTeamFormDialog`, `CopyLeagueTeamsDialog`, `ConfirmDialog` for Remove), `leagueTeamsQueryKey`, the affiliation endpoints and the `AffiliatedTeamCard` unlink mutation (kept per row so one row's pending state never leaks to another, as the card did). `LeagueTeamCard` and `AffiliatedTeamCard` become unused and are removed (with their tests) once their last consumer is gone, as 091 did for `NextMatchCountdown`.

**Behaviour change, called out:** Unaffiliate today fires immediately from a labelled text button. As an icon button it is easier to hit by accident, so it asks first in the shared `ConfirmDialog` ("Unaffiliate X from this season?" with the consequence stated if it has matches; wording is final at plan time). This is the only behaviour addition in the spec; the Open Questions let the user decline it.

## Schedule tab (slice C)

**Today:** a Season select, outlined small **Add Match** (navigates to `/manage/fixtures/matches/new?leagueId=&seasonId=`, prefilled by `MatchFormPage`) and outlined **Share** (opens `ShareScheduleDialog`, disabled while matches load), a `Skeleton`, then `components/LeagueFixtures`: matches grouped under date headings, each a bordered three-column row (home logo and name, time and venue, away name and logo). Matches come from `listAllMatches` for the league and season.

**Changes:**

- Season pill from the shell; no per-tab select.
- A single content line (`ContentControlsLine`): "Showing 44 matches · 2026/27" on the left; on the right **Share** (outlined) and **Add match** (filled, the one primary action). Disabled states unchanged.
- The body becomes the league page's `LeagueFixturesTable` (zebra, sticky header, When, Match with logos, Venue, "Our match" chip, chevron), so edit and view agree. The extra filters of the league page's Schedule tab (Team select, search, Only our matches, Show played) are **not** added in v1: the edit tab shows every match of the season as it does today, which keeps the behaviour identical (see Open Questions for adding them).
- `LeagueFixtures` is removed if the plan confirms no other consumer (its doc comment mentions a `LeagueDetailPage` that no longer exists); its test and story go with it.

**Identical:** the query, the Add match prefill, the share dialog and its three outputs.

## Playing conditions tab (slice C)

**Today:** a Season select; a "Full document" uppercase subtitle and `DocumentUpload` (PDF, `PLAYING_CONDITIONS_PDF_NAME`); a "Match format and points" subtitle with a ghost **Share** button (opens `PlayingConditionsShareDialog`); then `components/PlayingConditionsForm`: uppercase group subtitles (Match Format, Points System, Bonus Points, Additional Notes), a two-column grid with 24 px gaps, helper text under most fields (examples, the "(auto: N)" hint, the bonus explanations), MUI `Checkbox`es for Allow substitutions and Enable bonus points, free-text areas of three rows, and a **Save Playing Conditions** button inside the form at the very bottom, with its error text.

**Changes** (the form is `PlayingConditionsForm`, so the change is there and in the tab wrapper):

- Season pill from the shell.
- Sections use `FormSectionHeading` with icon tiles: **Document**, **Innings** (max overs, powerplay, max overs per bowler, fielding restrictions notes, allow substitutions), **Points** (win, loss, draw, no result, forfeit win; the standard five fields), **Bonus points** (enable; the two thresholds only when enabled), **Notes**. These are the same groupings as the league page's Conditions tab cards (Innings, Points, Fielding restrictions), so the two read alike.
- Three-column field grid from `md` (one column on a phone), 40 px inputs, the examples as placeholders ("e.g. 20", "e.g. 6"), no helper text except validation errors. The "(auto: N)" hint stays visible as the field's placeholder ("Auto (6)") because it states the effective value. The two long bonus explanations become a tooltip on a small info icon beside the label (the text is kept verbatim).
- The two Checkbox controls become `CompactSwitch` (the one toggle style, 085).
- **Share** (outlined) and **Conditions PDF** upload sit on the tab's own content line (`ContentControlsLine`), as the league page's Conditions tab line does, instead of a ghost button inside a subtitle.
- Save: a **footer** in the tab card, divider above, right-aligned **Save playing conditions** (filled) with the error text before it, matching the Details footer. The form keeps its own `id` and `onSubmit`; the footer button is bound by `form={PLAYING_CONDITIONS_FORM_ID}` (the id the component already exports for this purpose).

**Identical:** every field, validation rule, the default points seed for a first save, the payload and the `PUT`, the upload endpoint, the share dialog.

## Contacts tab (slice A)

**Today:** "No contacts yet for this league." or a grid of `RecordCard`s (circular initials avatar, name, a role badge, Role / Email / Phone fields, View and Edit footer links to the contact pages), and an outlined small **Add Contact** below.

**Changes:** a panel on the Teams-tab row pattern: heading "Contacts · 3" with a **filled Add contact** in its header (still navigates to `/manage/fixtures/leagues/{leagueId}/contacts/new`); zebra rows with the avatar and name (the role badge from `contactBadgeFor` beside it), Role, Email, Phone, and icon buttons **View** and **Edit** (same two routes). Phone: name with role under it and a chevron that opens the contact. Empty state as today. No change to the contact pages or data.

## API Contract

None. No endpoint, DTO or `openapi.yaml` change. Every tab keeps the queries `LeagueFormPage.tsx` already makes (leagues, seasons, club teams, affiliations, contacts, season matches, playing conditions, league teams). The only new data path is the `?tab=` query parameter, which is client routing state, not API.

| Endpoint | Access | Purpose |
|---|---|---|
| (none) | | |

## UI Requirements

Composes from the existing library (`docs/standards/design-system.md`). Two small backwards compatible additions to shared components, otherwise new pieces are page-local.

**Reused versus new**

| Piece | Status | Where used |
|---|---|---|
| `RecordFormScreen` (`headerAction`, `actions`) | Reused; `actions` becomes optional (no footer when omitted); optional `tabs` slot rendered under the title on the page wash | Shell |
| `HeaderSeasonSelect`, `pickDefaultSeasonId` | Reused | Shell (Season pill) |
| `Tabs` styling of `LeagueViewLayout` | Reused (extracted to a shared helper if inline) | Shell |
| `FormSectionHeading`, `LeagueForm` | Reused as built in 091 | Details, Playing conditions |
| `InfoCard` shell (icon tile and heading) | Reused | Teams panels, Contacts panel |
| `ContentControlsLine`, `CompactSwitch` | Reused | Schedule and Conditions content lines, Conditions switches |
| `CompactToggleGroup`, `ListViewToggle`, `PageCounters`, `FilterBar`, `KeyFigureTile` | Not used (a form page has no counters or view switch) | n/a |
| `ConfirmDialog` | Reused (Remove as now, plus Unaffiliate) | Teams |
| `LinkExistingRecordDialog`, `LeagueTeamFormDialog`, `CopyLeagueTeamsDialog`, `useLeagueTeamMutations` | Reused unchanged | Teams |
| `avatarSx`, `badgeSx`, `zebraTint` | Reused | Rows in Teams and Contacts |
| `LeagueFixturesTable` (`pages/manage/league`) | Reused | Schedule |
| `ShareScheduleDialog`, `PlayingConditionsShareDialog`, `DocumentUpload` | Reused unchanged | Schedule, Conditions |
| `RecordStatusToggle`, `Button`, `Input`, `WebsiteInput` | Reused | Details footer, forms |
| `PlayingConditionsForm` | Reused, restyled (sections, grid, switches, no helper text, footer binding) | Conditions |
| `LeagueEditTabs` (tab strip bound to `?tab=`) | New, page-local | Shell |
| `LeagueEditTeamsTab` | New, page-local; holds the two panels | Teams |
| `AffiliatedTeamRows` (our teams zebra list) | New, page-local; replaces `AffiliatedTeamCard` | Teams |
| `LeagueTeamTable` | New, page-local; replaces `LeagueTeamCard` | Teams |
| `LeagueContactRows` | New, page-local; replaces the contact `RecordCard` grid | Contacts |
| `LeagueEditScheduleTab`, `LeagueEditConditionsTab`, `LeagueEditContactsTab` | New, page-local extractions of the inline tab bodies | Per tab |
| `RowIconButton` (icon button with tooltip and aria-label, 36 px, 44 px on a phone) | New only if the plan finds no existing one (`RecordIconButton` is a different, avatar-style control); otherwise reuse | Row actions |
| `LeagueFixtures`, `LeagueTeamCard`, `AffiliatedTeamCard` | Removed when unused | n/a |

`docs/standards/design-system.md` gains a short "League edit page" paragraph beside the Teams and League ones; `docs/standards/frontend.md` is updated only if the `RecordFormScreen` additions change its documented anatomy. `LeagueFormPage.tsx` is reduced to the shell, the Details tab and the page-level queries and mutations, each tab in its own file (`docs/standards/frontend.md` file anatomy).

**Phone:** the tab strip scrolls horizontally if needed; Season pill beside Back on the top row or full width under the title (mockup decides); every row action is a 44 px target; tables collapse to the phone row shapes above.

## Test Plan

Per `docs/standards/testing.md`. No backend change, so no backend or contract tier work (the OpenAPI diff must stay empty; that is the check).

- **Unit (Vitest + Testing Library):**
  - Shell: the tab strip, `?tab=` selects and falls back to Details, the Season pill shows only on Teams, Schedule and Conditions and drives all three, no footer on Teams, Schedule and Contacts, Deactivate and Reactivate in the Details footer only, the create flow has no tabs, pill or toggle. Existing `LeagueFormPage.test.tsx` cases updated to the new markup, not weakened.
  - Teams: our teams rows (Edit link target, Unaffiliate asks first and then calls the existing mutation; empty line), league teams table (columns, the Inactive muted row, Edit, Deactivate / Reactivate and Remove open the same dialogs and call the same mutations with the same arguments, the 409 duplicate-name path in the form dialog, the alert messages for deleted / deactivated-instead / copied), the phone row menu, the one filled button per panel. Existing `LeagueTeamsSection`, `LeagueTeamCard` tests migrated or removed with their components.
  - Schedule: the content line, the table receives the season's matches, Add match navigates with the prefill, Share opens the dialog.
  - Playing conditions: sections, three-column grid class at `md`, switches replace checkboxes (the role query in tests changes from checkbox to switch), bonus fields shown only when enabled, the payload and the default points seed unchanged, the footer Save submits the form.
  - Contacts: rows, View and Edit routes, Add contact route, empty state.
- **Component (Storybook, one critical interaction per new shared piece):** stories for `LeagueTeamTable`, `AffiliatedTeamRows`, `LeagueContactRows`, `LeagueEditTabs`, `RowIconButton` (if new), and the updated `PlayingConditionsForm` and `RecordFormScreen` stories (with and without `actions`, with `tabs`).
- **Accessibility:** icon buttons have names and tooltips; tab strip is a real `tablist`; phone targets are 44 px; the row menu is keyboard operable.
- **End-to-end (Playwright):** no new golden path. The existing create-league path, if any, is adjusted for the footer and tab markup.
- **Integration and contract:** none required (no backend change); the OpenAPI contract diff passing unchanged is the contract-tier evidence.

## Acceptance Criteria

- Edit League shows the title row, one compact tab strip and a card holding only the active tab, with no empty footer and no per-tab Season select; it is visibly the same density as Edit Match.
- The Season pill appears only on Teams, Schedule and Playing conditions, and changing it changes all three.
- On Teams, our affiliated teams and the league teams are two matching zebra lists; each section has exactly one filled button (Add team; Add league team) and every row action is an icon button with a tooltip (a three-dot menu on a phone); no two card shapes remain.
- Edit, Deactivate / Reactivate, Remove, Copy and Add league team do exactly what they did, including the delete-or-deactivate outcome messages and the duplicate-name error; Unaffiliate asks for confirmation first (unless the user declined it in review).
- The Schedule tab uses the league page's fixtures table; Add match still prefills League and Season; Share still produces PDF, poster and calendar.
- Playing conditions saves the same payload as before from a footer Save, with switches instead of checkboxes, sections and no helper text; the Conditions PDF upload and the captain-summary Share still work.
- Contacts are a compact list with a filled Add contact; View and Edit open the same pages.
- `?tab=teams` (and the other values) opens that tab; an unknown value opens Details.
- Deactivate / Reactivate is in the Details footer and nowhere else.
- Add League is the Details card without tabs, unchanged in fields, validation and payload.
- No endpoint, permission, data or share-output change; the OpenAPI diff is empty.

## Open Questions

**Decided by the user on 2026-10-10:** the Teams tab is **variant A** (zebra lists for Our teams and League teams; mockups: https://claude.ai/artifact/SdFrktKTKSJqghS99swu2G, boards Teams tab variant A, Phone and Schedule; variant B, chips, is not built). The user chose not to see mockups of the other tabs and asked for them to be built from this spec following the standards already set (Match form compactness, the Teams tab pattern, 091 and 092 cards and tables). Every other question below therefore stands at its proposed default (tabs, confirm before Unaffiliate, keep the Schedule tab reusing the league page table, no filters on it in v1, Season pill in the header and hidden on Details and Contacts, Deactivate in the Details footer only, Conditions checkboxes become switches, Contacts as a compact list, a three-dot row menu on a phone, start from `?seasonId=` when present).

Each has a proposed default, used if the user does not decide.

1. **Tabs or sections?** Default: tabs, as a compact strip on the page wash (see Shell). Alternative: stacked sections with an in-page nav. Mockup both.
2. **Our teams as a zebra list or as chips?** Default: zebra list (A), the same pattern as league teams. Alternative: chips (B). Mockup both.
3. **Confirm before Unaffiliate?** Default: yes, because it becomes an icon button. Alternative: keep it immediate, as today.
4. **Keep the Schedule tab on the edit page at all?** The league page already has a better Schedule view with Share and Add match reachable from it. Default: keep, reusing the table (no function lost). Alternative: remove the tab and add a "Schedule" link to the league page, saving a screen (a behaviour change, so only with the user's approval).
5. **Filters on the edit Schedule tab** (Team, search, Only our matches, Show played): default no (v1 shows every match, as today); add later if wanted (this closes 091's open question as "not needed yet" unless the user says otherwise).
6. **Where does the Season pill sit?** Default: the header's right side next to Back on the top row, hidden on Details and Contacts. Alternative: at the right end of the tab strip. Mockup decides.
7. **Deactivate / Reactivate moves to the Details footer only.** Default: yes (the Match page precedent, 093). Alternative: also keep it visible on every tab.
8. **Conditions form: checkboxes to `CompactSwitch`.** Default: yes (the one toggle style). Tests change from checkbox to switch queries.
9. **Contacts as a compact list instead of cards.** Default: yes, matching Teams. Alternative: keep the card grid with only the button changed.
10. **Phone row actions:** default a three-dot menu per row with 44 px targets. Alternative: always show the icon buttons and let the row wrap.
11. **Season of the league page.** The page reads `?seasonId=` from the league page, but the edit page keeps its own season state. Default: start from `?seasonId=` when present (the league page's Edit button would pass it), else `pickDefaultSeasonId`. This is a small behaviour addition; decline to keep today's behaviour.
12. **Spec `094` (club structure and seasons)** may change how seasons are chosen or labelled. Default: this spec uses today's `HeaderSeasonSelect` and `listSeasons`; if 094 merges first, reconcile the pill at plan time.

## Rollout Notes

**Design step first (before the plan).** The user wants to see the Teams tab before deciding. Mockups to produce and approve (Claude Design, as 091 and 092, on the club's real tokens, `docs/workflow.md` step 2):

1. **Teams tab, desktop, variant A** (two zebra lists, header actions) with a populated state, an empty our-teams state, an inactive league team and the inline Alert.
2. **Teams tab, desktop, variant B** (chips for our teams) for comparison.
3. **Teams tab, phone** (row menu, the info-icon helper text).
4. **The shell, desktop and phone**: title row with Back and the Season pill, the tab strip, the Details card with footer, next to the Match edit page for comparison, plus the "sections instead of tabs" option as a low-detail sketch.
5. **Playing conditions** (sections, switches, footer) and **Schedule** (content line and table), desktop only.
6. **Contacts list**, desktop and phone.

Settle the Open Questions on those boards; amend this spec to record the decisions; then `/plan-feature`.

**Slices, one branch, each ending in a green build and independently shippable in this order:**

- **A. Shell, Details check and Contacts.** `RecordFormScreen` (optional `actions`, optional `tabs`), compact tab strip, Season pill, `?tab=`, Deactivate to the Details footer, per-tab file split, Contacts list. Ships first because B and C use the pill and the shell; until A lands the tabs keep their own Season selects.
- **B. Teams tab.** Our teams rows, `LeagueTeamTable`, removal of the two card components. Can ship alone after A.
- **C. Schedule and Playing conditions.** Fixtures table reuse, `PlayingConditionsForm` restyle, footer Save. Can ship before or after B.

Slice A also updates the match form's empty-list hint to use `?tab=teams` (it currently links to Details; one string). Update `docs/roadmap.md` when each slice lands: mark the `070` "`?tab=` deep link" item resolved, and record any of the above left for later (Schedule tab filters, Teams filters, the 094 reconciliation). Update `docs/standards/design-system.md` with the League edit paragraph. Migrations: none. No feature flag.
