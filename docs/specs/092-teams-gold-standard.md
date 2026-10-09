# 092 — Teams Gold Standard: Page, Card, List View, Team Page, Edit Form

**Depends on:** 004 (teams), 017/037 (squads), 088–091 (the Players, Polls and Leagues gold standards: `FilterBar`, `ContentControlsLine`, `PageCounters`, `ListViewToggle`, `useListViewPreference`, `HeaderSeasonSelect`, `KeyFigureTile`, `InfoCard`, `FormSectionHeading`, table pattern, the "Record detail page" and "Compact forms" paragraphs in `docs/standards/design-system.md`)
**Status:** draft — written 2026-10-09 from the user's request ("the gold standard for teams: cards, toolbars, dashboard, view, edit pages"). Mockup canvas (https://claude.ai/artifact/8rpBhNZBwJDwDoxxo5DoV3: Teams page desktop and phone, list view, team page desktop and phone, Edit team Details) **awaiting the user's review**; this text has not been reviewed.

## Problem & Goals

The Teams screens (`TeamList` per section, `TeamDirectory` club-wide, `TeamDetailPage`, `TeamFormPage`) predate the gold standard: a bare search and sort toolbar, no counters, no list view, no season control, a bento team page, and a form with six outer tabs.

- **A. Teams page** (`TeamList` and `TeamDirectory` share it): Season pill, counters (quick filters), `FilterBar` (Section, search), content line, Cards | List.
- **B. Team card:** logo, name, section and Active chips, Players and Matches figures, Captain / Manager / Coach rows, sponsors, footer links.
- **C. Team page:** poll-style header (Back, Season pill, filled **Edit team**), badges, ground and social links, a key-figure strip, Contacts and Sponsors cards of equal height, Squad card.
- **D. Edit / Add team form:** Details as one sectioned card (Basic info, Branding and social), Cancel; outer tabs reduced to Details, Contacts, Sponsors, Squad.

## Non-goals

No change to what a team, squad, contact or sponsor is, to permissions, or to the Contacts, Sponsors and Squad tab content (compact spacing only). No new team fields, no migration.

## User Stories

- As a manager, I see how many teams are active, how many players are in squads and which teams have no captain or an empty squad.
- As a manager, I switch Teams between Cards and List and the app remembers it.
- As a manager, I open a team and see its key figures, contacts, sponsors and squad for the chosen season.
- As a manager, I edit a team's basics, logo and social links on one screen.

## Teams page (A)

Mockup boards 1–3. Header "Teams" (section-scoped list keeps `Teams — <section path>` and its Back), `HeaderSeasonSelect` (no "All") beside it, **Add team** (filled). Counters (`PageCounters`): **Active teams** (quick filter), **Players in squads** (figure, chosen season), **Matches this week** (figure), **No captain** and **Empty squads** (amber quick filters, mutually exclusive, click again to clear). `FilterBar` with Section (club-wide list only) and search; content line "Showing N teams", sort link (Name), **Show inactive** switch (inactive hidden by default), Cards | List (`useListViewPreference('teamList:view')`). List: `TeamTable` (zebra, sticky header, whole row opens the team): Team, Section, Players, Matches, Captain ("No captain" amber), Status; phone: Team, Players, chevron.

## Team card (B)

Mockup boards 1–2, one `RecordCard`, whole card opens the team: logo tile, name, section chip and Active/Inactive chip; two figure tiles (Players, Matches); zebra rows Captain, Manager, Coach ("–" muted when empty); Sponsors row of logo tiles ("No sponsors"); footer Squad, Matches, Edit. Links keep `?from=section` when opened from the section list.

## Team page (C)

Mockup boards 4–5. Top row: Back, Season pill (squad and figures follow it), filled **Edit team**. Title row: logo (64 px), name, section and Active chips. Line: ground, social icons (`SocialLinksRow`). Key-figure strip (`KeyFigureTile`): Players in squad, Matches this season, Captain, Ground. Contacts and Sponsors `InfoCard`s (equal height), then the Squad `InfoCard` of `SquadPlayerTile`s (captain highlighted).

## Add / Edit team form (D)

Mockup board 6. Details becomes one card with `FormSectionHeading` sections **Basic info** (Name, Abbreviation, Ground; three columns, one on a phone) and **Branding and social** (logo upload, Facebook, Instagram, X); "(optional)" labels, no helper text; footer with Active switch (edit), **Cancel**, **Save changes** / **Create team**. Same fields, validation and payload. Branding and Social Media outer tabs are removed.

## API Contract

No endpoint change is required if the counters and filters are computed client-side from the data the cards already load (`useTeamCardData`). Open question below.

## UI Requirements

Composes existing pieces only. New: `TeamTable`, the page's counters hook, the team page header/strip, the sectioned form. `TeamList` and `TeamDirectory` share one `TeamsPage` body to avoid duplication. Update `docs/standards/design-system.md`, `frontend.md` (`teamList:view`) and `docs/roadmap.md`.

## Test Plan

Frontend unit: page (pill, counters as filters, Show inactive, toolbar, view switch and remembered preference, empty states), card, `TeamTable`, team page header and strip, form (sections, validation and payload unchanged), filled Edit. Storybook stories for the card and `TeamTable`. Existing tests adjusted, not weakened.

## Acceptance Criteria

- Both Teams lists show the pill, five counters, toolbar and cards or table; the view survives a reload.
- The team page matches the mockups; Edit is filled; Contacts and Sponsors cards are equal height.
- The form's Details is one sectioned card with an unchanged payload.
- No permission or data rule changes.

## Open Questions

- Are client-side counters acceptable, or should a `teams/summary` endpoint (as for leagues) be added? Client-side is simplest but only counts teams loaded.
- Does the Season pill change anything on the card (Players, Matches), or only the team page? Proposed: both.

## Rollout Notes

One branch, slices: (1) shared Teams page + card + table; (2) team page; (3) form. Migrations: none.
