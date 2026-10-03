# 076 — Team Selection

**Depends on:** `029-league-management.md` (`Match`, `MatchSide`, `MatchSidePlayer`, the cap, age-eligibility and squad-membership rules this spec rewrites, and the Playing XI tabs it replaces), `030-team-sheet-communication.md` (the PDF and WhatsApp team sheet, which read a side's players), `033-availability-aware-xi-builder.md` (the per-row availability tinting this spec replaces with badges), `035-section-scoped-access.md` (`AccessService.canAdministerSection` and `resolveMatchSectionIds`), `037-match-improvements.md` (items 5 to 9: the Captain / Wicketkeeper / Twelfth man block, the batting-order stepper, Add Squad Member and Re-select from Previous Match, all re-expressed here), `040-announce-team.md` (announce, the un-announce-on-edit rule and `MatchSideDto.announced`), `052-league-playing-conditions.md` (`LeaguePlayingConditions.allowSubstitutions`, per league and season), `063-section-availability-and-flexible-squads.md` and `064-unified-availability-polls.md` (group polls answer per date and Morning/Afternoon window; `MatchSquadMember` and its hard block, both retired as a selection mechanism here), `066`/`067-squad-poll-responses-page.md` (the Responses pages where an answer is corrected), `068-player-availability-grid.md` (the grid whose `picked` flag changes meaning), `069-match-card-redesign.md` and `075-match-view-and-edit.md` (the card, the Match View and the edit page whose tabs this spec changes), `073`/`074-availability-coverage.md` (Coverage, the planner this spec deliberately does not build). Drafts `055-league-season-config.md` and `058-team-captain-auto-select.md` (not built, not touched) overlap this spec: see Rollout Notes.
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/Vt3LivHuMT9oHwibMo2bau

## Problem & Goals

Choosing who plays is the product's most important job and today it is spread over three places that disagree. A match can have a **Match Squad** (group-poll matches only, `063`/`064`), then a **Playing XI** built from that squad or from the team's season roster (`029`), then Captain, Wicketkeeper and Twelfth man in a separate block of three dropdowns (`037`). Nothing stops the same player being picked for two sides at the same time unless both sides come from one group poll window (`063` Part C, `MatchSquadMember`'s unique constraint); a player who answered "unavailable" can still be put in the XI (`033` only tints the row); the twelfth man sits outside the cap, so a league with an XI of 12 can end up with 13 names; and the batting order must be filled the moment a player is added.

This spec replaces the match squad and the three steps with **one selection list per team per match**: at most 12 players, with the batting places and the optional 12th man taken from the league's playing conditions. It adds two server-enforced hard blocks (a player already in another team's selection for the same slot; a player who said "unavailable"), a Release action so a manager can free a player from another team, a pool the manager picks from (the team's roster by default, the whole section on request, the people who said "available" for a group-poll match), and an atomic "apply selection" endpoint behind a single "Select players" dialog. The batting order becomes optional so a player can be selected before he has a position.

**Goals**
- One selection list per team per match, at most 12 players: batting places (11, or 12 where the league's XI size is 12) plus an optional 12th man only where the playing conditions have one; the total never exceeds 12.
- The Match Squad tab, its screen and the Match View's **Pick match squad** button are retired; `MatchSquadMember` stops being read by any rule.
- Hard block 1, **taken for the slot** (server-enforced, 409): a player in another team's selection (another match, or the other side of a derby) for an overlapping slot of the same club cannot be selected until released.
- Hard block 2, **said unavailable** (server-enforced, 409): a player whose answer on the poll covering this match is Unavailable cannot be selected. Unsure, no response and no poll are allowed with a visible marker and one calm summary line.
- **Release** from the selection dialog, with a confirmation that spells out the consequence, when the acting manager may administer the other team.
- A selection pool read endpoint and an atomic apply-selection endpoint; the existing add / remove / reorder / update-side endpoints keep working and enforce the same rules.
- A page (the content of the Home XI / Away XI tabs) with a progress header, a tap-a-name menu (captain, wicketkeeper, batting position, 12th man, remove), drag-to-reorder, an unordered holding area after Done, and an announce rule that says exactly what is missing.
- The Player Availability grid's `picked` flag means "in the team's selection" (including the 12th man).

## Non-goals

- **Reserves, a travelling squad or more than 12 names.** One list, at most 12. The user decided; nothing in the model can hold a thirteenth selected player.
- **The slot-based multi-team Selection planner.** Picking several teams' lists together from Coverage (`074`) is still the later spec `075` listed. This spec gives it the missing guard (a player cannot be in two teams for a slot) but plans nothing.
- **A database-level slot constraint.** The slot rule spans two tables, a league format and a day part; a constraint is not cheap or safe here. The service check plus a per-player advisory lock (Data Model Changes, section 9) is the guard; a database constraint is a roadmap item.
- **Re-validating a selection when a match is rescheduled or its league's format changes.** The rules run when a player is selected. Moving a match onto a slot where its players are already taken, or changing a league's format, creates no check and no error (known gap, see Rollout Notes and the risks in the report).
- **Repairing data that already breaks the new rules.** Duplicate selections that exist today (the same player in two sides for one slot) and sides over the new total are left as they are, shown with a marker and never auto-trimmed.
- **Changing any poll.** Polls, answers, Responses pages, coverage (a match is covered by at most one poll, `064`), group and squad poll creation are untouched. Change answer is a link to the existing Responses page, with its existing manager override, not a new endpoint.
- **Deleting `MatchSquadMember`, its table, repository, the five `.../teams/{teamId}/squad` endpoints or their client functions.** They stay, dormant and unused by any rule or screen (Data Model Changes, section 10). Cleanup is a roadmap item. The `GET` stays as the existing source of poll coverage (`windowId`, `roundId`, `windowOpen`) for the Match View, the card and the edit page.
- **Changing Add Squad Member beyond where it is reached.** The same `PlayerForm` dialog and `createPlayer` call; it moves into the Select players dialog as "Add new player" (UI section 6).
- **A "Whole club" pool.** The switch is Team squad / Whole section. A player tagged only to another section (a junior "playing up" from a different section tree) is not offered; he must be added to the team's roster or tagged to the section first.
- **An "Order as ticked" shortcut.** The mockup's honest trade-off: after Done the manager sets positions himself. A one-line shortcut can be added later if it feels slow (roadmap).
- **Blocking Announce for a selected player who later says unavailable.** Such a player shows a red badge and a summary line; the hard block applies when selecting, not when announcing (open point, Rollout Notes).
- **Notifying the other team's manager when a player is released from his team**, or un-announcing that team. A release from an announced team shows an extra warning and leaves the team announced (UI section 4).
- **A per-club timezone, a match end time or duration, and exact multi-day modelling.** The slot rule uses the server's system zone (as `063` does) and a span derived from the league format only (Data Model Changes, section 5).
- **Any change to who may see or edit a match** (`035`), to `MatchForm`, to the team sheet's layout, to `PlayingXiSummary`'s role chip, or to the public pages.
- **Telling players anything.** Announce stays the admin-facing flag of `040`; no message or notification is sent by selecting, announcing or releasing.
- **The user's drafts `055` and `058`.** Not edited, not built, not committed by this spec.

## User Stories

- As a manager, I open a team's tab on the edit page and see one list of the players selected for that team, how many of the maximum are selected, and whether anyone hasn't confirmed.
- As a manager, I press **Select players**, tick from the team's roster (or the people who said "available" on a group poll), switch to the whole section if I need to, search by name, and press Done.
- As a manager, I cannot tick more players than the league allows: the rest grey out with "Team is full".
- As a manager, I see Unsure and No response players with a badge and can still select them; I see one calm line saying how many selected players haven't confirmed, never a pop-up.
- As a manager, I cannot select a player who said unavailable; his row says "Said unavailable" and offers "Change answer", which opens that poll's Responses page so I can correct it after a phone call.
- As a manager, I cannot select a player who is already in another team's selection for the same slot; his row says "In Villagers 2 · Sat 10:00".
- As a manager of that other team's section, I can release him from the dialog after a confirmation that says "Removes Jaden from Villagers 2's selection", and then tick him.
- As a manager who does not administer that team, I see "Ask that team's manager to release this player" instead of a Release button.
- As a manager, I can release a player from an announced team, with an extra warning that this changes a published team, and the team stays announced.
- As a manager, I play one player in a morning match and an afternoon match on the same day, but not in two matches of the same slot, and not in an afternoon match on a day another match takes whole (a one-day, 45-over or 50-over league).
- As a manager, after Done the new players wait under "Not in the batting order yet"; I drag them into order or type a position, and the others shift.
- As a manager, I tap a player's name and get Make captain, Wicketkeeper, Batting position, Make 12th man and Remove from team; the captain and the keeper are one player each, shown as words, not boxes.
- As a manager, I cannot announce until every selected player (except the 12th man) has a batting position, and the message says exactly what is missing.
- As a manager, I re-select the previous match's team; anyone now blocked is skipped and the summary says why for each.
- As a manager on a phone, the dialog is full screen with its footer pinned and the page list uses the same tap menu.
- As a manager, I add a brand-new player from inside the dialog without leaving the page.
- As a coach looking at the Player Availability grid, a player shows as "picked" when he is in any team's selection for that match, 12th man included.

## Data Model Changes

### 1. Migration

One migration, `backend/src/main/resources/db/changelog/v1/038-team-selection.sql` (latest existing is `037-add-match-scoring-streaming-urls.sql`), included at the end of `db.changelog-master.xml`:

```sql
-- docs/specs/076-team-selection.md: a selected player may have no batting position yet, and the
-- 12th man becomes an ordinary selection row (position NULL) instead of a bare id on match_side.
-- UNIQUE (match_side_id, batting_order) stays: Postgres treats NULLs as distinct, so many players
-- can wait without a position while two players can never share one.
ALTER TABLE match_side_player ALTER COLUMN batting_order DROP NOT NULL;

-- Backfill: every existing 12th man becomes a selection row with no position. role is NOT NULL, so
-- BATSMAN (the default the old Add player control used). Test data only; nothing is deployed.
INSERT INTO match_side_player (match_side_id, player_profile_id, batting_order, role)
SELECT ms.id, ms.twelfth_man_player_id, NULL, 'BATSMAN'
FROM match_side ms
WHERE ms.twelfth_man_player_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM match_side_player p
      WHERE p.match_side_id = ms.id AND p.player_profile_id = ms.twelfth_man_player_id);
```

No new table and no new column. `match_side.twelfth_man_player_id` stays: it now **designates** which selected row is the 12th man. `match_squad_member` is not touched.

Entity and DTO changes (additive except one type): `MatchSidePlayer.battingOrder` becomes `Integer` (nullable), `@Column(name = "batting_order")`; `MatchSidePlayerDto(UUID playerProfileId, Integer battingOrder, PlayingRole role)`. Every Java reader of `battingOrder` that unboxes it (`MatchSideServiceImpl.addPlayer`'s `mapToInt(MatchSidePlayer::getBattingOrder)`, the reorder code) is rewritten; `findByMatchSideIdOrderByBattingOrderAsc` already sorts NULLs last in Postgres, which is the order the page wants. `MatchSideDto` gains `SelectionLimitsDto limits` (appended last; section 4), so `MatchSideMapper.toDto` takes the limits as a third argument built by the service.

### 2. The model, in one paragraph

A side's **selection** is its set of `match_side_player` rows. A row with a `batting_order` is in the batting order; a row without one is waiting; the one row named by `match_side.twelfth_man_player_id` (if any) is the **12th man** and never has a position. The captain and the wicketkeeper (`match_side.captain_player_id`, `wicket_keeper_player_id`) are selected rows that are not the 12th man. Positions are always **contiguous**: every mutation that removes a position holder or gives someone a position compacts the positions to 1..k, so there are never gaps.

### 3. Business rules, service layer

Shared logic lives in one place (`docs/standards/backend.md`): `MatchSideServiceImpl` (the existing endpoints) and the new `MatchSelectionServiceImpl` (pool and apply) both call one `SelectionRules` collaborator (a `service.support` bean built from `SelectionLimitsResolver`, `MatchSlots`, `SelectionAvailabilityResolver` and `SelectionEligibility`, each a small class with its own tests). Nothing below is written twice.

### 4. Limits (how today's cap maps)

Today (`MatchSideServiceImpl.applicableCap`): the cap on ordered rows is `League.maxPlayingXiSize`, or 11 for a match with no league; the twelfth man is **additional** and always allowed, "regardless of `allowSubstitutions`" (`029`). So a league of 11 allowed 12 names and a league of 12 allowed 13. New rules, computed by `SelectionLimitsResolver.limits(match)`:

| Match | `battingPlaces` | `twelfthManAllowed` |
|---|---|---|
| **No league** (a friendly) | 11 | true (nothing exists to forbid it; today's behaviour kept) |
| **With a league** | `min(League.maxPlayingXiSize, 12)` | `LeaguePlayingConditions.allowSubstitutions` for `(match.leagueId, match.seasonId)`; false when no conditions row exists; false when `battingPlaces` is 12 |

`maxSelected = battingPlaces + (twelfthManAllowed ? 1 : 0)`, so it is at most 12. Consequences, stated plainly because they change behaviour: (a) a league of 11 without `allowSubstitutions` now has **11** places and no 12th man (today 12 names); (b) a league of 12 now has 12 places and no 12th man (today 13); (c) a league whose `maxPlayingXiSize` is above 12 (the field has no upper bound today) is clamped to 12 for selection. The 12th man is a place in the selection, so "N of 12 selected" counts him. When draft `055` moves `maxPlayingXiSize` onto `LeaguePlayingConditions`, only `SelectionLimitsResolver` changes.

`SelectionLimitsDto(int battingPlaces, boolean twelfthManAllowed, int maxSelected)` is returned inside `MatchSideDto` (every sides call) so the page, the dialog and the Match View read the same numbers. `MatchDto.playingXiSize` (`069`) keeps its name and its null-for-no-league rule but now holds `maxSelected` for a league (the card's "N of M picked" counts the 12th man, so M must too); `MatchServiceImpl.list` resolves it in one batch per page (conditions looked up for the page's `(league, season)` pairs, never per row).

### 5. The slot rule (hard block 1)

**Slot** = the match's **local calendar date** (`ZoneId.systemDefault()`, exactly as `SectionAvailabilityMatchResolverImpl` does) plus **Morning or Afternoon**, using the existing rule `SectionAvailabilityMatchResolver.dayPartOf` (before 12:00 is Morning, 12:00 and later is Afternoon); `MatchSlots` calls that resolver rather than restating it. A match **occupies** slots according to its league's `LeagueFormat`:

| Format of the match's league | Occupies |
|---|---|
| `T20`, `T30`, unset, or no league | its own single slot |
| `T45`, `T50`, `ONE_DAY` | **both** slots (Morning and Afternoon) of its local date |
| `THREE_DAY` | both slots of 3 consecutive local dates starting at its date |
| `FIVE_DAY` | both slots of 5 consecutive local dates starting at its date |

Two matches **collide** when their occupied slot sets intersect, each computed from its own league's format. `Match` has a single `matchDate` and no end or duration, so the multi-day spans come from the format name alone (3 and 5 calendar days); weather, an early finish or a match that is really split over non-consecutive days are not modelled (roadmap).

**Taken** means: the player is a `match_side_player` row (the 12th man included) of a side of **another active match of the same club** whose occupied slots collide with this match's, or of the **other side of this same match** (a derby). Deactivated matches never hold a player. A player may play a morning and an afternoon match on the same day; he may not be in two matches of one slot, nor in an afternoon match on a day another match takes whole.

Implementation: `MatchSlots` computes this match's occupied dates, fetches the club's active matches in `[firstDate - 4 days, lastDate]` (the widest span reaching back is a five-day match) with one new repository query (`MatchRepository`, a `Specification` or derived query on `clubId`, `active` and a `matchDate` range, with an integration test), batch-loads those matches' leagues, sides and `MatchSidePlayer` rows (`MatchSideRepository.findByMatchIdIn` and `MatchSidePlayerRepository.findByMatchSideIdIn` already exist), computes each match's occupancy in memory, and returns `Map<playerId, TakenBy>` for the candidates. `TakenBy` carries the team, the match, the side, the kickoff, whether the side is announced and whether the match is this one.

**Grandfathering.** A player already selected on **this** side is never blocked by this rule when he stays selected: the rule applies only to players being **added**. If he is also in another team's selection for an overlapping slot (data that exists today), the pool returns his `taken` info alongside `selected: true` so the page can show "Also in Villagers 2" without blocking anything.

### 6. Membership rule (replaces the squad membership rule)

`requireSquadMembership` and its group-coverage branch (`MatchSquadMember`) are deleted. The rule that remains, for every path that adds a player (add, update-side's 12th man, apply, re-select):

- The player is an **active** `PlayerProfile` of this club (`profile.clubId = clubId`, `active = true`), and
- he is on the team's roster for the match's season (`TeamSquadMember` for `(teamId, match.seasonId)`), **or** he is tagged (`PlayerSection`) to the team's section or any descendant section (`AccessService.sectionAndDescendantIds`), and
- he passes the existing age rule (`requireAgeEligible`: the league's `minAge` / `maxAge` against the cutoff date or season start, a missing date of birth failing where an age rule exists), reused as one batch-capable `SelectionEligibility.ageProblem` so the pool and the writes cannot disagree.

Not required: being on the roster (a section player is enough), having answered any poll, being in a poll's audience. A side whose team belongs to another club (029's cross-club allowance) has no section tree in this club, so its pool is the roster only. The error for a player outside this pool is the existing `PlayerNotInSquadException` (400) with the message "<Name> is not on this team's roster or in its section".

### 7. How the server evaluates availability (hard block 2)

For the side's team, `SelectionAvailabilityResolver` asks the existing `MatchPollCoverageService.resolve(matchId, teamId)` and reads the answer from the covering poll, in one batched read per call (never per player):

| Coverage | Answer source | Status of a player |
|---|---|---|
| `GROUP` (a `section_availability_window_match` row links the match to a window) | `SectionAvailabilityResponse` rows of `coverage.windowId()` (the answer is **per window**: one answer covers every match of that date and Morning/Afternoon bracket) | the row's answer; no row and the player is in the window's audience (active players tagged to the window's section or a descendant) = `NO_RESPONSE`; no row and not in the audience = `NOT_POLLED` |
| `SQUAD` (a `MatchAvailabilityPoll` for this match and team) | `PlayerAvailability` rows of `coverage.pollId()` (per match poll); a row with a null status counts as no answer | the row's answer; no answer and the player is in the team's season squad (the poll's audience) = `NO_RESPONSE`; otherwise `NOT_POLLED` |
| `NONE` | none | `NOT_POLLED` for everyone |

Group wins over squad, as everywhere (`MatchPollCoverageService`). In a derby each side evaluates its own team's coverage. `SelectionAvailability` is `AVAILABLE | UNSURE | UNAVAILABLE | NO_RESPONSE | NOT_POLLED`. **Only `UNAVAILABLE` blocks** (409, `SAID_UNAVAILABLE`); the other four are allowed. Only the poll covering **this match** is consulted: an answer given on another match's poll, or for a different slot, is not used.

### 8. The announce rule

Today's rule (`MatchSideServiceImpl.announce`, `040`): the side must have at least one player (400 `ValidationException`); no captain, keeper or full-XI requirement exists, and none is added. New, in the same method and the same status code, via `SelectionIncompleteException extends ValidationException`:

- at least one selected player (unchanged);
- every selected player **other than the 12th man** has a batting position, and no more than `battingPlaces` do;
- the selection has at most `maxSelected` players (guards sides that were over the limit before this spec).

The message names exactly what is missing, for example: "Cannot announce Villagers 1: 3 players have no batting position (Anton de Villiers, Jaco Smith, Thabo Naidoo)." / "...: 12 players are selected but only 11 places exist; choose the 12th man or remove one." / "...: 13 players are selected; the most allowed is 12." More than three names are shown as "A, B, C and 4 more". The captain and the wicketkeeper stay optional.

### 9. Race condition: what protects two managers selecting the same player at once

Honestly: a plain "check, then insert" inside `@Transactional` (READ COMMITTED) does **not** stop two managers selecting the same player in the same instant: both transactions read "free" and both insert. The service-level check alone leaves a window of a few milliseconds. The cheap, safe guard used here is a Postgres **advisory transaction lock per player**: before running the slot check, every write path that adds players takes `pg_advisory_xact_lock(hashtext(<playerProfileId>))` for each player being added, in ascending id order (so two requests cannot deadlock each other); it is released automatically at commit or rollback. The second transaction therefore waits, then runs its check and sees the first one's committed row, and fails with the clean 409. One small native query in a repository (`SelectionLockRepository`, with a Testcontainers integration test, one of which runs two concurrent applies), no schema change. What it does not cover: a write path that forgets to take the lock (add, update-side's 12th man and apply all do, and a test asserts that), and the reschedule / format-change gap in Non-goals. A database-level constraint remains a roadmap item. The existing `GlobalExceptionHandler` mapping of `DataIntegrityViolationException` to a generic 409 stays as the last safety net.

### 10. Existing data and `MatchSquadMember`

- **`MatchSquadMember` is dormant**: no screen writes it, no rule reads it. `MatchSideServiceImpl` drops its `MatchSquadMemberRepository` use; `PlayerAvailabilityServiceImpl.loadPicked` stops reading it. Existing rows stay in the table and are ignored (nothing is deployed; they are test data). A group-covered match's picks that only ever existed as match-squad rows therefore stop showing as "picked" until the player is selected through this feature.
- **`SectionAvailabilityRoundServiceImpl.delete` no longer refuses** a group poll because match-squad rows exist (`RoundHasMatchSquadException`): with no screen to remove them, a stale row would make a poll undeletable forever. It deletes the round's `match_squad_member` rows with the other children instead (the foreign key has no cascade, so they must go first). The exception class is left in place, unused (cleanup in the roadmap).
- **The Player Availability grid's `picked`** (`068`) now means: the player has a `match_side_player` row on **any** side of the game, the 12th man included (today the 12th man is not counted and match-squad membership is). `loadPicked` is the only place that changes; the `CellDto`, the `picked` totals and the grid UI are untouched.
- **Duplicates that may exist today** (a player in two sides for one slot): not repaired. See "Grandfathering" in section 5.
- **Sides over the new limit** (for example 12 players plus a 12th man in a league that now allows 12 in total): not trimmed. Any change through the apply endpoint must end within the limit; Announce is blocked with the section 8 message until it does.

## API Contract

All under `/api/v1/manage/clubs/{clubId}`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")` like every `MatchSideController` endpoint, with the section check in the service (`assertCanAdministerMatch`, as the existing side endpoints do). The new endpoints live in a new `MatchSelectionController` / `MatchSelectionService` / `MatchSelectionServiceImpl`; the existing ones stay in `MatchSideController`.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET .../matches/{matchId}/teams/{teamId}/selection-pool?wholeSection=false&q=` **(new)** | as the side endpoints | The candidates for this match and team, each with availability, taken info, a selectable flag and a machine-readable reason (below). `teamId` must be one of the match's own team ids (400 otherwise, as `MatchSquadServiceImpl` does). Works before the side exists. Read-only, `@Transactional(readOnly = true)`. |
| `PUT .../matches/{matchId}/sides/{sideId}/selection` **(new)** | same | Atomic apply: the complete desired set of selected players. Adds new, removes unticked, validates limits, membership, age, slot and availability together, all or nothing. 200 with the `MatchSideDto`; 409 with per-player rejections. |
| `POST .../matches/{matchId}/sides/{sideId}/players` (`029`) | same | Add one player. Now enforces the pool membership rule, the new total cap, and both hard blocks. The new row gets the next batting position while fewer than `battingPlaces` positions are used, otherwise no position. |
| `PUT .../sides/{sideId}` (`029`) | same | Update captain / keeper / 12th man (still a full replace of the three). Captain and keeper must be selected rows and not the 12th man (400). A 12th man must be allowed by the limits (400 `TwelfthManNotAllowedException`); one who is not yet selected is **added** through the same checks (so an older client still works); designating him removes his batting position (positions compact). A request naming the same player as 12th man and as captain or keeper is a 400 (it contradicts itself). The previous 12th man stays selected, without a position. |
| `POST .../matches/{matchId}/sides/{sideId}/players/{playerProfileId}/remove?keepAnnounced=false` (`029`) | same | Remove one player (selection row). Clears him as captain, keeper or 12th man, compacts positions. **New optional `keepAnnounced`** (default `false`, today's behaviour: an announced side is un-announced, `040`). The **Release** action sends `true`, the one case where removing from an announced side must not un-announce it. |
| `PUT .../sides/{sideId}/players/reorder` (`029`) | same | Now sets the **full batting order**: the list holds distinct selected players (the 12th man allowed in it, which un-designates him), at most `battingPlaces`; listed players get positions 1..k in list order; selected players not listed have no position. Sending exactly the current players keeps working as before. |
| `PUT .../sides/{sideId}/players/{playerProfileId}` (`029`) | same | Role change, unchanged. |
| `POST .../sides/{sideId}/announce`, `.../unannounce` (`040`) | same | Announce gains the section 8 rule; un-announce unchanged. |
| `GET .../matches/{matchId}/sides` (`029`) | same | `MatchSideDto` gains `limits`; `MatchSidePlayerDto.battingOrder` is nullable. |
| `GET .../matches` (`029`) | same | `MatchDto.playingXiSize` now means `maxSelected` for a league (section 4). |
| `.../matches/{matchId}/teams/{teamId}/squad` endpoints (`063`/`064`) | as today | Unchanged and **dormant** except the `GET`, still the coverage source (Non-goals). |

**`SelectionPoolDto`**: `matchId`, `teamId`, `sideId` (null until the side exists), `basis` (`ROSTER` or `POLL_AVAILABLE`), `wholeSection` (echo), `coveringPoll` (`kind` `NONE | SQUAD | GROUP`, `pollId`, `roundId`, `matchId`: what the UI needs to link to the Responses page), `truncated`, `entries`. **Default pool** (`wholeSection=false`): for a match covered by a **group** poll, the players whose answer on that poll is `AVAILABLE` (`basis = POLL_AVAILABLE`); otherwise the team's season roster (`basis = ROSTER`). **Whole section** (`wholeSection=true`): the roster plus every active player tagged to the team's section or a descendant, so it is always a superset of the default. Both always include the players **currently selected** on this side, in or out of the pool, so unticking works. Inactive profiles are never listed unless selected. `q` is a case-insensitive "contains" on first or last name (backend search, never client filtering); the list is capped at 500 entries (the grid's `MAX_PLAYERS`) with `truncated` set, ordered by first then last name.

**`SelectionPoolEntryDto`**: `playerProfileId`, `firstName`, `lastName`, `jerseyNumber` (squad number from `TeamSquadMember` when set, else the profile's, as `068`), `availability` (section 7), `selected`, `selectable`, `reason`, `reasonText`, `taken`.

- `reason` is one machine-readable value: `TAKEN_FOR_SLOT`, `SAID_UNAVAILABLE` or `AGE_INELIGIBLE`; `null` when selectable. When several apply the precedence is `AGE_INELIGIBLE`, then `SAID_UNAVAILABLE`, then `TAKEN_FOR_SLOT` (releasing him would not help if he also said unavailable). `reasonText` is the human sentence ("Mark Steyn said he is unavailable for this match", the age message from `requireAgeEligible`).
- `taken` (`SelectionTakenDto`): `teamId`, `teamName`, `matchId`, `matchDate`, `sideId`, `sameMatch` (the other side of this match), `announced`, `canRelease` (`AccessService.canAdministerSection(authentication, clubId, otherTeam.sectionId)`; false for a team of another club). Present for a blocked row and, for a **selected** player who is also taken elsewhere, alongside `selectable: true`.
- A selected player is always `selectable: true` (he can be unticked); a selected player who has since said unavailable keeps `availability: UNAVAILABLE` so the page can mark him.

**`ApplySelectionRequest`**: `players` (`@NotNull`, may be empty, which clears the side), each `SelectionEntryRequest(playerProfileId, role, battingOrder)`. `role` null means: keep the existing role for a player already on the side, `BATSMAN` for a new one. `battingOrder` null means: keep the existing position for a player already on the side, no position for a new one; when present it is the position (1..`battingPlaces`, distinct). Duplicates in `players` are a 400.

**Apply semantics.** Added = requested minus current; removed = current minus requested; kept = both. In one transaction: take the advisory locks for the added players (section 9); validate; **collect every rejection** and, if there is any, throw before any write, so nothing is persisted; otherwise delete the removed rows (clearing captain / keeper / 12th man pointing at them), insert the added rows, apply roles and positions, compact positions, and un-announce the side if it was announced (`040`, an own edit). Validation, per added player: pool membership, age, slot, availability; and, for the request as a whole: `players.size() <= maxSelected` and positions within `battingPlaces`. Kept players are not re-validated against the slot or availability rules (grandfathering). Apply never designates a 12th man: a kept 12th man stays designated; a removed one is cleared like any removal; designation is `updateSide`.

**Errors**

| Case | Exception (new ones in `com.cricketlegend.exception`) | Status |
|---|---|---|
| Player in another team's selection for the slot | `PlayerTakenForSlotException extends ConflictException`: "Jaden Botha is already in Villagers 2's selection for Sat 3 Oct (morning). Release him there first." | 409 |
| Player said unavailable | `PlayerSaidUnavailableException extends ConflictException`: "Mark Steyn said he is unavailable for this match." | 409 |
| Apply with one or more rejections | `SelectionRejectedException extends ConflictException`, detail "3 players can't be selected", plus a `rejections` property: list of `{playerProfileId, playerName, reason, message, taken}`, `reason` one of `TAKEN_FOR_SLOT`, `SAID_UNAVAILABLE`, `AGE_INELIGIBLE`, `NOT_IN_POOL`, `TEAM_FULL` (whole-request, `playerProfileId` null), `POSITION_INVALID` | 409 |
| Total over the limit on the single add endpoint | existing `PlayingXiCapExceededException` (message now "Team is full: 12 is the most that can be selected") | 400 |
| Outside the pool / age ineligible on the single endpoints | existing `PlayerNotInSquadException`, `PlayerAgeIneligibleException` | 400 |
| 12th man not allowed | `TwelfthManNotAllowedException extends ValidationException` | 400 |
| Announce incomplete | `SelectionIncompleteException extends ValidationException` | 400 |

`GlobalExceptionHandler` gains one handler for `SelectionRejectedException` that sets the `rejections` property on the `ProblemDetail` (the subclass handler wins over the generic `ConflictException` one); no new base type, so the exception matrix in `docs/standards/backend.md` needs only the new subclasses named.

**Release** is not a new endpoint: it is `POST .../matches/{otherMatchId}/sides/{otherSideId}/players/{playerProfileId}/remove?keepAnnounced=true` with the other team's existing access check. In a derby, `assertCanAdministerMatch` passes for a manager of either section, so the endpoint is more lenient than the pool's `canRelease`, which is checked per team section; the UI follows `canRelease`, and tightening the endpoint is not part of this spec (roadmap).

`backend/openapi/openapi.yaml`: additions (two paths, the schemas above, `limits` on `MatchSideDto`, the `keepAnnounced` query parameter, the `409` response on the new paths) and **one nullability change**, `MatchSidePlayerDto.battingOrder` becomes nullable; edited by hand per the repo's practice. A strict contract diff may flag that nullability as breaking; the build confirms how the diff treats it.

## UI Requirements

Composed from existing pieces: `RecordFormScreen`/`MatchFormPage`'s tab shell, `CardProgressBar`, `badgeSx`/`RecordCard` badge tones, `Button`, `Input`, `EmptyState`, `LinkExistingRecordDialog` (the Re-select picker), `CreateAndLinkRecordDialog` with `PlayerForm` (Add new player), MUI `Dialog`, `Menu`, `Chip`. New shared components (each with the four-file anatomy; the test and story files are built in phase 2): `TeamSelectionList` (the numbered list, holding area, 12th man row, row menu, drag) and `SelectPlayersDialog`. State stays in the page (`MatchSideTab`), React Query over a new `ui/src/api/matchSelectionApi.ts` (`getSelectionPool`, `applySelection`; one file per backend resource) and the existing `matchSideApi.ts`. Pixel values (colours, radii) come from `theme.ts` and the mockup's tokens, not the summary table.

### 1. Edit page tabs and deep links (`MatchFormPage`, builds on `075`)

- **The Match Squad tab, `MatchSquadPanel` and its Home/Away sub-tabs are removed.** Tabs become **Details**, **Home XI**, **Away XI** (each XI tab only for a side with a team id, as today). `MatchTabKey` loses `'match-squad'`.
- `?tab=playing-xi` selects Home XI, else Away XI (unchanged). `?tab=match-squad&side=home|away` (old bookmarks and the removed Pick match squad button) now selects **that side's XI tab** (falling back to the other XI tab if that side has no team id), instead of Details.
- The side tab's content is the page in section 2. `MatchSideTab` keeps creating the `MatchSide` on first use (`029`). Its queries: sides (`['managed-club', clubId, 'matches', matchId, 'sides']`) and the pool (`['managed-club', clubId, 'matches', matchId, 'teams', teamId, 'selection-pool', { wholeSection, q }]`). The `033` tinting data (`getPollResponses`, `getRoundResponses`, `availabilityByPlayerId`) is removed; availability now comes from the pool.
- `useSideCoverage` stays: the header Availability button and the Match View still use it for the poll destination.

### 2. The selection page (content of the Home XI / Away XI tab)

**Header card** (the mockup's `.hdr`), one bordered surface:
1. Title row: "Villagers 1 · Home · vs CBC 1" (team, side, opponent) and, right, the Announced / Not announced badge (the existing `announcedBadge`).
2. A row "Selected" left and "N of M" right, N = selected rows including the 12th man, M = `limits.maxSelected`; below it `CardProgressBar` (`ariaLabel` "<team> selection", `valueText` "N of M selected").
3. **One calm warning line** (amber, never a dialog), only when something applies, counting selected players whose availability is not `AVAILABLE`: "**2 selected players haven't confirmed** (1 unsure, 1 no response)." with "not polled" added when it applies ("1 not polled"). When no poll covers the match at all, the line instead reads "No availability poll covers this match, so nobody's availability is confirmed." and the per-row badges are not drawn (one marker, not eleven). A selected player whose answer is Unavailable (a late answer) gets a red badge **Said unavailable** and a second, red line "N selected players have since said they are unavailable"; neither blocks Announce.
4. One instruction line under it: "Tap a player's name for captain, wicketkeeper, batting position and more. Drag the handle to reorder."
5. **Three buttons only**: **Select players** (contained, `GroupsOutlined`), **Re-select from previous match** (outlined), **Announce team** (outlined; **Un-announce** when announced). Announce is disabled, with the missing-items text as its tooltip and `aria-describedby`, while the section 8 rule is unmet (the same text the server returns); a server 400 is also shown inline.

No C / WK toggle boxes, no per-row buttons, no Add player autocomplete, no Add Squad Member and no up/down arrows on the page.

**The list** (`TeamSelectionList`), inside one card, in this order:
- **Not in the batting order yet (N)** (shown only when N > 0, above the numbered places, a dashed-line label as in the mockup): selected players without a position, alphabetical. Rows have a drag handle, a dash in the number column, the name with ▾, badges.
- **Numbered places** 1..k (only the filled positions): drag handle, the number, the name with a small **▾**, a **Captain** / **Wicketkeeper** word badge where set (outlined primary chip), an **Unsure** / **No response** / **Not polled** badge where relevant (amber, neutral, neutral; text always present), and **Said unavailable** (red) and **Also in <team>** (info) markers where they apply. Colour is never the only signal.
- **12th man** in its own labelled row below a dashed "12th man" line, shown **only when `limits.twelfthManAllowed`**: the chosen player (same row anatomy, no number) or the placeholder "None chosen. Open a player's menu and choose Make 12th man." when the list is not empty.
- Empty state (nothing selected): "No players selected yet." with the Select players button emphasised.

**Tapping the name** (the whole name-plus-▾ is one button, `aria-haspopup="menu"`, accessible name "<Name>, open menu") opens a small MUI `Menu`:
- **Make captain**: moves the Captain badge to him (single-valued; reads "Remove as captain" when he is the captain). Hidden for the 12th man.
- **Wicketkeeper**: toggle with a check, single-valued. Hidden for the 12th man.
- **Batting position**: a number spinner (`aria-label` "Batting position for <Name>"), min 1, max = `min(battingPlaces, positioned count + (he is positioned ? 0 : 1))`. Committing (Enter or blur, not every keystroke) moves him to that position and shifts the others (the client builds the new full order and calls `reorder`). For a waiting player, or the 12th man, committing gives him a position and everyone from there down shifts. When all `battingPlaces` positions are filled and he has none, the spinner is disabled with "All N places are filled. Remove a player or make someone 12th man first."
- **Make 12th man** (only when `twelfthManAllowed`; for the 12th man himself it reads "Move into the batting order" and is disabled with the same reason when no place is free): sends `updateSide` with the side's current captain and keeper (cleared if it is him) and him as 12th man; his position goes, positions compact; the previous 12th man stays selected without a position.
- **Role** (**an addition to the approved mockup, flagged in Rollout Notes**): a submenu Batsman / Bowler / All-rounder, because `match_side_player.role` is required and shown on read-only views, and the approved menu has no way to set it; new selections default to Batsman, so without this control every role chip on the Match View and team sheet would be a default nobody chose.
- **Remove from team** (error colour): removes him from the selection. It is the same as unticking him in the dialog (it releases him) and un-announces an announced side (`040`).

**Sorting.** Three ways, all calling `reorder`: drag the ⋮⋮ handle (below); type the number in Batting position; on a phone the same spinner. Reorders, captain and keeper changes and the menu's other actions update the sides cache **optimistically** and roll back on error, so a drop never snaps back before the server answers.

**Drag and drop.** No drag-and-drop library is installed (`ui/package.json` has none). This spec **recommends `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** (stable, MIT, keyboard and touch support, no reliance on HTML5 drag events that do not work on touch; `react-beautiful-dnd` is deprecated and does not support React 19, which this repo uses). **This is a new dependency and needs the user's explicit approval before the build** (`CLAUDE.md` lists the approved additions; this is not one). Design with it: `DndContext` with `PointerSensor` (small distance), `TouchSensor` (short delay, tolerance) and `KeyboardSensor` with `sortableKeyboardCoordinates`; the **handle only** is the activator (`touch-action: none` on the handle alone, so the page still scrolls under a finger), `aria-label` "Reorder <Name>"; two sortable containers (the numbered places and the holding area); dropping on the numbered places at an index calls `reorder` with the new full order, dropping on the holding area removes his position; rows in the holding area are not reordered among themselves. Compatibility of the chosen release with React 19 is verified at install. **Fallback if the dependency is not approved:** no drag handle; the batting-position spinner stays, and the menu gains **Move up** and **Move down** (the `029` arrows relocated); the API and every other rule are identical, so this choice does not affect the backend.

**After Done** the manager sees the holding area (the mockup's "After pressing Done" state) with a line "**11 players are selected but the batting order is not set.** Drag them into order or open a player and type a position."

**Phone (375px first).** The list rows use the same tap menu as desktop (this follows the user's decision and **supersedes the mockup's phone sketch**, which showed C / WK toggles and a "⋯" menu); the drag handle is a 44px touch target; the header buttons stack full width; nothing scrolls sideways.

### 3. The Select players dialog (`SelectPlayersDialog`)

MUI `Dialog`, `fullScreen` on `xs` with a pinned footer. Title "Select players · Villagers 1"; subtitle "Sat 3 Oct, 10:00 · tick up to 12. Unticking removes a player from the team." (`maxSelected`, kickoff via `formatMatchDateTime`).

- **Switch** (two chips, as the mockup): first chip **"<Team name> squad"** for a roster pool, or **"Said available"** for a group-poll match (the default pool there); second chip **Whole section**. Changing it refetches the pool; ticked players are kept in local state across refetches.
- **Search** (debounced into the `q` param). When `truncated`, a caption "Showing the first 500. Refine your search."
- **Groups**, each a header row and its checklist rows (checkbox, name, availability badge):
  - **Available** (`availability = AVAILABLE`, selectable).
  - **Not confirmed**: Unsure, No response, Not polled; selectable, with their badge.
  - **Not possible**, greyed, no checkbox: taken (`In Villagers 2 · Sat 10:00`), said unavailable (`Said unavailable`), age ineligible (`reasonText`). Each blocked row offers one unblocking action:
    - **Release from <team>** (danger outlined, small) when `taken.canRelease`; otherwise the text **"Ask that team's manager to release this player"** (the user's wording was "him"; the codebase has no gender field, so the neutral form is used). See section 4.
    - **Change answer**: a link to the covering poll's Responses page (`/manage/availability/group/<roundId>` or `/manage/availability/squad/<matchId>/<pollId>`, the `coveredPollHref` targets of `075`), opened in a **new tab** so ticks survive; the pool query refetches on window focus.
- **Limit.** The count of ticked players (existing selection plus new, minus unticked) never exceeds `limits.maxSelected`: once reached, the unticked rows are disabled with "Team is full" and the footer shows it. Ticking beyond the limit is prevented client-side; the server enforces it again.
- **Footer** (pinned): "**11 of 12** selected", **Cancel**, **Done**. Done is disabled while nothing changed.
- **Done** calls `applySelection` with the ticked set (existing members carry no role or position so they keep theirs; new members carry none, so they land in the holding area). On success: close, invalidate sides and pool, and the page shows the holding area. On a 409 with `rejections`: the dialog stays open, an alert says "Some players can't be selected", each rejected row shows its `message` inline and is unticked, the pool refetches, and **nothing was saved**.
- **Add new player** link at the foot of the list (secondary): see section 6.

### 4. Release and Change answer

- **Release** opens a confirmation dialog: title "Release Jaden Botha from Villagers 2?", body "**Removes Jaden from Villagers 2's selection** for Sat 3 Oct, 10:00." (first name in the consequence line, as the user's wording). If `taken.announced`: a second warning line, "**Villagers 2's team is announced. This changes a published team.**" Buttons Cancel and **Release**. On confirm it calls the remove endpoint with `keepAnnounced=true` on the other match's side, **does not un-announce** that team, then refetches the pool (the row becomes selectable and is **not** auto-ticked: release, then tick him). Releasing from the other side of the same match works the same way.
- A release can leave an announced team short of players while still marked announced; the next edit of that team un-announces it, as `040` always did.
- **Change answer** mutates nothing here; the manager sets the answer on the Responses page (its existing override, `066`/`067`) and returns.

### 5. Re-select from previous match (`037` item 9, behaviour unchanged except the blocks)

The same button, the same previous-match picker (`listPreviousMatches`), the same Replace confirmation ("This replaces every player, role, and batting-order position currently set") and the same summary Alert, with these differences:
1. It first loads the pool with `wholeSection=true`. Source players that are not selectable in it (blocked, not in the pool, age ineligible) are **skipped** and reported with the pool's `reasonText`.
2. A non-empty destination is cleared with one `applySelection` with an empty list (an atomic release of the whole side), then the source's remaining players are applied in one `applySelection` call carrying their roles and their positions renumbered 1..k in source order (a gap left by a skipped player closes up); the source's 12th man is carried as a waiting row and designated afterwards, or reported as skipped when the new limits have no 12th man place or no room.
3. Captain, wicketkeeper and 12th man are restored with one `updateMatchSide` call for those still selected.
4. The summary reads "Copied 9 of 11 players from the previous team." and, when any were skipped, one line per player: "Jaden Botha is in Villagers 2's selection for that slot." / "Mark Steyn said he is unavailable." The three calls are not one transaction (today's per-player loop was not either); a failure after the clear leaves the side empty and the summary says so.

### 6. Add new player

The page's **Add Squad Member** button is gone (three buttons only). The same flow is reachable as an **Add new player** link inside the Select players dialog: the same `CreateAndLinkRecordDialog` + `PlayerForm` + `PLAYER_FORM_ID` and the same three-tab form, nested over the dialog. `createAndLinkPlayerMutation` now **always** adds the new player to the team's season roster (`addToSquad`); the group-covered branch that wrote `MatchSquadMember` is deleted. On success the dialog switches to **Whole section** and fills the search with the new player's name, because a brand-new player has no poll answer and would not appear in a group-poll match's "Said available" default. Nothing else about the flow changes.

### 7. Other screens that read a selection

- **Match View** (`MatchDetailPage`): the **Pick match squad** button and its `groupCovered` prop are removed; `TeamCard`'s "N of M picked" uses `side.limits.maxSelected` as M instead of the league's `maxPlayingXiSize` (so a 12th man counts); with no league the card keeps `075`'s rule (no bar, "N picked"); the "Playing XI" label is kept.
- **`PlayingXiSummary`** shows waiting players (a dash instead of a number, listed after the numbered ones) and shows the 12th man from his selection row exactly once (today he is drawn from `twelfthManPlayerId` only; the new rows must not draw him twice).
- **Team sheet PDF and WhatsApp text** (`teamSheetPdf.ts`, `teamSheetWhatsAppText.ts`): sort numbered players first by position, list waiting players after them without a number, and exclude the 12th man from the numbered list so the existing 12th man callout does not repeat him. Layout otherwise unchanged.
- **Match card** (`SelectionBlock`): M is `MatchDto.playingXiSize` (now `maxSelected`); the code is unchanged.
- **Player Availability grid**: the `picked` badge needs no UI change (Data Model Changes, section 10).

### 8. Retired UI and files

Deleted after a grep for other importers (the `075` practice): `components/PlayingXiBuilder/` (component, test, story, index; only `MatchFormPage` imports it), `components/MatchSquadPicker/` (same), `MatchSquadPanel` and its Match Squad tab in `MatchFormPage`, the Pick match squad button in `MatchDetailPage`, the `033` availability tinting helpers if nothing else imports them. `ui/src/api/matchSquadApi.ts` keeps `getMatchSquad` (coverage) and leaves its add / remove / jersey functions in place unused (roadmap cleanup).

## Test Plan

Per `docs/standards/testing.md` the full plan below is required, but **it is built in phase 2**; phase 1 builds the feature with the existing tests kept green and no new suite (Rollout Notes).

| Tier | Coverage |
|---|---|
| Backend unit: `SelectionLimitsResolver` | No league: 11 + 12th man (12). League of 11 with `allowSubstitutions` true: 11 + 12th (12); with it false or no conditions row: 11, no 12th man. League of 12: 12 places, never a 12th man, `maxSelected` 12 even with `allowSubstitutions` true. League of 14: clamped to 12. Conditions looked up per `(league, season)`. |
| Backend unit: `MatchSlots` (the slot rule matrix) | Day part boundary (11:59 Morning, 12:00 Afternoon). Same slot collides; morning and afternoon the same day do not; different days do not. Format matrix, this match against the other (T20/T30/unset/no league = one slot; T45/T50/ONE_DAY take both; THREE_DAY three dates, FIVE_DAY five dates): a one-day match at 09:00 blocks an afternoon T20, an afternoon T20 blocks nothing in the morning, a five-day match four days earlier blocks, one six days earlier does not, a three-day match two days earlier blocks. Midnight rollover (23:30 local). Another club's match ignored. A deactivated match ignored. The other side of the same match counts (derby). The 12th man row counts as taken. The player's own side is excluded; a duplicate that already exists is reported as `taken` alongside `selected`. |
| Backend unit: `SelectionAvailabilityResolver` | GROUP: AVAILABLE / UNSURE / UNAVAILABLE read from the window's responses; no row in the audience is NO_RESPONSE, outside it NOT_POLLED; the answer is shared by every match of the window. SQUAD: per-poll answers, null status is no answer, a player outside the team's squad is NOT_POLLED. NONE: all NOT_POLLED. Group beats squad. A derby evaluates each side's own coverage. Only `UNAVAILABLE` blocks. |
| Backend unit: `SelectionEligibility` and the membership rule | Roster member, section-tagged non-roster member, descendant-section member selectable; another section's player, an inactive player, another club's player not; age rule messages unchanged; missing date of birth under an age rule fails. Cross-club team side: roster only. The group-coverage branch is gone (a group-covered match uses the same rule). |
| Backend unit: `MatchSideServiceImpl` (existing endpoints) | `addPlayer` enforces pool, duplicate (409), total cap, age, taken (409), unavailable (409), takes the advisory lock, gives the next position only while positions remain; `updateSide` rejects captain / keeper who are not selected or are the 12th man, rejects a 12th man where not allowed, adds a not-yet-selected 12th man through the same checks, removes his position and compacts; `removePlayer` compacts positions, clears captain / keeper / 12th man, un-announces by default and **not** with `keepAnnounced=true`; `reorder` with the exact current set (old behaviour), with a waiting player included (gets a position), with the 12th man included (un-designated), with a list over `battingPlaces`, with duplicates, with a non-selected id; `announce` rule matrix (zero players; waiting players; over places; over the maximum; message text exact, including the "and N more" form). |
| Backend unit: apply selection | Adds, removes and keeps; roles and positions applied; positions compact; kept players not re-validated; **atomicity**: one blocked player among five persists nothing and returns every rejection; reasons `TAKEN_FOR_SLOT`, `SAID_UNAVAILABLE`, `AGE_INELIGIBLE`, `NOT_IN_POOL`, `TEAM_FULL`, `POSITION_INVALID`; empty list clears; duplicates 400; idempotent re-apply; announced side un-announced; locks taken in ascending id order. |
| Backend unit: pool | Default pool for roster, squad poll and group poll (yes-sayers only); whole section is a superset; selected players always listed; `q` search; the 500 cap and `truncated`; `canRelease` true for a manager of the other team's section and for a club admin, false otherwise and for another club's team; reason precedence; entries sorted by name. |
| Backend integration (Testcontainers, `AbstractIntegrationTest`; no class-level `@Transactional`) | The new `MatchRepository` window query; `SelectionLockRepository` and **two concurrent applies for one player** (one succeeds, one gets 409); apply through the controller (200, a 409 body carrying `rejections`, 403 for another section); the pool endpoint end to end for the three coverage kinds; remove with and without `keepAnnounced`; `MatchServiceImpl.list` returns `playingXiSize` as `maxSelected` with one conditions lookup per page; `PlayerAvailabilityServiceImpl` `picked` is true for a 12th man and ignores `MatchSquadMember` rows; deleting a group poll succeeds with stale match-squad rows. |
| Migration test (Testcontainers, modelled on `075`'s) | A `...through-037` test-only changelog beside the existing ones; applying `038` with data present: `batting_order` accepts NULL, two NULLs in one side are allowed, two equal non-NULL positions still violate the unique constraint, every existing 12th man gains exactly one row with NULL order and role `BATSMAN`, a 12th man already present as a row is not duplicated. |
| Access rules | A section-scoped manager: pool and apply on his own section's match, 403 on another's; `canRelease` true only for teams in his section tree; release endpoint 403 on a match with no section of his; club admin everywhere; the derby leniency pinned by a test of today's behaviour. |
| Contract | `openapi.yaml` additions plus the one nullability change; the contract diff passes (or the change is explicitly allowed). |
| Component (Vitest/RTL): `TeamSelectionList` | Numbered places, holding area above them only when non-empty, 12th man row only when allowed, placeholder; Captain / Wicketkeeper word badges, single-valued; Unsure / No response / Not polled / Said unavailable / Also in badges; the menu items and their visibility (captain / keeper hidden for the 12th man; Make 12th man hidden when not allowed); the position spinner commits on Enter and blur and builds the right full order (move up, move down, waiting player in, all places full disables it); Remove; Role submenu; drag by the keyboard sensor reorders and drops into and out of the holding area; no per-row buttons exist. |
| Component: `SelectPlayersDialog` | Groups and their members; the switch labels ("<Team> squad" vs "Said available") and refetch; search sends `q`; ticking, unticking, "Team is full" at the limit and the footer count; blocked rows: Release vs "Ask that team's manager", Change answer link targets and `target="_blank"`; Release confirmation text (exact, with and without the announced warning), calls remove with `keepAnnounced=true`, refetches, does not auto-tick; Done payload (no roles, no positions); a 409 keeps the dialog open with per-row messages; full screen on `xs` with a pinned footer; Add new player flow switches to Whole section. |
| Component: page (`MatchSideTab` / `MatchFormPage`) | Header summary and progress; the three buttons only; the unconfirmed line (counts, none when all confirmed, the no-poll wording); the late-unavailable red line; Announce disabled with the exact missing-items text and enabled when complete; tabs Details / Home XI / Away XI with no Match Squad; `?tab=match-squad&side=` lands on the XI tab; optimistic reorder and rollback; Re-select: blocked players skipped with reasons, summary text, destructive confirmation, 12th man handling. |
| Component: readers | `PlayingXiSummary` waiting players and a single 12th man; team sheet PDF and WhatsApp text with null positions and the 12th man as a row; `MatchDetailPage` has no Pick match squad and shows M from `limits`; `matchApi` / `matchSideApi` types. |
| Browser check (the six practical scenarios from the mockup, at 375px and desktop) | (1) **Juniors**: A at 09:00 ticks Liam; B at 09:00 shows him under Not possible · In A team; C at 14:00 shows him Available; the Whole section switch lists other age teams' players who said yes. (2) **Two senior sides sharing a player**: Villagers 2 ticks Jaden; Villagers 1's dialog shows him blocked; Release from Villagers 2 (confirm text), then tick him. (3) **National champs 50-over, 12 selected**: eleven in order plus a 12th man; all twelve taken for both slots of the day; a 20-over afternoon match the same day shows them blocked; a substitution before the toss is Remove from team on one, tick the replacement (the mockup's "tap ×" is the menu's Remove, there is no per-row ×). (4) **Said unavailable, then phoned**: Mark is blocked; Change answer opens the Responses page in a new tab; after the correction the dialog refetches on focus and he can be ticked. (5) **Team is full**: twelve ticked, the rest grey out. (6) **Re-select from previous match**: Jaden and Mark skipped with reasons in the summary. Plus: the holding area after Done, drag and the spinner both reorder, Announce is blocked with the exact message then succeeds, releasing from an announced team shows the extra warning and the team stays announced, nothing scrolls sideways at 375px. |
| End-to-end / smoke | Phase 2: extends the existing matches flow (not in CI per precedent) with select, apply, announce; plus smoke tests of the two new endpoints against a running app (the `docs/standards/backend.md` lazy-field point: a real running app, not an ambient transaction). |

## Acceptance Criteria

- A team's Home XI / Away XI tab shows one list of the selected players, "N of M selected" with M = the league's batting places plus a 12th man place only where the conditions allow one, never above 12; no Match Squad tab exists and the Match View has no Pick match squad button.
- A league of 12 has 12 places and no 12th man row; a league of 11 whose conditions allow substitutions has 11 places and one 12th man row; with no league there are 11 places and a 12th man row.
- The page has exactly three buttons (Select players, Re-select from previous match, Announce team), no C / WK boxes, no per-row buttons; tapping a name opens a menu with Make captain, Wicketkeeper, Batting position, Make 12th man where allowed, and Remove from team (plus Role, if confirmed); captain and keeper are one player each, shown as words.
- Players can be reordered by dragging the handle (if the dependency is approved), by typing a batting position (others shift) and, on a phone, by the same spinner; positions never have gaps.
- After Done, newly ticked players appear under "Not in the batting order yet (N)"; players already ordered keep their positions.
- Announce is refused (button disabled with the reason, and the server returns a 400) until every selected player except the 12th man has a position; the message names exactly what is missing; captain and keeper are not required.
- The server refuses (409, on every add path, not just the UI) a player who is in another team's selection of the same club for an overlapping slot, including the other side of a derby; a player can play one morning and one afternoon match the same day; a one-day, 45-over or 50-over league's match blocks both slots of its day; three-day and five-day leagues' matches block 3 and 5 consecutive dates.
- The server refuses (409) a player whose answer on the poll covering this match is Unavailable, read from the match's group window or its squad poll; Unsure, No response, Not polled and no poll are allowed, shown with a badge and one summary line, never a dialog.
- The Select players dialog lists Available, Not confirmed and Not possible groups, searches by name, switches between the team's squad (or the people who said available on a group poll) and the whole section, prevents ticking beyond the limit ("Team is full"), shows "<n> of <max> selected", and on Done adds and removes in one atomic request that either fully applies or changes nothing and lists a reason per refused player.
- A taken row offers "Release from <team>" when the manager may administer that team (after a confirmation reading "Removes <first name> from <team>'s selection"), and "Ask that team's manager to release this player" otherwise; releasing from an announced team shows "This changes a published team." and leaves it announced; a said-unavailable row offers Change answer, opening that poll's Responses page in a new tab.
- Re-select from previous match skips players who are now blocked and reports each with its reason; otherwise it copies order, roles, captain, keeper and 12th man as before.
- Add new player is available inside the dialog, adds to the team's season roster and selects nothing by itself.
- Unticking a selected player in the dialog, or Remove from team, takes him out of the selection and frees him for other teams.
- The Player Availability grid shows "picked" for a player on any side's selection, the 12th man included, and ignores `MatchSquadMember` rows; deleting a group poll no longer fails because of leftover match-squad rows.
- Two concurrent selections of one player for one slot produce one success and one 409.
- Existing data is not altered except by migration `038` (positions may be NULL; every existing 12th man becomes a selection row); sides already over the limit or duplicated are marked, not trimmed.
- The team sheet PDF and WhatsApp text, `PlayingXiSummary` and the match card read the new selection correctly (waiting players, a single 12th man, M = `maxSelected`).
- On a 375px screen the dialog is full screen with its footer pinned, the page list uses the tap menu and nothing scrolls sideways.

## Rollout Notes

- **Two phases, one PR, not merged until phase 2** (`CLAUDE.md` principle 5). The user wants a first run built and reviewed by hand before tests are added.
  - **Phase 1 (first run):** backend first (migration `038`, entity and DTO changes, `SelectionRules` and its parts, the new exceptions and handler, the apply and pool endpoints, `keepAnnounced`, limits in `MatchSideDto` and `MatchDto`, `loadPicked`, the round-delete change, `openapi.yaml`), then the frontend (page, dialog, release, re-select, retired components). The **existing tests are kept green**: update only the tests the replacement necessarily breaks (`MatchSideServiceImplTest` and `MatchSideControllerIntegrationTest` for the removed group-coverage branch, the cap and `battingOrder` nullability; `MatchSquadServiceImplTest` only if shared code moved; `SectionAvailabilityRoundServiceImplTest` for the removed delete guard; `PlayerAvailabilityGridRepositoryTest` and the grid's `picked` expectations; `MatchServiceImplTest` for `playingXiSize`; `MatchFormPage.test.tsx`, `MatchDetailPage.test.tsx`, the deleted `PlayingXiBuilder` and `MatchSquadPicker` tests and stories; `PlayingXiSummary`, team sheet and `matchApi` fixtures). **No new test suite is written in phase 1.**
  - The PR stays a **draft** until the user has tried phase 1. CI is expected to be red on the draft for the gates that demand tests (the component folder-shape check for the two new components, diff coverage on the new service classes); that is accepted for phase 1 and is not to be "fixed" by loosening a gate.
  - **Phase 2:** the full Test Plan above, the Storybook stories for the two new components, and the smoke tests. The branch is merged to `master` only after phase 2.
- **New dependency, needs the user's approval before the build starts:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (UI section 2). Without approval the build uses the Move up / Move down fallback and the drag handle is omitted; nothing else in this spec changes. If approved, `CLAUDE.md`'s tech-stack table gets the approved-addition line in the build PR.
- **Amends earlier specs** (the build PR adds an "Amended by `076`" note to each Status line, as `072` to `075` did): `029` (the cap and the twelfth man: the 12th man counts in the total of 12, is a selection row, and exists only where the conditions allow one; squad membership becomes the pool rule; batting order is optional), `037` (items 5 to 9: the Captain / Wicketkeeper / Twelfth man block, the order stepper, the Add player autocomplete and Add Squad Member placement, and Re-select's blocked-player handling are re-expressed; the rest of `037` stands), `040` (announce gains the position rule; removing a player can be told not to un-announce, for release only), `063` (Part B/C: the Match Squad picker is retired; the hard block per window and its unique constraint are no longer read; the "cross-section double-booking isn't prevented" limitation in its Rollout Notes is closed within one club by the slot rule), `064` (the Match Squad tab and the group-covered XI pool restriction are removed; coverage and "covered by" links stand), `075` (tab order is Details, Home XI, Away XI; `?tab=match-squad` now opens the XI tab; the Pick match squad button is removed; `TeamCard`'s M is `limits.maxSelected`). Also touched, so note them too: `030` (team sheets read null positions and the 12th man as a row), `033` (tinting replaced by badges), `068` (`picked` meaning), `069` (`playingXiSize` now `maxSelected`).
- **`docs/roadmap.md`** (living index; update in the build PR, not by this spec): add (1) **dormant `MatchSquadMember` cleanup**: the table, repository, `MatchSquadService`, the five endpoints, DTOs, client functions, `RoundHasMatchSquadException`, and a lean coverage endpoint to replace `GET .../squad` as the coverage source (that call also still builds a heavy candidate list on every page load); (2) a **database-level slot constraint** to replace the advisory lock; (3) the **slot-based multi-team Selection planner using Coverage** (`074`), extending `075`'s planner item, now that the guard exists; (4) **long-format occupancy refinements**: an end date or duration on `Match`, non-consecutive multi-day matches, early finishes and rain days, and re-validating when a match is rescheduled or a league's format changes; (5) an **"Order as ticked"** shortcut if the holding area feels slow; (6) **release notifications** to the other team's manager; (7) tightening the derby leniency of the side endpoints to per-team section checks; (8) a per-club timezone (existing item, now also load-bearing for the slot rule). Mark as resolved by this spec the cross-section double-booking item `063` raised.
- **Drafts `055` and `058` (not built, not touched, not committed).** `055` would move `maxPlayingXiSize` onto `LeaguePlayingConditions`: only `SelectionLimitsResolver` reads it, so whichever builds second changes one class. `058` (auto-select the team captain) edits `MatchFormPage`'s Playing XI tabs and `PlayingXiBuilder`, which this spec deletes: `058` must be re-read against this spec before it is built, and its "captain from `TeamSquadMember.isCaptain`" idea fits the new menu (a default for Make captain) rather than the old dropdown.
- **`docs/architecture.md`** is unaffected (no change to Person / Contact / RoleAssignment / Club / auth).
- **Open points for the build and for the user** (none re-opens a decision above): (a) the dependency approval; (b) the **12th man source**: this spec reads "where the conditions have one" as `LeaguePlayingConditions.allowSubstitutions` for the match's league and season (`029` called it informational and allowed a twelfth man regardless), with a friendly (no league) keeping a 12th man and a league without a conditions row getting none; (c) a league `maxPlayingXiSize` above 12 is clamped to 12; (d) the **Role** menu item is an addition to the approved mockup, proposed because `role` is required data and would otherwise be a silent default; (e) a selected player who later says unavailable does not block Announce; (f) multi-day formats are modelled as 3 and 5 consecutive dates from the format name; (g) the no-poll case shows one summary line instead of a badge on every row; (h) the apply endpoint has set semantics, so two managers editing one side at once can overwrite each other's additions (last write wins within a side; the slot and unavailable blocks still hold).
