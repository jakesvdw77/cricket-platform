# 118: Result Review Fixes (squad auto-add, drop the lineup-size warning, clipped Standouts card, Preview button placement, edit match date and time from the result flow)

**Depends on:** `101-match-results-our-side-scorecard.md` (the validation table, `ScorecardRules`, the Teams and Review steps), `102-match-results-opposition-scorecard.md` (reconciliation codes), `104-match-results-import-adaptors.md` (the import wizard's Teams and Match steps), `113-result-players-section-and-age.md` (eligibility; `PLAYER_NOT_IN_SQUAD` stays a warning), `111-league-season-dates.md` (`LeagueSeasonDates.assertWithin`, the `MATCH_OUTSIDE_LEAGUE_DATES` error), `029-league-management.md` (the team season squad endpoint) and `035-section-scoped-access.md` (section scope on it), `100-match-results-core.md` (the result page), `docs/standards/*.md`.
**Status:** draft (2026-10-22). Written from the owner's first hand test of an import on 2026-10-22. Amends `101`/`104` behaviour; where this spec disagrees with their text, this spec wins.

## Problem & Goals

The owner's first hand test of an import exposed five problems on the result wizard. (1) The Review step warns `PLAYER_NOT_IN_SQUAD` for players the manager has just linked or created on the Teams step, which reads as a mistake the manager made and has no one-click fix. (2) `LINEUP_TOO_LARGE` warns that a side has twelve players who took part, but a twelfth name (a substitute fielder) is normal cricket and not a problem. (3) On the Awards step the Standouts card is clipped. (4) The "Preview result" button sits on its own row above its card and leaves an empty strip. (5) The match's date and time cannot be changed from the result flow: the match edit page does it, but it is not reachable from the result wizard or the import, imports can create a match with a wrong time, and matches often start at a different time than scheduled.

Goals:
- **A. Linked or created players join the squad automatically.** On the Teams step of an OURS side, a player linked to a registered player, or created, is added to that team's squad for the match's season.
- **B. A real fix for `PLAYER_NOT_IN_SQUAD` on Review:** "Add to squad" for one player, "Add all" for the side, then revalidate.
- **C. `LINEUP_TOO_LARGE` removed entirely.**
- **D. The Standouts card is not clipped**, with a regression test.
- **E. "Preview result" lives in the header of the "This is how the result will look" card.**
- **F. The match's date and time can be changed from the Review step and from the import's Match step**, with the same league-season date check as the match edit page.

## Non-goals

- **Making `PLAYER_NOT_IN_SQUAD` an error or a block.** It stays a warning (`113`): a squad is season-scoped and optional.
- **A new squad endpoint or a server-side auto-add.** The client calls the existing add-to-squad endpoint (`POST /manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add`, `teamSquadApi.addToSquad`). Section scope (`035`), inactive-player and already-in-squad handling stay where the existing service already puts them. Doing it in the save would hide a squad change inside a result save.
- **Auto-adding on any path other than link or create** (picking a player in the Add player dialog, the Club tab borrow from another team, opposition rows, guests). Those keep the warning and the Review fix.
- **Removing a player from the squad when the manager later unlinks them.** The squad is not rolled back; it is a normal squad edit.
- **Any change to `LINEUP_SIZE`.** It stays; `OUR_TEAM_NOT_SELECTED` still uses it.
- **A replacement for the removed warning.** Nothing replaces it; the 11 rule is not a rule.
- **A separate "played at" time on the result.** There is one date and time, the match's `matchDate`. Changing it changes the match everywhere (fixtures, match card, polls' reference time), the same as editing the match.
- **Editing anything else about the match from the result flow** (teams, league, season, venue, links). The full match edit page stays the place for those. The new action changes the date and time only.
- **Moving a match to another season or league by changing its date.** `seasonId` and `leagueId` do not change; the date must fall within the match's own league season dates.
- **Other layout items.** Collected in the "Owner layout list (open)" section below and added as the owner sends them.

## User Stories

- As a manager importing a result, I want players I link or create on the Teams step to be added to the team's squad for the season, so that the Review step does not warn about people I just dealt with.
- As a manager on the Review step, I want an "Add to squad" button on a not-in-squad warning, and "Add all" for the side, so that I can clear the warning in one tap.
- As a manager, I do not want a warning when a side lists a twelfth player, so that real warnings are not buried.
- As a manager on the Awards step, I want the Standouts card shown in full, so that I can read it.
- As a manager on the Review step, I want the Preview result button in the preview card's header, so that the page has no empty strip above it.
- As a manager, I can change the match's date and time from the Played row on the Review step, so that a match that started at a different time than scheduled, or was imported with a wrong time, shows the right one without leaving the result flow.
- As a manager importing a result, I can see the chosen match's date and time on the import's Match step and change it before I confirm, so that I do not confirm against a wrong time.

## Data Model Changes

None. No migration. The squad rows are created through the existing squad service (`TeamSquadMember`); the date change updates the existing `Match.matchDate`.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `PATCH /api/v1/manage/clubs/{clubId}/matches/{matchId}/date-time` (new) | same as match edit: `MatchServiceImpl.assertCanAdministerMatch` (club admin or a manager of the match's section, `035`) | Body `UpdateMatchDateTimeRequest { @NotNull Instant matchDate }`. Returns the updated `MatchDto`. Calls `leagueSeasonDates.assertWithin(match.leagueId, match.seasonId, matchDate)` exactly as `update` does (`111`); outside the dates it answers 400 with code `MATCH_OUTSIDE_LEAGUE_DATES` and the league-dates detail. No other field of the match is read or changed. Implemented as `MatchService.updateDateTime`, sharing the access check and the `assertWithin` call with `update` (no copy). Works the same whether or not the match has a result. |
| Existing validation issue record `ResultIssueDto` (`backend/src/main/java/.../dto/ResultIssueDto.java`, schema `ResultIssueDto` in `backend/openapi/openapi.yaml`) | unchanged | Gains optional `playerProfileId` (UUID, nullable). Set by `ScorecardRules.lineupChecks` (around line 470) on `PLAYER_NOT_IN_SQUAD` so the client knows which player; null on every other issue. Additive. |
| `POST /manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add` | unchanged (`029`, `035`) | Called by the client for auto-add and for the Review fix. |

**Why a PATCH and not the existing `PUT /matches/{matchId}`:** `PUT` (`UpdateMatchRequest`) is a full replace. It needs the side fields (team ids or names plus logos or league-team ids), league, season, venue and `playingAreaId`, and runs `validateSides`, `validateLogoOnlyWithName`, `resolveLeagueTeam`, `venueFor` and the link checks over them. The result page does not hold a faithful copy of all of that (it would have to rebuild `MatchPayload` from a `MatchDto`), and any drift would silently rewrite sides, logos or the venue while the owner only meant to move the time. A date-only endpoint cannot change anything else, and still enforces the same access and league-date rules.

`LINEUP_TOO_LARGE` is removed from `WarningCode` and from the openapi enum. A removed enum value is technically a contract change; no client other than this UI reads it, and the UI's `TEAM_CODES` list is updated in the same change. The openapi file is updated by hand (per the repo's practice of not building under the live backend): the new path, `UpdateMatchDateTimeRequest`, `ResultIssueDto.playerProfileId`, and the removed enum value.

## UI Requirements

1. **Auto-add on link or create (Teams step, OURS side only).** After a player is linked to a registered player or created for an OURS side, the client calls `addToSquad` for that side's team and the match's season. Best effort: a 409 already-in-squad and an inactive-player error are benign and silent; any other failure is not shown as a blocker and never stops the save or the step. Needs a season on the match; with none, skip silently. Not done for the opposition side or guests.
2. **Review fix button.** For `PLAYER_NOT_IN_SQUAD` the Fix button reads **Add to squad** and acts on the issue's `playerProfileId` for that issue's side's team. When a side has more than one such issue, the side also offers **Add all**. After the calls the client revalidates. Per-player failures that are benign (as above) count as done; a section-scope refusal from the service shows as an inline error on that issue and leaves the warning.
3. **`LINEUP_TOO_LARGE` removed** from `TEAM_CODES` (`reviewIssues.ts`) and the step-mapping test.
4. **Standouts card.** `InfoCard.tsx:81` sets `height: 100%` on its root; inside a column flex parent (`AwardsStep.tsx:210`, itself in a stretched grid item) the card shrinks and its overflow is hidden. Fix (corrected after a first attempt): a `flexShrink: 0` on the shared `InfoCard` root only made the card overflow the stretched wizard container and overlap the footer, because the percentage height still resolved against the stretched column. `InfoCard` stays unchanged for every other page; the Awards column (`data-testid="awards-column"`) overrides its own cards (`height: auto`, `flexShrink: 0`, content `height: auto`), so they size to their content and the footer sits below them. Checked in a real browser render at 375 and 1200 px for Awards, Review, Teams, Batting and Bowling and fielding.
5. **Preview button.** On the Review step (`steps/ReviewStep.tsx`, the button around line 174 and the "This is how the result will look" heading around line 178; `ResultCapturePage` hosts the wizard but the button is in `ReviewStep`), the "Preview result" button moves from its own row above the card into the header of the "This is how the result will look" card, placed as the Playing conditions button is in the Checks card header (same header-action pattern). The empty row is removed. Phone layout keeps a 44 px target.
6. **Edit date and time, Review step.** The **top panel of the Edit result page** (the line under the page title showing the match, date and venue; `ResultCapturePage`) gains an **Edit date and time** action beside the date (a small Edit button with a pencil icon, `aria-label` "Edit date and time", 44 px target on a phone). The Played row of the preview card has no duplicate. It opens a small dialog, `MatchDateTimeDialog` (new, in `components/`, with a story and test, thin over MUI `Dialog`), holding the existing `DateTimeField` prefilled with the match's `matchDate`, Cancel and Save. Save calls the new `matchApi.updateMatchDateTime(clubId, matchId, matchDate)`. A 400 `MATCH_OUTSIDE_LEAGUE_DATES` is shown on the field via `matchOutsideLeagueDatesMessage` (`utils/errorDetail`), as `MatchFormPage` does with `matchDateServerError`; any other error shows in the dialog and the dialog stays open. The same client-side league-dates hint the match form already uses is reused, not rewritten. On success the dialog closes and the client invalidates the match query and the result queries, so the Played line, the preview dialog and the result summary show the new time. The draft is not re-saved by this action.
7. **Edit date and time, import Match step.** `import/MatchStep.tsx` shows the chosen match's date and time (`formatMatchDateTime`) beside "What the file says" (which already shows the file's date and time) and offers the same **Edit date and time** action with the same dialog. After saving, the candidate list and the date-mismatch check (`dateMismatch`) are recomputed from the refreshed match, and the existing date-check acknowledgement (`AcknowledgementTick`) stays: if a difference remains, the manager still has to acknowledge it before confirming; if the edit removes the difference, no acknowledgement is asked. Nothing is confirmed by editing the time.
8. **No success banner is needed** beyond the dialog closing and the line updating.

## Test Plan

Per `docs/standards/testing.md`.

- **Backend unit/integration (Testcontainers, per the existing `MatchServiceImpl` update tests):**
  - `ResultValidatorScorecardPublishRulesTest`: the `LINEUP_TOO_LARGE` tests (twelve, substitute, opposition, did-not-bat, extra) are deleted with the rule; add a test that a side with twelve players who took part raises no lineup warning. The `PLAYER_NOT_IN_SQUAD` test asserts the issue carries `playerProfileId`; other issues have it null.
  - `updateDateTime`: changes only `matchDate` (every other field unchanged, including a league-team side, logos and venue); a date outside the league season dates is refused with `MATCH_OUTSIDE_LEAGUE_DATES`; a match with no league or no dates accepts any date; a manager outside the match's section is refused (same as `update`); another club's match is not found; null `matchDate` is a 400; works on a match with a draft and with a published result.
  - Controller test for the `PATCH` route and status codes.
- **OpenAPI contract:** update the schema; the diff shows the new path and schema, the new `playerProfileId` field and the removed enum value only.
- **UI (Vitest + Testing Library):**
  - Linking and creating a player on an OURS side calls `addToSquad` with the team, season and player; not for opposition or guest; a 409 and an inactive-player error do not block saving.
  - Review: `PLAYER_NOT_IN_SQUAD` shows **Add to squad** and calls `addToSquad` for that issue's player then revalidates; **Add all** adds every such player of the side; a scope refusal shows inline and keeps the warning.
  - `reviewIssues.test.ts` and `ResultCapturePage.scorecard.test.tsx` no longer reference `LINEUP_TOO_LARGE`.
  - Clipped card regression: the Awards column's stylesheet rule gives its cards `height: auto` and `flexShrink: 0` (and their content `height: auto`), so the Standouts card is not `height: 100%` (`AwardsStep.test.tsx`).
  - Preview placement: the button is inside the header of the "This is how the result will look" card and no standalone row precedes the card.
  - `MatchDateTimeDialog`: prefilled with the match date; Save sends only the date; the league-dates server error shows on the field and the dialog stays open; Cancel sends nothing.
  - Review step: Edit date and time in the top panel opens the dialog; after save the panel line, the Played line and the preview show the new time.
  - Import Match step: shows the match date and time; editing it recomputes the date mismatch; the acknowledgement is still required while a difference remains and not asked once it is gone; confirm is still a separate explicit step.
  - A Storybook story for `MatchDateTimeDialog` (one story per shared component).
- **Playwright:** no new e2e; existing result-wizard e2e must still pass (Playwright has not been run for 104; do not rely on it as the only evidence).

## Acceptance Criteria

- Linking or creating a player for an OURS side on the Teams step puts that player in the team's squad for the match's season, and the Review step no longer warns for them.
- A 409 already-in-squad or an inactive-player error during auto-add shows nothing and does not prevent saving.
- On Review, a `PLAYER_NOT_IN_SQUAD` warning offers **Add to squad**; a side with several offers **Add all**; after either, the warning is gone on revalidation.
- The server's `PLAYER_NOT_IN_SQUAD` issue carries `playerProfileId`; `113` eligibility is unchanged and the warning is still not a block.
- No code, enum value, test, UI list entry, spec row or plan mention of `LINEUP_TOO_LARGE` remains (`101` lines about 313, 375, 425, 520; `102` lines about 142, 265, 290; `docs/plans/101`), apart from a note in `101`/`102` that this spec removed it. `LINEUP_SIZE` remains.
- A side with twelve players who took part validates with no lineup warning.
- The Standouts card on the Awards step is fully visible on phone and desktop.
- The Preview result button is in the preview card's header with no empty strip above the card.
- On the Edit result page, the top panel has an Edit date and time action; saving a new time changes the match's date and time, and the Played line and the preview show it without a page reload.
- Saving a date outside the match's league season dates is refused with the same message as on the match edit page, and nothing changes.
- The new endpoint changes `matchDate` and no other field, with the same access rule as match edit.
- On the import Match step, the manager sees the match's date and time and can change it before confirming; the date-check acknowledgement still applies while a difference remains; editing the time never confirms the import.

## Owner layout list (open)

More items from the owner will be added here; this spec stays in draft until the list is closed.

1. Move the "Preview result" button into the header of the "This is how the result will look" card (UI Requirement 5).
2. The "Edit date and time" action lives in the top panel of the Edit result page (beside the match line with the date), not on the Played row of the preview card (UI Requirement 6).
3. In the "No team is selected for this match" banner on the Teams step, "Select the team" (which left the result flow for the select-team page) becomes "Select players": it opens the Add player picker in the page so the manager picks the players who played without leaving. "Populate from the team" stays.
4. Scores step: the "Scheduled overs" and "Note (optional)" row is symmetrical. Both fields are one line high (Note grows only when typing); the "From league playing conditions" helper sits as a caption under the row instead of under one field. Stacked full width on a phone.
5. Review preview card: rows whose value was not specified (Toss, Field, Played, Team player) are shown with a warning-coloured icon and "Not recorded" in the warning colour, with an Add button to the step that sets it (Toss and Field: Toss and field; Team player: Awards). A visual hint only: never blocks publishing, no server rule.
6. One shared wizard footer (`components/WizardFooter`) on every step of the result wizard and the results import wizard: Back (filled, like Next) on the left; Save draft (the only outlined button) then the filled primary (Next: <step>, Publish, Continue, Create draft and review) on the right; on a phone it stacks full width in the order Next, Back, Save draft; 44 px targets. The optional-scorecard prompt on the Result step loses "Add the batting and bowling" (it duplicated Next: Batting) and keeps the notice with a text link "Skip batting and bowling".
7. Awards and fielding: the fielding list on Bowling and fielding is compact: the Catches / Stumpings / Run-outs labels are shown once in a header row (Ct / St / RO on a phone, aria-hidden, each stepper keeps an accessible name such as "Catches, Hannes Kruger"), each row is one 44 px line (name with ellipsis, three fixed-width steppers, the star), tabular numerals.
8. In-card action buttons of the result and import wizards are compact (shared `Button size="compact"`, about 32 px, 13px text, a transparent 44 px touch target below `md`); footer buttons keep the normal size (`design-system.md`, Button sizing).


1. Should the date change be refused while the result is published? The proposal allows it (the date does not alter the stats season, which comes from the match's season), and the Review step is only reachable for a draft anyway. Say if you want it blocked server-side.

## Rollout Notes

One PR, no migration, no feature flag. Order:
1. Backend: remove the rule, enum value and tests; add `playerProfileId` to `ResultIssueDto` and `ScorecardRules`; add `PATCH .../date-time` (`UpdateMatchDateTimeRequest`, `MatchService.updateDateTime`, controller route) with tests; update `backend/openapi/openapi.yaml` by hand.
2. UI: remove `LINEUP_TOO_LARGE` from `TEAM_CODES`; add the `playerProfileId` type; auto-add on link/create; Add to squad / Add all on Review.
3. UI: `matchApi.updateMatchDateTime`, `MatchDateTimeDialog` (with story), Edit date and time on the Review step's Played row and on the import Match step.
4. UI: Awards column card sizing fix and regression test; Preview button move.
5. Docs: strike `LINEUP_TOO_LARGE` from `101`, `102` and `docs/plans/101` (leave a one-line pointer to this spec); add a roadmap entry only if the owner's open list produces a deferred item.

Do not run `mvn` in `backend/` under the live app (scratch copy per the repo's practice).
