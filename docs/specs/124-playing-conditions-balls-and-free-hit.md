# 124: Playing conditions: balls per over limit and free hit

**Status:** approved by the owner's request (2026-10-28); small addition to `052-league-playing-conditions.md`.
**Depends on:** `052-league-playing-conditions.md`, `122-league-sharing.md`, `123-player-hub-leagues.md`.

## Problem & Goals
Junior leagues cap the balls in an over: after the cap the over is done, however many wides and no balls were bowled (for example 8 balls). Some leagues do not give a free hit after a no ball. Managers need to record both in the playing conditions, and players and parents need to read them.

## Non-goals
Scoring or enforcing the rules (the platform does not do ball-by-ball scoring). Per-match overrides. Changing how wides and no balls are charged.

## User Stories
- As a league manager, I switch on a limit of balls per over and set the number, so juniors' playing conditions say "an over ends after 8 balls, wides and no balls included".
- As a league manager, I turn off the free hit after a no ball for leagues that do not use it.
- As a parent or player, I see both rules on the Playing conditions tab in the Player Hub.

## Data Model Changes
`league_playing_conditions` (new migration, next free number after 056):
- `max_balls_per_over` integer null (null = no limit), check 1 to 20 when set.
- `free_hit_on_no_ball` boolean not null default true.
Existing rows get no limit and free hit on. Copying a league's conditions between leagues and seasons (`LeagueCopyRules`) copies both fields.

## API Contract
Additive only: `maxBallsPerOver` (integer or null) and `freeHitOnNoBall` (boolean, default true when omitted on update) on `LeaguePlayingConditionsDto` and `UpdateLeaguePlayingConditionsRequest`; the same two fields on `MyPlayingConditionsDto` for the Player Hub (spec 123). `openapi.yaml` hand-edited, additions only. Validation: `maxBallsPerOver` between 1 and 20 or null.

## UI Requirements
- **Manager form (`PlayingConditionsForm`):** a switch "Limit balls per over" with a number field "Maximum balls per over" shown when on (helper text: "The over ends after this many balls, wides and no balls included."); off clears the number. A switch "Free hit after a no ball", on by default.
- **Read views:** `PlayingConditionsSummary`, `LeagueConditionsView`: "Balls per over: no limit / at most 8, wides and no balls included" and "Free hit after a no ball: Yes / No".
- **Player Hub (`HubLeagueConditions`):** the same two rows, shown as fact tiles with the other conditions.
- **Sharing (`122`):** the PDF, WhatsApp and Facebook text for Playing conditions include both lines (via `utils/playingConditions.ts` and the league share builders), so nothing is added in one place only.
- Compact switches and fields, UK spelling, no em dashes.

## Test Plan
Written once at the end of the whole leagues work: migration default, DTO round trip and validation (0 and 21 rejected, null allowed), copy rules, form behaviour (switch shows and clears the number, free hit default on), the summary and Hub tiles, and the share text lines.

## Acceptance Criteria
1. A manager can set a limit of balls per over and turn off the free hit, and both are saved per league and season.
2. Existing conditions show "no limit" and "free hit: Yes".
3. The Hub Playing conditions tab and every share format show both rules.

## Rollout Notes
Migration adds two columns with safe defaults. No data fix needed.

## Decisions
- The owner wrote "max overs"; this is the maximum **balls per over** (the example is 8 balls). The limit is off by default, and the number field starts empty when switched on.
