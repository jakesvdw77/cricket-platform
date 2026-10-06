# 055 — League Squad Cap & Age Rules Move Per-Season, With Copy-Forward

**Depends on:** `029-league-management.md` (`League.maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` — this spec moves all four off `League` — and the `MatchSideServiceImpl` business rules that enforce them: the playing-XI cap in `applicableCap`, age eligibility in `requireAgeEligible`, both reused and re-pointed, not rewritten; `Season`, unchanged, used here only as the thing these fields are now scoped by), `052-league-playing-conditions.md` (`LeaguePlayingConditions` — the per-`(league_id, season_id)` entity these four fields move onto — its `findOrCreate`/upsert shape in `LeaguePlayingConditionsServiceImpl`, its "whole form" save convention (`UpdateLeaguePlayingConditionsRequest`, `resolvePlayingConditionsPayload`'s `maxOversPerInnings != null` "has this been saved" signal), its `PlayingConditionsForm`/`LeagueFormPage.tsx` Playing Conditions tab and `LeagueDetailPage.tsx` Playing Conditions section this spec extends rather than replaces, and its own Rollout Notes Amendment — the identical move already done once for `allowSubstitutions`, explicitly *not* extended to these four fields at the time because, unlike `allowSubstitutions`, they are genuinely enforced and moving them needs a real data migration and a rewire of `MatchSideServiceImpl`, deliberately deferred to its own spec; that deferred spec is this one). Also directly resolves `docs/roadmap.md`'s "Deferred by `052`" section, which named this exact gap and this exact scope.
**Status:** approved.

## Problem & Goals

`029` gave `League` four fields that are genuinely enforced at match time — `maxPlayingXiSize` (the playing-XI cap), `minAge`/`maxAge`/`ageCutoffDate` (age eligibility) — all fixed per-`League`, shared across every `Season` that league ever runs. `052` built the sibling per-`(league, season)` entity, `LeaguePlayingConditions`, for exactly the fields that plausibly change year to year (match format, points, bonus points), and in the same PR's Amendment moved a fifth League field, `allowSubstitutions`, onto it too — but explicitly declined to move these four, because unlike `allowSubstitutions` (confirmed enforced by nothing), all four are read by real business logic in `MatchSideServiceImpl` (`applicableCap`, `requireAgeEligible`) and moving them needs a real migration plus a rewire of that validation, not a mechanical column move. `052`'s Rollout Notes and `docs/roadmap.md`'s "Deferred by `052`" section both name this gap explicitly and flag it as "real future spec if a club actually needs per-season squad-cap/age-eligibility rules... not speculatively built now."

The trigger for building it now: a club running the same internal league across multiple years legitimately changes these rules between seasons (a league raising its playing-XI size, tightening or loosening an age band, or simply rolling its age-cutoff date forward each year) — and once a club has more than one season's worth of Playing Conditions to draw from, re-typing last year's numbers by hand into a new season's tab is real, avoidable friction. This spec both completes the data-model move `052` deferred and adds the "copy last season's answer forward, then adjust" convenience that makes typing them in at all painless once a second season exists.

**Goals**
- `League.maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` move to `LeaguePlayingConditions`, becoming genuinely per-`(league, season)` — resolving `docs/roadmap.md`'s "Deferred by `052`" item outright.
- `MatchSideServiceImpl`'s playing-XI cap and age-eligibility enforcement (`029`'s own business rules, unchanged in *behavior*) read these values from the match's own resolved `(leagueId, seasonId)` `LeaguePlayingConditions` row instead of from `League` directly.
- On the Playing Conditions tab, when a league+season has no structured fields saved yet but an earlier season of the *same* league does, a club admin can prefill the new season's whole form — including these four newly-moved fields — from that prior season's saved values with one action, review/adjust, and save explicitly. Nothing persists without that explicit save.
- The `ageCutoffDate` prefill specifically advances by one year (not a byte-for-byte copy) rather than silently offering a stale date, since "same calendar date, one year later" is the far more common intent than "identical date."
- `League` itself stays a single, persistent row reused across every season it runs — this spec does not duplicate or clone `League`; only its data model changes, and only for these four fields.

## Non-goals

- **No `League` duplication/cloning of any kind.** A `League` stays exactly what `029`'s Problem & Goals amendment made it: one persistent, club-owned row entered by teams across many seasons via `LeagueAffiliation`. There is no "clone this league" feature, now or as a result of this spec. What moves is data, not the entity's own identity or lifecycle.
- **No automatic, unreviewed carry-forward of any kind.** "Copy from previous season" is always an explicit, admin-initiated action that only populates the open form's local state — it never runs automatically on page load, never fires a network request of its own, and never persists anything until the admin reviews the prefilled values and clicks the existing "Save Playing Conditions" button. A season that already has its own saved structured fields is never silently overwritten by a stale prior season's values.
- **No change to `LeagueAffiliation`** (which teams are entered in a league for a season) — entirely unaffected, unread and unwritten by this spec.
- **No change to `allowSubstitutions`**, already moved to `LeaguePlayingConditions` by `052`'s own Amendment. This spec touches only the four fields `052` explicitly declined to move at the time.
- **No change to the Match Format / Points System / Bonus Points / Additional Notes fields `052` already built**, beyond having them participate in the same copy-forward action as the four fields this spec adds (see Goals/UI Requirements) — their own values, validation, and persistence are unchanged.
- **No copy-forward of the uploaded PDF document** (`documentUrl`/`uploadedAt`/`uploadedBy`). A prior season's Playing Conditions PDF is that season's own artifact; copy-forward only ever populates the structured-fields form. An admin who wants the same PDF for the new season re-uploads it (or a revised one) through the existing, unchanged `DocumentUpload` control on the Full Document sub-section.
- **No picker among multiple prior seasons.** Copy-forward always resolves to exactly one candidate — the most recent prior season (by `Season.startDate`) of the *same league* that has structured Playing Conditions saved — with no UI to choose a different, older season instead. A club that genuinely needs an older season's numbers can still open that season's own Playing Conditions section to read them and enter them by hand; a full picker is real future scope only if this single-candidate default turns out not to be enough in practice.
- **Not the same thing as `029`'s own already-deferred `TeamSquadMember` copy-forward.** `029`'s Rollout Notes flagged a *different*, still-unbuilt convenience — `POST .../squad/copy-from/{seasonId}`, copying a team's squad roster forward between seasons — as a natural future fast-follow. That item is untouched, unbuilt, and unrelated to this spec; this spec's "copy from previous season" applies only to `LeaguePlayingConditions`, never to `TeamSquadMember`. `docs/roadmap.md` should keep that item exactly as open as it already is.
- **No enforcement that a league's per-season squad-cap/age rules be filled in before a match can be scheduled or played**, matching `052`'s identical Non-goal for its own structured fields — a league+season with nothing saved for any of these four fields simply falls back to the same permissive defaults `MatchSideServiceImpl` already applies to a league-less match (see Data Model Changes' resolution rule).
- **No backfill guarantee for every league.** This spec backfills what it safely can from existing `League` rows into the most-relevant existing `LeaguePlayingConditions` row per league (see Data Model Changes) — a league with zero existing `LeaguePlayingConditions` rows has nothing to backfill into, and its pre-migration squad-cap/age values are genuinely dropped, not silently preserved. See Data Model Changes' and Rollout Notes' explicit call-out of this.

## User Stories

- As a club admin filling in a league+season's Playing Conditions for the first time in a brand-new season, and a prior season of the same league already has structured Playing Conditions saved, I see a "Copy playing conditions from {prior season label}" action that prefills the whole form (including playing-XI size, age range, and age cutoff date) from that prior season's saved values, with the age cutoff date already advanced by a year — I can review, adjust, or leave every field as prefilled, and nothing is saved until I click Save myself.
- As a club admin, if no prior season of this league has any structured Playing Conditions saved, I see the same blank, unseeded form `052` already gives me — no copy action is offered, and nothing about this spec makes that case any different from before.
- As a club admin, I can set a league+season's playing-XI size (defaulting to 11 on a first-ever save, same as before this spec) and, optionally, a min age, a max age, and an age cutoff date, on the same Playing Conditions tab where I already set match format, points, and bonus points — one save, one row, same as `052` already established for its own fields.
- As a club admin, when I schedule and build a playing XI for a match attached to a league+season that has its playing-XI size/age rules saved, I'm still capped and age-restricted exactly as `029` describes — the enforcement itself hasn't changed, only where its numbers come from.
- As a club admin, when I schedule and build a playing XI for a match attached to a league+season that has *no* saved playing-XI size/age rules yet (a season an admin hasn't visited the Playing Conditions tab for), the match behaves like a league-less friendly for cap/age purposes (11-player cap, no age restriction) until an admin fills the tab in — it is never silently blocked or errored by the missing configuration.
- As a club admin viewing a league (read-only), I see playing-XI size and age range alongside the rest of the season's structured Playing Conditions, not in the Details section where they used to live.

## Data Model Changes

**Entity changes.** `League` (`029`) loses `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` — after this spec, `League` carries only `id`/`clubId`/`name`/`source`/`active`/audit columns *from this spec's own perspective*, the same minimal "persistent competition identity" shape `029`'s Problem & Goals amendment always described it as (a club's `LeagueAffiliation`s and `Match`es are what give it season-to-season substance, not its own fields). Sibling specs `053-league-extended-profile.md` and `054-league-contacts.md` — drafted in parallel with this one, order of landing not fixed — separately add non-season-scoped columns (`logoUrl`/`format`/`phone`/`website`/`email`/`socialLinks`) and a related `LeagueContact` entity to `League`; those are additive and orthogonal to this spec's removals, so whichever lands first, the other's diff still applies cleanly, and `League` ends up with both the extended-profile fields and a leaner season-rule footprint, not a bare four-column row. `LeaguePlayingConditions` (`050`/`052`) gains all four, as new, independently nullable columns on the same row — still one row per `(league_id, season_id)`, `052`'s own "no version history" decision unchanged.

**Field semantics, carried over from `League` unchanged, now scoped per-`(league, season)`:**
- `maxPlayingXiSize` — the playing-XI cap. Was `NOT NULL DEFAULT 11` on `League`; on `LeaguePlayingConditions` it's a nullable column (matching every other structured field on this entity — see `052`'s "all nullable at the DB level" posture) whose *absence* now means "not yet configured for this season," resolved at read time by `MatchSideServiceImpl` (see below) rather than always having a value the way `League`'s own `NOT NULL` column guaranteed.
- `minAge`/`maxAge` — unchanged semantics, still both nullable, still validated `minAge <= maxAge` when both are set.
- `ageCutoffDate` — unchanged semantics ("age as of this date"; when null, `MatchSideServiceImpl` falls back to the season's own `startDate` — now trivially the *same* season a `Match` already carries, since `LeaguePlayingConditions.seasonId` and `Match.seasonId` are the same season by construction of the lookup below, not a separate resolution step).

**Whole-form posture (the decision requested in scoping this spec, made explicitly, not left implicit):** these four fields join the *same* one-transaction, whole-form save `052` already established for Match Format/Points System/Bonus Points/Additional Notes — one `PUT` to the existing Playing Conditions endpoint persists all of it together on the same row, in the same `LeaguePlayingConditionsServiceImpl.update()` call, no second endpoint or second save action. Their own *nullability* at the request/bean-validation level, though, mirrors what each field had on `League` before this spec, not the Match Format group's stricter "every field required once you save at all" posture:
- `maxPlayingXiSize` stays optional at the request level, defaulting to `11` in the service when omitted — the exact `request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11` rule `LeagueServiceImpl.create`/`update` used to apply, moved verbatim. Because the UI's own form always displays and submits a concrete number (seeded to `11` the same way `052`'s Points System group seeds its own defaults — see UI Requirements), this server-side default is a defensive fallback for any other future or non-UI caller of the endpoint, not something the shipped UI ever actually relies on.
- `minAge`/`maxAge`/`ageCutoffDate` stay fully optional, no default — identical to their `League` behavior.

One consequence worth stating plainly: a row can exist (e.g. created by `LeaguePlayingConditionsServiceImpl.upload()`'s `findOrCreate` on a PDF-only first save, before any structured field is ever set) with `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` all still null even though the row itself is not new. `MatchSideServiceImpl`'s resolution logic (below) treats "row absent" and "row present but these fields null" identically — both mean "not configured for this season," both fall back to the same defaults.

**`MatchSideServiceImpl` resolution — the enforcement rewire.** `Match.seasonId` is `NOT NULL` (required, confirmed on `Match.java`: *"`seasonId` is NOT NULL (required, not optional) per this spec's own pre-build amendment... every Match always has one"* — `029`'s own pre-build amendment), and `Match.leagueId` stays optional — this is exactly what makes the migration well-defined: whenever a `Match` has a `leagueId` at all, `(leagueId, match.getSeasonId())` is always a real, unambiguous pair to resolve `LeaguePlayingConditions` by, with no separate "which season" question the way there might have been if `seasonId` were still optional.

`applicableCap(Match match)` (today: `match.getLeagueId() == null` → `11`; else load `League`, return `league.getMaxPlayingXiSize()`) becomes:
```java
private int applicableCap(Match match) {
    if (match.getLeagueId() == null) {
        return 11;
    }
    return leaguePlayingConditionsRepository
            .findByLeagueIdAndSeasonId(match.getLeagueId(), match.getSeasonId())
            .map(LeaguePlayingConditions::getMaxPlayingXiSize)
            .filter(Objects::nonNull)
            .orElse(11);
}
```

`requireAgeEligible(Match match, UUID playerId)` (today: `match.getLeagueId() == null` → return; else load `League`, return early if both `minAge`/`maxAge` are null, else resolve cutoff date from `league.getAgeCutoffDate()` or `season.getStartDate()`) becomes: load `Optional<LeaguePlayingConditions>` the same way; if absent, or present with both `minAge`/`maxAge` null, return early exactly as today; otherwise resolve the cutoff date from the row's own `ageCutoffDate` if set, else `match.getSeasonId()`'s own `Season.startDate` (the existing fallback, now always reachable off the same `seasonId` already in hand rather than a second lookup path). `PlayerAgeIneligibleException`/`PlayingXiCapExceededException` (both `029`, unchanged) keep firing on the exact same conditions as today — only the source of the numbers being checked has moved. Both methods drop their dependency on `LeagueRepository` (no longer read `League` at all) in favor of `LeaguePlayingConditionsRepository`, already a constructor dependency this service doesn't yet have — added alongside the removal.

**Migration** (next sequential file after `028`):

```sql
-- backend/src/main/resources/db/changelog/v1/031-move-league-squad-and-age-rules-to-playing-conditions.sql

ALTER TABLE league_playing_conditions ADD COLUMN max_playing_xi_size INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN min_age INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN max_age INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN age_cutoff_date DATE;

-- Backfill: a league with at least one existing league_playing_conditions row gets its
-- pre-migration League-level values copied onto that league's single MOST RECENT such row (by the
-- row's own season.start_date) -- these four fields were only ever one League-wide value before
-- this migration, so there is no historically-accurate per-season value to backfill into any
-- OTHER existing row for the same league; only the most recent one is touched, on the reasoning
-- that it's the row most likely to still be actively referenced by upcoming matches.
UPDATE league_playing_conditions lpc
SET max_playing_xi_size = league.max_playing_xi_size,
    min_age = league.min_age,
    max_age = league.max_age,
    age_cutoff_date = league.age_cutoff_date
FROM league
WHERE lpc.league_id = league.id
  AND lpc.id = (
    SELECT lpc2.id
    FROM league_playing_conditions lpc2
    JOIN season s ON s.id = lpc2.season_id
    WHERE lpc2.league_id = league.id
    ORDER BY s.start_date DESC
    LIMIT 1
  );

ALTER TABLE league DROP COLUMN max_playing_xi_size;
ALTER TABLE league DROP COLUMN min_age;
ALTER TABLE league DROP COLUMN max_age;
ALTER TABLE league DROP COLUMN age_cutoff_date;
```

Register `031-move-league-squad-and-age-rules-to-playing-conditions.sql` in `db.changelog-master.xml` as the next sequential entry. Numbered `031` because sibling specs `053`/`054` (drafted in parallel with this one, also extending `League`) were assigned `029`/`030` respectively — confirm the real next number against `db.changelog-master.xml` at build time in case the actual build order differs.

**The real, accepted data-loss case — a league with zero existing `league_playing_conditions` rows.** A league that has never had a PDF uploaded or a structured field saved for *any* season has no row at all for the `UPDATE` above to touch — its pre-migration `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` values are dropped by the final `ALTER TABLE league DROP COLUMN` statements with nothing to carry them forward to, since there is no season-scoped destination row to create one for (creating a bare row would need to guess which season it belongs to, which this migration has no principled way to do). This is a genuine behavior change for any such league's *future* matches until an admin revisits its Playing Conditions tab and re-enters the values: its playing-XI cap silently reverts to the `11` fallback and its age restriction silently disappears, exactly as if it were a brand-new, never-configured league+season. See Rollout Notes for the required pre-deploy human step this implies.

**DTO/entity field changes** (mechanical, following `052`'s Amendment's identical field-move shape):
- `League.java` (entity) loses `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` fields and their `@Column` annotations.
- `LeaguePlayingConditions.java` (entity) gains `private Integer maxPlayingXiSize;` (`@Column(name = "max_playing_xi_size")`), `private Integer minAge;`, `private Integer maxAge;`, `private LocalDate ageCutoffDate;`.
- `LeagueDto` loses `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` (record components removed; `LeagueMapper`'s inferred mapping needs no new `@Mapping(ignore = true)` entries since the fields simply no longer exist on either side).
- `CreateLeagueRequest`/`UpdateLeagueRequest` lose the same four fields.
- `LeaguePlayingConditionsDto` gains `Integer maxPlayingXiSize` (note the type change from `LeagueDto`'s primitive `int` — this DTO already represents a row that may not have every field set, matching every other structured field here), `Integer minAge`, `Integer maxAge`, `LocalDate ageCutoffDate`.
- `UpdateLeaguePlayingConditionsRequest` gains `Integer maxPlayingXiSize`, `Integer minAge`, `Integer maxAge`, `LocalDate ageCutoffDate` — no new bean-validation annotations beyond what `CreateLeagueRequest`/`UpdateLeagueRequest` already had for these fields (no `@NotNull`; cross-field `minAge <= maxAge` stays a service-layer check, same as before).
- `LeaguePlayingConditionsServiceImpl.update()` gains the `minAge <= maxAge` cross-field check (`ValidationException`, `400`) inside its existing `validateStructuredFields` method, and sets `playingConditions.setMaxPlayingXiSize(request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11)` / `setMinAge` / `setMaxAge` / `setAgeCutoffDate` alongside its existing field assignments.
- `LeagueServiceImpl`'s own `validateAgeRange` method and its `maxPlayingXiSize`-defaulting logic are **removed outright**, not extracted to a shared helper — this spec relocates their only caller; there is no second caller left to justify a shared utility (unlike `LeagueSeasonAccessValidation`, which earned its extraction because two services genuinely needed the identical check).

**New read path for copy-forward — a new repository/service/endpoint, list-shaped, not season-scoped:**
- `LeaguePlayingConditionsRepository` gains `List<LeaguePlayingConditions> findByLeagueId(UUID leagueId)` — every row that has ever been created for this league, across every season (could be empty).
- `LeaguePlayingConditionsService`/`ServiceImpl` gain `List<LeaguePlayingConditionsDto> listByLeague(UUID clubId, UUID leagueId)` — validates `leagueId` belongs to `clubId` (`LeagueSeasonAccessValidation.assertLeagueBelongsToClub`, the same check `get`/`upload`/`update` already use), then maps `findByLeagueId(leagueId)` to DTOs. No pagination — a league's own season history is a small, bounded list, matching every other League-adjacent collection in this codebase.

## API Contract

| Endpoint | Access | Purpose / change |
|---|---|---|
| `POST /api/v1/manage/clubs/{clubId}/leagues` | `@access.canAdministerClub` (unchanged) | `CreateLeagueRequest` loses `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` — a league is now created with just `{name, source?}` |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}` | same | `UpdateLeagueRequest` loses the same four fields |
| `GET .../leagues` / `GET .../leagues/{leagueId}` (via list) | same | `LeagueDto` response loses the same four fields |
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions` | same | `LeaguePlayingConditionsDto` response gains `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions` | same | `UpdateLeaguePlayingConditionsRequest` gains the same four fields, saved in the same whole-form transaction; `400` (`ValidationException`) added for `minAge > maxAge` when both set, alongside `052`'s existing cross-field `400`s |
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/playing-conditions` | `@access.canAdministerClub` (new) | Lists every `LeaguePlayingConditions` row that exists for this league, across every season — backs the "copy from previous season" resolution (see UI Requirements). `404` if `leagueId` belongs to a different club. Plain array response, unpaginated, matching `GET .../leagues`'s own posture |

No change to any `Match`/`MatchSide`/`MatchSidePlayer` endpoint's request/response shape — `029`'s existing `PlayingXiCapExceededException`/`PlayerAgeIneligibleException` `400`s continue to fire under the same externally-observable conditions; only their internal data source moved (Data Model Changes above).

## UI Requirements

**1. `ui/src/components/LeagueForm/LeagueForm.tsx`** loses its "Playing XI size"/"Min age"/"Max age"/"Age cutoff date" `Input`s and their validation — after this spec it edits only `name` (mirroring `052`'s Amendment, which already trimmed this same form once for `allowSubstitutions`; this is the same move, extended). `LeaguePayload`/`League` (`ui/src/api/leagueApi.ts`) lose the same four fields.

**2. `ui/src/pages/manage/LeagueList.tsx`**'s `leagueRecordFields` loses its "Playing XI size"/"Age range" `RecordCard` fields, for the identical reason `052`'s Amendment already removed this card's "Substitutions allowed" chip: the League summary card has no season context to read a now-per-season value from, and fetching one per card for two extra chips isn't worth the added round-trips. `badgeFor`/`leagueSeasonBadges` (team count, current-season label) are unaffected.

**3. `ui/src/pages/manage/LeagueDetailPage.tsx`**'s Details section loses its "Playing XI size"/"Age range" `DetailFieldRow`s; the Playing Conditions section (`052`) gains them back, sourced from `playingConditionsPayload` instead of `league`, using the same "omit the row entirely rather than render it blank" convention this section already uses for its bonus-points rows — "Playing XI size" always renders when `playingConditionsPayload` is non-null (mirrors the pre-migration `League.maxPlayingXiSize`'s own `NOT NULL` guarantee having become "always set once ANY structured field is saved," per Data Model Changes' whole-form posture); "Age range" renders only when `minAge`/`maxAge` isn't both null; "Age cutoff date" renders only when set.

**4. `ui/src/components/PlayingConditionsForm/PlayingConditionsForm.tsx`** gains a new field group, **"Squad & Age Rules"**, positioned after Match Format and before Points System (grouped visually the same way as the existing four groups — `xs` single column / `md` two columns): "Playing XI size" (numeric `Input`, seeded to `11` on an unseeded form — the same `LeagueForm`-established default this field always had, moved here verbatim), "Min age" / "Max age" (numeric `Input`s, optional, `helperText` "Leave blank for no minimum/maximum" — copied verbatim from the old `LeagueForm` copy), "Age cutoff date" (`type="date"` `Input`, optional, `helperText` "Age as of this date — leave blank to use the season's own start date," updated from `LeagueForm`'s old "the match's own season start date" phrasing now that the fallback is unambiguously this same season). Client-side `validate()` gains the `minAge <= maxAge` check, copied verbatim from `LeagueForm`'s own removed one.

**5. `PlayingConditionsForm` gains the "Copy from previous season" action** — new props:
```ts
export interface PlayingConditionsFormProps {
  initialValues?: PlayingConditionsPayload | null
  copyFromSeason?: { seasonId: string; seasonLabel: string; conditions: PlayingConditionsPayload } | null
  onSubmit: (payload: PlayingConditionsPayload) => void
  pending: boolean
  error?: unknown
}
```
A `Button` (`variant="secondary"`, matching this codebase's "a real button, not a bare text link" precedent for any cross-record affordance), labelled `` `Copy playing conditions from ${copyFromSeason.seasonLabel}` ``, rendered above the Match Format group, **only when `!initialValues && copyFromSeason` is truthy** — i.e. only in the same "nothing structured has been saved for this league+season yet" empty state `initialValues == null` already signals (a season with a saved PDF but no structured fields still counts as this empty state — same `maxOversPerInnings != null` "has this been saved" signal `052` already established, not "does any DB row exist at all"). Clicking it calls `setValues(toFormState({ ...copyFromSeason.conditions, ageCutoffDate: advanceAgeCutoffDateByOneYear(copyFromSeason.conditions.ageCutoffDate) }))` and clears any current `errors` — a purely local state update; **no network call, no `onSubmit` call**. The admin still reviews the now-prefilled form and clicks the existing "Save Playing Conditions" button themselves, per Non-goals. Every field copies forward unchanged except `ageCutoffDate` (see item 7) — including `maxPlayingXiSize`/`minAge`/`maxAge`, matching Match Format/Points/Bonus Points, which also copy verbatim.

**6. `ui/src/utils/playingConditions.ts`** gains two new pure, unit-tested exports, alongside the existing `resolveEffectiveMaxOversPerBowler`/`resolvePlayingConditionsPayload`:
```ts
export interface CopyFromSeasonOption {
  seasonId: string
  seasonLabel: string
  conditions: PlayingConditionsPayload
}

export function resolveCopyFromSeason(
  allConditions: LeaguePlayingConditions[],  // every row for this league, any season (from item 8's new endpoint)
  seasons: Season[],                          // every season for the club
  currentSeasonId: string,
): CopyFromSeasonOption | null
```
Resolution rule: among `allConditions` whose `seasonId !== currentSeasonId`, whose corresponding `Season.startDate` (looked up via `seasons`) is **strictly earlier** than the current season's own `startDate` (a genuine chronological predecessor — never a later or same-date season), and for which `resolvePlayingConditionsPayload(record) != null` (structured fields actually saved, not just a PDF), pick the one with the latest `startDate`; returns `null` when no candidate qualifies (including when `currentSeasonId` itself doesn't resolve to a real season). This is the single, non-configurable candidate Non-goals describes — no picker among multiple matches.
```ts
export function advanceAgeCutoffDateByOneYear(ageCutoffDate: string | null): string | null
```
`null` in, `null` out. Otherwise parses the `YYYY-MM-DD` input, returns the same month/day one year later; the one exception is 29 February advancing into a non-leap year, which falls back to 28 February rather than producing an invalid date (`Date`'s own silent-rollover behavior, e.g. treating "29 Feb 2027" as "1 Mar 2027," is exactly the kind of quietly-wrong date this spec's Goals call out — the function must check leap-year validity itself, not rely on `Date` arithmetic to do it correctly).

**7. `ui/src/api/leaguePlayingConditionsApi.ts`** — `LeaguePlayingConditions` interface gains `maxPlayingXiSize: number | null`, `minAge: number | null`, `maxAge: number | null`, `ageCutoffDate: string | null`; `PlayingConditionsPayload` gains `maxPlayingXiSize: number` (required at the payload level, like the Points System fields — the form always submits a concrete number, seeded to `11`, never `null`; the backend's own `Integer`/default-11 nullability is a defensive contract-level allowance for a non-UI caller, not something the shipped form relies on — see Data Model Changes), `minAge: number | null`, `maxAge: number | null`, `ageCutoffDate: string | null`. New function:
```ts
export function listPlayingConditionsForLeague(clubId: string, leagueId: string): Promise<LeaguePlayingConditions[]>
```
calling the new `GET .../leagues/{leagueId}/playing-conditions` endpoint (item in API Contract) — a plain array, no 404-to-null handling needed (an empty array is itself the "nothing saved for any season" case, unlike the single-row `getPlayingConditions`, which legitimately 404s).

**8. `ui/src/pages/manage/LeagueFormPage.tsx` wiring.** A new query, `leaguePlayingConditionsForLeagueQuery` (`queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions-all']`, `queryFn: () => listPlayingConditionsForLeague(clubId, leagueId)`, `enabled: isEdit && Boolean(clubId) && Boolean(leagueId)`) — fetched once per league (not re-fetched per season switch, unlike `playingConditionsQuery`), invalidated alongside `playingConditionsQueryKey` on a successful `updatePlayingConditionsMutation` (so a season's own just-saved row immediately becomes a valid future copy-from candidate for an even-later season, without a page reload). `copyFromSeason` is derived via `resolveCopyFromSeason(leaguePlayingConditionsForLeagueQuery.data ?? [], seasonsQuery.data ?? [], selectedSeasonId)` and passed to `PlayingConditionsForm`. `LeagueForm`'s `initialValues` block (Details tab, `activeTab === 0`) drops the four removed fields.

**Mobile-first**, per `docs/standards/frontend.md`: the new Squad & Age Rules group stacks to a single column at 375px exactly like `PlayingConditionsForm`'s existing groups; the "Copy from previous season" `Button` sits full-width or wraps naturally at that width, matching every other action row on this form.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `LeaguePlayingConditionsServiceImplTest` — `update()` persists `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` alongside the existing structured fields in the same call; `maxPlayingXiSize` defaults to `11` when the request omits it; `minAge > maxAge` rejected `400`; `listByLeague` returns every row for a league across seasons, empty list when none exist, cross-club `NotFoundException` isolation for `leagueId`. `LeagueServiceImplTest` — existing `minAge`/`maxAge`/`maxPlayingXiSize` test cases removed (the fields no longer exist on `League`); remaining create/update/deactivate/reactivate cases unaffected. `MatchSideServiceImplTest` — `applicableCap`/`requireAgeEligible` cases rewritten against `LeaguePlayingConditions` fixtures instead of `League` ones: no `LeaguePlayingConditions` row for the match's `(leagueId, seasonId)` → cap `11`, no age restriction (mirrors today's "no league" case); a row exists but `maxPlayingXiSize`/`minAge`/`maxAge` are null (e.g. a PDF-only row) → same fallback; a row exists with values set → those values enforced, `PlayingXiCapExceededException`/`PlayerAgeIneligibleException` fire under the same conditions as today; `ageCutoffDate` null on the row falls back to `Season.startDate` for the match's own `seasonId`, exactly as before. `resolveCopyFromSeason.test.ts`/`advanceAgeCutoffDateByOneYear.test.ts` — no candidates (empty list, only-current-season rows, only-PDF-only rows, only later-season rows) returns `null`; multiple qualifying candidates picks the latest `startDate`; the current season itself is never returned even if present in `allConditions`; date advance for an ordinary date, the 29 Feb → 28 Feb leap-year fallback (both a non-leap target year and confirming a leap target year keeps 29 Feb), and `null` in → `null` out |
| Integration | Migration `031-move-league-squad-and-age-rules-to-playing-conditions.sql` applies cleanly: a league with one existing `league_playing_conditions` row has that row's four new columns correctly backfilled from the pre-migration `league` row; a league with multiple existing rows across seasons only backfills its most-recent-by-`season.start_date` row, leaving the others' new columns null; a league with zero existing rows loses its pre-migration values with no error (confirms the migration doesn't fail, not that data is preserved — it explicitly isn't, per Data Model Changes); the four `league` columns no longer exist afterward. New repository test for `findByLeagueId` (returns every row for a league, empty for one with none). Controller integration test for the new `GET .../leagues/{leagueId}/playing-conditions` endpoint — real data across two seasons, empty-list case, cross-club `404`. `PUT .../playing-conditions` controller test extended with the four new fields round-tripping correctly and the new `minAge > maxAge` `400`. `MatchSideController`/`MatchSideServiceImpl` integration tests re-run against `LeaguePlayingConditions` fixtures for the cap/age scenarios above, proving the rewire end-to-end through real Postgres, not just mocked repositories |
| Contract | `CreateLeagueRequest`/`UpdateLeagueRequest`/`LeagueDto` field removals, `LeaguePlayingConditionsDto`/`UpdateLeaguePlayingConditionsRequest` field additions, and the new `GET .../leagues/{leagueId}/playing-conditions` endpoint all reflected in the checked-in OpenAPI schema |
| Component | `LeagueForm.test.tsx` trimmed — no longer asserts the four removed fields/validation. `PlayingConditionsForm.test.tsx` extended — Squad & Age Rules group renders and validates (`minAge <= maxAge`); "Copy from previous season" button renders only when `initialValues` is null/undefined and `copyFromSeason` is provided, is absent when either condition fails; clicking it populates every field from `copyFromSeason.conditions` with `ageCutoffDate` visibly advanced by one year, and does **not** call `onSubmit`. `LeagueList.test.tsx` — card no longer renders "Playing XI size"/"Age range" fields. `LeagueDetailPage.test.tsx` — Details section no longer renders the two removed rows; Playing Conditions section renders them (present/omitted per the same rules as `052`'s existing bonus-points rows). `LeagueFormPage.test.tsx` — new `leaguePlayingConditionsForLeagueQuery` wiring; `copyFromSeason` correctly derived and passed through for a two-season fixture; invalidated alongside `playingConditionsQueryKey` on a successful save |
| End-to-end | No new golden path. `029`'s existing "exceed the cap" / "add an ineligible-age player" assertions (part of its own documented golden path) continue to hold with no change to their user-visible steps — only the enforcement's internal data source moved, not its externally observable behavior — so no E2E test needs to change, and none is added |

## Acceptance Criteria

- A club admin creating or editing a `League` no longer sees or sets playing-XI size, min/max age, or age cutoff date on that screen — a `League` is just a name (plus `active`).
- A club admin on a league+season's Playing Conditions tab can set playing-XI size (defaulting to 11), min age, max age, and age cutoff date, saved together with the existing Match Format/Points/Bonus Points fields in one save.
- A club admin opening a league+season's Playing Conditions tab for the first time, when an earlier season of the same league has structured Playing Conditions saved, sees a "Copy playing conditions from {season label}" action; using it prefills the whole form (with the age cutoff date advanced by one year) without saving anything until Save is clicked explicitly.
- A club admin opening a league+season's Playing Conditions tab for the first time, when no earlier season of the same league has anything saved, sees the same blank form as before this spec — no copy action appears.
- Scheduling a match against a league+season whose playing-XI size/age rules are saved still caps the XI and rejects ineligible-age players exactly as `029` describes; a league+season with nothing saved behaves like a league-less friendly for these two rules until an admin fills them in.
- A club admin viewing a league (read-only) sees playing-XI size, age range, and age cutoff date in the Playing Conditions section, not the Details section.
- Every pre-existing league with at least one `LeaguePlayingConditions` row keeps its former squad-cap/age values, now attached to that league's single most recent such row, after the migration runs.

## Rollout Notes

- **This spec resolves `docs/roadmap.md`'s "Deferred by `052`" section outright.** A human should remove that section once this ships — its two bullets (the `allowSubstitutions` move, already resolved by `052`'s own PR, and this spec's own four-field move) are both fully addressed; nothing about this item stays open afterward. Not edited here, per this spec's own scope — a human/maintenance action once the PR merges, matching how every prior spec in this codebase has handled its own roadmap follow-up.
- **The zero-existing-rows backfill gap (Data Model Changes) is a real pre-deploy risk, not a hypothetical one, for any club with a live, age-restricted or non-default-XI-size league that has never once used the Playing Conditions tab.** Before this migration runs against real club data, a human should run a query along the lines of `SELECT l.id, l.name FROM league l WHERE (l.max_playing_xi_size IS DISTINCT FROM 11 OR l.min_age IS NOT NULL OR l.max_age IS NOT NULL OR l.age_cutoff_date IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM league_playing_conditions lpc WHERE lpc.league_id = l.id)` against the pre-migration database, and manually re-enter any matching league's values via the new Playing Conditions tab for the relevant season immediately after deploying — before that league's next match is scheduled, since the cap/age fallback is otherwise silently permissive, not a visible error.
- **`League` loses its four season-rule fields after this spec** — from this spec's own scope alone, and taken together with `052`'s Amendment (which already moved `allowSubstitutions` off), `League` is left with `id`/`clubId`/`name`/`source`/`active`/audit columns plus whatever `053`/`054` independently add (`logoUrl`/`format`/`phone`/`website`/`email`/`socialLinks`/contacts — see Data Model Changes above for how those two specs compose with this one). This is a deliberate, accepted consequence of this spec and `052`'s Amendment together, not a signal that `League` itself is now redundant — it remains the real, persistent thing `LeagueAffiliation` enters teams into and `Match` schedules fixtures against across many seasons (`029`'s own Problem & Goals framing), independent of how few or many of its own fields it happens to carry directly.
- **This spec's "copy from previous season" is scoped only to `LeaguePlayingConditions`.** `029`'s own still-open, still-unbuilt `TeamSquadMember` copy-forward convenience (`POST .../squad/copy-from/{seasonId}`, flagged in that spec's Rollout Notes) is a different feature entirely and stays exactly as deferred as `029` left it — nothing here builds, blocks, or supersedes it.
- **No Claude Design pass needed.** Every new UI surface here (the Squad & Age Rules field group, the "Copy from previous season" button) is a same-shaped extension of `PlayingConditionsForm`'s existing field-grid pattern and this codebase's existing secondary-`Button` action precedent — not a new visual pattern. The plan can build directly against this spec's UI Requirements.
- Ships as one PR — the migration, `League`/`LeaguePlayingConditions` entity field moves, `LeagueDto`/`CreateLeagueRequest`/`UpdateLeagueRequest`/`LeaguePlayingConditionsDto`/`UpdateLeaguePlayingConditionsRequest` changes, the `MatchSideServiceImpl` rewire, the new `listByLeague`/`GET .../playing-conditions` list endpoint, and every UI change above (`LeagueForm`, `LeagueList`, `LeagueDetailPage`, `PlayingConditionsForm`, `LeagueFormPage`, the two new `playingConditions.ts` utils, `leaguePlayingConditionsApi.ts`) — not staggered, since the backend enforcement rewire and the frontend fields that feed it are meaningless shipped independently of each other, matching `052`'s own identical "ships as one PR" precedent for a similarly cross-cutting change.
