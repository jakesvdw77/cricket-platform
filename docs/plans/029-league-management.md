# Plan: 029 — League Management & Match-Day Squad Selection

## Context

Spec `029-league-management.md` is approved and a design pass for `PlayingXiBuilder` (and, informally, the `TeamFormPage` Squad tab) is done. Before writing this plan, the user raised a real gap in the approved spec: `TeamSquadMember` as written is a **standing** roster (`team_id` + `player_profile_id`, no time dimension) — nothing ever forces it to change, so a junior team's squad from last year silently carries into a new season even after players age out of that division.

**Decision (confirmed with the user via AskUserQuestion): make squad membership season-scoped now**, before backend/frontend build starts, rather than shipping the standing model and retrofitting it later. This is a genuine amendment to spec `029` — not a build detail — so it's called out explicitly below rather than silently folded into the implementation, per `CLAUDE.md` principle 7 and `docs/workflow.md` step 5's own instruction to flag spec/reality gaps rather than quietly reinterpret them.

**Net effect of the amendment, in one line:** `TeamSquadMember` gains a required `season_id`; `Match.season_id` becomes required (was nullable) so every `MatchSide` has an unambiguous season to validate squad membership and age eligibility against. Everything else in spec `029` (`League`, `LeagueAffiliation`, `Match`'s team-or-free-text sides, `MatchSide`/`MatchSidePlayer`, all API shapes not listed as changed below) stands as written.

## Spec Amendment — apply to `docs/specs/029-league-management.md` before/alongside build

This is a real amendment to a fixed spec, not a build-time interpretation — do this edit first (a direct, targeted patch to the existing spec sections, not a full spec-author re-run), so the spec and code never diverge:

1. **`TeamSquadMember`** — add `uuid season_id` (FK `season.id`, not null). Unique constraint changes from `(team_id, player_profile_id)` to `(team_id, season_id, player_profile_id)`. Add an index on `season_id` (matching `LeagueAffiliation`'s three-index precedent: `team_id`, `season_id`, `player_profile_id` each indexed). Validation at add-time is unchanged (club-membership/active check) — season is just an added scoping dimension, not a new eligibility rule.
2. **`Match.season_id`** — becomes **not null** (was nullable). `League` stays optional on `Match` — a standalone friendly still needs no league, it just needs a season (which the club creates once per year/period regardless, per the spec's own Season user story). This also **simplifies** the age-eligibility cutoff-date rule in the spec's Data Model Changes section: the "`Match` has an age-restricted `League` but no `season_id` and no `League.ageCutoffDate`" rejection case (current spec text, the second bullet under "Age eligibility") becomes unreachable and should be deleted — `season.start_date` is now always available as the fallback cutoff date.
3. **Team squad API** — re-nest under season, since "which team's squad" is now always "which team's squad *for which season*":
   - `GET /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad` (was `.../teams/{teamId}/squad`)
   - `POST .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add`
   - `POST .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove`
   - `404` if `seasonId` doesn't belong to `clubId` (same isolation posture as every other nested id in this spec).
4. **`MatchSide` squad-membership check** — "must already be a member of that `team_id`'s squad" becomes "...member of that `team_id`'s squad **for the `Match`'s own `season_id`**."
5. **`MatchForm` UI Requirements** — the "optional `League`/`Season` `Select` pair" becomes: `Season` required, `League` optional (independent — a league-less friendly still needs a season).
6. **`TeamFormPage` Squad tab UI Requirements** — add a `Season` `Select` above the squad `RecordCard` grid, populated from `listSeasons(clubId)`, defaulting to whichever season's date range contains today (else the most recently created season). Everything else about the tab (RecordCard grid, `LinkExistingRecordDialog<PlayerDto>`, remove action) is unchanged from the existing spec text — this is one added control, not a redesign.
7. **Rollout Notes** — add: "Squad membership is season-scoped (`TeamSquadMember.season_id`) rather than a standing roster, so a team's squad must be (re)built each season — a deliberate amendment made before this spec's own build started, catching the case where a junior team's roster would otherwise silently carry over players who've aged out. **Copying a squad forward from a prior season is explicitly deferred** (not built in Phase 0) — the first season built under this spec has nothing to copy from anyway; a `POST .../squad/copy-from/{seasonId}` convenience is a natural fast-follow once a club has more than one season's worth of squads."

**Design artifact follow-up (small, targeted — not a redesign):** the already-published "Team Squad Tab" canvas needs one added control (a `Season` select above the grid) to match item 6 above. Do this right after the plan is approved, before `frontend-builder` starts on `TeamFormPage`.

## Data Model / Migration

Single migration, `backend/src/main/resources/db/changelog/v1/021-add-league-management.sql`, exactly as spec'd in `029`'s own Migration section **except**:
- `team_squad_member` gains `season_id UUID NOT NULL REFERENCES season(id)`, unique constraint becomes `(team_id, season_id, player_profile_id)`, add `CREATE INDEX ix_team_squad_member_season ON team_squad_member(season_id)`.
- `match.season_id` becomes `UUID NOT NULL REFERENCES season(id)` (drop the nullable version in the spec's current SQL block).

Order of table creation unchanged: `league`, `season`, `league_affiliation`, `team_squad_member`, `match`, `match_side`, `match_side_player` (squad and match tables both depend on `season`, so `season` must precede both — already true in the spec's ordering).

## Backend — `backend-builder`, in this order

Standard skeleton per `docs/standards/backend.md` throughout: flat `domain`/`dto`/`repository`/`service`+`service.impl`/`mapper`/`controller` packages, constructor injection, MapStruct mappers, `@Transactional`/`@Transactional(readOnly = true)` on every service method touching a lazy collection, specific exception subclasses (not raw `ValidationException`) for each named business rule.

1. **Migration** — `021-add-league-management.sql` as amended above.
2. **`League`** — domain, `LeagueDto`, `CreateLeagueRequest`/`UpdateLeagueRequest`, `LeagueRepository`, `LeagueMapper`, `LeagueService`/`LeagueServiceImpl` (create/update with `minAge<=maxAge` validation, deactivate/reactivate with `409`s), `LeagueController`.
3. **`Season`** — same shape: domain/dto/repository/mapper/service+impl (`startDate<=endDate` validation)/controller.
4. **`LeagueAffiliation`** — domain/dto/repository/mapper/service+impl (create with same-club-consistency check across `league`/`team`/`season`, triple-uniqueness `409`, unaffiliate)/controller nested under `leagues/{leagueId}/affiliations`.
5. **`TeamSquadMember`** (season-scoped per the amendment) — domain (`team_id`, `season_id`, `player_profile_id`), `TeamSquadService`/`TeamSquadServiceImpl` (add: club-match + active-membership validation, already-in-squad `409`; remove: hard delete), reuses `028`'s existing `PlayerDto` — no new DTO — controller nested `teams/{teamId}/seasons/{seasonId}/squad`.
   - New exception: `PlayerNotActiveClubMemberException extends ValidationException` (`400`) — named per the spec's own parenthetical in the Team Squad API table.
6. **`Match`** — domain (`club_id` always the acting club per the spec's explicit derivation rule, never `home_team_id`'s own club), `MatchDto`, `CreateMatchRequest`/`UpdateMatchRequest`, exactly-one-of-team-or-name-per-side validation (service-layer `ValidationException` ahead of the DB `CHECK` constraints), `MatchRepository` (paginated `findByClubId(..., Pageable)`), `MatchMapper`, `MatchService`/`MatchServiceImpl`, `MatchController` (`GET` list is the first `Pageable` endpoint in this feature area).
7. **`MatchSide`/`MatchSidePlayer`** — domain for both, `MatchSideDto`/`MatchSidePlayerDto`, `MatchSideRepository`/`MatchSidePlayerRepository`, `MatchSideMapper`, `MatchSideService`/`MatchSideServiceImpl` implementing, in order:
   - side creation restricted to the match's own two team ids, `409` if a side for that team already exists;
   - squad-membership check against `TeamSquadMember` for `(team_id, match.season_id, player_id)` → `PlayerNotInSquadException extends ValidationException`;
   - cap check (`league.maxPlayingXiSize` or `11`) → `PlayingXiCapExceededException extends ValidationException`;
   - age-eligibility check (cutoff date = `league.ageCutoffDate` else `season.startDate`, always resolvable now) → `PlayerAgeIneligibleException extends ValidationException`, both the missing-DOB and out-of-range messages;
   - captain/keeper-must-be-in-XI, twelfth-man-must-not-be-in-XI validations;
   - add/remove/reorder/role-update endpoints, remove also clears `captainPlayerId`/`wicketKeeperPlayerId` if they pointed at the removed player;
   - `MatchSideController`.
8. **OpenAPI schema** — regenerate/update the checked-in schema for every new endpoint + DTO (contract-diff gate in CI).

Every `@Service` method with a business rule gets its unit test in the same commit (`docs/standards/backend.md`'s non-negotiable) — `test-writer` fills gaps afterward per step below, but builder agents aren't exempt from this baseline.

## Frontend — `frontend-builder`, after backend endpoints exist

1. **API files** (one per resource, thin axios wrappers): `leagueApi.ts`, `seasonApi.ts`, `leagueAffiliationApi.ts`, `teamSquadApi.ts` (now takes `seasonId`), `matchApi.ts`, `matchSideApi.ts`.
2. **`PlayingXiBuilder`** (`ui/src/components/PlayingXiBuilder/`, four-file anatomy) per the spec's UI Requirements — built from the already-published design artifact. Data-and-callback props only, no direct API calls inside the component.
3. **`LeagueForm`/`LeagueList`/`LeagueFormPage`** (Affiliations tab: season `Select` + `RecordCard` grid + `LinkExistingRecordDialog<TeamDto>`).
4. **`SeasonForm`/`SeasonList`/`SeasonFormPage`** — no tabs.
5. **`MatchForm`** (four-file anatomy) — `Season` required `Select`, `League` optional `Select`, per-side team/free-text toggle restricted to the club's own teams.
6. **`MatchFormPage`** — Details tab + Playing XI tab(s) per real-`Team` side, sourcing `listSquad(clubId, teamId, match.seasonId)`.
7. **`ManageFixturesHome`** (hub-of-cards, composed from existing `Card`) and **`MatchList`** (paginated `useQuery`, `ListToolbar` + `RecordCard`).
8. **`SquadPicker`** — reuses `MatchList`'s paginated data, cards route into `MatchFormPage`'s Playing XI tab.
9. **`TeamFormPage`** — add the **Squad** tab (edit mode only): `Season` `Select` (default = current-by-date season) → `RecordCard` grid of `listSquad(clubId, teamId, seasonId)` → `LinkExistingRecordDialog<PlayerDto>` add flow → remove action per card. Match the already-published "Team Squad Tab" design (plus its season-selector follow-up edit).
10. **`App.tsx`** routing** — wire `fixtures`/`squads` routes to real components, add the new nested routes under `/manage/fixtures`.

## Tests — `test-writer`, after both slices build and pass locally

Compare against the spec's Test Plan table (already comprehensive) plus the amendment's own new cases:
- `TeamSquadServiceImplTest` — add season-isolation cases: a player addable to squad for season A and independently for season B; removing from season A's squad doesn't affect season B's row.
- `MatchSideServiceImplTest` — add a season-mismatch case (player in squad for a different season than the match's own `season_id` → `PlayerNotInSquadException`).
- Everything else per the spec's existing Unit/Integration/Contract/Component/E2E rows, unchanged.

## Flags for your review

- **This plan amends spec `029` before build** (season-scoped `TeamSquadMember`, required `Match.season_id`) per the user's explicit decision this session — the spec file itself needs the direct patch described above; recommend doing that edit as the very first action once this plan is approved, before `backend-builder` touches `TeamSquadMember`/`Match`.
- **"Copy squad forward from a prior season" is deferred**, not built in Phase 0 — flagged in Rollout Notes as the natural fast-follow. Worth confirming this is acceptable given the deadline (there's nothing to copy from yet this weekend regardless).
- **`docs/specs/001-tenancy-identity-model.md`'s ADR-02 amendment note and `docs/roadmap.md` update** are still owed per spec `029`'s own existing Rollout Notes (unrelated to this session's season-scoping decision) — not part of this plan's build scope, but shouldn't be forgotten once this ships.

## Verification

- `cd backend && ./mvnw test` — full unit + Testcontainers integration suite, including the new season-isolation/season-mismatch cases above.
- `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` + OpenAPI contract-diff check.
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test (`docs/workflow.md` step 8): create a season, create a league (with age restrictions), affiliate a team, build that team's squad *for that season*, create a match with that league/season, build the home side's playing XI, confirm the cap and age-ineligibility rejections fire, confirm a player in a *different* season's squad is correctly rejected from this match's side.
