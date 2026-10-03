# 070 — League Teams

**Depends on:** `029-league-management.md` (`League`, `Season`, `Match`, `LeagueAffiliation` and the `Match` side rules this spec rewrites the CHECK constraints of; the "club-owned `League` only" decision, unchanged), `050-league-schedule-and-fixtures.md` (`Match.homeTeamName`/`awayTeamName` free-text opponents, `homeTeamLogoUrl`/`awayTeamLogoUrl`, the "Teams" tab label, `LeagueFixtures`), `052-league-playing-conditions.md` (the nested `.../leagues/{leagueId}/seasons/{seasonId}/...` URL shape and the per-`(league, season)` scoping this spec follows), `055-league-season-config.md` (draft, read only — its explicit, admin-initiated, never-automatic copy-forward pattern; this spec differs in that the copy is server-side and cross-league, see Non-goals), `035-section-scoped-access.md` (`AccessService.resolveMatchSectionIds` and the section-scope rule that a free-text side contributes no section), `037-match-improvements.md`/`042-match-list-filters-and-search.md` (opponent-name search over `homeTeamName`/`awayTeamName`), `069-match-card-redesign.md` (the card consumes the denormalised names/logos unchanged).
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/7thJAiYfdMf9yKywejxeE5

## Problem & Goals

Today a match against another club's team is captured by typing the opponent's name by hand into `MatchForm` (`050`). Names drift ("Riverside CC", "Riverside", "riverside cc"), logos must be re-uploaded per match, and nothing ties the fixtures of one league together. A league has a fixed set of entrants each season, and the club admin already knows them: the right model is a small, per-league, per-season list of opponents the admin registers once and then picks from.

This spec adds that list, called a **league team**: a lightweight record (name, abbreviation, logo) registered for one league and one season. It is deliberately not a `Team` — no section, no squad, no players, no `LeagueAffiliation`. It exists so a match can pick an opponent instead of typing one. Free text stays as a fallback for friendlies and for every existing match.

**Goals**
- A club admin can register, edit, deactivate and remove league teams for a league and season, from the league's existing Teams tab.
- A club admin can copy league teams from any other league and season of the same club into the current one, by an explicit action with a checklist, never automatically.
- `MatchForm` offers, per side, three choices: **My team**, **League team** (club admins only), **Other** (free text). The League team picker lists the registered league teams for the match's league and season, plus the club's own affiliated teams grouped as "Our teams".
- A match stores a nullable reference to the chosen league team per side **and** still copies its name and logo into the existing name/logo columns, so the schedule PDF/ICS/poster, public pages, opponent search, the match card and every old match keep working unchanged.
- Renaming a league team (typo fix) fixes every match that references it.
- A league-team side is never treated as one of the club's teams anywhere: no playing XI, no polls, no section access.

## Non-goals

- **Standings, results, points tables.** Still `029`'s Phase 1 item; no results exist yet. League teams are the natural row set for a future standings table, but nothing here computes or stores one. Listed in `docs/roadmap.md` (see Rollout Notes).
- **Opponent rosters and players.** A league team has no squad, no player records, no availability. It cannot be selected for a playing XI (see "Must not change" below). Opponent players are a separate, much larger feature.
- **A cross-club or platform-wide opponent directory.** League teams are club-owned, per league and season. Two clubs that both play the same league each keep their own list. Sharing/deduplicating across clubs is deferred (roadmap).
- **A club-wide opponent list.** There is no "all opponents ever" screen or picker independent of league and season. The copy action is the only bridge between seasons and leagues.
- **Tidy-up or merge of historical free-text names.** No tool to turn free-text opponents on past matches into league teams, to merge duplicates, or to suggest names. The roadmap's existing item on autocomplete from historical free-text names (`042`) stays open and unaffected (roadmap).
- **No migration of existing free-text matches.** All existing matches stay exactly as they are (name set, `*LeagueTeamId` null). Confirmed by the user: the data is test data, start fresh.
- **Bulk CSV import** of league teams. One at a time, or via the copy action.
- **Automatic copy-forward.** Nothing is ever copied on creating a season or opening a tab. Copy is always an admin action with a checklist. This differs from `055`'s client-side form prefill because league teams are rows, not a form: the copy creates new rows only when the admin confirms.
- **Section-scoped or per-role access.** Club admin only, as league management is today. To be revisited when roles/permissions are built (see Open questions in Rollout Notes).
- **No change to `Team`, `LeagueAffiliation`, `MatchSide`/XI selection, polls or availability.** The club's own teams remain real `teamId` sides.
- **No uniqueness across seasons or leagues.** The same opponent legitimately exists as separate rows in many leagues and seasons; each row is independent (a copy is a new row, not a link).

## User Stories

- As a club admin on a league's Teams tab, I can add a league team for the selected season with a name, optional abbreviation and optional logo, so I register each entrant once.
- As a club admin, I can edit a league team's name, abbreviation, logo and active flag, and every match that uses it shows the corrected name and logo.
- As a club admin, I can remove a league team: if no match uses it it is deleted; if matches use it it is deactivated instead (and I am told which happened), so no fixture loses its opponent.
- As a club admin, I can reactivate a deactivated league team.
- As a club admin starting a new season, I can copy league teams from any other league and season of my club, untick the ones that left, and get new rows in the current league and season, with duplicates by name skipped.
- As a club admin creating or editing a match, I can set each side to My team, League team or Other (free text), so I pick opponents from a list instead of typing them.
- As a club admin, I can pick one of my own affiliated teams from the League team picker's "Our teams" group and it behaves exactly as My team does.
- As a club admin, I cannot give a match two sides that are the same league team, cannot pick an inactive league team for a new selection, and cannot pick a league team from a different league or season than the match's.
- As a club admin for club X, I cannot read or change club Y's league teams, even by guessing an id.

## Data Model Changes

Migration `backend/src/main/resources/db/changelog/v1/036-add-league-team.sql` (latest existing is `035-unify-availability-polls.sql`), registered in `db.changelog-master.xml`. Entities in `com.cricketlegend.domain`, Liquibase only, `ddl-auto=validate` (`docs/standards/backend.md`).

**New entity — `LeagueTeam`**, one row per `(league, season)` per opponent:

```
LeagueTeam {
    uuid       id
    uuid       league_id      -- FK league.id, not null
    uuid       season_id      -- FK season.id, not null
    string     name           -- not null
    string     abbreviation   -- nullable
    string     logo_url       -- nullable (MediaUpload "/media/..." URL, as Team.logoUrl)
    boolean    active         -- not null, default true
    timestamp  created_at
    timestamp  updated_at
    uuid       updated_by
}
```

No `club_id` column: the club is `league.club_id`, and the season must belong to the same club (`LeagueSeasonAccessValidation.assertLeagueBelongsToClub` / `assertSeasonBelongsToClub`, the same checks `LeaguePlayingConditionsServiceImpl` uses). A mismatch on either id reads as `NotFoundException` (404), per every prior cross-club precedent.

Unique by `lower(name)` within `(league_id, season_id)`, enforced by a unique index (inactive rows count, so a name cannot be re-registered beside a deactivated twin; reactivate instead). Service-layer check first with a clean message: `DuplicateLeagueTeamNameException extends ConflictException` (409), a new named subclass per `docs/standards/backend.md`. Names are trimmed and must be non-blank (`ValidationException`, 400). A league team's name is allowed to equal one of the club's own `Team` names; the two are separate entities and the picker shows them in separate groups.

**`Match` gains two nullable columns** (additive to `050`'s logo columns):

```
Match {
    ...
    uuid  home_league_team_id   -- nullable FK league_team.id
    uuid  away_league_team_id   -- nullable FK league_team.id
}
```

`homeTeamName`/`awayTeamName` and `homeTeamLogoUrl`/`awayTeamLogoUrl` remain and are **always populated** for a league-team side with the league team's name and logo at the time of save (the denormalised copy; the server writes it, a client-sent name or logo for a league-team side is ignored). Nothing that reads those columns changes.

**Side rule, rewritten.** Each side is exactly one of:
1. **Own team:** `*_team_id` set; `*_team_name` and `*_league_team_id` null (and no logo, as `050`).
2. **Named opponent:** `*_team_id` null; `*_team_name` set; `*_league_team_id` either null (free text) or set (league team).

A `*_league_team_id` is only ever allowed alongside a name. Migration:

```sql
-- backend/src/main/resources/db/changelog/v1/036-add-league-team.sql

CREATE TABLE league_team (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id     UUID NOT NULL REFERENCES league(id),
    season_id     UUID NOT NULL REFERENCES season(id),
    name          VARCHAR(255) NOT NULL,
    abbreviation  VARCHAR(16),
    logo_url      VARCHAR(1024),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID
);

CREATE UNIQUE INDEX ux_league_team_name ON league_team(league_id, season_id, lower(name));
CREATE INDEX ix_league_team_league_season ON league_team(league_id, season_id);

ALTER TABLE match ADD COLUMN home_league_team_id UUID REFERENCES league_team(id);
ALTER TABLE match ADD COLUMN away_league_team_id UUID REFERENCES league_team(id);
CREATE INDEX ix_match_home_league_team ON match(home_league_team_id);
CREATE INDEX ix_match_away_league_team ON match(away_league_team_id);

ALTER TABLE match DROP CONSTRAINT ck_match_home_side;
ALTER TABLE match DROP CONSTRAINT ck_match_away_side;
ALTER TABLE match ADD CONSTRAINT ck_match_home_side CHECK (
    (home_team_id IS NOT NULL AND home_team_name IS NULL AND home_league_team_id IS NULL)
    OR (home_team_id IS NULL AND home_team_name IS NOT NULL));
ALTER TABLE match ADD CONSTRAINT ck_match_away_side CHECK (
    (away_team_id IS NOT NULL AND away_team_name IS NULL AND away_league_team_id IS NULL)
    OR (away_team_id IS NULL AND away_team_name IS NOT NULL));
```

Every existing row already satisfies the new checks (exactly one of id/name, league-team ids null), so no data change is needed. The foreign keys carry no cascade: a referenced league team can only be removed by the service's deactivate-instead rule below, and the FK is the backstop.

**Service-layer rules for a league-team side** (all `MatchServiceImpl`, alongside `validateSides`, `validateLogoOnlyWithName` and `validateTeamReferences`):
- The league team must exist and belong to the acting club (via its league), else 404.
- The match must have a `leagueId`, and the league team's `league_id`/`season_id` must equal the match's `leagueId`/`seasonId`, else `ValidationException` (400). Editing a match's league or season while it holds a league-team side that no longer matches is therefore a 400 until the side is re-picked.
- A league team that is inactive may not be newly selected (400); a match that already references a now-inactive league team keeps it and may be saved unchanged (comparison against the stored reference).
- Home and away may not reference the same league team (400).
- `validateSides` changes from "exactly one of id/name" to the two-case rule above; `validateLogoOnlyWithName` is unchanged for free-text sides and is bypassed for league-team sides (the server sets the logo from the league team, which may legitimately be null).

**Propagation on edit.** When a league team's name or logo changes, a single bulk `UPDATE` rewrites `home_team_name`/`home_team_logo_url` on every match where `home_league_team_id` is the row, and the same for away, in the same transaction. A typo fix therefore fixes every referencing match. The repository query is custom and gets a Testcontainers test. `match.updated_at` is bumped. Deactivating a league team does not touch matches.

**Remove semantics.** One service method: if any match references the league team (home or away), it is deactivated (`active = false`) and the response says `DEACTIVATED`; otherwise the row is hard-deleted and the response says `DELETED`. Explicit reactivate exists for the deactivated case.

**Copy semantics.** Source may be any league and season of the same club (including the target league's other seasons, other leagues, or even the target league and season itself, which then skips every row as a duplicate). Copy creates new `league_team` rows with `name`, `abbreviation`, `logo_url` only, `active = true`, in the target league and season. Rows whose `lower(name)` already exists in the target are skipped and reported. The logo URL is copied by reference to the same stored file (no file duplication); deleting is never done to media files, so sharing is safe. Copy never touches matches and never runs without an explicit request listing the chosen source rows.

## API Contract

Nested under league and season, matching the `052` `playing-conditions` shape and the `029` `affiliations` access pattern. All paths are prefixed `/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/league-teams`, access `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` (club admin only for now; see Open questions). New `LeagueTeamController` / `LeagueTeamService` + `LeagueTeamServiceImpl` / `LeagueTeamRepository` / `LeagueTeamMapper` (MapStruct) / DTOs, following the one backend skeleton. Every service `list`/`get` is `@Transactional(readOnly = true)`, writes `@Transactional`. `404` if `leagueId` or `seasonId` is real but belongs to a different club.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET .../league-teams` | `canAdministerClub` | Lists the league's teams for that season (active and inactive, inactive rendered muted), sorted by name. Plain array, unpaginated: a league season's entrants are a small bounded set (same posture as `affiliations`). Optional `activeOnly=true` for the match picker |
| `POST .../league-teams` | same | Creates one. `{name, abbreviation?, logoUrl?}`. `400` blank name; `409` duplicate by `lower(name)` in this league+season. `201` |
| `PUT .../league-teams/{leagueTeamId}` | same | Updates `{name, abbreviation?, logoUrl?}`; propagates name/logo to referencing matches (see Data Model Changes). `404` if the row is not in this league+season; `409` duplicate name |
| `POST .../league-teams/{leagueTeamId}/deactivate` | same | `409` if already inactive (`InvalidStatusTransitionException`, as league/match). Matches untouched |
| `POST .../league-teams/{leagueTeamId}/reactivate` | same | `409` if already active |
| `POST .../league-teams/{leagueTeamId}/remove` | same | Hard-deletes if unreferenced, else deactivates. Response `{outcome: DELETED \| DEACTIVATED, leagueTeam}` (leagueTeam is null when DELETED). A `POST` action rather than `DELETE`, matching `unaffiliate`/`deactivate` precedent |
| `POST .../league-teams/copy` | same | Copy into this league+season. `{sourceLeagueId, sourceSeasonId, leagueTeamIds: UUID[]}` — the ids ticked in the checklist, each of which must belong to the named source league+season (`404`/`400` otherwise). `404` if the source league or season is another club's. Response `{created: LeagueTeamDto[], skipped: [{name, reason: "DUPLICATE_NAME"}]}`. All-or-nothing in one transaction. `400` if `leagueTeamIds` is empty. The checklist's rows come from the existing `GET` for the source league and season, so no separate "list sources" endpoint is needed |

**`LeagueTeamDto`:** `id, leagueId, seasonId, name, abbreviation, logoUrl, active, referencedByMatchCount`. `referencedByMatchCount` is computed for the list in one batched count query (no N+1) so the UI can say "used in 3 matches" and predict delete versus deactivate.

**Match endpoints (changes only; access unchanged, `canAccessClub` with the existing section scoping):**

| Endpoint | Change |
|---|---|
| `POST /api/v1/manage/clubs/{clubId}/matches` | `CreateMatchRequest` gains optional `homeLeagueTeamId`, `awayLeagueTeamId`. A side with a league-team id must send no `*TeamId`; its `*TeamName`/`*TeamLogoUrl` are ignored and overwritten from the league team. `400`/`404` per the service-layer rules above |
| `PUT .../matches/{matchId}` | `UpdateMatchRequest` gains the same two fields, same rules |
| `GET .../matches`, `GET .../matches/{matchId}` | `MatchDto` gains `homeLeagueTeamId`, `awayLeagueTeamId` (nullable). Name, logo and all other fields unchanged. The `069` list-batch fields are unaffected |

`openapi.yaml` is updated by hand (additions only: the new resource, the two request fields, the two DTO fields), per the project's standing process.

### Must not change: sites where `teamId == null` means "not one of the club's teams"

A league-team side has **no `teamId`**, so every one of these keeps treating it as an external opponent, with no code change and a regression test where one is named. This list is a review checklist, not work items:

- `AccessService.resolveMatchSectionIds` / `addOwnClubTeamSection` — a league-team side contributes no section (so `assertCanAdministerMatch` in `MatchServiceImpl`, `MatchSideServiceImpl` and `MatchAvailabilityPollServiceImpl` behaves as for free text).
- `MatchServiceImpl` — `resolveReachableTeamIds`, `resolveReachableSectionIds` (filter options), and the `teamId == null ? null : sideByKey.get(...)` side lookup used for announced/picked state (`069`).
- `MatchSideServiceImpl.createSide` — still requires `teamId` to equal the match's own `homeTeamId`/`awayTeamId`; a league-team side can never get a `MatchSide`/XI.
- `MatchAvailabilityPollServiceImpl` (open-poll listing and poll creation) and `MatchPollCoverageServiceImpl.sideName`/opponent resolution — opponent shown by `homeTeamName`/`awayTeamName`, which stay populated.
- `PublicAvailabilityPollServiceImpl` (`resolveTeamName`, the `teamId == null` branch) — uses the copied name.
- `SectionAvailabilityRoundServiceImpl` and `SectionAvailabilityFixtureGroupResolverImpl` (`addRowIfQualifies`, `teamId == null` branches, opponent-name argument) — fixture-group and round rows still resolve the opponent from `*TeamName`.
- `PlayerAvailabilityServiceImpl` (`sideName`, the `teamsById` lookup) — label "A v B" from the copied names.
- `MatchSpecifications` opponent-name search and team-filter predicates — search keeps matching on `homeTeamName`/`awayTeamName`; the team filter keeps matching only real team ids.

If a future change makes any of these league-team-aware, that is a spec change, not a quiet edit.

## UI Requirements

Composed from shared components only (`docs/standards/design-system.md` record list/create-edit pattern; gold-standard reference screens are the poll screens, `064`–`066`, and the `069` card). No new shared component is expected; a Claude Design pass is **required before build** for the Teams tab section, the Copy dialog and the `MatchForm` side selector, since all three are new visual patterns (`docs/workflow.md` Step 2).

**1. League Teams tab (`ui/src/pages/manage/LeagueFormPage.tsx`, the "Teams" tab from `050`).** The tab keeps its season `Select` (shared `selectedSeasonId` state, defaulted via `pickDefaultSeasonId`) and its existing grid of the club's own affiliated teams (`AffiliatedTeamCard`, "Add team" via `LinkExistingRecordDialog`), unchanged. Below it, a new section headed **League teams** for the selected season:
- A section action bar: **Add league team** (primary) and **Copy from another league/season** (secondary, real button). Not a text link.
- A `RecordCard` grid of the league's league teams, per the mandatory list pattern: avatar (the logo, `rounded`, initials of the abbreviation or name as fallback), title = name, badge **Inactive** (grey) when inactive, a field row (Abbreviation; "Used in N matches" when N > 0), footer buttons icon-over-caption as `069`/poll cards: **Edit**, **Deactivate**/**Reactivate**, **Remove**. Inactive cards render muted. Empty state when none, with a hint pointing at Add and Copy.
- **Add/Edit:** a form in a dialog (`RecordFormScreen` is for full screens; a three-field form is a dialog — the same shared form fields, `Input` and `MediaUpload variant="logo"`, copied from `TeamForm`'s logo usage). Fields: Name (required), Abbreviation (optional, short), Logo (optional). Server `409` duplicate is shown against the Name field. Editing shows an info line "Changes also update N matches that use this team" when `referencedByMatchCount > 0`.
- **Remove:** a confirm dialog whose text depends on `referencedByMatchCount`: "Delete {name}?" when 0, or "{name} is used in N matches, so it will be deactivated instead" when > 0. The result toast reports the actual `outcome`.
- **Copy dialog:** two `Select`s (source league, then source season, both over the club's `listLeagues`/`listSeasons`, defaulting to the most recent other season of this league when one exists), loading that source's league teams via the existing `GET`. A checklist (all ticked by default, with select all/none) showing name, abbreviation and logo per row; rows whose name already exists in the target are shown disabled with "Already in this season". Confirm button "Copy N teams" disabled at 0. Result toast "Copied 7, skipped 2 (already here)". Nothing is copied until Confirm; opening the dialog does not create anything. Phone: full-screen dialog, one column.

**2. `MatchForm` (`ui/src/components/MatchForm/MatchForm.tsx`)**, per side (Home/Away): the existing two-way toggle becomes a three-way `ToggleButtonGroup` (the **League team** button is shown only to club admins, since the list endpoint is club-admin only; others keep the two-way toggle): **My team** (the existing `Select` over the club's own teams, unchanged), **League team**, **Other** (the existing free-text `Input` + logo `MediaUpload` from `050`, unchanged).
- **League team** shows a grouped `Autocomplete`/`Select`: the group **Our teams** (the club's own teams affiliated to the match's league and season, via `LeagueAffiliation`), then the group **League teams** (active league teams for the match's league and season, sorted by name, each with its logo avatar and abbreviation). Choosing an "Our teams" entry sets that side exactly as My team does (`teamId`), so the three toggle choices stay consistent: the picker switches the toggle's visible state to My team. Choosing a league team sets `*LeagueTeamId` and clears `*TeamId`/free text/uploaded logo. The server then supplies the name and logo, so the form sends only the id.
- The picker needs a league and season: with none chosen the League team option is disabled with helper text "Choose a league and season first". Changing the league or season clears any league-team side and shows a snackbar saying so (the server would 400 otherwise).
- When the list is empty, a helper "No league teams registered for this league and season" with a button linking to the league's Teams tab.
- Switching a side away from League team clears `*LeagueTeamId`. `MatchPayload` (`ui/src/api/matchApi.ts`) gains `homeLeagueTeamId?`/`awayLeagueTeamId?`; `Match` gains the same.
- Editing an existing free-text match keeps its side on **Other**; it is not auto-matched to a league team. Editing a match that has an inactive league team shows it selected, with an "Inactive" suffix.

**3. New `ui/src/api/leagueTeamApi.ts`** (one file per resource, `docs/standards/frontend.md`): `listLeagueTeams(clubId, leagueId, seasonId, {activeOnly?})`, `createLeagueTeam`, `updateLeagueTeam`, `deactivateLeagueTeam`, `reactivateLeagueTeam`, `removeLeagueTeam`, `copyLeagueTeams`. React Query keys under `['managed-club', clubId, 'leagues', leagueId, 'seasons', seasonId, 'league-teams']`; create/update/remove/copy invalidate that key, and update also invalidates the matches list keys (names propagate).

**4. Display elsewhere:** nothing changes. Cards, fixtures list, PDF/ICS/poster, public pages and search keep reading the copied name and logo columns. `LeagueFixtures` (`050`) may show the league team's logo already through `*TeamLogoUrl`.

Mobile-first (375px first): the Teams section stacks with the action buttons wrapping full-width; the `MatchForm` three-way toggle uses short captions ("My team", "League", "Other") and the picker is full-width; the Copy checklist rows are a single column with no horizontal scroll.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit (backend) | `LeagueTeamServiceImplTest` — create (trim, blank name 400, duplicate by `lower(name)` 409 including against an inactive row), update with propagation call asserted, deactivate/reactivate `409`s, remove deletes when `referencedByMatchCount == 0` and deactivates when referenced (both home-side and away-side references), copy (skips duplicates and reports them, ignores ids not in the stated source, empty ids 400, source from another club 404, same league+season source skips all, new rows carry only name/abbreviation/logo and are active), cross-club 404 for `leagueId`/`seasonId`/`leagueTeamId`. `MatchServiceImplTest` — side rule: own team, free text, league team accepted; league-team id with a team id rejected; league team without a league on the match rejected; league team from another league or season rejected; same league team on both sides rejected; inactive league team rejected on new selection but an unchanged existing reference saves; name/logo overwritten from the league team and a client-sent name ignored; free-text and own-team behaviour (including `050`'s logo rule) unchanged; changing the match's league or season with a league-team side that no longer matches is 400 |
| Regression (backend, unit) | For the "Must not change" list: a match with a league-team side (no `teamId`) resolves no section in `AccessService.resolveMatchSectionIds`, is excluded from `resolveReachableTeamIds`/section options, is rejected by `MatchSideServiceImpl.createSide`, gets no poll for that side, and yields the right opponent name in the availability/fixture-group/public-poll/coverage paths |
| Integration | Testcontainers: migration `036` applies cleanly over existing data (existing matches untouched and satisfying the rewritten CHECKs); the new unique index on `(league_id, season_id, lower(name))` enforced at the DB level; the rewritten `ck_match_home_side`/`ck_match_away_side` reject a league-team id with a team id, a league-team id with no name, a team id with a name, and neither; accept own team, free text, and named league team; FK prevents deleting a referenced league team; the bulk propagation `UPDATE` query rewrites name/logo for home and away references only for the right league team and no other matches; the batched `referencedByMatchCount` query; controller integration tests for every endpoint (real `CLUB_ADMIN` success, another club's admin 403/404, `platform_admin` superset, `409`/`400`/`404` cases, copy result shape), and `POST`/`PUT .../matches` with league-team sides through real HTTP. Service tests that exercise lazy mapping run without an ambient test transaction (`docs/standards/backend.md`) |
| Contract | New endpoints, `LeagueTeamDto`, request/response DTOs, `CreateMatchRequest`/`UpdateMatchRequest`/`MatchDto` additions in the checked-in `openapi.yaml` (additions only, no breaking change) |
| Component (Vitest/RTL) | Teams tab: league-team section renders cards, inactive muted with badge, empty state; Add/Edit dialog validation and duplicate-name error; Remove confirm text for referenced vs unreferenced and outcome toast; Copy dialog (source selects, checklist all ticked, duplicates disabled, confirm disabled at 0, nothing sent until Confirm, result toast); `MatchForm`: three-way toggle per side, League team picker groups "Our teams" and "League teams", disabled with no league/season, empty-list helper, choosing "Our teams" behaves as My team, choosing a league team sets only the id, changing league/season clears a league-team side, free-text and own-team paths unchanged, existing `050` logo-upload tests still pass; `leagueTeamApi` query invalidation |
| Browser check | Phone, two-column and wide: Teams section, Copy dialog and `MatchForm` selector have no horizontal scroll or clipped buttons |
| End-to-end | None new (extends the existing, not-in-CI create-match path, as prior `/manage` specs) |

## Acceptance Criteria

- A club admin can add, edit, deactivate, reactivate and remove league teams for a league and season, and cannot create two with the same name (case-insensitive) in the same league and season.
- Removing a league team that matches use deactivates it and says so; removing an unreferenced one deletes it.
- A club admin can copy league teams from any other league and season of the same club through a checklist; unticked teams are not copied, duplicates by name are skipped and reported, new independent rows are created with name, abbreviation and logo only, and nothing is ever copied automatically.
- In `MatchForm`, each side offers My team, League team and Other; the League team picker lists the registered league teams for the match's league and season plus the club's affiliated teams under "Our teams", and free text still works.
- A match with a league-team side stores the reference and the copied name and logo; the match card, schedule PDF/ICS/poster, public pages and opponent search show the opponent with no change to those features.
- Renaming or changing the logo of a league team updates every match that references it.
- A league-team side never appears as one of the club's teams: no playing XI, no poll, no section grants, and no new section or team filter option.
- A match cannot reference a league team from another league, season or club, the same league team on both sides, or a league team without a league on the match.
- Existing matches, including free-text ones, are unchanged and still editable.
- A club admin for another club cannot read or change this club's league teams.

## Rollout Notes

- **Backend first, then UI.** PR order: (1) migration `036`, `LeagueTeam` entity/service/controller/DTOs, match columns, the rewritten CHECKs, `MatchServiceImpl` side validation and propagation, `openapi.yaml`, with the regression tests for the "Must not change" sites; (2) UI: `leagueTeamApi.ts`, Teams-tab section and dialogs, `MatchForm` selector. Because the old UI still sends only names/ids, the backend PR is safe to ship alone.
- **Design pass first** (`docs/workflow.md` Step 2) for the Teams-tab section, Copy dialog and the `MatchForm` three-way side selector, then this spec moves to approved.
- **`docs/roadmap.md`** (living index; to be updated when this spec is approved/merged, not by this draft): add under the League/Match items — standings and results built on league teams (blocked on results, `029` Phase 1); a cross-club or platform-wide opponent directory and sharing league teams between clubs; tidy-up/merge of historical free-text opponent names (and note the existing "autocomplete from historical free-text opponent names" item is now partly superseded for league matches but still open for friendlies); opponent rosters/players; per-role access for league teams once roles/permissions are built; bulk CSV import.
- **`docs/architecture.md`**: the Mermaid data model gains `LeagueTeam` (League 1..n LeagueTeam, Season 1..n LeagueTeam, Match 0..2 -> LeagueTeam) if that diagram shows Match/League relationships; update it alongside the build PR. The diagram's `Team` relationships do not change.
- **Denormalisation is deliberate.** Name and logo are copied onto the match so every existing consumer keeps working unchanged. The one invariant to keep is that a league-team side's name and logo equal the league team's, maintained by the save-time overwrite and the propagation on edit; if any other write path to those columns is ever added it must preserve this.
- **No data migration** of existing free-text matches, confirmed by the user (test data only).
- **Decisions recorded (user, resolved):**
  1. **Access: club admin only, including the list `GET`.** No section-scoped read exception. `MatchForm` therefore shows the **League team** option only to club admins; anyone else sees My team and Other, exactly as today. Revisit when roles/permissions are built (loosening is a `@PreAuthorize` change on a few endpoints plus dropping the UI gate; no data-model or screen change).
  2. **My team and "Our teams" both stay.** A side can be set either way; the two are equivalent.
  3. **Re-adding a removed name:** the duplicate check counts inactive rows, so the admin is told to reactivate the existing row (no replacement of inactive rows).
