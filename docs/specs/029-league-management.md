# 029 — League Management & Match-Day Squad Selection

**Depends on:** `001-tenancy-identity-model.md` (`League`/`LeagueAffiliation` — this spec amends ADR-02, see Problem & Goals — and `Season`, named in `001`'s own Field Reference table but never built until now), `025-club-structure.md` (`Section.minAge`/`maxAge`'s deliberately *non-enforced* precedent, which this spec's `League.minAge`/`maxAge` deliberately diverges from — see Problem & Goals), `026-teams.md`/`027-team-profile.md` (`Team` — the entity every `LeagueAffiliation`, `Match` side, and squad in this spec is built against; `027`'s tabbed-screen pattern and `LinkExistingRecordDialog`/`CreateAndLinkRecordDialog`, both reused here), `028-players.md` (`Player.dateOfBirth`, `PlayerProfile`, `ClubMembership` — all reused as-is, not re-modeled), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace and `@access.canAdministerClub` pattern every endpoint below reuses), `006-post-login-home-shells.md` (`ManagerDashboard`'s existing "Fixtures & Results" and "Squads" cards, both still `EmptyState` placeholders, wired to real screens for the first time).
**Status:** draft.

## Problem & Goals

`001`'s ADR-02 decided `League` would be reporting/aggregation-only — no admin role, no fixture scheduling, no standings surface — because running leagues on the vendor's behalf was speculative scope at the time. **This spec amends ADR-02**, the same way `015-person-status-and-role-assignment.md` grew a stub `001` had only sketched into a real, built entity: real cross-club leagues typically live on an external platform (CricClubs) this vendor plans to integrate with once a commercial agreement exists — that integration is explicitly **not** built here, only reserved for (see `League.source`, Non-goals). What this spec builds instead is administration of a **club's own internal league, tournament, or friendly fixture list**: a club creates and runs its own competition inside this platform, enters its own `Team`s, schedules matches, and picks a playing XI. ADR-02's original "vendor-run, cross-club league administration" scenario stays exactly as deferred as `001` left it — every `League` this spec creates is owned by one club, never a true cross-club entity.

`006` shipped two `/manage` nav cards — "Fixtures & Results" and "Squads" — as `EmptyState` placeholders on day one; `docs/roadmap.md`'s "Blocked on the full tenancy model" section still lists league/fixture administration among the gaps a real tenancy model needs to close. `025`, `026`/`027`, and `028` have since built `Section`, `Team`, and `Player` for real — this is the next real slice: a club can now schedule its own matches (against its own teams, another club's team, or an outside opponent with no account here at all) and pick who plays.

**Goals**
- A club admin can create a `League` for their own club — internal by default, with a configurable playing-XI size (not a fixed 11, since some leagues such as Vets cricket field 12 fully-participating players) and optional, **enforced** age eligibility (see the divergence note below).
- A club admin can define `Season`s for their club (label + date range) and affiliate one or more of their own `Team`s into a `League` for a given `Season`.
- A club admin can schedule a `Match` — against another of the club's own `Team`s, another club's `Team` (a real inter-club fixture), or a free-text opponent name for a club with no account on this platform — with a date/time, a venue, and an optional `League`/`Season`.
- A club admin can maintain a `Team`'s squad — the pool of players eligible to be selected for that team, validated against real club membership, not an open free-for-all.
- A club admin can pick a `Match`'s playing XI for either side that's a real `Team`: an ordered batting line-up, captain, wicketkeeper, twelfth man, and a batsman/bowler/all-rounder tag per player — capped at the `League`'s configured XI size (or 11 for a standalone friendly), drawn only from that `Team`'s squad, and rejected if a player falls outside the `League`'s enforced age range.

**Why `League.minAge`/`maxAge` are enforced when `Section.minAge`/`maxAge` (`025`) are not.** `025` made a deliberate, explicit choice to leave `Section` eligibility metadata purely descriptive — nothing in this codebase validated a player against it, because nothing needed to yet. This spec is that "yet": a league genuinely needs to block an ineligible player from being selected, not just describe an age band for a committee's own reference. Treat this as a conscious, documented divergence between two similarly-named fields on two different entities, not an inconsistency to reconcile later.

## Non-goals

- **`League.source = EXTERNAL` / any CricClubs sync.** The enum value exists so a future spec can add it without a schema change; nothing else does. No sync logic, no external API call, no vendor-run cross-club league administration — `001` ADR-02's original scenario stays exactly as deferred as it always was.
- **Vendor-run, cross-club league administration.** Every `League` in this spec is `club_id`-owned; there is no true cross-club/global `League` and no `LEAGUE` `RoleAssignment` scope type. `001`'s own reversibility note for ADR-02 ("add `LEAGUE` as a fifth `scope_type` on `RoleAssignment` when needed") remains unactioned.
- **Match results, scores, or any outcome field.** `Match` is fixture/scheduling data only in this pass — no innings, no score, no result, no points/standings table. Explicitly Phase 1, a fast-follow spec, not built here (see Rollout Notes).
- **Auto-generated fixtures or round-robin scheduling.** Matches are entered one at a time, by hand.
- **Availability polls, AI-assisted XI suggestion, an "Announce Team" lock/notify/email workflow, or public/shareable team-sheet graphics.** The legacy Cricket Legend project (`/Users/jaco/Development/cricketlegend`, a different codebase) had all four; this spec is a deliberately trimmed-down rebuild — squad and playing-XI selection only, none of the above. Real future work, not forgotten.
- **Any public-facing schedule, squad, or team-sheet display.** `/manage`-only, matching every prior spec in this codebase's identical Non-goal.
- **A `/platform` mirror.** Same established reasoning every spec since `020` has given — `canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**`.
- **Any `RoleAssignment` `LEAGUE`/`TEAM`-scope wiring.** Matches `025`/`026`/`028`'s identical Non-goal for `SECTION`/`TEAM` scope — this spec only ever checks `CLUB`-scope access via the existing `canAdministerClub`.
- **Enforcing `Section.minAge`/`maxAge`/`gender` against anything.** Unrelated, unchanged, still `025`'s own non-enforced metadata — not to be confused with this spec's own, deliberately enforced, `League.minAge`/`maxAge` (see Problem & Goals).
- **Re-parenting, cardinality limits, or hard-deleting a bare join.** `LeagueAffiliation` and `TeamSquadMember` are unlink-only (hard delete of the join row, no `active` flag) — matching `SectionContact`/`TeamContact`/`TeamSponsor`/`PlayerSection`'s established "a join row carries no independent business meaning" posture.
- **A cross-club opponent independently managing their own playing XI on a shared fixture.** A `Match`'s home/away side can reference any club's `Team` (see Data Model Changes), but this pass scopes all `MatchSide`/XI-selection authorization to the `Match`'s own owning `club_id` — the club that created and manages the `Match` record. If the opposing side happens to be a real `Team` belonging to a different, also-onboarded club, that club's own admin cannot independently build their own side's XI through this `Match` record in this pass; only the managing club can. A genuinely two-sided, cross-club-authorized XI workflow is real future scope, not built here — flagged explicitly in Rollout Notes as a call made to keep this pass shippable this week.
- **A standalone `ClubMembership` or `Season` "billing"/subscription concept.** `Season` here is purely a date range for scoping affiliations and matches — no relation to `001` ADR-03's subscription-ownership `Season`/`Section` billing question, which stays exactly as deferred as `001` left it.
- **Bulk import of fixtures, seasons, or squads (CSV or similar).** One at a time through the form, matching `028`'s identical cut for player import.

## User Stories

- As a club admin, I can create a `League` for my club with a name, a configurable playing-XI size (defaulting to 11), an `allowSubstitutions` flag, and optional min/max age with an optional cutoff date.
- As a club admin, I can deactivate a `League` I no longer run and reactivate it later, without losing its history.
- As a club admin, I can create `Season`s for my club (a label and a date range) to scope which affiliations and matches belong to which year/period.
- As a club admin, I can affiliate one of my club's own `Team`s into one of my club's own `League`s for a given `Season`, and remove that affiliation later without deleting the `Team` or the `League`.
- As a club admin, I can schedule a `Match`: pick a date/time and venue, optionally attach it to one of my `League`s and `Season`s, and set each side to either one of my club's own `Team`s, another club's real `Team`, or a free-text opponent name (e.g. "Riverside Occasionals") when the opponent has no account on this platform.
- As a club admin, I can edit or reschedule a `Match`, and deactivate one that's been called off without losing its record.
- As a club admin, I can build a `Team`'s squad — the pool of players eligible to be selected for that team — by adding players who are active members of my own club, and remove a player from the squad later without deleting their player record.
- As a club admin, for a `Match` where a side is one of my real `Team`s, I can pick that side's playing XI: add players from the team's squad in batting order, reorder them, tag each with a batsman/bowler/all-rounder role, and set a captain, a wicketkeeper, and a twelfth man.
- As a club admin, I'm blocked from adding more players to a playing XI than the `League`'s configured XI size allows (or 11, for a standalone friendly with no `League`).
- As a club admin, I'm blocked from adding a player to a `League`-restricted `Match`'s playing XI if their age (as of the `League`'s cutoff date, or the `Season`'s start date if no cutoff is set) falls outside that `League`'s age range — or if their date of birth isn't recorded at all.
- As a club admin for club X, I cannot view or modify club Y's leagues, seasons, affiliations, squads, matches, or playing XIs, even by guessing an id — enforced server-side.

## Data Model Changes

**New entity — `League`**, club-scoped, the first real administration surface `001`'s ADR-02 always deferred:

```
League {
    uuid      id
    uuid      club_id              -- FK club.id, not null — every League here is club-owned (see
                                     -- Problem & Goals' ADR-02 amendment)
    string    name                 -- not null
    string    source               -- enum INTERNAL | EXTERNAL, not null, default INTERNAL —
                                     -- EXTERNAL is a reserved placeholder for a future CricClubs
                                     -- integration; nothing beyond the column exists for it yet
    integer   max_playing_xi_size  -- not null, default 11 — a plain configurable count, deliberately
                                     -- not a fixed TRADITIONAL/VETS enum, so a Vets league (12 fully-
                                     -- participating players) is just a different number, not a
                                     -- separate code path
    boolean   allow_substitutions  -- not null, default false — informational rule-documentation
                                     -- (e.g. Vets cricket allows a sub to fully bat/bowl, not just
                                     -- field); the actual mechanical cap enforced is always
                                     -- max_playing_xi_size, never this flag
    integer   min_age              -- nullable — ENFORCED (see Problem & Goals' divergence note),
                                     -- unlike Section.minAge (025)
    integer   max_age              -- nullable — ENFORCED
    date      age_cutoff_date      -- nullable — "age as of this date"; if null, falls back to the
                                     -- Season.start_date of the Season a given Match is under, at
                                     -- evaluation time. One field covers both a birth-year rule (set
                                     -- this to 31 Dec of the season's year) and a rolling-age rule
                                     -- (leave it blank) — no separate rule-type enum needed
    boolean   active                -- default true; "disable, never delete" (see Non-goals)
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

`min_age <= max_age` validated at create/update time when both are set (`ValidationException`, `400`) — same shape as `025`'s identical `Section` rule.

**New entity — `Season`**, club-scoped, named in `001`'s own Field Reference table (`id, club_id, label`) but never built until now — this spec adds the two date fields `001`'s table already anticipated ("Scopes registrations and league affiliation") and this codebase's standard audit/active-flag columns:

```
Season {
    uuid      id
    uuid      club_id     -- FK club.id, not null
    string    label        -- not null, e.g. "2026"
    date      start_date   -- not null
    date      end_date     -- not null
    boolean   active       -- default true; a codebase-wide addition beyond 001's original three-field
                            -- sketch, matching every other club-scoped entity's own "disable, never
                            -- delete" posture (Product, Club, ClubContact, Sponsor, Team, League
                            -- above) — not explicitly requested for Season, added for consistency; see
                            -- Rollout Notes
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

`start_date <= end_date` validated at create/update time (`ValidationException`, `400`).

**New entity — `LeagueAffiliation`**, a club's own `Team` entered into its own `League` for a `Season`:

```
LeagueAffiliation {
    uuid  id
    uuid  league_id  -- FK league.id, not null
    uuid  team_id    -- FK team.id, not null
    uuid  season_id  -- FK season.id, not null
}
```

Unique on `(league_id, team_id, season_id)` — a `Team` can't be affiliated to the same `League` twice for the same `Season`, but can be affiliated to any number of different `League`s, or the same `League` across different `Season`s. **Same-club consistency, enforced at the service layer**: `team.club_id`, `season.club_id`, and `league.club_id` must all match the `clubId` already resolved from the URL — since every `League`/`Season` here is club-owned and every `Team` a club affiliates is that same club's own `Team` (`001`'s entity table only ever intended `League`/`LeagueAffiliation` as the cross-club seam, which this spec's club-owned `League`s deliberately are not). A mismatch on either FK reads as `NotFoundException` (`404`), matching every prior spec's identical "the referenced id doesn't belong to this club" precedent (`025`'s `sectionId`/`contactId` isolation, `026`'s `sectionId`/`teamId` isolation) — not a `400`, and not a `403`.

**New entity — `TeamSquadMember`**, the persistence for a `Team`'s squad, **season-scoped, not standing** — added by this spec's own pre-build amendment (see Rollout Notes): a team's squad is rebuilt each season rather than carrying over indefinitely, so a junior team's roster can't silently retain a player who's since aged out of that division. A real join entity/table, not a raw `@ElementCollection`, matching this codebase's existing precedent for every other many-to-many relationship (`SectionContact`, `TeamContact`, `TeamSponsor`, `PlayerSection`) rather than mirroring the legacy project's bare `Team.squadPlayerIds` collection field:

```
TeamSquadMember {
    uuid  id
    uuid  team_id            -- FK team.id, not null
    uuid  season_id          -- FK season.id, not null
    uuid  player_profile_id  -- FK player_profile.id, not null
}
```

Unique on `(team_id, season_id, player_profile_id)` — the same player can be (re)added independently for each season; removing them from one season's squad has no effect on any other season's row. **Validated at add-time, a deliberate tightening beyond the legacy project's zero validation here:** a player can only be added to a `Team`'s squad if `player_profile.club_id == team.club_id` **and** that player currently has an active club membership. Rather than a second join query against `club_membership`, this is checked via `PlayerProfile.active == true` — `028`'s own service layer already keeps `PlayerProfile.active` and `ClubMembership.valid_to IS NULL` in lockstep (deactivating a player closes the membership in the same transaction; reactivating reopens it), so `PlayerProfile.active` is an equivalent, cheaper proxy for "has an active `ClubMembership` in this club" without a second join. A violation of either condition is a `NotFoundException` (`404`, for a `playerId` that isn't a real player of this club — mirrors the cross-tenant-id precedent above) or a dedicated `ValidationException` subclass (for an otherwise-real, correctly-scoped player who is currently inactive) — see API Contract.

**New entity — `Match`**, deliberately doing double duty as both fixture and match record (mirroring the legacy project's own single-entity approach rather than a separate `Fixture` concept):

```
Match {
    uuid       id
    uuid       club_id          -- FK club.id, not null — the managing club (see the dedicated note
                                  -- below on how this is derived)
    uuid       home_team_id     -- nullable FK team.id — a real Team, any club's, not just this
                                  -- Match's own club_id (cross-club Team references are fine even
                                  -- though League stays club-scoped)
    string     home_team_name   -- nullable free text — used when the home side has no account on
                                  -- this platform
    uuid       away_team_id     -- nullable FK team.id, same cross-club allowance as home_team_id
    string     away_team_name   -- nullable free text
    uuid       league_id        -- nullable FK league.id — must belong to this Match's own club_id
                                  -- when set (see API Contract)
    uuid       season_id        -- NOT NULL FK season.id — same club_id constraint as league_id.
                                  -- Required (not optional) since this spec's pre-build amendment
                                  -- made squad membership season-scoped: a MatchSide always needs an
                                  -- unambiguous season to resolve which TeamSquadMember rows apply.
                                  -- A standalone friendly still needs no League, but does need a
                                  -- Season — cheap since a club creates a Season once per year/period
                                  -- regardless (see Rollout Notes)
    timestamp  match_date       -- not null, date and time
    string     venue            -- nullable free text — no separate Venue/Field entity this pass
    boolean    active           -- default true; a codebase-wide addition beyond the fields explicitly
                                  -- requested for Match, matching every other entity's "disable, never
                                  -- delete" posture (a called-off fixture needs somewhere to go
                                  -- without deleting its record) — see Rollout Notes
    timestamp  created_at
    timestamp  updated_at
    uuid       updated_by
}
```

Exactly one of `home_team_id`/`home_team_name` is populated, and exactly one of `away_team_id`/`away_team_name` — a nullable FK + nullable free-text column per side, with a Postgres `CHECK` constraint enforcing the exclusivity at the database level (see migration below), backed by a `ValidationException` (`400`) at the service layer for a clean error message before the constraint would ever be hit.

**How `Match.club_id` is derived — a deliberate, conservative call, not the "likely" home-team-club derivation this spec was scoped against.** `Match.club_id` is always the `clubId` the creating admin is acting under (the URL's own `clubId`, the same club whose `canAdministerClub` grant authorized the request) — **never** derived from `home_team_id`'s own `club_id`, even when the home side happens to reference a real `Team` belonging to a different club. Deriving ownership from whichever club's `Team` happens to be picked as "home" would let one club's admin silently hand a `Match` record's ownership to another club merely by referencing that club's `Team` id — a real cross-tenant assignment risk this spec doesn't need to take on to ship this week's matches. "The club whose admin created it and who can edit it" (this spec's own framing) is exactly the URL's `clubId`, full stop.

**Migration** (next sequential file after `028`'s `020-add-player.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/021-add-league-management.sql

CREATE TABLE league (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id               UUID NOT NULL REFERENCES club(id),
    name                  VARCHAR(255) NOT NULL,
    source                VARCHAR(16) NOT NULL DEFAULT 'INTERNAL',
    max_playing_xi_size   INTEGER NOT NULL DEFAULT 11,
    allow_substitutions   BOOLEAN NOT NULL DEFAULT false,
    min_age               INTEGER,
    max_age               INTEGER,
    age_cutoff_date       DATE,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            UUID
);

CREATE INDEX ix_league_club ON league(club_id);

CREATE TABLE season (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    label       VARCHAR(255) NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_season_club ON season(club_id);

CREATE TABLE league_affiliation (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id   UUID NOT NULL REFERENCES league(id),
    team_id     UUID NOT NULL REFERENCES team(id),
    season_id   UUID NOT NULL REFERENCES season(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID,
    UNIQUE (league_id, team_id, season_id)
);

CREATE INDEX ix_league_affiliation_league ON league_affiliation(league_id);
CREATE INDEX ix_league_affiliation_team ON league_affiliation(team_id);
CREATE INDEX ix_league_affiliation_season ON league_affiliation(season_id);

CREATE TABLE team_squad_member (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id            UUID NOT NULL REFERENCES team(id),
    season_id          UUID NOT NULL REFERENCES season(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID,
    UNIQUE (team_id, season_id, player_profile_id)
);

CREATE INDEX ix_team_squad_member_team ON team_squad_member(team_id);
CREATE INDEX ix_team_squad_member_season ON team_squad_member(season_id);
CREATE INDEX ix_team_squad_member_player ON team_squad_member(player_profile_id);

CREATE TABLE match (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id         UUID NOT NULL REFERENCES club(id),
    home_team_id    UUID REFERENCES team(id),
    home_team_name  VARCHAR(255),
    away_team_id    UUID REFERENCES team(id),
    away_team_name  VARCHAR(255),
    league_id       UUID REFERENCES league(id),
    season_id       UUID NOT NULL REFERENCES season(id),
    match_date      TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID,
    CONSTRAINT ck_match_home_side CHECK ((home_team_id IS NOT NULL) <> (home_team_name IS NOT NULL)),
    CONSTRAINT ck_match_away_side CHECK ((away_team_id IS NOT NULL) <> (away_team_name IS NOT NULL))
);

CREATE INDEX ix_match_club ON match(club_id);
CREATE INDEX ix_match_home_team ON match(home_team_id);
CREATE INDEX ix_match_away_team ON match(away_team_id);
CREATE INDEX ix_match_league ON match(league_id);
CREATE INDEX ix_match_season ON match(season_id);
CREATE INDEX ix_match_date ON match(match_date);

CREATE TABLE match_side (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id                 UUID NOT NULL REFERENCES match(id),
    team_id                  UUID NOT NULL REFERENCES team(id),
    captain_player_id        UUID REFERENCES player_profile(id),
    wicket_keeper_player_id  UUID REFERENCES player_profile(id),
    twelfth_man_player_id    UUID REFERENCES player_profile(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               UUID,
    UNIQUE (match_id, team_id)
);

CREATE INDEX ix_match_side_match ON match_side(match_id);
CREATE INDEX ix_match_side_team ON match_side(team_id);

CREATE TABLE match_side_player (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_side_id      UUID NOT NULL REFERENCES match_side(id),
    player_profile_id  UUID NOT NULL REFERENCES player_profile(id),
    batting_order      INTEGER NOT NULL,
    role               VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_side_id, player_profile_id),
    UNIQUE (match_side_id, batting_order)
);

CREATE INDEX ix_match_side_player_side ON match_side_player(match_side_id);
CREATE INDEX ix_match_side_player_player ON match_side_player(player_profile_id);
```

**`MatchSide`/`MatchSidePlayer` business rules, enforced server-side:**

- A `MatchSide` exists only for a side that's a real `Team` (`team_id` must equal whichever of the `Match`'s own `home_team_id`/`away_team_id` matches it) — a free-text opponent side never gets one, since there's no roster in this system to select from.
- Every player referenced anywhere on a `MatchSide` — a `match_side_player` row, `captain_player_id`, `wicket_keeper_player_id`, or `twelfth_man_player_id` — must already be a member of that `team_id`'s squad **for the `Match`'s own `season_id`** (`TeamSquadMember`, season-scoped per this spec's pre-build amendment). A mismatch — including a player who's in that team's squad for a *different* season — is a dedicated `ValidationException` subclass (`PlayerNotInSquadException`), `400`.
- `captain_player_id`/`wicket_keeper_player_id` must reference a player who is already one of this `MatchSide`'s `match_side_player` rows (i.e. already added to the batting order) — a `ValidationException`, `400`, if not.
- `twelfth_man_player_id` must **not** be one of the `MatchSide`'s current `match_side_player` rows — a twelfth man is a distinct, non-playing reserve, not a second reference to someone already in the XI (`ValidationException`, `400`). This mirrors the requirement's own framing that the twelfth man is "kept as plain bookkeeping regardless of `allowSubstitutions`... a separate concern," not a member of the ordered XI itself.
- Adding a `match_side_player` row is capped at `league.max_playing_xi_size` when the `Match` has a `league_id`, or `11` when it doesn't — a dedicated `ValidationException` subclass (`PlayingXiCapExceededException`), `400`, once the cap is reached. The twelfth man does **not** count against this cap (a separate concern, per the requirement).
- **Age eligibility**, checked whenever the `Match`'s `League` has `min_age` and/or `max_age` set, against **every** player reference on the `MatchSide` (every `match_side_player` row, plus `captain_player_id`/`wicket_keeper_player_id`/`twelfth_man_player_id`) — not just the ordered XI, since a twelfth man may still fully bat/bowl under a league where `allow_substitutions` is true, and the rule exists to keep an ineligible player out of the match entirely, not just off the batting card:
  - The cutoff date is `league.age_cutoff_date` if set, else the `Match`'s own `season.start_date` — always resolvable now that `Match.season_id` is required (see this spec's pre-build amendment, Rollout Notes); the earlier "no season and no league cutoff date" rejection case no longer applies.
  - **If the player's own `Player.dateOfBirth` (`028`) is null, the add is rejected** — eligibility genuinely cannot be evaluated without it, and this spec's conservative call is to require it be set (via the existing Players screen, `028`) before that player can be added to an age-restricted league's `Match`, rather than defaulting to "assume eligible."
  - Both failure cases raise the same dedicated `ValidationException` subclass, `PlayerAgeIneligibleException`, `400`, with a distinct message per case.

## API Contract

All endpoints below sit on the existing `/api/v1/manage/**` namespace and reuse `020`'s access pattern unmodified — `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")`, the same `RoleAssignment`/`CLUB`-scope check every `/manage` endpoint since `020` has used (`docs/specs/002-realm-subdomain-auth.md`'s realm/subdomain model underneath it, unchanged). Every endpoint is scoped to `clubId` first — `404` if a nested id (`leagueId`, `seasonId`, `teamId`, `matchId`, `sideId`) is real but belongs to a different club, matching every prior spec's isolation posture.

**Leagues**

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues` | `@access.canAdministerClub` | Lists every league for the club (active and inactive, inactive renders muted — same posture as every prior list) |
| `POST /api/v1/manage/clubs/{clubId}/leagues` | same | Creates a league. `{name, source?, maxPlayingXiSize?, allowSubstitutions?, minAge?, maxAge?, ageCutoffDate?}` |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}` | same | Updates the same fields |
| `POST .../leagues/{leagueId}/deactivate` | same | `409` if already inactive |
| `POST .../leagues/{leagueId}/reactivate` | same | `409` if already active |

**Seasons**

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/seasons` | `@access.canAdministerClub` | Lists every season for the club |
| `POST /api/v1/manage/clubs/{clubId}/seasons` | same | Creates a season. `{label, startDate, endDate}` |
| `PUT /api/v1/manage/clubs/{clubId}/seasons/{seasonId}` | same | Updates the same fields |
| `POST .../seasons/{seasonId}/deactivate` | same | `409` if already inactive |
| `POST .../seasons/{seasonId}/reactivate` | same | `409` if already active |

**League affiliations** — nested under the league, since a `Team`/`Season` pairing only ever makes sense in the context of "which teams are entered in this league":

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations` | `@access.canAdministerClub` | Lists every affiliation for the league (across all seasons) |
| `POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations` | same | Affiliates a team for a season. `{teamId, seasonId}` — `404` if either belongs to a different club than `clubId`; `409` if the exact `(league, team, season)` triple already exists |
| `POST .../affiliations/{affiliationId}/unaffiliate` | same | Hard-deletes the join row (mirrors `SectionContact`/`TeamSponsor`'s unlink precedent) — `404` if no such affiliation |

**Team squad** — a new sub-resource nested off `clubId` + `teamId` + `seasonId` (independent of `026`'s section-nested Team CRUD path, since squad membership isn't a Team-editing concern and the client already holds a `teamId` from any existing Team screen) — **season-scoped per this spec's pre-build amendment**: a squad is always "this team's squad for this season," never a standing, un-scoped list:

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad` | `@access.canAdministerClub` | Lists the team's squad for that season — reuses `028`'s existing `PlayerDto` shape, no new DTO. `404` if `seasonId` belongs to a different club |
| `POST .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add` | same | Adds a player to that season's squad. `404` if the player isn't a real player of this club, or `seasonId` belongs to a different club; `400` (`PlayerNotActiveClubMemberException extends ValidationException` — see note below) if the player exists but is currently inactive; `409` if already in that season's squad |
| `POST .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove` | same | Removes the player from that season's squad (hard delete of the join row) — has no effect on any other season's row for the same player/team. `404` if not currently in that season's squad. Does **not** retroactively remove that player from any `MatchSide` they're already selected on — a past selection is a historical record, not a live view of current squad membership (a deliberate call, see Rollout Notes) |

*(A player who exists, belongs to this club, but is currently deactivated (`PlayerProfile.active = false`) is a distinct failure from "player not found" — modelled as a `ValidationException` (`400`), not a `404`, since the id is real and correctly scoped, just currently ineligible.)*

**Matches**

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches` | `@access.canAdministerClub` | **Paginated** (`Pageable` — `page`/`size`/`sort`, default sort `matchDate` descending) — the first list in this feature area to need real pagination (`docs/standards/backend.md`'s pagination rule), unlike `Section`/`Team`/`Sponsor`'s deliberately small, flat, unpaginated lists: a club's match history grows every week across every season, unlike its section/team/sponsor counts |
| `POST /api/v1/manage/clubs/{clubId}/matches` | same | Creates a match. `{homeTeamId?, homeTeamName?, awayTeamId?, awayTeamName?, leagueId?, seasonId, matchDate, venue?}` — `seasonId` is required (not optional — see this spec's pre-build amendment, Rollout Notes), `leagueId` stays optional; `400` if either side doesn't have exactly one of its team-id/name pair populated, or if `seasonId` is missing; `404` if `leagueId`/`seasonId` is set but belongs to a different club than `clubId`; `404` if `homeTeamId`/`awayTeamId` is set but no such `Team` exists (any club — cross-club references are allowed, see Data Model Changes) |
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}` | same | Fetches one match (backs the edit screen) |
| `PUT /api/v1/manage/clubs/{clubId}/matches/{matchId}` | same | Updates the same fields — rescheduling, changing venue/opponent/league/season are all just an edit, no separate "reschedule" action |
| `POST .../matches/{matchId}/deactivate` | same | `409` if already inactive |
| `POST .../matches/{matchId}/reactivate` | same | `409` if already active |

**Match sides (playing XI)**

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides` | `@access.canAdministerClub` | Lists the match's sides (0, 1, or 2 — one per real-`Team` side), each with its ordered players |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides` | same | Creates a side. `{teamId}` — `400` if `teamId` isn't equal to this match's own `homeTeamId`/`awayTeamId`, or if that side is a free-text opponent (no roster to build); `409` if a side for that team already exists on this match |
| `PUT .../sides/{sideId}` | same | Updates `{captainPlayerId?, wicketKeeperPlayerId?, twelfthManPlayerId?}` — all three validated per the business rules above |
| `POST .../sides/{sideId}/players` | same | Adds a player to the XI. `{playerProfileId, role}` — appended at the end of the batting order. Validated: squad membership, cap, age eligibility (business rules above); `409` if already added to this side |
| `PUT .../sides/{sideId}/players/{playerProfileId}` | same | Updates that player's `role` only — batting order/eligibility are unaffected |
| `POST .../sides/{sideId}/players/{playerProfileId}/remove` | same | Removes the player from the XI (hard delete of the row; also clears `captainPlayerId`/`wicketKeeperPlayerId` on this side if they pointed at the removed player) |
| `PUT .../sides/{sideId}/players/reorder` | same | `{playerProfileIds: UUID[]}` — the full new batting order for every player currently on this side; `400` if the set doesn't exactly match the side's current players |

## UI Requirements

**The Playing XI builder is genuinely new — flag for a Claude Design pass before build (`docs/workflow.md` Step 2), same precedent `025` set for `SectionTreeEditor`.** Nothing in `components/**` today renders or edits an ordered, role-tagged squad selection; this is not a near-miss on an existing component.

- **`ui/src/components/PlayingXiBuilder/`** (new, four-file anatomy) — given a team's squad (`PlayerDto[]`), the side's current ordered XI, and the applicable cap (`maxPlayingXiSize` or 11): an `Autocomplete` over squad members not yet added (plus a role `Select`) to add a player at the end of the order; each row in the ordered list shows the player's name, a role `Select` (Batsman/Bowler/All-rounder), and up/down `IconButton`s to reorder (mobile-first — explicit up/down controls rather than drag-and-drop, which doesn't hold up well on a touch viewport at 375px); a remove action per row; three `Select`s above or below the list for Captain/Wicketkeeper (options limited to players currently in the ordered list) and Twelfth Man (options limited to squad members **not** currently in the ordered list); a running "X / cap" count, disabling the add control once the cap is reached; and inline error surfacing for the server's age-ineligibility/squad-membership rejections (a toast or field-level alert, not a silent failure). Props are data-and-callback only — no direct API calls from inside the component, matching `docs/standards/frontend.md`'s "server state through React Query in the page, not the component" convention.
- **`ui/src/pages/manage/LeagueList.tsx`** / **`LeagueFormPage.tsx`** / **`ui/src/components/LeagueForm/`** (all new) — the standard `ListToolbar` + `RecordCard` + `RecordFormScreen` list/CRUD anatomy (`008`/`010`, reused by every prior `/manage` list). `LeagueFormPage` (edit mode only, mirroring `027`'s tab precedent) gains an **Affiliations** tab: a `Season` picker (`Select`, over `listSeasons(clubId)`) plus a `RecordCard` grid of teams currently affiliated for the selected season, an "Add team" action opening `027`'s existing, generic `LinkExistingRecordDialog<TeamDto>` (candidates = the club's own active teams not already affiliated for that season) calling this spec's own affiliate endpoint, and an unlink action per card.
- **`ui/src/pages/manage/SeasonList.tsx`** / **`SeasonFormPage.tsx`** / **`ui/src/components/SeasonForm/`** (all new) — same standard anatomy, `label`/`startDate`/`endDate` fields, no tabs (no sub-resource of its own).
- **`ui/src/pages/manage/ManageFixturesHome.tsx`** (new) — the "Fixtures & Results" dashboard card's real destination for the first time, mirroring `007-configuration-hub-overview.md`'s own hub-of-cards pattern exactly (composed entirely from the existing `Card` component, no new shared component): three cards, **Leagues** (`/manage/fixtures/leagues`), **Seasons** (`/manage/fixtures/seasons`), **Matches** (`/manage/fixtures/matches`) — the "Results" half of the card's existing copy stays aspirational until the Phase 1 results-capture spec ships (see Rollout Notes), matching how `007` itself named future-module cards ahead of their own spec.
- **`ui/src/pages/manage/MatchList.tsx`** (new) — reads `clubId` from `ManagerHome`'s `Outlet` context, consumes the **paginated** match endpoint via `useQuery` keyed on the current page (`docs/standards/frontend.md`'s pagination rule — the first list screen in this feature area that can't just fetch everything), renders `ListToolbar` (search — backend-driven, over opponent name/team name) + `RecordCard` grid: title = "Home vs Away" (resolving each side's team name or free-text name), `fields` = date/time, venue, league/season if set, muted "Inactive" badge, `editTo`/Deactivate-Reactivate `secondaryAction`.
- **`ui/src/components/MatchForm/`** (new, four-file anatomy) — `matchDate` (date-time picker), `venue` (`Input`), a **required** `Season` `Select` (over `listSeasons(clubId)` — required per this spec's pre-build amendment, since squad membership is season-scoped and every `MatchSide` needs an unambiguous season) plus an **independent, optional** `League` `Select` (season options/filtering exact behaviour left to build time), and, per side (Home/Away), a toggle between "One of our teams" (a `Select` over the **current club's own** team list — cross-club `Team` references stay backend-supported for a future inter-club fixture case, but this pass's UI only ever lets an admin pick from their own club's teams, never another club's, a deliberate scoping call made to ship this week's matches without a cross-club team search UI) and "External opponent" (a free-text `Input` for the name).
- **`ui/src/pages/manage/MatchFormPage.tsx`** (new) — `RecordFormScreen` wrapping `MatchForm` for create; in edit mode, a tabbed layout (`027`'s Details/Contacts/Sponsors precedent) — **Details** (the form above) plus one **Playing XI** tab per side that's currently a real `Team` reference (0, 1, or 2 sub-tabs, e.g. "Home XI"/"Away XI"), each rendering `PlayingXiBuilder` against that side's `Team` squad **for the match's own season** (`listSquad(clubId, teamId, match.seasonId)`) and current `MatchSide` (creating one via `POST .../sides` on first use if none exists yet).
- **`ui/src/pages/manage/SquadPicker.tsx`** (new) — the "Squads" dashboard card's real destination (its existing copy, "Pick squads per match," already anticipated this exact flow rather than a separate per-team roster screen): reuses `MatchList`'s same paginated data source and card shape, but each card's primary action jumps straight to that match's **Playing XI** tab on `MatchFormPage` rather than its Details tab — the same underlying `Match` data, a different entry point optimized for "I need to pick today's XI," not a second parallel list.
- **`ui/src/pages/manage/TeamFormPage.tsx`** (`026`/`027`, existing) — gains a fourth tab, **Squad** (edit mode only, mirroring `028`'s identical "Sections tab, edit mode only" precedent): a **`Season` `Select`** (over `listSeasons(clubId)`, defaulting to whichever season's date range contains today, else the most recently created season — added by this spec's pre-build amendment since squad membership is season-scoped) above a `RecordCard` grid of the team's squad **for the selected season** (reusing `028`'s `PlayerDto` shape and card fields), an "Add player" action opening `LinkExistingRecordDialog<PlayerDto>` (candidates = the club's own active players not already in this team's squad for that season), and a remove action per card.
- **`ui/src/api/leagueApi.ts`**, **`seasonApi.ts`**, **`leagueAffiliationApi.ts`**, **`teamSquadApi.ts`**, **`matchApi.ts`**, **`matchSideApi.ts`** (all new) — one file per backend resource per `docs/standards/frontend.md`, thin wrappers over the API Contract above.
- **`ui/src/App.tsx`** — the existing `fixtures` route's element changes from `<EmptyState title="Fixtures & Results" .../>` to `<ManageFixturesHome />`; the existing `squads` route's element changes from `<EmptyState title="Squads" .../>` to `<SquadPicker />`; new nested routes under `/manage/fixtures`: `leagues`, `leagues/new`, `leagues/:leagueId/edit`, `seasons`, `seasons/new`, `seasons/:seasonId/edit`, `matches`, `matches/new`, `matches/:matchId/edit`. No new route needed for the Team `Squad` tab (lives inside `026`'s existing `TeamFormPage` route).
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — no change. The existing "Fixtures & Results" (`/manage/fixtures`) and "Squads" (`/manage/squads`) cards (`006`) already point at the right paths; only the routes' elements change, in `App.tsx` above.

**Mobile-first**, per `docs/standards/frontend.md` — `PlayingXiBuilder`'s ordered list and role/captain/keeper/twelfth-man controls must all be usable at 375px (stacked, full-width rows), and `MatchForm`'s per-side toggle must not force horizontal scrolling at that width.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `LeagueServiceImplTest`/`SeasonServiceImplTest` — create/update including `minAge<=maxAge`/`startDate<=endDate` validation, deactivate/reactivate transitions and their `409`s; `LeagueAffiliationServiceImplTest` — create/unaffiliate, the triple-uniqueness `409`, cross-club `NotFoundException` isolation for `teamId`/`seasonId`; `TeamSquadServiceImplTest` — add/remove, the not-a-real-player `404`, the inactive-player `ValidationException`, the already-in-squad `409`; `MatchServiceImplTest` — create/update, the exactly-one-of-team-or-name validation per side, cross-club `404` for `leagueId`/`seasonId`, cross-club-allowed `Team` reference for `homeTeamId`/`awayTeamId`, the club_id-derivation rule (always the acting club, never the home team's own club), deactivate/reactivate `409`s; `MatchSideServiceImplTest` — side creation restricted to the match's own two team ids, add/remove/reorder players, the squad-membership `PlayerNotInSquadException`, the cap `PlayingXiCapExceededException` (both the league-configured size and the 11-fallback for a league-less match), the age-eligibility `PlayerAgeIneligibleException` (missing DOB, out-of-range age, both cutoff-date sources — league's own vs. season's start date — and the no-date-available rejection), captain/keeper-must-be-in-XI and twelfth-man-must-not-be-in-XI validations |
| Integration | New repository tests (Testcontainers) for all six new tables — migration applies cleanly, every FK and unique constraint (including the two `CHECK` constraints on `match`) behaves correctly at the DB level; new controller integration tests for every endpoint above — real `CLUB_ADMIN` success for the caller's own club, `403`/`404` for a different club, `platform_admin` superset success, every documented `409`/`400`/`404` proven through real HTTP, the paginated `GET /matches` proven to actually page (not return everything) |
| Contract | Every new endpoint + `LeagueDto`/`SeasonDto`/`LeagueAffiliationDto`/`MatchDto`/`MatchSideDto`/`MatchSidePlayerDto` (and their `Create`/`Update` request shapes) documented in the checked-in OpenAPI schema |
| Component | `PlayingXiBuilder.test.tsx` + Storybook story — add/remove/reorder, role selection, captain/keeper option-scoping (only current XI members), twelfth-man option-scoping (only non-XI squad members), cap-reached disables the add control, error surfacing for a simulated server rejection; `LeagueForm`/`SeasonForm`/`MatchForm` component tests — field validation, `MatchForm`'s per-side team-vs-free-text toggle; `LeagueFormPage.test.tsx` — Affiliations tab renders only in edit mode, season-scoped affiliation list; `MatchList.test.tsx` — pagination wiring (not a client-side slice); `MatchFormPage.test.tsx` — Playing XI sub-tabs render only for real-`Team` sides; `TeamFormPage.test.tsx` extended — the new Squad tab renders in edit mode only |
| End-to-end | New golden path (`docs/standards/testing.md`'s own listed example, "create match, capture scorecard," is a close match for this spec's first half): create a league, create a season, affiliate a team, add players to that team's squad, create a match against another team with that league/season attached, build the home side's playing XI (add players, reorder, set captain/keeper/twelfth man), attempt to exceed the cap (blocked), attempt to add an ineligible-age player on an age-restricted league (blocked), reload and confirm every change persisted. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can create, edit, deactivate, and reactivate a `League` scoped to their own club, with a configurable XI size, an `allowSubstitutions` flag, and optional enforced min/max age.
- A club admin can create, edit, deactivate, and reactivate a `Season` scoped to their own club.
- A club admin can affiliate one of their own `Team`s into one of their own `League`s for a `Season`, and remove that affiliation later without affecting the `Team` or `League` themselves.
- A club admin can build a `Team`'s squad from their club's own active players, and a player who isn't an active member of that club cannot be added.
- A club admin can create a `Match` with either side set to a real `Team` (their own club's or another club's) or a free-text opponent name, optionally attached to a `League`/`Season`, and can edit or deactivate it later.
- A club admin can build a real-`Team` side's playing XI — ordered, role-tagged, with captain/wicketkeeper/twelfth man — drawn only from that team's squad.
- Adding a player beyond the applicable cap (`League.maxPlayingXiSize`, or 11 without a league) is rejected.
- Adding a player outside an age-restricted `League`'s min/max age (as of the league's cutoff date or the season's start date) is rejected, as is adding a player with no recorded date of birth to such a league's match.
- A club admin for club X gets `403`/`404` attempting to reach or modify club Y's leagues, seasons, affiliations, squads, matches, or match sides.
- `ManagerDashboard`'s "Fixtures & Results" and "Squads" cards route to real screens, not `EmptyState`.

## Rollout Notes

- **Squad membership is season-scoped (`TeamSquadMember.season_id`), not a standing roster — a pre-build amendment to this spec, made before any code was written.** The originally-drafted `TeamSquadMember` had no time dimension at all, which would have let a junior team's squad silently carry over a player who's since aged out of that division. A team's squad must now be (re)built each season; nothing carries forward automatically. **Copying a squad forward from a prior season is explicitly deferred** — not built in Phase 0, since the first season built under this spec has nothing to copy from anyway. A `POST .../squad/copy-from/{seasonId}` convenience is the natural fast-follow once a club has more than one season's worth of squads to draw from. This same amendment made `Match.season_id` required (was originally drafted nullable) — every `MatchSide` needs an unambiguous season to resolve squad eligibility against, and a club creates a `Season` once per year/period regardless, so this isn't real added friction even for a standalone friendly.
- **This spec ships as Phase 0.** League/Season/LeagueAffiliation/Match/Squad/MatchSide entry, scheduling, and playing-XI selection only — the deliberately narrow slice needed for this weekend's real matches.
- **Phase 1 (future spec, not this one): results capture and standings.** Innings/score/outcome fields on `Match`, and any points/standings table derived from them. Genuinely the very next spec in this area, not a vague someday — flagged here so `docs/roadmap.md` picks it up as the immediate next item.
- **Phase 2 (future, blocked on a commercial agreement that doesn't exist yet): real `EXTERNAL`/CricClubs sync.** `League.source = EXTERNAL` exists as a column value only; no sync logic, credentials, or vendor integration work happens until that agreement exists.
- **This spec amends `001`'s ADR-02.** A human should add an amendment note to `001-tenancy-identity-model.md`'s Decision Log for ADR-02 (matching the style of a superseding note, not a rewrite of the original entry) — the "no admin role, fixture scheduling, or standings surface" language is now only true of a true cross-club/vendor-run league, which stays exactly as deferred as ADR-02's own reversibility note already described; club-internal league administration is what this spec resolves.
- **A human should update `docs/roadmap.md`'s "Blocked on the full tenancy model" section once this ships**: the `League`/`LeagueAffiliation`-existence gap and "vendor-run league administration" bullet are addressed for the club-internal case (the cross-club/vendor-run case remains open, unchanged); results/standings and CricClubs sync should be added as new, explicitly open items pointing at this spec's own Phase 1/Phase 2 notes above, not re-derived from scratch.
- **`Season` and `Match` both gain an `active` flag beyond what this spec's own requirements explicitly enumerated** — a conservative, consistent-with-the-rest-of-the-codebase call (every other club-scoped entity here has one), not a literal instruction. Flagging this clearly since it wasn't spelled out field-by-field the way `League`'s was.
- **`Match.club_id` is always the acting/creating club, never derived from the home team's own club** — a deliberate, conservative divergence from this spec's own "likely the home team's club" suggestion, made to avoid a cross-tenant ownership-assignment risk that isn't worth taking on this week. See Data Model Changes' dedicated note.
- **`MatchSide` authorization is scoped to the `Match`'s own `club_id`, not to each side's `Team`'s own club** — meaning a cross-club opponent's own admin cannot independently build their own side's playing XI through this `Match` record in this pass, even if their `Team` is a real, onboarded entity. Named explicitly as a Non-goal above; revisit if a genuine two-club-administered fixture becomes a real, recurring need.
- **The UI's home/away team picker on `MatchForm` only offers the current club's own teams**, even though the backend allows either side to reference any club's `Team`. The broader cross-club allowance stays backend-only for now — a future spec can add a cross-club team search if a genuine need for it shows up (e.g. two onboarded clubs both wanting to record the same inter-club fixture independently).
- **Squad membership validated via `PlayerProfile.active`, not a second `ClubMembership` query** — relies on `028`'s own invariant that the two are always kept in lockstep by `PlayerServiceImpl`'s deactivate/reactivate methods. If that invariant is ever loosened by a future spec, this squad-membership check needs to be revisited alongside it.
- **Removing a player from a `Team`'s squad does not retroactively remove them from any `MatchSide` they're already selected on.** A past playing-XI selection is treated as a historical record, consistent with this spec building no results/history feature yet but still wanting past selections to stay intact rather than silently mutate.
- **Age-eligibility enforcement applies to every player reference on a `MatchSide` (the ordered XI, captain, keeper, and twelfth man alike), not just the ordered XI itself** — a deliberate reading of the underlying business rule ("keep an ineligible player out of this league's match") rather than the narrower literal wording ("the XI"), since a twelfth man can fully participate under `allowSubstitutions`.
- **A missing `Player.dateOfBirth`, or a `Match` with an age-restricted `League` but no usable cutoff date (no `League.ageCutoffDate` and no `Match.seasonId`), both reject the add outright** rather than defaulting to "assume eligible" — the conservative call this spec's own scoping asked for.
- **`ManageFixturesHome`'s "Fixtures & Results" card copy keeps saying "Results"** even though no results feature exists yet — matching `007-configuration-hub-overview.md`'s own precedent of naming a future module's card ahead of its own spec, not a naming inconsistency to fix here.
- **The "Squads" dashboard card and this spec's own `TeamFormPage` Squad tab are two different, complementary things, not a duplication:** the Squad tab (on a `Team`'s own edit screen) manages *who's eligible* for that team long-term; the "Squads" card (`SquadPicker`, reusing `MatchList`'s data) is about *picking today's XI* for a specific, already-scheduled match. Flagging this mapping explicitly since neither card's pre-existing `006` copy ("Register teams" / "Pick squads per match") was written with this spec's own entity split in mind.
- Ships as its own PR, on top of `026`/`027`'s already-built `Team`, `028`'s already-built `Player`/`PlayerProfile`/`ClubMembership`, and `020`'s `/api/v1/manage/**` namespace.
- **Immediate next step before any code:** the Claude Design pass for `PlayingXiBuilder` (`docs/workflow.md` Step 2) — the one genuinely new visual pattern in this spec.
