# 064 — Unified Availability Polls

**Depends on:** `032-match-availability-polls.md` (`MatchAvailabilityPoll`/`PlayerAvailability`, the per-match "squad poll"), `034-availability-polls-dashboard.md` (the open-polls dashboard this spec extends), `063-section-availability-and-flexible-squads.md` (`SectionAvailabilityRound`/`Window`/`WindowMatch`, `MatchSquadMember`, the fixture-group resolver, the "group poll"), `029-team-squads.md` (`TeamSquadMember`, the season roster), `033-availability-aware-xi-builder.md`, `035-section-scoped-access.md`.
**Status:** approved — supersedes `063`'s `Team.squadMode` switch; everything else in `063` stands. Amended by `073-availability-hub.md`: the list header and New poll action move into the shared Availability hub layout; the single Availability dashboard tile is the entry point. Amended by `075-match-view-and-edit.md`: "Open match" and the covered-by links now target the Match View and the covering poll's Responses page. Amended by `076-team-selection.md`: the Match Squad tab and the group-covered XI pool restriction are removed; coverage and the covered-by links stand.

## Problem & Goals

`063` made "how a team asks about availability" a property of the *team* (`Team.squadMode = STATIC | FLEXIBLE`), and gave group polls their own screen (`/manage/section-availability`) separate from `034`'s open-polls dashboard (`/manage/availability`). Hands-on use showed both choices are wrong. The right decision-maker is the person *creating a poll*, not a team setting made weeks earlier: a team should be able to have a per-match squad poll for one fixture and sit inside a group poll for another. And a club admin wants one place that lists every open poll, with a "New poll" button — the record-list pattern used everywhere else (`ListToolbar` + `RecordCard` + create screen) — not a proposal area stacked above a card grid on a second, separate screen.

**Goals**
- One screen, `/manage/availability`, lists every open poll of both kinds (**Squad** poll = `032`'s per-match poll; **Group** poll = `063`'s round), each as a `RecordCard` with a type badge, under a `ListToolbar`, with a **New poll** button.
- **New poll** asks the creator which kind: *Squad* (one team, one or more of its matches, each match getting its own `032` poll) or *Group* (a section, ticked fixtures across any of its teams/leagues, one `063` round — today's fixture-group flow, moved).
- `Team.squadMode` is removed. Every team has the season roster (`029`) and can be covered by either kind of poll, chosen per match.
- A match is covered by **at most one poll in total**, of either kind. A poll created by mistake can be **deleted** to free its matches.
- The squad picker follows the poll covering the match, not a team setting.
- **Squad polls get the same Autoclose option group polls have** (default on, closes 24 hours before the match), and autoclose is **actually enforced for both kinds**. Today `063`'s `autoClose`/`scheduledCloseAt` are stored but nothing reads them, so a group poll never closes by itself; adding a second toggle that does nothing would repeat that.

## Non-goals

- **Re-confirming a match already in a group poll with a second, per-match poll** (e.g. a Friday "still available?" ask). Real use case, deliberately not designed here — the one-poll-per-match rule is what keeps "who is available for this match" single-sourced. Future item if it matters.
- **Editing a group poll's selected matches after creation / moving a match between polls.** Unchanged from `063`; deleting and recreating the poll is the way to change coverage this pass.
- **A new backend "all open polls" union endpoint.** The dashboard merges the two existing open-poll queries client-side (open polls are bounded to what is live right now, as `034` already reasoned). Revisit only if a club's concurrent open polls make the merge visibly slow.
- **Reminder messages before a poll closes.** `063` deferred the "warn when a poll is about to close / resend" mechanism; this spec only closes polls on time. Still a separate future item.
- **Any change to the public response pages** (`/availability/:pollId`, `/section-availability/:roundId`), `MORNING`/`AFTERNOON` bracketing, autoclose, the `MatchSquadMember` hard block, or `033`'s tinting. All unchanged.
- **A full closed-poll history.** Added after approval (user decision, see Amendments): a **Show closed polls** switch lists closed polls so they can be reopened or deleted, but only the 50 most recent closed polls of each kind, not an unbounded paginated history. A season-long poll-response history remains a future item.

## User Stories

- As a club admin, I land on one list of every open poll in my club — squad and group alike — and see at a glance which kind each is.
- As a club admin, I click **New poll** and choose Squad or Group.
- As a club admin creating a Squad poll, I pick a team and tick any of its upcoming matches that aren't already covered by a poll; each ticked match gets its own poll and link.
- As a club admin creating a Squad poll, I can leave **Autoclose** on (default) so each poll closes itself 24 hours before its match, with the computed close time shown, or switch it off to close manually. With several matches ticked, each poll gets its own close time from its own match.
- As a club admin, a poll with Autoclose on really does close at its close time, whichever kind it is, without anyone clicking Close.
- As a club admin creating a Group poll, I pick a section and tick fixtures from any of its teams (as `063` built), grouped by date.
- As a club admin, a match already covered by any poll is shown disabled with a link to the poll that covers it, in both flows.
- As a club admin, I can delete a poll created by mistake, freeing its matches for a new one.
- As a team manager, a match's squad source follows how it was polled: covered by a group poll → I pick from the people who said yes (with the same-player-twice block); otherwise → I pick from the team's season roster, tinted by a squad poll's answers if one exists.
- As a club admin, no team setting forces a polling style any more; `TeamForm` no longer has a squad-mode field.

## Data Model Changes

Migration `backend/src/main/resources/db/changelog/v1/NNN-drop-team-squad-mode.sql` (next sequential number, via `new-migration`): `ALTER TABLE team DROP COLUMN squad_mode`. **Nothing is deployed, so there is no production data to preserve and no backward compatibility to design for.** No data migration or backfill: the column is simply dropped, and any group polls/`MatchSquadMember` rows in a local dev database are throwaway test data that may be cleared. A forward migration is still used rather than editing `063`'s already-applied changesets in place, so existing local databases upgrade without Liquibase checksum errors.

**Squad poll autoclose.** `match_availability_poll` gains `auto_close BOOLEAN NOT NULL DEFAULT true` and `scheduled_close_at TIMESTAMPTZ` (same meaning as `section_availability_round`'s columns of the same names, which already exist from `063`; these are new columns on the poll table), in the same migration: `scheduled_close_at` = the match's kickoff minus 24 hours, computed at creation, null when `auto_close` is false. Open rounds already have the columns from `063`.

**Enforcement.** A scheduled job closes every poll where `open = true AND auto_close = true AND scheduled_close_at <= now()`, for both tables, through the existing close service methods (so a group poll still cascades to every window and the same `updated_at`/audit behaviour applies). It runs every few minutes, not hourly, so a poll never stays open more than a few minutes past its time. Mechanism (plain `@Scheduled` vs the Spring Batch job `063`'s roadmap item names, and single-instance locking if the backend ever runs more than one node) is settled in the plan; nothing in this repo schedules anything yet. If a poll's match is rescheduled, `scheduled_close_at` is **not** recomputed this pass (stays as computed at creation), matching `063`'s group-poll behaviour.

**Coverage is resolved from data, not from the team.** A match+side is "group-covered" iff a `section_availability_window_match` row links the match to a window (the explicit join table `063` already has, `match_id` unique). It is "squad-poll-covered" iff a `MatchAvailabilityPoll` exists for that match+team. The two are mutually exclusive, enforced at the service layer on both create paths (`409` naming the covering poll), with `063`'s DB unique on `window_match.match_id` as the existing backstop for group-vs-group.

**Deletion frees coverage.** Today a window's `(section, date, day-part)` uniqueness holds "for the lifetime of the data, across every round past and present" (`063`) — with a delete action that has to be re-examined at plan time: deleting a round deletes its windows, `window_match` links and responses, so those brackets and matches become pollable again. A round with any `MatchSquadMember` rows against its windows cannot be deleted (`409`) — the manager's picks are real work; remove them first. Deleting a squad poll cascades to its `PlayerAvailability` rows.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET/POST/PUT …/teams` (and `TeamDto`/`Create/UpdateTeamRequest`) | unchanged | `squadMode` field removed from request and response. OpenAPI schema re-checked into git. |
| `POST …/matches/{matchId}/polls` (`032`) | unchanged | Body gains `autoClose: boolean` (default `true` when absent); response and the poll DTOs gain `autoClose`/`scheduledCloseAt`. No longer `400`s with `TeamSquadModeMismatchException`; instead `409` if the match is already covered by a group poll (naming it). |
| `DELETE /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}` | same section-scoped gate as the poll's other admin endpoints | **New.** Deletes a squad poll and its responses. |
| `DELETE /api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}` | `canAccessClub` + `assertCanAdministerSection(round.sectionId)` | **New.** Deletes a group poll, its windows/links/responses; `409` if any `MatchSquadMember` exists for its windows. |
| `GET …/sections/{sectionId}/section-availability-fixture-groups` (`063`) | unchanged | No longer filters to `FLEXIBLE` teams — every upcoming match involving any team of the section is proposed. A match covered by *either* poll kind is returned `alreadyPolled`, with the existing fields generalised to name the covering poll's kind (`SQUAD`/`GROUP`), id and description (exact DTO shape settled in the plan). |
| `POST …/section-availability-rounds` (`063`) | unchanged | Drops the "must be a `FLEXIBLE` team" validation; adds `409 MatchAlreadyPolledException` for matches covered by a squad poll. |
| `GET …/matches/{matchId}/teams/{teamId}/squad` (`063`) | unchanged | No longer `400`s for non-`FLEXIBLE` teams; returns `windowId: null` when the match isn't group-covered. |
| Playing-XI membership check (`MatchSideServiceImpl.requireSquadMembership`) | n/a | Branches on **coverage** (group-covered → `MatchSquadMember`; else `TeamSquadMember`), not `squadMode`. |
| `GET …/availability-polls/open` and `GET …/section-availability-rounds` (existing) | unchanged | The two sources the dashboard merges client-side. |

`TeamSquadModeMismatchException` is removed with its two throw sites. The auto-close job has no endpoint; it calls the existing close paths internally.

## UI Requirements

Composes existing shared components only (`ListToolbar`, `RecordCard`, `ManageScreenHeader`, `RecordFormScreen`, `EmptyState`, `Button`, `Input`) — per the mandatory record-list pattern (`docs/standards/design-system.md`, `frontend.md`). New: a `PollTypeBadge` chip (or a `RecordCard` badge entry — whichever the existing `RecordCardBadge` already supports), and `NewPollPage`.

- **`/manage/availability` (`AvailabilityPollsDashboard`, extended):** `ListToolbar` (search by team/opponent/description, type filter All/Squad/Group, section filter via `SectionTreeSelect`), a **New poll** primary button, and a card grid mixing both kinds, ordered by soonest covered match. Squad cards keep `034`'s card (avatar summaries, Edit deep-link into `MatchAvailabilityTab`) and gain a **Closes** row (or "Closes manually" when Autoclose is off); Group cards keep `063`'s `RoundCard` content (description, per-bracket response summaries, inline description edit, open/close, share link). Both gain a **Delete** action with a confirm dialog explaining what is removed.
- **`/manage/availability/new` (`NewPollPage`):** step 1 — two choice cards, *Squad poll* ("one match, one team's roster") and *Group poll* ("a section's fixtures, one link"). Squad branch: team select (section-scoped to the caller's access) + upcoming matches of that team, covered ones disabled with a link, tick one or more, **Open N polls**. Group branch: today's section picker + fixture-group cards (description, autoclose, tickable matches, **Open poll**), moved here verbatim from `SectionAvailabilityRounds`. Each ticked match shows its own computed close time, and an **Autoclose** switch (default on) above the **Open N polls** button applies to all of them, with the same helper text as the group flow ("Automatically closes 2 Oct 2026, 14:00, 24 hours before the match"). Supports `?type=group&sectionId=…&matchId=…` for the existing "no poll yet" shortcuts from the match page.
- **`/manage/section-availability`** redirects to `/manage/availability/new?type=group`, keeping the incoming query string (so the match page's existing `?sectionId=&matchId=` shortcuts keep working); the dashboard's nav entry/card is the only entry point.
- **`TeamForm` / `TeamFormPage`:** `squadMode` field removed; the Squad (season roster) tab always shows. **`MatchFormPage`:** each side's Availability and Match Squad sub-tabs branch on that side's *coverage* (`windowId` from the squad endpoint, and the squad poll lookup) instead of `team.squadMode`; an uncovered side shows both "Open a squad poll" and "Open a group poll" shortcuts into `NewPollPage`.
- `MatchList.tsx`'s and every test/story fixture's `squadMode` field removed.

## Test Plan

- **Backend unit/integration (`testing.md`):** squad poll create computes `scheduledCloseAt` (kickoff − 24h) when `autoClose` is true and null when false, defaults to on when the field is absent; the auto-close job closes an overdue open `autoClose` poll of each kind (a group poll cascading to every window), leaves not-yet-due, already-closed and `autoClose = false` polls alone, and is idempotent when run twice; create-squad-poll `409`s when the match is group-covered; create-round `409`s when a selected match has a squad poll; fixture-groups resolver proposes matches for non-`FLEXIBLE`-era teams and flags squad-poll-covered matches `alreadyPolled` with the poll kind; delete round (cascade; `409` with `MatchSquadMember` rows; frees the match for re-polling); delete squad poll (cascade, frees the match); `requireSquadMembership` resolves by coverage in both directions; squad endpoint returns `windowId: null` instead of `400` for an uncovered match; section-scope `403`/`404` on both new `DELETE`s; migration applies cleanly to a fresh database and to one that already has `063`'s schema; `backend/openapi/openapi.yaml` regenerated (the repo has no automated contract-diff test, despite `testing.md`).
- **Frontend (Vitest/RTL):** squad branch Autoclose switch shows the computed close time per ticked match, sends `autoClose` in each create call, and the card shows Closes / "Closes manually"; dashboard renders both kinds with correct badges, type/section filters, empty state; New poll chooser routes to each branch; Squad branch ticks several matches → N create calls; covered matches disabled with link; Group branch round-trips description/autoclose/selection as `063`'s tests did; delete confirm calls the right endpoint per kind; `TeamForm` has no squad-mode field; `MatchFormPage` branches on coverage. Updated Storybook stories for any changed shared component.
- **Playwright e2e:** create a squad poll and a group poll for two different matches of the same team from one screen; see both in one list; delete one and re-poll its match.

## Acceptance Criteria

- `/manage/availability` lists every open squad and group poll in one record-list-pattern screen with a **New poll** button; `/manage/section-availability` redirects there.
- **New poll** offers Squad and Group; Squad creates one poll per ticked match; Group behaves exactly as `063`'s fixture-group flow did.
- No `squadMode` appears anywhere in the API, DB, forms, or UI; no team needs configuring before it can be polled either way.
- A squad poll can be created with Autoclose on (default) or off, and shows its close time on the card.
- An open poll with Autoclose on, of either kind, is closed automatically within a few minutes of its close time; polls with it off, or not yet due, are untouched.
- Closing any poll asks for confirmation first; a closed poll is visible under **Show closed polls**; **Reopen** is offered only until the automatic close time (or any time when Autoclose is off) and refused by the server afterwards.
- A match cannot be in two polls of any kind; the second attempt is rejected (API `409`) and disabled in the UI with a link to the covering poll.
- Deleting a poll frees its matches; a group poll with picked squad members refuses deletion with a clear message.
- The migration applies cleanly to a fresh database and to a developer's existing local one.

## Amendments after approval

Decisions made during build, with the user's agreement:

- **Show closed polls.** Closed polls used to vanish from the list yet keep covering their matches and could not be deleted, so *Deleting a poll frees its matches* was unreachable for them. The dashboard gets a **Show closed polls** switch (off by default, reset on every visit, not persisted, same as Matches' **Show past matches**). It adds closed squad polls via new `GET /api/v1/manage/clubs/{clubId}/availability-polls/closed?sectionId=` (same DTO and section scoping as the open endpoint, ordered by match date descending, capped at the 50 most recent) and closed group polls via the existing `GET …/section-availability-rounds?open=false`. Closed cards show a **Closed** badge, **Delete**, and **Reopen** when allowed. `?showClosed=true` presets the switch (used by "covered by" links to group polls).
- **Closing asks for confirmation.** Every Close action (dashboard cards of both kinds and the match Availability tab) opens a confirm dialog first, because closing by accident is too easy.
- **Reopen only until the automatic close time.** Reopening a poll with Autoclose on is refused (`409`, "This poll can no longer be reopened because its automatic close time has passed.") at or after its `scheduledCloseAt`; a poll with Autoclose off can be reopened at any time. The UI hides **Reopen** and shows "Closed. Can no longer be reopened." once that time has passed. A reopened poll still closes again at its close time. Deleting stays available.
- **Squad-poll coverage in the fixture-group proposal is team-scoped** (match + team), as in `create`; only group coverage blocks both sides of a match.
- **Squad Autoclose helper text** reads "Each poll closes by itself 24 hours before its match. Switch off to close them manually." with a per-match "closes <date time>", as in the approved design, rather than the group flow's single-sentence form.
- The `Team.squadMode` column drop, scheduler (`@Scheduled`, 5 minutes, single node, gated by `cricketlegend.autoclose.enabled`), `AutoCloseSchedule` shared 24-hour rule, and `MatchPollCoverageService` are as described in the plan.

## Rollout Notes

- **Sequencing:** (1) backend — migration, drop `squadMode`/`TeamSquadModeMismatchException`, coverage-based branching, cross-kind `409`s, the two `DELETE`s, resolver/fixture-groups generalisation, regenerate OpenAPI; (2) frontend — remove `squadMode` everywhere, dashboard merge, `NewPollPage`, redirect, `MatchFormPage` branching. Backend first; the UI can't drop the field until the API does.
- **This is a contract change to `063`**, which is why it is a spec: `063`'s "second opt-in mode, existing alongside, never replacing" stance is reversed. `063` should get a note pointing here once approved, and `docs/roadmap.md` should mark its "fold into `034`" item resolved and note this spec; `docs/architecture.md`'s relevant diagram should lose `squadMode`.
- **The auto-close job is new infrastructure for this codebase** (no scheduler exists today). It is in scope because the toggle is meaningless without it, and it closes `063`'s own deferred "enforce `scheduledCloseAt`" roadmap item; `docs/roadmap.md` should be updated to say so. Reminder warnings stay deferred.
- **Open for the plan to settle:** the scheduler mechanism and locking (above); exact `alreadyPolled` DTO generalisation; whether the window `(section, date, day-part)` uniqueness becomes "per live round" or deletion alone is enough; the bound on rounds/polls shown if a club ever has very many open at once.
