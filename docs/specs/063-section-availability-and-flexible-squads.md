# 063 - Section Availability Windows & Flexible Match Squads

**Depends on:** `001-tenancy-identity-model.md` (`Section`, `Team`, `PlayerProfile`, the tenancy shapes every new entity below hangs off), `025-club-structure.md` (`Section`, its flat non-recursive tree, this spec's `SectionAvailabilityWindow` scopes to exactly one `Section` row, not a descendant closure, matching `025`'s own non-enforced, non-recursive posture for `Section` metadata), `026-teams.md` (`Team.section_id`, this spec adds `Team.squadMode` alongside it), `028-players.md` (`PlayerProfile`, `PlayerSection`, this spec's entire eligibility/audience model for a section-level ask reuses `PlayerSection` unmodified, exactly the "eligible for section" concept the brainstorm behind this spec asked to be found and reused rather than reinvented), `029-league-management.md` (`Match`, `MatchSide`, `MatchSidePlayer`, `TeamSquadMember`, `League`, `Season`, this spec's `MatchSquadMember` is the per-match analogue of `TeamSquadMember` for `FLEXIBLE` teams only, and amends `MatchSideServiceImpl`'s existing squad-membership check to branch on `Team.squadMode`; `STATIC` teams' use of `TeamSquadMember`/`MatchSide`/`MatchSidePlayer` is entirely unchanged), `031-jersey-numbers.md` (`TeamSquadMemberDto`'s flat, player-plus-squad-context DTO shape and its `jerseyNumber`/`squadJerseyNumber` two-number model, `MatchSquadMemberDto` below mirrors this shape field-for-field rather than inventing a third one, so `PlayingXiBuilder` needs zero changes to consume either), `032-match-availability-polls.md` (`MatchAvailabilityPoll`, `PlayerAvailability`, the `AvailabilityStatus` enum, reused unmodified for `SectionAvailabilityResponse.status`, not reinvented, and the public, unauthenticated, unguessable-link response pattern `PublicAvailabilityPollController` established, reused verbatim in shape for this spec's own public surface; this spec also amends `032`'s poll-creation endpoint with one new validation, see API Contract), `033-availability-aware-xi-builder.md` (`PlayingXiBuilder`'s `availabilityByPlayerId` prop and `MatchSideTab`'s poll-data fetch, this spec adds a second, `FLEXIBLE`-team data source for that exact same prop, not a new prop or a new component), `034-availability-polls-dashboard.md` (built — its own `**Status:** draft` header is stale, matching this codebase's general pattern of not updating that field after a spec ships; `ui/src/pages/manage/AvailabilityPollsDashboard.tsx` is a real, wired-up screen; this spec still deliberately does not fold its own new window-list surface into `034`'s dashboard, a real, non-trivial follow-up better done once both exist, see Rollout Notes for what that follow-up involves), `035-section-scoped-access.md` (built — likewise a stale `draft` header — `AccessService.canAdministerSection`/`assertCanAdministerSection`/`assertCanAdministerAnySection` are live and already used by every current admin endpoint, e.g. `TeamController`/`TeamSquadServiceImpl`/`MatchAvailabilityPollController`/`MatchAvailabilityPollServiceImpl`; this spec's own new admin endpoints use that exact same section-scoped pattern, not the coarser `canAdministerClub`-only check an earlier draft of this spec specified, see API Contract).
**Status:** draft.

## Problem & Goals

Every squad/availability mechanism this codebase has built so far, `TeamSquadMember` (`029`, a season-long roster) and `MatchAvailabilityPoll`/`PlayerAvailability` (`032`, one poll per match per side), assumes a `Team` has a stable roster and that "who's available" is a per-match question. That models most senior/rep cricket well, but breaks down for junior sections, where a club routinely shuffles players across two or three teams in the same age group depending on who's free on a given Saturday. A junior section might field matches across multiple leagues on the same day (League 1's AM and PM fixtures, League 2's AM and PM fixtures), and asking the same pool of players one per-match poll each is both repetitive for the players and disconnected from how a junior team manager actually thinks about the day: "who's in for Saturday morning," not "who's in for match #4127."

This spec adds a second, opt-in squad-selection mode existing alongside the first, never replacing it. `Team.squadMode` (`STATIC` by default, `FLEXIBLE` opt-in) is the single switch: every `STATIC` team keeps exactly `029`'s season-squad model and exactly `032`/`033`'s per-match poll and XI-tinting behaviour, unchanged in every respect. A `FLEXIBLE` team instead draws its per-match squad from a section-level availability ask: a club admin reviews a section's own upcoming fixtures, auto-grouped into proposed polls by consecutive/same-calendar-date clustering, ticks which matches a given poll should actually cover (a weekend, a lone midweek match, whatever the fixture list looks like), gives it a short description, and opens it as a `SectionAvailabilityRound` — one shared link covering exactly those matches, however many days they span. Every eligible player answers Available/Unavailable/Unsure once per distinct bracket the selected matches actually fall into, in a single visit, rather than clicking a separate link per bracket or per day. Underneath, each bracket is still tracked as its own `SectionAvailabilityWindow` — unchanged in what it does (see Data Model Changes, Part A, for the full revision history: this is this spec's second revision of the round's own creation flow, not its first). A team manager builds each match's actual squad by picking from whoever said yes to its own bracket, with a hard block against picking the same player for two different matches in the same bracket, and a poll can optionally close itself automatically ahead of the earliest match it covers, so a manager never discovers a poll quietly still open the morning of a game.

**Goals**
- A club admin can flip a `Team` between `STATIC` (today's exact behaviour) and `FLEXIBLE` squad selection, per team, so a club can run stable senior sides and fluid junior sides side by side without one model compromising the other.
- A club admin reviewing a section's availability options sees its actual upcoming fixtures, not a blind date field — every `FLEXIBLE`-team match across however many leagues, auto-grouped into proposed polls by consecutive/same-calendar-date clustering (a lone midweek match stands alone; a Saturday+Sunday weekend groups together), each match pre-selected and individually removable before the poll opens. **A match already covered by another poll can't be selected into a second one** — shown disabled with a link to the poll that already covers it, so the same fixture is never asked about twice.
- Each poll gets a short, editable description (defaulting to something built from its own dates and section, e.g. "Saturday 4 – Sunday 5 October — Under 13 fixtures"), shown everywhere the poll appears (the admin list, the public page, the share-invite text) — a plain date range stops being a useful title once a poll can cover an admin-chosen, possibly irregular set of matches rather than one clean calendar day.
- A poll can optionally close itself automatically ahead of time — **on by default**, 24 hours before the exact kickoff of the earliest match it covers — so a manager isn't relying on remembering to close it by hand before squad selection.
- Anyone holding a poll's public link can set their own Available/Unavailable/Unsure status, once per bracket its selected matches actually fall into, in a single visit, with no login — the exact same no-login, unguessable-link posture `032` already established and validated, reused rather than redesigned.
- A team manager, for a specific `FLEXIBLE`-team match, sees a live "who said yes for this bracket" pool and builds that match's squad from it with a one-click move, via a new `MatchSquadMember` per-fixture squad that replaces what `TeamSquadMember` does for a `STATIC` team. **Only a player with an explicit `AVAILABLE` response is ever offered as a pickable candidate** — a deliberate product decision, not a gap: a non-responder or an `UNSURE` player is the team manager's own responsibility to chase down and resolve (by phone, WhatsApp, in person), the same way `032`'s own admin-override endpoint exists for exactly this. The picker itself never offers a "pick anyone" bypass.
- A club admin/team manager can set any eligible player's status directly from `/manage`, per bracket, as an admin override — mirroring `032`'s own real, already-shipped override endpoint — for exactly the case above: a player confirmed their availability outside the app (a phone call, a WhatsApp message) and the manager records it on their behalf before picking a squad.
- A player who is available and gets picked for one match in a bracket is hard-blocked, server-side, from being picked for any other match sharing that same bracket, with a clear "already picked for {Team, Match}" indicator, not a silent disable.
- `033`'s advisory availability tinting and `029`'s existing `MatchSide`/`MatchSidePlayer` squad-membership validation both keep working for `FLEXIBLE` teams, reading from this spec's new tables instead of `032`'s/`029`'s, branching cleanly on `Team.squadMode`.
- A `SectionAvailabilityWindow` remains the actual per-bracket unit everything else in this spec (the hard block, `MatchSquadMember`, `033`'s tinting) reads and writes against, completely unchanged in what it does — this revision only changes how a window's matches get chosen and how a round is created around it, never the exclusivity/hard-block semantics themselves.

## Non-goals

- **Auto-suggesting or auto-assigning squad membership from availability responses.** This spec is manual pick-from-available-pool only, the two-pane picker (Part B) never adds a player to a match's squad on its own, no matter how unambiguous their availability looks (e.g. "available, and not picked for anything else this bracket"). Matches `032`'s own identical Non-goal for XI selection, extended here to squad selection. A future spec can revisit auto-suggestion once real usage shows it's wanted, flagged in `docs/roadmap.md`, not built here.
- **A fixed-vs-configurable day-part vocabulary, resolved as fixed for this pass.** `DayPart` ships as a two-value enum, `MORNING`/`AFTERNOON`, split at a match's own local time-of-day (`< 12:00` vs `>= 12:00`), the exact bracket the brainstorm's own driving example needed, and the simplest thing that could work. A club that genuinely runs evening fixtures, or wants a custom time-range bracket rather than a fixed AM/PM split, isn't served by this pass, flagged as a real, explicitly deferred future item in Rollout Notes/`docs/roadmap.md`, not a decision this spec closes off permanently (adding a third enum value, or replacing the enum with a `startTime`/`endTime` pair, is an additive, backward-compatible future change against the same table).
- **Section-descendant closure for a window's audience.** A `SectionAvailabilityWindow` asks exactly the players tagged (via `PlayerSection`, `028`) to its own `section_id`, not that section's ancestors or descendants. This mirrors `025`'s own deliberately flat, non-recursive posture for `Section` metadata (no eligibility enforcement, no tree-walking) and sidesteps needing any part of `035`'s still-unbuilt `SECTION`-scope closure logic to ship this. If a club's tree splits a bracket further (e.g. "U13" into "U13 Boys"/"U13 Girls"), the admin opens the window against whichever section level actually carries the `PlayerSection` tags of the players who need asking, the same flat tagging model `028` already established, not a new rule.
- ~~`SECTION`-scoped `RoleAssignment` resolution, or any narrowing of who can reach this spec's own admin endpoints beyond the existing `canAdministerClub` (`CLUB`-scope) check.`~~ **Correction, this is no longer a non-goal — `035-section-scoped-access.md` is already built**, not still-unbuilt as an earlier draft of this spec assumed (see Depends-on). This spec's new admin surface (`SectionAvailabilityWindow` CRUD, `MatchSquadMember` picker endpoints) uses `035`'s existing section-scoped access pattern (`canAccessClub` at the controller, `assertCanAdministerSection`/`assertCanAdministerAnySection` at the service layer), exactly matching `TeamSquadServiceImpl`'s/`MatchAvailabilityPollServiceImpl`'s own shape, see API Contract for the exact shape per endpoint.
- **Independent open/close per bracket within a round.** Opening or closing a `SectionAvailabilityRound` cascades to every `SectionAvailabilityWindow` underneath it — there's no way to close just the Afternoon bracket while Morning stays open, or vice versa. A club that genuinely needs that granularity isn't served by this pass; real future item if it comes up in practice, not built here.
- **Actually enforcing `scheduledCloseAt` — no scheduled job exists yet in this pass.** `SectionAvailabilityRound.autoClose`/`scheduledCloseAt` are computed and stored at creation time (Data Model Changes, Part A), and shown in the UI ("closes automatically Fri 3 Oct 09:00"), but nothing in this pass reads that timestamp to actually flip `open` to `false` — a round's `open` flag only ever changes via the existing manual open/close admin actions until then. **A future spec will add a Spring Batch job, running hourly**, that does two things against every `open = true AND auto_close = true` round: sends a warning/reminder once its `scheduled_close_at` is approaching (the exact lead time is that future spec's own decision), and closes it (cascading to every window under the round, same as a manual close) once `scheduled_close_at <= now()`. Querying on `open = true` is what makes manual close and autoclose compose correctly with no extra logic needed: a round an admin already closed by hand (a match abandoned, postponed, or otherwise no longer needing answers, per Goals) simply falls out of the job's own query the moment `open` flips to `false` — the job only ever acts on whatever's still genuinely open when it runs, never re-opens or fights a manual close. That job is also the natural place to finally build the "resend/reminder mechanism" this spec (and `032` before it) has deferred as a Non-goal throughout — flagged here so its implementer connects the two rather than treating them as unrelated. **A human should add this to `docs/roadmap.md`** as a real, explicitly open future item once this spec ships, naming both halves (warn, then close), the hourly cadence, and this manual/auto interaction.
- **Editing a round's selected matches after creation, or moving a match from one poll to another.** Once a match is included in a round (via its resolved window), that's permanent for this pass — there's no "add a newly-discovered fixture to an already-open poll" or "un-include a match" action. A round's own `firstMatchDate`/`lastMatchDate`/`description` default and `scheduledCloseAt` are all computed once, at creation, from whatever was selected at the time. Real future item if this turns out to matter in practice (e.g. a fixture gets added to the calendar after the poll for that weekend already opened), not built here.
- **Folding this spec's new window list into `034`'s open-polls dashboard.** `034-availability-polls-dashboard.md` is itself still drafted, not built, as of this spec, there is no shipped dashboard page to fold a second list into yet. This spec ships its own, independent admin screen and nav entry point (Part A) rather than making its own scope depend on `034`'s build order. Once both exist, showing open `SectionAvailabilityWindow`s alongside `034`'s open `MatchAvailabilityPoll`s on one combined screen is a real, likely-small follow-up, flagged explicitly in Rollout Notes/`docs/roadmap.md`, not attempted here.
- **Automatic migration, reconciliation, or deletion of existing squad data when a `Team`'s `squadMode` is switched.** Flipping a `Team` from `STATIC` to `FLEXIBLE` (or back) never touches its existing `TeamSquadMember` or `MatchSquadMember` rows, whichever set stops being read once the mode changes simply stops being read, it isn't deleted or reconciled. A club is expected to decide a junior team's mode once, early, not toggle it routinely; if that assumption turns out wrong in practice, a real reconciliation feature is future scope.
- **Re-resolving `MatchSquadMember.section_availability_window_id` when a match's own date/time changes after squad picks exist.** The window a squad pick belongs to is resolved once, at add-time, from the match's date/day-part (Data Model Changes, Part B/C). If a match is later rescheduled into a different day-part or date (a real, common occurrence for weather-affected cricket fixtures), existing picks keep pointing at the bracket they were made against, not the match's new one, a known, accepted gap in this pass rather than a decision this spec resolves. A future pass should decide whether a reschedule blocks while picks exist, re-resolves them, or requires a manual re-pick; flagged in Rollout Notes/`docs/roadmap.md`.
- **Cross-section double-booking.** The Part C hard block is scoped to one `SectionAvailabilityWindow`, i.e. one section's own bracket. A player tagged (via `PlayerSection`) to more than one section, e.g. a player who turns out for both an U13 and an U15 side, isn't protected from being picked into two different sections' matches that share the same overlapping date/day-part, since each section resolves its own, independent window. This is distinct from the Non-goal above on section-hierarchy (ancestor/descendant) closure; it's two unrelated sections, not one tree. Accepted as a known limitation for this pass, not solved here; flagged in Rollout Notes/`docs/roadmap.md`.
- **Any change to a `STATIC` team's behaviour, in any respect.** `029`'s `TeamSquadMember`/`MatchSide`/`MatchSidePlayer`, `032`'s `MatchAvailabilityPoll`/`PlayerAvailability`, `033`'s tinting, and `034`'s (still-unbuilt) dashboard are all completely unaffected for a `STATIC` team, every branch this spec adds only ever fires when `Team.squadMode == FLEXIBLE`. This is the spec's own central constraint, restated here explicitly rather than left implicit.
- **Real player login, or a login-gated response flow.** Matches `032`'s own identical Non-goal and reasoning exactly, `SectionAvailabilityResponse` is `player_profile_id`-keyed, not session-derived, forward-compatible with a future login-aware consumer, but this pass's response flow is public/no-login only, same trust posture as `032` (an unguessable UUID is the entire access boundary, a considered tradeoff, not a gap, per `032`'s own Rollout Notes reasoning, unchanged here).
- **Batting order, captain/wicketkeeper/twelfth man, or any other part of playing-XI selection.** `MatchSquadMember` is the per-match analogue of `TeamSquadMember` only, the *pool* a `FLEXIBLE` team's playing XI is drawn from. Building the actual ordered XI for a `FLEXIBLE`-team side still happens through `029`'s existing `MatchSide`/`MatchSidePlayer`/`PlayingXiBuilder`, entirely unchanged in UI and API shape, only the squad-membership pool it validates against changes source (Part D).
- **A `/platform` mirror, bulk/CSV window or response entry, or a resend/reminder mechanism.** Same established reasoning/precedent as `032`'s identical Non-goals.

## User Stories

**Part A: Section Availability Rounds (the ask)**

- As a club admin, I can pick one of my club's sections and see its actual upcoming fixtures (every `FLEXIBLE`-team match, across however many leagues), auto-grouped into proposed polls by consecutive/same-calendar-date clustering, so I'm reviewing real matches, not typing a date I have to get right.
- As a club admin, every match in a proposed group is pre-selected; I can untick any that shouldn't be part of this particular poll.
- As a club admin, a match already covered by another poll is shown disabled, with a plain-language note and a link to the poll that already covers it — I can't accidentally (or deliberately) ask about the same fixture twice.
- As a club admin, each proposed group has an editable description, pre-filled with something sensible built from its own dates and section, that becomes the poll's title everywhere it's shown.
- As a club admin, I can leave "Autoclose" on (the default) and the poll shows me when it'll close itself — 24 hours before the exact kickoff of the earliest match I selected — or turn it off if I'd rather close it by hand.
- As a club admin, I can still close a poll manually at any time, whether or not Autoclose is on and however far off its scheduled close time is — e.g. a match gets abandoned, postponed, or otherwise no longer needs answers. Autoclose is additive, never a replacement for the existing manual close action.
- As a club admin, opening a poll for a group creates exactly the `SectionAvailabilityWindow`s its selected matches actually need (one per distinct date+bracket combination among them) — I never create or manage a window directly, and no poll is ever opened covering zero matches.
- As a club admin, I can see which of my club's already-scheduled matches each bracket currently covers.
- As a club admin, I can close a poll at any time (cascading to every bracket underneath, making its public page read-only) and reopen it later without losing any responses already collected.
- As a club admin, I can generate a channel-agnostic invite message embedding the poll's single public link, mirroring `032`'s own "Share invite" pattern.
- As anyone holding a poll's link, I can open a public, no-login page listing every player eligible for that section, and set my own status for each bracket its selected matches actually fall into — one visit, one link, not a separate page per bracket or per day — by tapping my own row's controls, the same no-login self-select flow `032` already validated.
- As anyone visiting a closed poll's link, I can still see everyone's current status for every bracket, but can't change anything.
- As anyone visiting an unknown poll id, I see a clean "not found" message.

**Part B: `Team.squadMode` and `MatchSquadMember` (building a match's squad)**

- As a club admin, I can set a `Team` to `FLEXIBLE` squad selection (or back to `STATIC`) from the team's own form.
- As a team manager, for a specific match involving a `FLEXIBLE` team, I can see a two-pane picker: everyone who said Available for that match's own bracket on one side, everyone already picked for this specific match's squad on the other, and move a player between the two with one click.
- As a team manager building that squad, if no `SectionAvailabilityWindow` exists yet for this match's own bracket, I see a clear message telling me to open a poll covering it, with a shortcut that jumps straight to this match pre-selected in the fixture-group picker (Part A).
- As a team manager, once I've picked a match's squad, I can still build that side's ordered playing XI exactly as I always could (`029`'s `PlayingXiBuilder`), drawn from the players I just picked, not the team's season-long roster.

**Part C: Contested availability (the hard block)**

- As a team manager, if I try to add a player to my match's squad who's already been picked for a *different* match sharing the same bracket, I'm blocked, and I see exactly which team and match they're already picked for, not a silently disabled control.
- As a club admin, I'm confident this block is enforced by the database itself, not just the UI, a second request racing the first can't create two picks for the same player in the same bracket.

**Part D: Integration with existing surfaces**

- As a club admin building a `FLEXIBLE`-team side's playing XI, I still see `033`'s Unavailable/Unsure tinting on squad candidates, now reading this match's own section-window responses instead of a per-match poll.
- As a club admin opening the Availability tab on a `FLEXIBLE`-team match, I see a short explanation that this team uses section-level availability instead of a per-match poll, with a link to the relevant round (not a bare window), not the `032` poll-open workflow, which no longer applies to this side.
- As a club admin, attempting to open a `032`-style per-match poll against a `FLEXIBLE` team's side is rejected with a clear error, rather than silently creating a poll nothing will ever read.

## Data Model Changes

### Part A: `SectionAvailabilityRound` / `SectionAvailabilityWindow` / `SectionAvailabilityWindowMatch` / `SectionAvailabilityResponse`

**Revision note — this is this spec's *second* revision of Part A's creation flow, not its first.** The original draft (and that draft's own first build pass) exposed `SectionAvailabilityWindow` directly as the public/admin surface, one link per `(section, date, day-part)` bracket. Review found that unlikely to see real adoption, so a first revision (and its own build pass) added `SectionAvailabilityRound` as a thin public-facing wrapper around a fixed pair of `MORNING`/`AFTERNOON` windows, one shared link per section per calendar day. Hands-on review of *that* found two further real problems: nothing stopped an admin from opening a poll for a day with zero matches on it, and a round was capped at exactly one calendar day, so a weekend spanning Saturday and Sunday still needed two separate links, defeating the point. **This revision replaces "pick a section and a date" with "pick a section and tick which of its actual upcoming fixtures this poll should cover"** — a round's matches are now an explicit, admin-chosen selection, not something inferred from a date field, and a round can span however many calendar days its selected matches actually fall on. `SectionAvailabilityWindow` remains exactly what it always was — the per-bracket unit the hard block, `MatchSquadMember`, and `033`'s tinting all read and write against, completely unchanged in behaviour — only *how a window's matches get attached to it* changes: explicit selection via a new join table, not a live time-based scan.

**`Team` gains one field** (Part B, listed here since it's a single-column, no-new-table change):

```
Team {
    ...                -- unchanged: id, club_id, section_id, name, active (026)
    SquadMode squadMode -- new, not null, default STATIC, enum STATIC | FLEXIBLE
}
```

**New entity: `SectionAvailabilityRound`** — the actual public-facing and admin-facing unit; everything a club admin or a player interacts with directly. No longer scoped to a single `(section, date)` — a section can have several concurrent open rounds (e.g. a weekend poll and a separate midweek-cup poll open at once), since exclusivity now lives at the bracket/window level (below), not the round level:

```
SectionAvailabilityRound {
    uuid      id
    uuid      club_id            -- FK club.id, not null, denormalized from section.club_id, same
                                    -- precedent as every other section-scoped entity below
    uuid      section_id         -- FK section.id, not null, the exact section asked, no descendant
                                    -- closure (see Non-goals, same posture as the window it wraps)
    varchar   description        -- not null, editable free text; defaults to a generated label built
                                    -- from the selected matches' own date range + section name at
                                    -- creation time (e.g. "Saturday 4 – Sunday 5 October — Under 13
                                    -- fixtures"), shown everywhere the round is referenced (admin list,
                                    -- public page, share-invite text); never regenerated after creation,
                                    -- editing it is a plain field update (see API Contract)
    date      first_match_date   -- not null, denormalized min(matchDate) across every match selected
                                    -- into this round at creation time — for display/sorting and for
                                    -- computing scheduled_close_at below; not re-derived after creation
                                    -- (see Non-goals: a round's match set is fixed once created)
    date      last_match_date    -- not null, denormalized max(matchDate), same reasoning
    boolean   auto_close         -- not null, request-supplied at creation (no server-side default —
                                    -- the create form's own UI state defaults it to true, matching
                                    -- 026/031's existing "@NotNull on the request, UI supplies the
                                    -- sensible default" convention rather than a DB-level DEFAULT)
    timestamp scheduled_close_at -- nullable (null when auto_close is false); computed once at creation
                                    -- as first_match_date's own exact match datetime minus 24 hours
                                    -- (not just the calendar date), stored, never recomputed. Inert data
                                    -- in this pass — nothing reads it yet, see Non-goals
    boolean   open                -- not null, default true; opening/closing a round cascades to every
                                    -- SectionAvailabilityWindow underneath it (see Non-goals: no
                                    -- independent per-bracket open/close in this pass)
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

No uniqueness constraint on this table at all — a round's own identity is just its id; the constraint that actually prevents overlap lives on `SectionAvailabilityWindow` below, exactly as before.

**`SectionAvailabilityWindow` is unchanged from the first revision's own shape** — still the per-bracket unit, still owned by exactly one round, still unique per `(section, date, day-part)`:

```
SectionAvailabilityWindow {
    uuid     id
    uuid     club_id      -- FK club.id, not null, denormalized from section.club_id (same
                            -- PlayerProfile.club_id precedent, 028: list/query without joining Section)
    uuid     section_id   -- FK section.id, not null, the exact section asked, no descendant
                            -- closure (see Non-goals)
    uuid     round_id     -- FK section_availability_round.id, not null — the round this window's
                            -- bracket belongs to
    date     window_date  -- not null — this specific bracket's own date (a round spanning several
                            -- days now owns several windows, each with its own window_date; no longer
                            -- assumed equal to a single round-wide date, see below)
    DayPart  day_part     -- not null, enum MORNING | AFTERNOON (see Non-goals on granularity)
    boolean  open         -- not null, default true, kept in lockstep with round.open (see below)
    timestamp created_at
    timestamp updated_at
    uuid     updated_by
}
```

Unique on `(section_id, window_date, day_part)`, unchanged — at most one window ever exists for a given section+bracket, **for the lifetime of the data, across every round past and present** (not just within one round). This is the mechanism that makes "a match already covered by another poll can't be selected again" a real guarantee rather than a UI convention: if a bracket already has a window (from any round, open or closed), no other match resolving to that same bracket can ever get a *different* window created for it — it either joins the existing one (not supported for an already-created round, see Non-goals) or is excluded from a new round's creation entirely (see the fixture-group resolution below).

**A window's matches are now an explicit, stored selection, not a live time-based scan.** New entity, `SectionAvailabilityWindowMatch`:

```
SectionAvailabilityWindowMatch {
    uuid      id
    uuid      window_id  -- FK section_availability_window.id, not null
    uuid      match_id   -- FK match.id, not null
    timestamp created_at
}
```

Unique on `match_id` — a given match can belong to at most one window, ever (a DB-level backstop for the same invariant `SectionAvailabilityWindow`'s own bracket uniqueness already protects at the bracket level; two different matches sharing one bracket get two rows here sharing one `window_id`, which is exactly the "several matches, one shared poll bracket" shape this spec has always needed). Rows are created once, atomically, when a round is opened (API Contract) — there's no endpoint to add or remove a row afterward (see Non-goals).

**Opening a round creates exactly the windows its selected matches actually need — one per distinct `(section, date, day-part)` combination among them, no more, no fewer.** For each selected match, its own bracket key is resolved via `SectionAvailabilityMatchResolver.resolveWindowKey(team, match)` (unchanged from the first revision); every match resolving to the same key shares one new window; a round selecting matches across three distinct brackets (e.g. Sat AM, Sat PM, Sun AM) creates three windows, not a fixed two, and a round selecting just one match creates exactly one. This directly closes the "opens a poll to nothing" gap the first revision had: a window is never created unless at least one real, admin-selected match resolves to it.

**Opening/closing a round cascades to every one of its windows' own `open` flag**, keeping them in lockstep — there's no independent per-bracket open/close in this pass (see Non-goals).

**New entity: `SectionAvailabilityResponse`**, one per `(window, player)` — unchanged from the original design, still keyed to the window (the bracket), not the round; mirrors `032`'s own `PlayerAvailability` shape field-for-field, reusing its `AvailabilityStatus` enum unmodified:

```
SectionAvailabilityResponse {
    uuid               id
    uuid               window_id          -- FK section_availability_window.id, not null
    uuid               player_profile_id  -- FK player_profile.id, not null
    AvailabilityStatus status             -- AVAILABLE | UNAVAILABLE | UNSURE (032, reused, not
                                            -- redefined)
    timestamp          created_at
    timestamp          updated_at
    uuid               updated_by         -- always null in this pass, same reasoning as
                                            -- PlayerAvailability.updated_by (032): the public
                                            -- write path has no authenticated identity to
                                            -- attribute it to
}
```

Unique on `(window_id, player_profile_id)`, upsert semantics, identical to `PlayerAvailability`.

**A window's audience is still resolved live, not stored** — nothing here changes from the original design: every `PlayerProfile` currently tagged (via `PlayerSection`, `028`) to `window.section_id`, filtered to `PlayerProfile.active == true`, the exact "eligible for section" concept `028` already built, reused unmodified rather than reinvented. A new `SectionAvailabilityAudienceResolver` service resolves this, mirroring `032`'s own `AvailabilityPollSquadResolver` shape (a small, dedicated resolver, not inline query logic scattered across the service). A round's own audience (API Contract) is simply this same resolution run once against `round.section_id` — identical across every bracket the round owns, since eligibility is a section property, not a per-bracket one.

**A window's covered matches are now explicitly stored, no longer a live time-based scan — the one genuine behavioural change this revision makes to `SectionAvailabilityWindow` itself.** The original design (and its first revision) resolved a window's matches fresh on every read: every `FLEXIBLE`-team `Match` in the window's own section whose `match_date` fell into its `(date, day-part)` bracket, computed on demand, nothing stored. That meant a window's coverage could silently change after the fact — a match added to the calendar later would quietly join a bracket nobody chose it for. This revision replaces that scan with `SectionAvailabilityWindowMatch` (above): a window's matches are exactly, and only, whatever was explicitly selected when its round was created. `.../matches` (API Contract) now just reads the join rows for a round's windows, joined out to `Match` for display fields — a plain query, not a resolution.

**A new resolver, `SectionAvailabilityFixtureGroupResolver`, replaces the old scan for the one place a live view of "what's out there" is still genuinely needed: proposing what a *new* round could cover.** Given a `sectionId`, it: (1) finds every `FLEXIBLE`-team `Match` in that section with a future `match_date` (naturally small and bounded — one section's own upcoming fixtures — needing no further limit or pagination); (2) for each, resolves its own `(date, day-part)` bracket key (reusing `SectionAvailabilityMatchResolver.resolveWindowKey`) and checks whether a `SectionAvailabilityWindow` already exists for that key — if so, the match is flagged `alreadyPolled: true` with a reference to the existing window's own round (id + description), if not, it's a genuine candidate; (3) groups every match's own **distinct calendar date** (not exact time) by straightforward date adjacency — sorted ascending, a date starts a new group unless it's exactly one calendar day after the current group's latest date, so Saturday+Sunday cluster together and a following Tuesday (a two-day gap) starts its own group. This clustering runs across already-polled and not-yet-polled matches alike, so a proposed group shows its full real context (a mix of includable and already-covered fixtures, exactly per the UI Requirements' mockup-verified layout), not just what's left.

**Migration** (a new file, not an edit to `032-add-section-availability-and-flexible-squads.sql`/`033-add-section-availability-rounds.sql` — both already applied to local dev data by this spec's first two build passes; per Liquibase convention, an applied changeset is never edited, a new sequential file adds what changed):

```sql
-- backend/src/main/resources/db/changelog/v1/032-add-section-availability-and-flexible-squads.sql
-- (unchanged from the first build pass — kept here for reference, not re-applied)

ALTER TABLE team
    ADD COLUMN squad_mode VARCHAR(16) NOT NULL DEFAULT 'STATIC';

CREATE TABLE section_availability_window (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    window_date DATE NOT NULL,
    day_part    VARCHAR(16) NOT NULL,
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (section_id, window_date, day_part)
);

CREATE INDEX ix_section_availability_window_club ON section_availability_window(club_id);
CREATE INDEX ix_section_availability_window_section ON section_availability_window(section_id);

CREATE TABLE section_availability_response (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id          UUID NOT NULL REFERENCES section_availability_window(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID,
    UNIQUE (window_id, player_profile_id)
);

CREATE INDEX ix_section_availability_response_window ON section_availability_response(window_id);
CREATE INDEX ix_section_availability_response_player ON section_availability_response(player_profile_id);
```

```sql
-- backend/src/main/resources/db/changelog/v1/033-add-section-availability-rounds.sql
-- (this revision's own migration)

CREATE TABLE section_availability_round (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    round_date  DATE NOT NULL,
    open        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    UNIQUE (section_id, round_date)
);

CREATE INDEX ix_section_availability_round_club ON section_availability_round(club_id);
CREATE INDEX ix_section_availability_round_section ON section_availability_round(section_id);

-- No section_availability_window row has shipped anywhere outside local dev testing of this
-- not-yet-released spec, so round_id is added NOT NULL directly rather than nullable +
-- backfill + tighten, the sequence a table with real data would need. Any local dev rows
-- created by this spec's first build pass should be cleared before applying this migration.
ALTER TABLE section_availability_window
    ADD COLUMN round_id UUID NOT NULL REFERENCES section_availability_round(id);

CREATE INDEX ix_section_availability_window_round ON section_availability_window(round_id);
```

```sql
-- backend/src/main/resources/db/changelog/v1/034-add-section-availability-fixture-selection.sql
-- (this revision's own migration — same "not shipped anywhere real yet" posture as 033 above,
-- so round_date/its unique constraint are dropped outright rather than deprecated; verify the
-- exact auto-generated constraint name against the real applied schema before running this,
-- Postgres's own default naming convention is assumed below)

ALTER TABLE section_availability_round
    DROP CONSTRAINT IF EXISTS section_availability_round_section_id_round_date_key,
    DROP COLUMN round_date,
    ADD COLUMN description        VARCHAR(255) NOT NULL,
    ADD COLUMN first_match_date   DATE NOT NULL,
    ADD COLUMN last_match_date    DATE NOT NULL,
    ADD COLUMN auto_close         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN scheduled_close_at TIMESTAMPTZ;

CREATE TABLE section_availability_window_match (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id  UUID NOT NULL REFERENCES section_availability_window(id),
    match_id   UUID NOT NULL REFERENCES match(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id)
);

CREATE INDEX ix_section_availability_window_match_window ON section_availability_window_match(window_id);
```

### Part B/C: `MatchSquadMember`

**New entity: `MatchSquadMember`**, the per-fixture squad pool for a `FLEXIBLE` team, replacing what `TeamSquadMember` does for a `STATIC` team's season squad. Starts empty per match, no pre-seeding, the simpler and safer default the brainstorm behind this spec asked for:

```
MatchSquadMember {
    uuid    id
    uuid    match_id                       -- FK match.id, not null
    uuid    team_id                        -- FK team.id, not null, must equal this match's own
                                             -- home_team_id or away_team_id, and that Team must be
                                             -- squad_mode == FLEXIBLE (see business rules below)
    uuid    section_availability_window_id -- FK section_availability_window.id, not null,
                                             -- resolved once at add-time from (team.section_id,
                                             -- match.match_date's date+day-part); this denormalized
                                             -- column is what makes the Part C hard block a real DB
                                             -- constraint, not just a service-layer check (see below)
    uuid    player_profile_id               -- FK player_profile.id, not null
    integer jersey_number                   -- nullable, defaults from PlayerProfile.jerseyNumber
                                             -- at add-time, independently editable after, identical
                                             -- two-number model to TeamSquadMember.jerseyNumber (031)
    timestamp created_at
    uuid      created_by
}
```

**Two unique constraints, doing two different jobs:**
- `(match_id, team_id, player_profile_id)`, no duplicate row for the same match/team/player (defensive; the second constraint below already implies this transitively, but this one documents the simpler invariant directly).
- **`(section_availability_window_id, player_profile_id)`, the Part C hard block, enforced at the database level.** Because every `MatchSquadMember` row for a given match+team resolves to exactly one window, this single constraint means a player can appear in at most one `MatchSquadMember` row across *every* match and team that shares that window, the exact cross-match exclusivity Part C requires, for free, from one index. Two concurrent "add this player" requests for two different matches in the same bracket cannot both succeed, even under a race, the database rejects the second insert outright, not just the UI.

**Business rules, enforced server-side (mirrors `029`'s own `MatchSide`/`TeamSquadMember` rule shapes exactly):**
- A `MatchSquadMember` row's `team_id` must equal whichever of the match's own `home_team_id`/`away_team_id` matches it, and that `Team` must be `squad_mode == FLEXIBLE`, a `STATIC` team's squad is never built this way. A mismatch on the team-mode check is `TeamSquadModeMismatchException extends ValidationException` (`400`), a shared, named exception also thrown by this spec's `032` amendment below, since "this action doesn't match the team's configured squad mode" is one recurring failure mode with two call sites, not two different rules.
- Adding a `MatchSquadMember` row requires a `SectionAvailabilityWindow` to already exist for `(team.section_id, match.match_date's date, match.match_date's day-part)`, if none exists yet, `SectionAvailabilityWindowRequiredException extends ValidationException` (`400`), carrying the unresolved `matchId`/`sectionId`/`windowDate`/`dayPart` so the UI can offer a shortcut straight to the fixture-group picker (Part A) with this exact match pre-selected — opening that poll creates the one window this match needs (and any others its fellow selected matches resolve to).
- Adding a player already holding a `MatchSquadMember` row for the *same* resolved window (any other match/team) is `PlayerAlreadyPickedForWindowException extends ConflictException` (`409`), the service-layer, clean-error-message counterpart to the DB constraint above (same "DB constraint + pre-check for a clean message" pattern this codebase already uses elsewhere, e.g. `021`'s `ux_club_contact_primary`), carrying which `matchId`/`teamId`/team name they're already picked for.
- `jersey_number` uniqueness, a partial unique index on `(match_id, team_id, jersey_number)` where `jersey_number IS NOT NULL`, identical technique to `031`'s `ux_team_squad_member_jersey_number`; violated at the service layer as `DuplicateMatchSquadJerseyNumberException extends ConflictException` (`409`), mirroring `031`'s own `DuplicateSquadJerseyNumberException` exactly.
- Removing a `MatchSquadMember` row is a hard delete of the join row, matching `TeamSquadMember`'s own unlink-only posture (`029` Non-goals) for membership itself, only the jersey number gets a real update endpoint, mirroring `031`'s precedent for `TeamSquadMember` exactly.

**Amendment to `029`'s `MatchSideServiceImpl`.** Every place `029` validates a `MatchSidePlayer` add/update against `TeamSquadMember(team_id, season_id, player_profile_id)` (the `PlayerNotInSquadException` check) now branches on `team.squadMode`: `STATIC` resolves against `TeamSquadMember` exactly as `029` built it, unchanged; `FLEXIBLE` resolves against `MatchSquadMember(match_id, team_id, player_profile_id)` instead, same exception type (`PlayerNotInSquadException`) either way, only the source table differs. No other `029` business rule changes, the playing-XI cap (`League.maxPlayingXiSize`/`11`) and age-eligibility checks apply identically regardless of squad mode, since both already operate on the resolved player, not on which squad table produced them.

**Migration** (continues `032-add-section-availability-and-flexible-squads.sql` above, same file):

```sql
CREATE TABLE match_squad_member (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id                        UUID NOT NULL REFERENCES match(id),
    team_id                         UUID NOT NULL REFERENCES team(id),
    section_availability_window_id UUID NOT NULL REFERENCES section_availability_window(id),
    player_profile_id               UUID NOT NULL REFERENCES player_profile(id),
    jersey_number                   INTEGER,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                      UUID,
    UNIQUE (match_id, team_id, player_profile_id),
    UNIQUE (section_availability_window_id, player_profile_id)
);

CREATE INDEX ix_match_squad_member_match ON match_squad_member(match_id);
CREATE INDEX ix_match_squad_member_team ON match_squad_member(team_id);
CREATE INDEX ix_match_squad_member_window ON match_squad_member(section_availability_window_id);
CREATE INDEX ix_match_squad_member_player ON match_squad_member(player_profile_id);

CREATE UNIQUE INDEX ux_match_squad_member_jersey_number
    ON match_squad_member (match_id, team_id, jersey_number)
    WHERE jersey_number IS NOT NULL;
```

## API Contract

All endpoints below sit on the existing `/api/v1/manage/**` namespace. Since `035-section-scoped-access.md` is already built (see Depends-on), every new admin endpoint uses its section-scoped access pattern rather than the coarser club-wide check: the controller-level `@PreAuthorize` is `@access.canAccessClub(authentication, #clubId)` (the broad "can this caller reach the club at all" gate, matching `MatchAvailabilityPollController`'s own precedent for resources that don't carry a `sectionId` path variable), and the service layer then asserts the caller can administer the *specific* section the resource resolves to, immediately after loading it and before any other business validation — `accessService.assertCanAdministerSection(authentication, clubId, sectionId)`, exactly mirroring `TeamSquadServiceImpl`'s own call shape (load the resource, assert on its section, then validate). The note beneath each table below names exactly which section id each endpoint asserts on and where that id comes from. The public surface is unaffected, and reuses `/api/v1/public/**`'s existing `permitAll()` posture exactly as `032` established it.

### Part A: Section Availability Rounds

**Admin surface:**

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/sections/{sectionId}/section-availability-fixture-groups` | `@access.canAdministerSection` (directly, a real `sectionId` path variable — the one Part A endpoint that carries one, so this reuses the controller-level pattern `TeamController` already established, not the `canAccessClub`-plus-service-assert shape everything else here uses) | Runs `SectionAvailabilityFixtureGroupResolver` (Data Model Changes) and returns the proposed groups: `[{suggestedDescription, startDate, endDate, matches: [{matchId, teamId, teamName, opponentLabel, matchDate, dayPart, leagueName, alreadyPolled, existingRoundId, existingRoundDescription}]}]` — the last three fields on each match are only populated when `alreadyPolled` is `true`. Read-only, no side effects; calling this repeatedly (e.g. the admin re-opening the picker) is always safe |
| `GET /api/v1/manage/clubs/{clubId}/section-availability-rounds` | `@access.canAccessClub` | Lists every round for the club (optionally `?sectionId=`/`?open=` filters): `{id, sectionId, sectionName, description, firstMatchDate, lastMatchDate, autoClose, scheduledCloseAt, open, brackets: [{dayPart, windowDate, windowId, availableCount, unavailableCount, unsureCount, noResponseCount, coveredMatchCount}, ...]}` — `brackets` is however many windows this round actually owns (one to several, no longer a fixed pair, see Data Model Changes) |
| `POST /api/v1/manage/clubs/{clubId}/section-availability-rounds` | same | Creates a round and exactly the windows its selected matches need (Data Model Changes), `open = true` immediately. Body: `{sectionId, description, matchIds: [uuid, ...], autoClose: boolean}` — no `roundDate`/`dayPart`, the selected matches decide both. `400` (`ValidationException`) if `matchIds` is empty, or if any `matchId` isn't a real match of a `FLEXIBLE` team in this section; `404` if `sectionId` belongs to a different club; `409` (`MatchAlreadyPolledException extends ConflictException`) naming the conflicting match(es) if any selected `matchId`'s own bracket already has a window (a defensive re-check against a possibly-stale fixture-group list, same "DB constraint + clean pre-check message" pattern as the Part C hard block) |
| `PUT .../section-availability-rounds/{roundId}` | same | Edits `description` only. Body: `{description}`. `400` if blank |
| `POST .../section-availability-rounds/{roundId}/open` | same | Cascades to every underlying window's `open` flag. `409` if already open |
| `POST .../section-availability-rounds/{roundId}/close` | same | Cascades to every underlying window's `open` flag. `409` if already closed |
| `GET .../section-availability-rounds/{roundId}/responses` | same | Every eligible player (`SectionAvailabilityAudienceResolver`, resolved once against the round's own section) with their status per bracket: `{playerId, name, jerseyNumber, statuses: [{windowId, dayPart, windowDate, status}]}` (one entry per window the round owns, `status` is `AvailabilityStatus \| null`), plus each bracket's count summary and the round's public path (`/section-availability/{roundId}`) |
| `GET .../section-availability-rounds/{roundId}/matches` | same | Every `Match` explicitly linked to one of this round's windows via `SectionAvailabilityWindowMatch` (a plain join, no longer live-resolved, see Data Model Changes), each tagged with which bracket it belongs to: `{matchId, teamId, teamName, opponentLabel, matchDate, venue, leagueName, dayPart, windowId}` |
| `PUT .../section-availability-rounds/{roundId}/players/{playerProfileId}` | same | **Admin override** — sets that player's status for one specific bracket directly from `/manage`, mirroring `032`'s own real, already-shipped `MatchAvailabilityPollController.setPlayerStatus` (added post-launch after live review found no way to record a response relayed outside the app, e.g. a phone call — the exact scenario this spec's own product decision covers, see Goals). Body: `{windowId, status: AVAILABLE \| UNAVAILABLE \| UNSURE}` — identifies the bracket by `windowId` directly rather than `dayPart` alone, since a round can now own several windows sharing the same `dayPart` across different dates (unambiguous by `windowId`, ambiguous by `dayPart` alone). Same `404`/`409` rules as the public write path below (not-in-audience `404`, closed-bracket `409`) — an admin override still respects a closed round, matching `032`'s own "closing locks it, full stop, admin included" precedent |

**Service-layer section assertion, per endpoint above (except the fixture-groups endpoint, which asserts directly at the controller, see its own row):** `list` resolves the caller's accessible section set and narrows to it, additionally calling `assertCanAdministerSection(clubId, sectionId)` when the `?sectionId=` filter itself is supplied, mirroring `MatchAvailabilityPollServiceImpl.listOpenForClub`'s own narrowing shape; `create` asserts directly against the request body's `sectionId`; every other endpoint loads the `SectionAvailabilityRound` first, then asserts `assertCanAdministerSection(clubId, round.sectionId)` before its own business logic.

**`SectionAvailabilityWindow`'s own admin endpoints from the original per-window design (list/create/open/close/responses/matches, all directly against a bare window) stay removed from the public API**, unchanged from the first revision — a window is still never its own admin-facing resource, only ever reached through the round that owns it. `MatchSquadServiceImpl` (Part B/C) still resolves a specific window internally by `(sectionId, windowDate, dayPart)`, entirely unaffected by this change.

**Public surface** (`permitAll`, no `clubId` in the URL, the round's own UUID is the entire access boundary, same deliberate tradeoff `032`/the earlier revisions already made, not re-litigated here):

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/public/section-availability-rounds/{roundId}` | `permitAll` | Resolves the round's `description`, section name, open/closed state, every eligible player's name and standing `jerseyNumber` (`PlayerProfile.jerseyNumber`, `031`), and their current status per bracket: `{windowId, dayPart, windowDate, status}` list per player, one entry per window the round owns (no more assuming exactly `MORNING`/`AFTERNOON`, no more hiding a zero-match bracket — a bracket only exists at all now if it was explicitly selected into the round, see Data Model Changes, so there's nothing left to hide). `404` if `roundId` doesn't exist |
| `PUT /api/v1/public/section-availability-rounds/{roundId}/players/{playerProfileId}` | `permitAll` | Sets that player's status for one specific bracket. Body: `{windowId, status: AVAILABLE \| UNAVAILABLE \| UNSURE}` (identified by `windowId`, same reasoning as the admin-override row above), resolves the window and upserts `SectionAvailabilityResponse` against it. `404` if `roundId` doesn't exist, `windowId` doesn't belong to this round, or `playerProfileId` isn't part of this round's own audience (not tagged, via `PlayerSection`, to `round.sectionId`); `409` (`SectionAvailabilityWindowClosedException extends ConflictException`) if that bracket's window is closed |

**Amendment to `032`'s existing `POST .../matches/{matchId}/polls`.** Gains one new validation: `400` (`TeamSquadModeMismatchException`) if the requested `teamId`'s `Team.squadMode == FLEXIBLE`, a per-match poll no longer applies once a team uses section-level availability (Part D). Every other `032` endpoint/behaviour is unchanged.

### Part B/C: Match Squad (`MatchSquadMember`)

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad` | `@access.canAccessClub` | Resolves this side's bracket (`sectionId`, `windowDate`, `dayPart`) and, if a window exists for it, returns `windowId`/`windowOpen`/`roundId` (the owning round, so the UI can fetch round-level responses for `033`'s tinting without a second lookup, see Part D) plus two lists: `candidates`, every player with an `AVAILABLE` `SectionAvailabilityResponse` for that window, each annotated with `pickedElsewhere: {matchId, teamId, teamName} \| null` if they already hold a `MatchSquadMember` row for this window elsewhere (Part C's UI indicator), and `selected`, the current `MatchSquadMember` rows for this exact match+team, in `TeamSquadMemberDto` (`031`) shape (`MatchSquadMemberDto`, identical field set, `id` is the `MatchSquadMember` row's own id). `windowId` is `null` (no window opened yet) when no `SectionAvailabilityWindow` exists for the resolved bracket, the response still carries this match's own `matchId`/`sectionId`/`windowDate`/`dayPart` so the UI can offer a shortcut straight to the fixture-group picker (Part A) with this match pre-selected. `400` (`TeamSquadModeMismatchException`) if `teamId`'s `Team.squadMode == STATIC` |
| `POST .../matches/{matchId}/teams/{teamId}/squad/{playerId}/add` | same | Adds a `MatchSquadMember` row (jersey number defaults from `PlayerProfile.jerseyNumber`, may be `null`). `400` (`TeamSquadModeMismatchException`) if not `FLEXIBLE`; `400` (`SectionAvailabilityWindowRequiredException`) if no window exists yet for the resolved bracket; `404` if `playerId` isn't a real, active player of this club; `409` (`PlayerAlreadyPickedForWindowException`) if already picked for this window elsewhere; `409` (plain `ConflictException`) if already in this exact match+team's squad |
| `POST .../squad/{playerId}/remove` | same | Removes the row (hard delete). `404` if not currently in this match+team's squad |
| `PUT .../squad/{playerId}` | same | Updates `jerseyNumber` only, mirroring `031`'s `PUT .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}` exactly. Body: `{jerseyNumber: Integer \| null}`. `400` if negative; `404` if not currently in this match+team's squad; `409` (`DuplicateMatchSquadJerseyNumberException`) if another player already holds that number on this match+team |

**Service-layer section assertion:** every endpoint above resolves the real `Team` for `teamId` first (already required to confirm it's one of the match's own home/away sides and to check its `squadMode`), then asserts `assertCanAdministerSection(clubId, team.sectionId)` before any other business validation, mirroring `TeamSquadServiceImpl`'s own call shape. A single team is always known here (unlike `032`'s poll endpoints, which check across a match's two sides via `assertCanAdministerAnySection`), so `assertCanAdministerSection` — one specific, already-resolved section — is the right check, not the multi-section variant.

Every endpoint above is scoped to `clubId` first, `404` if `matchId`/`teamId` is real but belongs to a different club, matching every prior spec's isolation posture.

## UI Requirements

### Part A: Section Availability Rounds

**Verified against a plain, unpublished local HTML mockup reviewed and approved before this revision was written up** (built from this repo's real tokens — `ui/src/theme.ts`, `RecordCard`, `MatchAvailabilityTab` — not an idealised wireframe). The mockup replaced the previous revision's "New round" dialog with a full page, since a dialog doesn't leave room for reviewing a real fixture list — that page-not-dialog decision, and everything below, reflects what was actually approved, not a fresh guess.

**Two genuinely new visual patterns**: the fixture-group review section on the existing rounds page (replacing the previous revision's small "New round" dialog outright, not extending it, and not a separate page of its own — see below) and the public round-level response page's per-bracket toggle layout (unchanged need from the first revision, still genuinely new ground: N toggle groups per player row, not a fixed one or two).

- **`ui/src/pages/manage/SectionAvailabilityRounds.tsx`** (existing from the prior revision, its "New round" dialog trigger removed) gains the fixture-group review **directly on this same page, above the existing open-rounds grid — one screen, no separate route.** A section picker at the top of this new area (pre-selected via `?sectionId=` query param when reached from a match's own shortcut, e.g. `/manage/section-availability?sectionId=...&matchId=...`), then:
  - One card per proposed fixture group (from `GET .../section-availability-fixture-groups`), headed by its date range (e.g. "Sat 4 – Sun 5 Oct") and a match count; every match row pre-checked with its own team/league/opponent/date-time, uncheck to exclude it from this particular poll; a match already covered by another poll renders disabled, grayed, with a caption naming the existing poll and a link to it (`existingRoundDescription`/`existingRoundId`) — it can't be checked.
  - An editable **description** field per group, pre-filled with `suggestedDescription`, sitting above the match list.
  - An **Autoclose** toggle per group, default on, with inline text showing the computed close time (the earliest ticked match's own kickoff minus 24 hours, recomputed client-side as matches are ticked/unticked) when on.
  - An "Open poll for N selected fixtures" primary action per group (disabled at zero selected), calling `createRound`.
  - The existing "currently open polls" `RecordCard` grid (unchanged shape from the prior revision) still lists already-opened rounds below the proposed groups, so the whole page reads as one screen rather than two disconnected ones — each card now titled by the round's own `description`, with a per-bracket response-count summary (however many brackets it owns, not a fixed pair) and the `PUT .../section-availability-rounds/{roundId}` inline-edit for `description` after the fact.
  - **Each round card still expands to a per-player response list** (from `.../responses`), one row per eligible player showing a status Chip per bracket the round owns, each Chip clickable to open a menu of the three statuses (the admin-override interaction, `032`'s own `MatchAvailabilityTab` pattern, unchanged from the prior revision — just however many Chips a round's own bracket count calls for, not capped at two).
- **`ui/src/pages/view/PublicSectionAvailabilityRound.tsx`** (existing from the prior revision): header (`description`, section name, open/closed state — no bare date range as the header anymore, `description` is the title everywhere now), and a full eligible-player list: one row per player, showing their name plus **one `ToggleButtonGroup` per window the round owns**, each labelled with its own date + day-part (e.g. "Sat 4 Oct — Morning", "Sun 5 Oct — Morning") rather than assuming a fixed Morning/Afternoon pair — a round covering one match renders one toggle group per row, a round spanning a whole weekend renders as many as it has brackets, stacked at `xs`, wrapping/side-by-side from `sm`+. Every bracket the round owns is always rendered now (no more hiding a zero-match bracket — a bracket only exists if a real, selected match put it there, see Data Model Changes). Tapping any toggle calls the `PUT` endpoint with that bracket's `windowId`, no "who are you" step; every toggle disabled when closed; unknown `roundId` renders a clean "not found" message.
- **`ui/src/api/sectionAvailabilityApi.ts`** gains `getFixtureGroups(clubId, sectionId)`, `updateRoundDescription(clubId, roundId, description)`; `createRound`'s body changes to `{sectionId, description, matchIds, autoClose}`; `listRounds`/`getRoundResponses`/`getRoundMatches` response types change shape per the API Contract (variable-length `brackets`/`statuses` arrays, `description`/`firstMatchDate`/`lastMatchDate`/`autoClose`/`scheduledCloseAt` fields). **`ui/src/api/publicSectionAvailabilityApi.ts`**'s `setAvailability` now takes `windowId` instead of `dayPart`.
- **`ui/src/App.tsx`**: no route changes — the fixture-group review lives on the existing `/manage/section-availability` route, not a new one; the existing `/section-availability/:roundId` public route is unchanged too.

### Part B/C: `Team.squadMode` and the Match Squad picker

- **`ui/src/components/TeamForm/TeamForm.tsx`** (`026`, existing): gains a `squadMode` field (a `Select` or two-option toggle: "Static season squad" / "Flexible per-match squad", default Static), placed near the existing `name` field. A short inline helper text explains the difference in plain language (e.g. "Flexible teams build their squad per match from section availability, instead of a season-long roster").
- **`ui/src/pages/manage/TeamFormPage.tsx`** (`029`, existing): the existing **Squad** tab (season roster, `TeamSquadMember`) renders only when `team.squadMode === 'STATIC'`; for a `FLEXIBLE` team it's replaced with a short explanatory panel ("This team builds its squad per match, see a specific match's own Match Squad tab") rather than an empty/broken tab.
- **One genuinely new shared component, flagged for a Claude Design pass before build**: nothing in `components/**` today renders a live two-pane "available pool vs. selected" picker with a cross-match contested-pick indicator:
  - **`ui/src/components/MatchSquadPicker/`** (new, four-file anatomy): given `candidates: MatchSquadCandidate[]` and `selected: MatchSquadMemberDto[]` (both data-and-callback only, no direct API calls, matching `PlayingXiBuilder`'s own established convention), two columns/panes: "Available" (every candidate not currently selected, each showing name + standing jersey number, and, when `pickedElsewhere` is set, a clear inline badge/caption "Already picked for {teamName}, {opponentLabel}" *and* a disabled add action, per Part C's "indicator, not silent disable" requirement) and "Selected" (current `MatchSquadMember` rows, each with an inline-editable jersey number mirroring `031`'s `SquadPlayerCard` pattern, and a one-click remove/move-back action). Moving a candidate to "Selected" calls the `add` endpoint; moving back calls `remove`. Server rejections (`PlayerAlreadyPickedForWindowException` on a race, `SectionAvailabilityWindowRequiredException`) surface as inline feedback, not a silent failure. Mobile-first: two stacked panes at `xs`, side-by-side from `md`, matching this codebase's existing wide-content responsive convention.
- **`ui/src/pages/manage/MatchFormPage.tsx`** (`029`/`032`/`033`, existing, extended): per real-`Team` side, branches on that side's `Team.squadMode`:
  - **Availability sub-tab**: `STATIC` renders `MatchAvailabilityTab` exactly as `032` built it, unchanged. `FLEXIBLE` renders a short informational panel instead ("This team uses section-level availability, not a per-match poll") linking to the round that already covers this match when one exists, or, when `windowId` is `null`, a shortcut straight to the fixture-group review page (Part A) with `sectionId` pre-selected and this exact `matchId` pre-ticked — not a blind "create a round for this date" form.
  - **New "Match Squad" sub-tab, `FLEXIBLE` sides only**: renders `MatchSquadPicker`, fed by `GET .../matches/{matchId}/teams/{teamId}/squad`.
  - **Playing XI sub-tab**: unchanged UI for every side; only `MatchSideTab`'s own underlying data fetch changes source, see Part D below.
- **`ui/src/api/matchSquadApi.ts`** (new): `getMatchSquad`, `addToMatchSquad`, `removeFromMatchSquad`, `updateMatchSquadJerseyNumber`, thin wrappers over the Part B/C endpoints.

### Part D: Integration with `033`/`034`

- **`ui/src/pages/manage/MatchFormPage.tsx`'s `MatchSideTab` (`033`, existing)**: its poll/responses fetch branches on `team.squadMode`: `STATIC` is `033`'s existing fetch, unchanged (`listPolls`/`getPollResponses`). `FLEXIBLE` instead resolves this side's window (reusing the same `GET .../matches/{matchId}/teams/{teamId}/squad` call Part B already makes for the Match Squad tab, no second network call, its `windowId`/`roundId` fields) and, when non-null, fetches `getRoundResponses(clubId, roundId)` and finds the `statuses` entry whose own `windowId` matches this side's resolved window (no longer a fixed `morningStatus`/`afternoonStatus` pair, since a round can now own several same-`dayPart` windows across different dates — matching by `windowId` is the only unambiguous way), mapping the result into the identical `Map<string, AvailabilityStatus>` shape `033`'s `availabilityByPlayerId` prop already expects. **`PlayingXiBuilder` itself needs zero changes**, it already treats `availabilityByPlayerId` as "whatever the caller resolved," matching `033`'s own stated design.
- **`034`'s open-polls dashboard is not extended in this pass**, it isn't built yet (see Non-goals/Rollout Notes). Once both `034` and this spec have shipped, adding open `SectionAvailabilityWindow`s to that same dashboard is a real, likely-small follow-up, not attempted here.

**Mobile-first**, per `docs/standards/frontend.md`, every new screen/component above stacks full-width and stays usable at 375px, matching `032`'s own identical requirement for its structurally similar public/admin pair.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit (Part A) | `SectionAvailabilityFixtureGroupResolverTest` (new): consecutive-date clustering (a weekend groups, a Tuesday two days later starts its own group), a match already covered by an existing window is flagged `alreadyPolled` with the correct existing round reference, a match excluded entirely when its team isn't `FLEXIBLE` or belongs to a different section; `SectionAvailabilityRoundServiceImplTest`: create (empty `matchIds` `400`, a `matchId` not belonging to a `FLEXIBLE` team in this section `400`, cross-club `sectionId` `404`, a `matchId` whose bracket already has a window `409` naming it, exactly the right number of windows created for a multi-bracket selection, `firstMatchDate`/`lastMatchDate`/`scheduledCloseAt` computed correctly, `scheduledCloseAt` null when `autoClose` is false), description edit, open/close transitions and their `409`s and cascade to every window's `open` flag, `getResponses` resolves the live `PlayerSection`-tagged audience correctly with one status entry per window the round owns, the admin-override `setPlayerStatus`-equivalent keyed by `windowId` (not-in-audience `404`, closed-bracket `409`, still respects closed state exactly like `032`'s own override); `PublicSectionAvailabilityRoundServiceImplTest`: happy-path get/set against a specific `windowId`, unknown-`roundId` `404`, `windowId` not belonging to this round `404`, not-in-audience `404`, closed-bracket `409`; `SectionAvailabilityAudienceResolverTest`/match-resolution logic (unchanged from the original design, still window-scoped): the `MORNING`/`AFTERNOON` time-of-day split |
| Unit (Part B/C) | `MatchSquadServiceImplTest`: add (squad-mode-mismatch `400`, no-window `400`, not-a-real-player `404`, already-picked-elsewhere `409` with the correct `matchId`/`teamId` in the exception, already-in-this-squad `409`), remove, jersey-number update and its `404`/`400`/`409` — entirely unchanged by this revision, still resolves a specific `SectionAvailabilityWindow` directly and knows nothing about rounds; `MatchSideServiceImplTest` extended (`029`): `PlayerNotInSquadException` now resolves against `MatchSquadMember` for a `FLEXIBLE` team and `TeamSquadMember` for a `STATIC` team, both proven against the identical exception type; a `032` `MatchAvailabilityPollServiceImplTest` case added for the new `TeamSquadModeMismatchException` on a `FLEXIBLE` team's poll-create attempt |
| Integration | New repository tests (Testcontainers) for `section_availability_round`/`section_availability_window`/`section_availability_window_match`/`section_availability_response`/`match_squad_member`: all three migrations apply cleanly in sequence against existing `025`/`028`/`029`/`031` tables; `section_availability_window.round_id` `NOT NULL` constraint proven; **`section_availability_window_match.match_id`'s unique constraint proven** (two attempts to link the same match to two different windows, second rejected at the DB level — the data-integrity backstop for "a match can't be polled twice"); both unique constraints on `match_squad_member` reject a duplicate at the DB level, **including the cross-match `(window_id, player_profile_id)` constraint proven by attempting two inserts for the same player against two different `match_id`s sharing one window** (the Part C hard-block's real DB-level proof, not just a service-layer assertion, unaffected by anything in this revision); new controller integration tests for every admin/public endpoint above, mirroring `032`'s own isolation-and-no-auth-header coverage exactly (real `CLUB_ADMIN` success/`403`/`404` for admin endpoints, real `200` round-trips with no `Authorization` header for public ones), plus a real fixture-groups round-trip proving a match already in an open round's window is correctly flagged `alreadyPolled` when a second, real HTTP request lists proposed groups for the same section |
| Contract | Every new endpoint (admin, public, and the `032` amendment) + new DTOs documented in the checked-in OpenAPI schema |
| Component | `SectionAvailabilityRounds.test.tsx` extended for the new fixture-group review page: proposed groups render with pre-checked matches, unchecking a match excludes it from the create call, an already-polled match renders disabled with its existing-poll link, the description field round-trips, the Autoclose toggle's computed close-time display updates as matches are ticked/unticked + Storybook story; `PublicSectionAvailabilityRound.test.tsx` extended: a round with one window renders one toggle group per row, a round with several renders one per window each correctly labelled by its own date+day-part (generalizing the prior revision's two-bracket-fixed test cases, not just renaming them) + Storybook story; `MatchSquadPicker.test.tsx` + Storybook story: candidate/selected rendering, move-in/move-out wiring, the `pickedElsewhere` badge renders and disables the add action rather than hiding the candidate, inline jersey-number edit, server-rejection feedback surfacing (unchanged by this revision); `TeamForm.test.tsx` extended: `squadMode` field renders/validates/round-trips; `TeamFormPage.test.tsx` extended: Squad tab vs. explanatory panel branches correctly on `squadMode`; `MatchFormPage.test.tsx` extended: Availability sub-tab and Match Squad sub-tab both branch correctly on each side's `squadMode`, and the "no window yet" shortcut links to the fixture-group page with this match pre-selected |
| End-to-end | New golden path: set a team to `FLEXIBLE`, review its section's upcoming fixtures, confirm an already-polled match (seeded via a prior round) renders disabled with a link to its poll, tick a weekend's worth of matches spanning two brackets, edit the description, leave Autoclose on and confirm the shown close time, open the poll, respond Available for one bracket as a player via the poll's public link (fresh unauthenticated browser context), open the match's Match Squad tab and confirm that player appears as an available candidate, pick them into the squad, attempt to pick the same player into a different match sharing the same bracket (blocked, indicator shown), build that side's playing XI from the picked squad via the existing `PlayingXiBuilder`, confirm `033`'s tinting still reflects an `Unsure`/`Unavailable` responder correctly, reload and confirm every change persisted. Extends, rather than replaces, `029`'s/`032`'s/`033`'s existing golden paths (run against a `STATIC` team, unchanged). Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can set any `Team` to `FLEXIBLE` squad selection independently of every other team in the club, with zero behaviour change for any `STATIC` team.
- A club admin reviewing a section sees its real upcoming fixtures, auto-grouped by consecutive/same-calendar-date clustering, ticks which ones a poll should cover (any subset, spanning however many days), gives it a description, and opens it — creating exactly the windows those matches need, never zero, never a fixed pair.
- A match already covered by another poll can't be selected into a second one — shown disabled with a link to the poll that already covers it.
- A poll defaults to Autoclose on, showing the computed close time (24 hours before the earliest selected match's own kickoff); turning it off leaves the poll open until manually closed.
- A club admin can open, close, and reopen a poll (cascading to every bracket it owns), edit its description at any time, and see which of the club's matches each bracket currently covers.
- A club admin can set any eligible player's status directly from `/manage`, per bracket, as an admin override, mirroring `032`'s own real override endpoint; the Match Squad picker only ever offers a player as a candidate once their status is `AVAILABLE`, by whichever path (self-service or override) it got set.
- Anyone holding a poll's public link can set their own status for every bracket it owns, in one visit, with no login, exactly mirroring `032`'s validated no-login posture; a closed poll is read-only for every bracket; an unknown id shows a clean "not found" page.
- A team manager can build a `FLEXIBLE`-team match's squad from a live "who said yes for this bracket" pool via a two-pane picker, moving players in and out with one click.
- A player already picked for one match in a bracket cannot be picked for a different match sharing that bracket, rejected both by a real database constraint and a clean, informative service-layer error naming the conflicting team/match, never a silent disable.
- `029`'s existing `MatchSide`/`MatchSidePlayer`/`PlayingXiBuilder` flow works unchanged for a `FLEXIBLE` team's side, validating squad membership against `MatchSquadMember` instead of `TeamSquadMember`.
- `033`'s advisory Unavailable/Unsure tinting continues to work for a `FLEXIBLE` team's side, reading from `SectionAvailabilityResponse` instead of `PlayerAvailability`, with zero changes to `PlayingXiBuilder` itself.
- Attempting to open a `032`-style per-match poll against a `FLEXIBLE` team's side is rejected with a clear `400`, not silently accepted.
- A club admin for club X gets `403`/`404` attempting any new admin endpoint against club Y's ids.

## Rollout Notes

- **This is this spec's *second* revision of Part A's own creation flow — a real, chronological build history, not a hypothetical.** Revision 0 (the original draft) exposed `SectionAvailabilityWindow` directly, one link per bracket; its own first build pass shipped that. Revision 1 wrapped it in `SectionAvailabilityRound`, one link per section per fixed `(section, date)` pair, always creating both `MORNING`/`AFTERNOON` windows unconditionally; its own build pass (backend + frontend) shipped that too, retiring revision 0's bare-window controllers/pages entirely. Hands-on review of revision 1 found two real problems: a round could be opened for a day with zero matches, and a round was capped at one calendar day, so a weekend still needed two links. **Revision 2 (this one) replaces "pick a section and a date" with "pick a section and tick which of its real upcoming fixtures a poll should cover,"** adds an editable `description` and an `autoClose`/`scheduledCloseAt` pair, and lets a round own however many windows its selected matches actually resolve to, not a fixed pair. A local, unpublished HTML mockup was built and approved before this text was written (see UI Requirements) — this isn't a guess at the shape.
- **A third build pass is needed before any of this ships — revision 1's backend and frontend are real, tested, and running, and most of it needs reworking, not just extending.** Needed: `SectionAvailabilityWindowMatch` (new entity/migration), the new `SectionAvailabilityFixtureGroupResolver`, the fixture-group admin endpoint and its full-page (not dialog) UI, `description`/`autoClose`/`scheduledCloseAt` on `SectionAvailabilityRound` (migration `034`, dropping `round_date` outright per Data Model Changes), `create`'s request body change (`matchIds`+`description`+`autoClose` replacing `roundDate`), every `dayPart`-keyed field/param becoming `windowId`-keyed (admin override, public write, `033`'s tinting fetch), and the public/admin response shapes generalizing from a fixed pair to a variable-length list. **What still needs zero changes, confirmed twice now across two revisions**: `MatchSquadServiceImpl`, `MatchSquadMember`, the Part C hard-block constraint, `SectionAvailabilityAudienceResolver`, and `SectionAvailabilityMatchResolver.resolveWindowKey` — every one of them operates on a single already-resolved window, and nothing about how a window's matches get chosen changes what it does once it exists.
- **Ships in the four parts named throughout this spec, and can land as up to four smaller PRs rather than one large one.** Part A (window open/close/public-response, no dependency on `Team.squadMode` existing yet beyond the single new column) is independently shippable first; Part B (`Team.squadMode` toggle + `MatchSquadMember` + the picker UI) depends on Part A's tables; Part C (the hard-block constraint) is delivered as part of Part B's own migration/service, not a separate pass, since the constraint has to exist before any `MatchSquadMember` row can be written safely; Part D (XI-builder/tinting integration) is a small, final, almost entirely frontend pass once Parts A through C exist. Landing all four in one PR is also fine, the split above is about reviewability, not a hard sequencing requirement.
- **`034-availability-polls-dashboard.md` is already built** (`ui/src/pages/manage/AvailabilityPollsDashboard.tsx`), not unbuilt as an earlier draft of this spec assumed. This spec still ships its own independent admin screen/nav entry rather than folding into that dashboard — combining the two (a shared avatar-summary component, one merged open-items list) is a real, non-trivial follow-up better done deliberately once both exist, not squeezed into this pass. **A human should add a `docs/roadmap.md` entry once this ships**, flagging "list open `SectionAvailabilityRound`s alongside `034`'s open `MatchAvailabilityPoll`s on one combined screen" as a real, likely-small future item.
- **`035-section-scoped-access.md` is already built.** Every new admin endpoint here uses its existing section-scoped access pattern (`canAccessClub` at the controller, `assertCanAdministerSection`/`assertCanAdministerAnySection` at the service layer, see API Contract), not the coarser `canAdministerClub`-only check an earlier draft of this spec specified. **A human should correct `docs/roadmap.md`'s "Blocked on the full tenancy model" section**, which still describes `035` as drafted/not-yet-built as of this writing — that description predates this correction and is now stale independent of `063`.
- **Auto-suggesting squad membership from availability responses is explicitly deferred, not forgotten.** Flagged as a real future item once real usage shows whether "available and not picked for anything else" is unambiguous enough to safely pre-fill. **A human should add this to `docs/roadmap.md`** as a new, explicitly open item pointing at this spec's own Non-goals, not re-derived from scratch later.
- **The `MORNING`/`AFTERNOON` day-part split is a considered, deliberately minimal choice, not a permanent ceiling.** A club running evening fixtures, or wanting a genuinely custom time-range bracket instead of a fixed AM/PM split, isn't served by this pass. Adding a third `DayPart` value is additive against `SectionAvailabilityMatchResolver.resolveWindowKey` alone — a round already creates however many distinct windows its selected matches resolve to (this revision's own change), so a third value just means a third possible bucket, not a redesign of the round/window relationship. **A human should add this to `docs/roadmap.md`** as a real, explicitly open future item, not a closed decision.
- **A rescheduled match doesn't re-resolve its existing squad picks' window linkage, accepted as a known limitation.** If a match moves to a different date/day-part after `MatchSquadMember` rows already exist against it, those rows keep pointing at the original bracket. **A human should add this to `docs/roadmap.md`** as an open item: decide whether a reschedule should block while picks exist, auto-re-resolve them, or require a manual re-pick.
- **Cross-section double-booking (e.g. a player turning out for both an U13 and an U15 side) isn't prevented, accepted as a known limitation.** The Part C hard block only spans one section's own window. **A human should add this to `docs/roadmap.md`** as an open item once real usage shows how often a club's players are eligible across more than one section at once.
- **`MatchSquadMemberDto` deliberately mirrors `TeamSquadMemberDto`'s (`031`) field set exactly**, rather than a leaner match-specific shape, this is what lets `PlayingXiBuilder` (`029`, extended for jersey numbers by `031`) consume either source with zero component changes, only a different fetch upstream in `MatchSideTab`. Flagged explicitly as a deliberate reuse decision, not an oversight that the two DTOs happen to look alike.
- **This spec's own admin `SectionAvailabilityRounds` screen does not reuse `034`'s `AvailabilityRespondentAvatars` component**, even though `034` (and that component) turn out to already be built — an earlier draft of this spec assumed otherwise. It ships a plain compact count-summary row per bracket instead, matching `032`'s own `MatchAvailabilityTab` treatment, a deliberate choice to keep this pass's own UI surface small, not a forced one. **Consolidating onto one shared avatar-group summary component is a real, small follow-up**, flagged here rather than left as an undocumented near-miss for a future reviewer to puzzle over.
- Ships as its own PR (or up to four, see above), on top of `025`'s `Section`, `026`'s `Team`, `028`'s `PlayerProfile`/`PlayerSection`, `029`'s already-built `Match`/`MatchSide`/`TeamSquadMember`, `031`'s already-built jersey-number model, and `032`'s already-built public-link/poll pattern.
- A human should update `docs/roadmap.md`'s relevant sections once this ships, per the entries flagged throughout this Rollout Notes section above.
