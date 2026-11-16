# 155: Playoff and knockout fixtures in the league schedule

**Depends on:** `029-league-management.md` and `050-league-schedule-and-fixtures.md` (league matches), `070-league-teams.md` (league teams), `097-league-schedule-import.md` and the import-must-confirm rule (`feedback_import_always_confirm`), `111-league-season-dates.md`, `151-server-test-round-one.md` slice I (the No Field tag), `153-printable-team-sheet.md` (the team sheet), `150-managers-and-access-grants.md` (permissions), `docs/standards/page-anatomy.md`.
**Status:** built 2026-11-15, awaiting the owner's review (2026-11-16), then tests, merge and deploy. Requested by the owner: a tournament has a playoff date for each pair of finishing positions (1 v 2, 3 v 4 and so on), other tournaments have quarter-finals, semi-finals and a final on set dates, and the system has no way to create them. Mockup: `docs/mockups/playoff-fixtures-mockup.html`. Decided by the owner 2026-11-15 are marked **Decided**.

## Problem & Goals
Today a match needs both sides to be a real team or a typed name (`CreateMatchRequest`: exactly one of `homeTeamId`/`homeTeamName`, one of `awayTeamId`/`awayTeamName`), and has no notion of a stage. A playoff whose opponents are not known until the pool ends can only be faked with a typed "TBC", which the schedule cannot tell from a pool game, the results import tries to match to a team, and nothing resolves later.

**Goals**
- A match can carry a **stage** (Playoff, Semi-final, Final and so on) and a **label** ("1st v 2nd"). **Decided:** the stage is free text with a general list to pick from.
- A side can be a **placeholder** ("1st in the pool", "Winner of semi-final 1", "Position 3") instead of a team, shown as TBC, and **resolved by hand** to the real team once known. **Decided.**
- Playoff games are created for **all** teams in the league, not only ours (the schedule already holds other clubs' matches). **Decided.**
- An **Add Playoff Games** action creates a whole round at once (pairings, date, time, field), behind a confirm step.
- The league log and standings (when built) count pool matches only.

## Non-goals
- Resolving placeholders automatically from the league log (later; the owner chose by hand first).
- Seeding or bracket diagrams, tie-break rules, or advancing a winner automatically.
- Changing how results are scored or imported beyond ignoring placeholder sides.

## Data and API
Migration `070-match-stage-and-placeholders.sql` (never edit an applied migration):
- `match.stage VARCHAR(60)` nullable. **null means a pool match.** Free text (**Decided**), trimmed, max 60.
- `match.stage_label VARCHAR(80)` nullable ("1st v 2nd", "Position 3 v 4").
- `match.home_placeholder BOOLEAN NOT NULL DEFAULT false` and `match.away_placeholder BOOLEAN NOT NULL DEFAULT false`. A placeholder side keeps its text in the existing `home_team_name`/`away_team_name` and has no team id, league team id or logo.

Backend (`Match` entity, `MatchDto`, `CreateMatchRequest`, `UpdateMatchRequest`, `MatchServiceImpl`): the new fields are carried at the END of each record. Rules: a placeholder side needs a non-blank name and rejects a team id, league team id or logo (400); setting a real team on that side in an edit clears the flag (the resolve step); a placeholder match cannot have a result captured until both sides are real (409 with a clear message); Team Selection and availability polls for our own real side stay allowed, since picking our XI does not depend on the opponent; there is no league log or standings table yet, so nothing to filter today, and when one is built it counts `stage IS NULL` only. `openapi.yaml` updated by hand.

**New endpoint:** `POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playoffs/preview` and `.../playoffs` (confirm): body `{ stage, games: [{ stage (optional, overrides the round's), label, homeSide, awaySide, matchDate, venue, playingAreaId }] }` where a side is `{ placeholder: "1st in the pool" }` or `{ leagueTeamId }` / `{ teamId }`. Preview validates and echoes what would be created; the confirm call creates it in one transaction (server-enforced confirm, as for imports). Permission `MATCHES_EDIT` and `LEAGUES_EDIT`.

**Stage suggestions** (a shared list in the UI, `ui/src/utils/matchStages.ts`; any other text is allowed): Playoff, Quarter-final, Semi-final, Third place, Final.

## UI Requirements (page-anatomy.md applies)
- **Match form** (`MatchForm`): a **Stage** field (a free-solo combo with the suggestion list, empty means pool) and a **Label** field; each side gets a **TBC** option beside Team and League team that takes the placeholder text. Resolving later is the normal Edit Match.
- **League Schedule** (`LeagueFixturesTable`, `MatchTable`, `MatchCard`): a **stage chip** (outlined, the stage name) beside the Our match and No Field chips; a placeholder side is shown italic as "TBC: 1st in the pool" with no logo; sorted by date as now. A **Stage** filter beside the existing ones (All, Pool, and each stage in use).
- **Manage Schedule menu:** **Add Playoff Games** (after Import Schedule). It opens a dialog: Stage (the combo), then a table of games, each with Label, Home, Away, Date, Time and Field; a **Add Pairing** button; a preset button **1v2, 3v4...** that fills pairings by finishing position for the league's team count, and **Semi-finals and final** that fills two semi-finals and a final. Step 2 is a confirm summary ("Create 4 playoff games?") with the list; only Confirm writes.
- **Log and standings:** unchanged screens, pool matches only; a small note "Playoff games are not counted" when the league has any.
- **Team sheet (153):** a match with a stage prints it as a line under the date (for example "SEMI-FINAL"); a placeholder opposition prints its TBC text, or the Blank match option still applies.
- Shared compact `Button`, one filled button per dialog, Title Case labels, no em dashes.

## Test Plan
Backend: service tests for the placeholder rules (name required, no team id or logo, resolve clears the flag), the placeholder match refusing result capture, stage trimming and length, the preview and confirm endpoints (validation, one transaction, permissions), the migration. Frontend: MatchForm stage and TBC fields, the stage chip and italic TBC side, the Stage filter, Add Playoff Games (presets fill the table, confirm summary, nothing written before Confirm), the team sheet stage line. `LinkedAccountCannotReachManagerSurfaceIntegrationTest` stays green with the new yaml.

## Acceptance Criteria
I can add the VCASA playoff day as four games with placeholder sides, see them in the league schedule marked Playoff with TBC opponents, later edit each to pick the real teams, and nothing else about them changes pool matches. For another tournament I can create two semi-finals and a final on set dates.

## Rollout Notes
One migration (nullable columns, default false flags), backend then UI image. Existing matches are pool matches (stage null). Open items for later: auto-resolving sides from the league log, a bracket view, and a per-club saved list of stage names.

## Built 2026-11-15: where things are
Backend: migration `070-match-stage-and-placeholders.sql`; `Match`, `MatchDto`, `CreateMatchRequest`/`UpdateMatchRequest` (stage, stageLabel, homePlaceholder, awayPlaceholder, appended; the older constructors stay for existing callers); placeholder rules in `MatchServiceImpl`; result capture refused for a TBC side in `ResultServiceImpl.assertCapturable`; `PlayoffController` / `PlayoffService` (preview rolls the transaction back, so it validates exactly as create would and writes nothing) reusing `MatchService.createBatch`. UI: `api/playoffApi.ts`, `utils/matchStages.ts`, `components/PlayoffGamesDialog`, stage and TBC in `MatchForm`/`MatchSideFields`, the stage chip and italic TBC sides in `LeagueFixturesTable` and the Matches list (`StageChip`), a Stage filter on the league schedule, "Add Playoff Games" in the Manage Schedule menu, and the stage line on the Poster team sheet.
Not built: acknowledging scheduling warnings from the Add Playoff Games dialog (a warning 409 shows as a message; the manager adjusts the game), the Stage filter on the Matches list, and any league log (none exists yet).

