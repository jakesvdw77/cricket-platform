# Plan: spec 092 — Teams gold standard (page, card, list view, team page, edit form)

## Context

Spec 092 (`docs/specs/092-teams-gold-standard.md`, mockups approved 2026-10-09 incl. the card board 2b) brings Teams to the Matches / Players / Polls / Leagues standard: **A** one shared Teams page for `TeamList` (section-scoped) and `TeamDirectory` (club-wide) with Season pill, five counters, `FilterBar`, content line, Cards | List; **B** the new team card; **C** the team page; **D** the sectioned Details form. **Frontend only**: no endpoint, no migration (spec API Contract); counters are computed client-side from the data `useTeamCardData` already loads. Branch `feat/092-teams-gold-standard` (spec committed). Three slices, a commit group each, one PR only when the user says so.

## Findings that shape the plan

- `TeamList` and `TeamDirectory` are near-duplicates (search, name sort, `TeamCard` grid, `useTeamCardData(clubId, teams, currentSeasonId)` with `currentSeasonId = pickDefaultSeasonId(seasons)`); `TeamDirectory` also has a persisted Section filter (`teamDirectory:filters:<clubId>`, `SectionTreeSelect`) and exports `badgeFor` (used by `TeamDetailPage`). Spec says they share one body.
- `useTeamCardData` fetches per team: contacts, sponsors, squad (current season only) and one shared matches query (`size: 200`, season). It must take the **pill's season** (a parameter already) and also expose `matchesThisWeek` per team (from the same matches list: `matchDate` in next 7 days, server-clock-free client `Date`, same rule as the Matches counter) so counters need no new fetch. Query keys already include the season id.
- `TeamCard` (`components/TeamCard/TeamCard.tsx`) is a bespoke MUI card (stretched link, `SponsorQuickViewDialog`, social links, Edit text button). Used by both lists only. It is rebuilt to board 2b; props change (adds `active`, drops `abbreviation` chip, keeps `viewTo`/`editTo`, adds `squadTo`/`matchesTo` for the footer).
- Reusable (all built in 087–091): `PageCounters`, `FilterBar` (has Section slot? — it has League/Season/Section/Team slots; use the Section slot with `SectionTreeSelect` if it accepts it, else the `extraSelects` slot), `ContentControlsLine`/`SortLink`, `CompactSwitch`, `ListViewToggle` + `useListViewPreference('teamList:view')`, `HeaderSeasonSelect` (`showAll={false}`), `ManageScreenHeader` (`titleAdornment`), `usePersistedListFilters`, `cardGridSx`, `KeyFigureTile`, `InfoCard`, `FormSectionHeading`, `SocialLinksRow`, `zebraTint`, and the table skeleton of `LeagueTable`/`PlayerTable`.
- Counters (spec): Active teams (quick filter), Players in squads (figure = sum of `playerCount`), Matches this week (figure = sum), No captain and Empty squads (amber quick filters, mutually exclusive, click again clears). Computed over the **shown** teams (after Section and Show inactive, before search, as Leagues). Because card data loads asynchronously, the two attention counters show loading until all per-team queries have settled.
- `TeamDetailPage.tsx` (438 lines): header chips + bento (contacts/sponsors icon grids, squad grid with `SquadPlayerTile`, season selector inside the squad card, filled Edit already). `TeamFormPage.tsx` (987 lines) outer tabs Details/Branding/Social Media/Contacts/Sponsors/Squad; `TeamForm` takes `activeSection` ('details'|'branding'|'social') + `hidden` and renders one group at a time; tab indices 3/4/5 are Contacts/Sponsors/Squad and `onInvalid` jumps to tab 0.

## Decisions to confirm (readings; the spec fixes the behaviour)

1. Counters follow the **Section filter and Show inactive**, not search (consistent with Leagues).
2. "Matches this week" = matches with the team as home/away in the next 7 days from the pill season's loaded matches (same 200-row cap as `matchCount`).
3. The Season pill is remembered per club with the other persisted filters (`teamList:filters:<clubId>` = {sectionId, seasonId}); the section-scoped list ignores the Section filter and is fixed to its section.
4. The team page's Season pill replaces the squad card's season selector and is carried from the list as `?seasonId=`.
5. Footer links: Squad → team page (squad is on it), Matches → `/manage/matches?teamId=` if that filter exists, else team page; Edit → edit page. (Checked during the build; flag if Matches has no team filter.)
6. Inactive teams: grey "Inactive" chip instead of Active, muted card (board not drawn; mirrors Players).

## Slice 1 — Teams page, card, table (`frontend-builder`, `test-writer`)

- `hooks/useTeamCardData.ts`: add `matchesThisWeek` to `TeamCardData`; keep signature. Update its test.
- `components/TeamCard/TeamCard.tsx`: rebuild as board 2b (header logo/name/section+status chips, social icons top-right, two figure tiles, zebra Captain/Manager/Coach rows with muted "–", sponsors row via the existing `ButtonBase` + `SponsorQuickViewDialog`, three-column footer Squad / Matches / Edit). Update `TeamCard.test.tsx`, `TeamCard.stories.tsx` (full, missing captain/coach, empty squad, inactive).
- New `components/TeamTable/TeamTable.tsx` (+ `.test.tsx`, `.stories.tsx`, `index.ts`) from the `LeagueTable` skeleton: Team (logo, name), Section, Players, Matches, Captain ("No captain" amber), Status, chevron; zebra, sticky clipped header, stretched link, `data-desktop-only`; phone: Team, Players, chevron.
- New `pages/manage/teams/TeamsPage.tsx` (+ test): the shared body. Props: `clubId`, `scope` (`{ kind: 'club' }` | `{ kind: 'section', sectionId }`), title/back/add targets, link builders (`?from=section` for the section scope). Contains the header with `HeaderSeasonSelect`, `PageCounters` (pure helper `teamCounters(teams, cardData)` in `utils/teamCounters.ts` + test), `FilterBar` (Section on club scope, search), `ContentControlsLine` (count, name sort, Show inactive, `ListViewToggle`), `cardGridSx` cards or `TeamTable`, empty states kept ("No teams yet", "No matching teams", error, not authorized).
- `TeamList.tsx` and `TeamDirectory.tsx` become thin wrappers around `TeamsPage` (TeamDirectory keeps exporting `badgeFor`); their tests are adjusted, not weakened (the old toolbar assertions move to the new controls).
- Commit.

## Slice 2 — team page (`frontend-builder`, `test-writer`)

- `TeamDetailPage.tsx`: header per board 4/5 — Back, `HeaderSeasonSelect` (no All), filled Edit team; logo 64 px, name, section + status chips; ground and `SocialLinksRow` line; `KeyFigureTile` strip (Players in squad, Matches this season, Captain, Ground; two across on a phone); Contacts and Sponsors `InfoCard`s in an `align-items: stretch` two-column row (existing contact and sponsor tiles reused inside); Squad `InfoCard` (existing `SquadPlayerTile`, captain highlighted) driven by the pill season; drop the in-card season selector. Season from `?seasonId=` else `pickDefaultSeasonId`.
- Update `TeamDetailPage.test.tsx` for the new structure (pill changes the squad request, strip figures, equal-height cards via `data-testid`, filled Edit, `from=section` back link unchanged).
- Commit.

## Slice 3 — edit / add form (`frontend-builder`, `test-writer`)

- `components/TeamForm/TeamForm.tsx`: render Basic info (Section, Name, Abbreviation, Ground; three columns, one on phone) and Branding and social (logo upload + Facebook/Instagram/X) as two `FormSectionHeading` sections in one card when `activeSection === 'details'`; remove the `branding`/`social` sections and their props; "(optional)" labels, no helper text (the `e.g.` hints go). Payload, validation and `onInvalid` unchanged.
- `TeamFormPage.tsx`: outer tabs become Details, Contacts, Sponsors, Squad (indices shift by two; update `activeTab` conditions, `onInvalid`, `activeTab <= 2` footer logic to `=== 0`); footer gets **Cancel**; Active switch stays in the footer on edit; Add team is the same card without the outer tabs.
- Update `TeamForm.test.tsx`, `TeamFormPage.test.tsx` (tab names/indices), `TeamForm.stories.tsx`. Commit.

## Docs (last commit)

`docs/standards/design-system.md` (team card/table/page paragraphs), `docs/standards/frontend.md` (`teamList:view`, `teamList:filters`), `docs/roadmap.md` (client-side counters as a possible later `teams/summary`), spec 092 status line (built, awaiting browser check, with the readings above), this plan copied to `docs/plans/092-teams-gold-standard.md`.

## Verification

- `source ~/.nvm/nvm.sh; nvm use 22.12.0` in `ui/`: `npx tsc -b`, `npm run lint` (no errors), changed test files first, then **one** full `npx vitest run --project=unit --maxWorkers=2` with nothing else running, then `--project=storybook` for the new stories (rerun once on a transient "useContext null").
- No backend change, so no backend build (and nothing run under the live backend).
- Manual (the user): Teams page on club-wide and section-scoped routes against boards 1–3 (pill changes figures, counters filter, Show inactive, list view survives reload), the team page against boards 4–5, the Edit team form against board 6 (Details sections, Cancel, tabs).

## Not in this plan

Backend summary endpoint, new team fields, content changes to the Contacts/Sponsors/Squad form tabs beyond spacing, and a PR (only on the user's say-so).
