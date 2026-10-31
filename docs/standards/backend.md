# Backend Standards

The contract every backend-touching agent is briefed with by path, not by vague reference to "the usual pattern." See `CLAUDE.md` for the principles this exists to serve.

## Non-negotiables

- Controllers never touch repositories directly; services never return JPA entities across the controller boundary — DTOs only, mapped via MapStruct, never by hand.
- No `System.out`/`System.err` — use the injected SLF4J `Logger`; enforced by ArchUnit's `NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS` (`LayeringRulesTest.noClassesAccessStandardStreams`).
- `ddl-auto=validate`, always. Schema changes are a numbered Liquibase migration (`backend/src/main/resources/db/changelog/v1/NNN-description.sql`) in the same PR as the entity change — never split, never Hibernate auto-DDL.
- Business exceptions live in `com.cricketlegend.exception` and extend a fixed, documented set of HTTP-status base classes — `NotFoundException`, `ConflictException`, `ValidationException` — caught centrally by a `GlobalExceptionHandler` (`@RestControllerAdvice`). Exception → HTTP status matrix:

  | Exception | Status |
  |---|---|
  | `NotFoundException` | 404 |
  | `ConflictException` | 409 |
  | `ValidationException` | 400 |
  | `InvalidPublicTokenException` | 401 (public availability pass missing, expired or wrong scope; spec 077) |
  | `PublicVerificationFailedException` | 403 (generic failed public check, carries `triesLeft`; spec 077) |
  | `PublicVerificationLockedException` | 423 (name locked after repeated failures, carries `retryAfterSeconds`; spec 077) |
  | `PublicRateLimitedException` | 429 (per-address limit, carries `retryAfterSeconds`; spec 077) |
| `EmailNotVerifiedException` | 403 (token has no verified email; problem property `code` = `EMAIL_NOT_VERIFIED`; spec 119) |
| `LinkLockedException` | 423 (account locked after 5 failed link confirmations in an hour, carries `retryAfterSeconds`; spec 119) |
| `LinkRateLimitedException` | 429 (more than 10 link requests in a day, carries `retryAfterSeconds`; spec 119) |

  `EmailNotVerifiedException`, `LinkLockedException` and `LinkRateLimitedException` (spec 119) follow the same pattern and also extend `RuntimeException` directly; the two link ones mirror the public 423 and 429 and are mapped to a `ProblemDetail` with `retryAfterSeconds`. A suspended person on `/me/activate` or `/me/register` is refused with Spring Security's `AccessDeniedException` (403), the same type the section assertions use. The four public-availability exceptions (spec 077) are deliberately their own types rather than subclasses of the three bases, because no base carries 401, 403, 423 or 429; they are mapped in `GlobalExceptionHandler` to a `ProblemDetail` with their extra properties. They are the only exceptions allowed to extend `RuntimeException` directly.

  Extend this table here before introducing a new *base* type — don't invent a new HTTP-status category ad hoc in a controller.

  **Prefer a specific, named exception over a generic one.** A distinct, recurring failure mode gets its own small subclass of the right base — e.g. `InvalidStatusTransitionException extends ConflictException`, `DuplicateSlugException extends ConflictException` — living in `com.cricketlegend.exception` alongside the three base classes, instead of every call site throwing the same base exception with just a different string message. This keeps call sites self-documenting and makes a specific failure catchable by type where that matters. Never reach for a raw `RuntimeException`/`IllegalArgumentException`/`IllegalStateException` for a business rule violation — it skips the exception→status mapping entirely and `GlobalExceptionHandler` won't handle it meaningfully.

  **An exception may carry structured detail for the client**, as a `ProblemDetail` property set by its own `GlobalExceptionHandler` method (a more specific type wins over `ConflictException`): `SelectionRejectedException` carries `rejections` and `DuplicateFieldException` (spec 099) carries `existingPlayingAreaId`, so the screen can offer the existing record instead of only showing a message.

  Spec 104 adds `InvalidImportInputException` (abstract, extends `ValidationException`) with `UnsupportedImportFormatException` (carries `supported`), `UnreadableImportInputException` and `ImportInputValidationException` (carries `errors` and `totalErrors`), and three `ConflictException` subclasses, `ImportMatchAlreadyHasResultException`, `ImportExternalIdAlreadyUsedException` (carries `otherMatchId`) and `ImportWouldOverwriteDraftException`. No new base type or status.

  Spec 097 (import framework) adds seven named exceptions, none a new base type or status: `ImportFileRejectedException` and `ImportValidationFailedException` (extend `ValidationException`, 400; the second carries `issues` and the fresh `batch`), `ImportBatchNotFoundException` (extends `NotFoundException`, 404) and `ImportBatchStateException` (carries the fresh `batch` when the live data changed), `ImportBatchExpiredException`, `ImportConfirmationInvalidException` and `ImportDeletionBlockedException` (carries `blockers`), all extending `ConflictException` (409). A named subclass of an existing base may carry structured detail as a `ProblemDetail` property set by its own `GlobalExceptionHandler` method, as `SelectionRejectedException` and `DuplicateFieldException` already do; the three that carry a body have such a method. They are distinct from the spec 104 result-import exceptions above and extend none of them.

- Every `@Service` method carrying a business rule ships with a unit test in the same PR; every custom repository query ships with a Testcontainers-backed integration test in the same PR (base class: `com.cricketlegend.AbstractIntegrationTest`).
- **Shared logic lives in one place.** Business logic needed by two or more services is extracted into a shared service/utility before the second use is written — never copy-pasted. Same for validation rules, mapping helpers, and query specifications (reusable `Specification<T>` classes over hand-rolled duplicate queries).
- **Pagination is backend-driven, never client-side.** Any list endpoint whose result set can grow unbounded returns a Spring Data `Page<T>` (`Pageable` request param — `page`/`size`/`sort`), fetched with a real `LIMIT`/`OFFSET` (or keyset) query — never the full table handed to the frontend to slice, filter, or paginate in memory. The whole point is keeping that memory and scalability cost on the server, where it's one tunable query, not duplicated per browser tab. See `docs/standards/frontend.md`'s matching rule for how the client consumes this.
- **Every `@Service` method that maps an entity with a lazy field (any `@ElementCollection`/`@OneToMany`/`@ManyToMany`, JPA's default is lazy) needs its own `@Transactional` — `readOnly = true` on a `list`/`get`, plain `@Transactional` on a write.** `spring.jpa.open-in-view=false` (this app's setting, the correct one for production) means a real HTTP request has no Hibernate session open beyond whatever the service method itself provides — mapping a lazy field outside that throws `LazyInitializationException`, a 500 on what looks like a working `GET`. This has now hit this codebase three times on the identical shape (`ClubProfileServiceImpl` originally; `SponsorServiceImpl` learned from it and documents the fix in its own Javadoc; `TeamSponsorServiceImpl`/`TeamContactServiceImpl`, `027-team-profile.md`, repeated it) — apply `@Transactional` to every list/get method from the start, not just the ones with an `@ElementCollection` today, since a field added later shouldn't silently reintroduce this. **A class-level `@Transactional` on a `*ControllerIntegrationTest` masks a missing one at the service layer** — it keeps one Hibernate session open across the whole simulated request, so the test passes even though the real, `open-in-view=false` server would 500. This class of bug is only reliably caught by exercising the real running app (a live smoke test against real Postgres, or a service/repository-tier test that doesn't wrap itself in an ambient transaction) — see `docs/workflow.md`'s own point that manual smoke-testing and automated tests catch different bugs, this is a concrete instance of exactly that.

## Class skeleton (the one shape)

```java
@RestController
@RequestMapping("/api/v1/matches")
class MatchController {
    private final MatchService matchService;          // constructor injection only

    @PreAuthorize("hasRole('manager')")
    @PostMapping
    ResponseEntity<MatchDto> create(@Valid @RequestBody CreateMatchRequest req) {
        return ResponseEntity.ok(matchService.create(req));   // DTO in, DTO out — never the entity
    }
}

interface MatchService {
    MatchDto create(CreateMatchRequest req);           // interface + Impl, always
}

@Service
class MatchServiceImpl implements MatchService {
    private final MatchRepository repository;
    private final MatchMapper mapper;                  // MapStruct, never manual conversion

    @Override
    public MatchDto create(CreateMatchRequest req) {
        if (repository.existsClash(req)) throw new ConflictException("...");
        return mapper.toDto(repository.save(mapper.toEntity(req)));
    }
}
```

Package layout: `controller` / `service` + `service.impl` / `repository` / `domain` / `dto` (flat, no subpackages) / `mapper` / `config`.

Spec 104 adds `service.adaptor`, a sibling of `service.impl` and `service.support`: import adaptors (stateless beans extending `AbstractAdaptor`, found by `AdaptorRegistry`) that turn an input into the common `ImportedResultDto`. They never touch a repository, a result service or the processor.

Import rules (spec 104):
- **Adaptors never write.** `service.adaptor` may depend only on `dto`, `exception`, domain enums, `OversFormat` and itself (ArchUnit `ImportAdaptorRulesTest`). The Result Processor (`service.support`) turns the common format into a draft; adaptors only read.
- **`source` and `external_id` are written only through `ResultService.saveImportedDraft`**, and only `ResultImportServiceImpl` may call it (ArchUnit). It only ever produces a `DRAFT`; an import never publishes. A re-import of the same `(source, external_id)` needs the `replaceExistingDraft` acknowledgement, otherwise the server answers 409.
- **`result_player.import_match` is clear-only for clients.** It is set only by `ScorecardService.replaceImported`; a normal save may clear it (the manager confirmed the name) but never set it, and `ScorecardMapper` ignores it on the way in. Publishing is blocked with `IMPORTED_NAME_UNCONFIRMED` while any row still carries it.
- **Name matching is deterministic and local** (`NameResolver`, `NameTiers`, `NameSimilarity`). Nothing is sent to any AI service; `UnresolvedNameSuggester` is an interface with no bean. A remembered name (`result_name_alias`, per club) is written inside the scorecard save, never by the import.
- **A reader fails loudly rather than guessing.** An adaptor that reads a report (`CRICCLUBS_CSV`, `STUMPS_PDF`) reports every problem as an `ImportInputValidationException` whose path is the input location (`line N`, or `page N, line M` for a PDF), with a stable code and a plain message, and never defaults an unknown value. The rules that do not depend on how a file was read live in a separate package-private mapper so a second reader of the same source can reuse them.
- **PDFBox is imported by one class.** Apache PDFBox (approved for spec 108) is used only by `service.adaptor.StumpsPdfText`, which turns a PDF into numbered lines; the parser and every other class see only those lines (ArchUnit `onlyStumpsPdfTextImportsPdfBox`, proven non-vacuous). It reads text only: no JavaScript, no embedded files, no network, at most 30 pages, and a corrupt, protected or text-less PDF is refused with a plain message. A name or a line of a report is never logged or put in an error message.
- **The preview is stateless.** The document goes to the browser and comes back with `resolve`; the server re-validates it and recomputes every match level. The raw payload is not stored (`source_payload` stays null).

## Import framework (spec 097)

- **Only `ImportServiceImpl` calls an `ImportTypeHandler`.** A handler is one Spring bean per import type (`type()`), found by `ImportHandlerRegistry`; the registry only holds and looks up the beans (its one `type()` call at registration is not a use), and every rule, token, lock, expiry, history and audit step is the service's. A controller never touches a handler or a repository.
- **Handlers write only through the existing services** (`MatchService`, `LeagueTeamService`, ...), never through repositories, so every business rule of the normal create path applies (for a fixture that includes `LeagueSeasonDates.assertWithin`, spec 111). A handler never writes `import_alias` or `import_batch_entity`: it returns `CommitOutcome` (entities and aliases to remember) and the framework records them.
- **The framework is not in `service.adaptor`.** Its classes are `service.impl.ImportServiceImpl`, `service.impl.ImportExpiryServiceImpl` and `service.support.Import*` (plus the table readers and template writers); `ImportAdaptorRulesTest` covers only the result-import adaptors and must stay non-vacuous. A concrete handler lives in `service.support` (or a sibling package named for its type), never in `service.adaptor`. The main code ships no dummy handler; tests register their own.
- **Nothing is written before the confirmed commit.** `preview` and `decisions` write only the `import_batch` row. Commit needs the HMAC confirmation token (`ImportConfirmationToken`, bound to batch, revision, effective-import digest and user, 30 minutes) and the creations digest, takes the batch row lock and the `ImportLockRepository` advisory lock, re-validates against live data including record identity, and writes in one transaction. A refusal that stores a fresh review state first (`ImportValidationFailedException`, `ImportBatchStateException`) is `noRollbackFor`; a handler failure rolls back and `last_error` is written afterwards in its own transaction (`ImportBatchFailureRecorder`).
- **Secret and logging.** `app.imports.token-secret` (env `IMPORT_TOKEN_SECRET`) has a default only in the `dev` profile; elsewhere startup fails when it is missing or blank. The secret, tokens, file contents and row values are never logged or put in an exception message; logs carry batch ids, club ids and counts.
- **Rows live in the stored `payload` jsonb** (at most 1,000 rows, `ImportLimits`), so the rows endpoint filters, sorts and cuts the page in `ImportServiceImpl` from that payload, never in the client. This is the one list that pages from a stored document rather than a `LIMIT`/`OFFSET` query, and only because the set is bounded by the row cap (spec 097 R17); the history list is an ordinary paged query.
- **Parsing is in one place.** `XlsxTableReader` (POI) and `CsvTableReader` (Commons CSV) read every file, `ImportFileSniffer` checks name, magic bytes and zip-bomb limits first, and `XlsxTemplateWriter` / `CsvTemplateWriter` build templates; a handler calls them and never opens a workbook itself. A file problem is an `ImportFileRejectedException` with a plain message that never contains cell content.
- **A club the caller cannot administer is 403** (`canAdministerClub`); a missing batch, or a batch of another club, is 404 (`ImportBatchNotFoundException`). Only a batch's creator changes its decisions or commits it; any club admin may view and delete a committed import.
- **Editable rows (spec 125).** A manager's edits and added rows are decisions on the batch (`rowEdits`, `addedRows`), never changes to the stored file rows (`ImportPayload.fileRows`). `ImportRowEditor` (`service.support`, pure) is the only place they are validated and applied; `ImportServiceImpl.parsedOf` calls it before every evaluate, so validate, propose, plan, digest and commit all see the effective rows. `ImportDigest` hashes row values and results, never the provenance fields `origin` and `fileValues`. A type opts in with `ImportTypeHandler.editableColumns()` (default empty). A blank batch (`POST .../{type}/blank`, `ImportSource.MANUAL`) stores placeholder file metadata and skips the file checks; `saveDecisions` drops resolutions for names that no longer appear.

## Age reference date (spec 110)

- **The date a league judges ages on is computed only by `LeagueAgeReference`** (`service.support`): the league's cut-off day and month in the calendar year the league starts in that season (the league season start date if set (spec 111), else the first active match, else the season start), or the league start itself when there is no cut-off. `SelectionEligibility`, `TeamSelectionBatchRules` and the age-reference-date endpoint all call it; never recompute the date elsewhere, and use its batch method (`ofAll`) rather than one query per match.

## League season dates (spec 111)

- **A match in a league season that has dates must fall within them.** The check lives only in `LeagueSeasonDates.assertWithin` (`service.support`), called by `MatchServiceImpl` create, update, `updateDateTime` (spec 118) and reactivate, and a future bulk or schedule-import path must call it per fixture; it refuses with `MatchOutsideLeagueDatesException` (400, problem property `code` = `MATCH_OUTSIDE_LEAGUE_DATES`). A league season with no `league_season` row, a friendly and a deactivate are not checked. The dates themselves may not exclude an active match (`LeagueDatesExcludeMatchesException`, 409).

## Registered players on a result (spec 113)

- **A registered player of one of our sides is checked only by `ResultPlayerEligibility`** (`service.support`): in the side's team's section or a descendant, and inside the league's age rule (`SelectionEligibility.ageProblems`). The save refusal (`ScorecardServiceImpl` replace, replaceImported and link, newly added players only), the validation errors `PLAYER_NOT_IN_SECTION` and `PLAYER_AGE_INELIGIBLE` and the import candidate filter all call it; never re-implement the rule or query per player.

## Share settings (spec 114)

- **The club default for "First names as initials" is the `club_profile.share_initials_only` column** (`boolean not null default false`, migration `051-club-share-initials-only.sql`), read and written only through `ClubShareSettingsController` and `ClubShareSettingsService`: `GET` and `PUT /api/v1/manage/clubs/{clubId}/share-settings`, body `ShareSettingsDto { initialsOnlyDefault }`, both guarded by `@access.canAccessClub` (any manager of the club, not only the club admin). The club profile `PUT` never resets it, and a club with no profile row reads as false.

## Statistics (spec 103)

- **The Players list games columns are decided only by `PlayerGamesReader` / `PlayerGamesCounter`.** A match counts once per player from a published result's team list (spec 103 counting rules, deactivated matches included per decision 21) or, with no published result, from a selection for a started active match.
- **Statistics are computed on read, never stored.** There is no stats table and no cache; an unpublish, a guest link or a deleted result is correct on the next read. A materialised table needs a measured problem first (spec 103, "Architecture proposal").
- **`PlayerStatsCalculator` (`service.support`) is the only place a figure is defined.** The aggregate SQL (`PlayerStatsSql`, `PlayerStatsAggregateRepository`) only sums and counts stored columns into additive counters (the one logic beyond that is the encoded `max` keys for highest score and best bowling); averages, rates, percentages, haul bands, coverage and the `notCaptured` catalogue all come from the calculator. Never compute a figure in SQL, a mapper, a ranker or the client.
- **The stats repositories are the second permitted reader of the result tables.** `PlayerStatsAggregateRepository` and `PlayerStatsFactsRepository` may read `match_result` and its children, gated by the fixed predicate built from the shared constant `ResultVisibility.PUBLISHED_STATUS` (never a re-typed string); they are touched only by the statistics services (ArchUnit, `LayeringRulesTest`). A draft or unpublished result is never read, counted or detected.
- **What counts** (spec 103, "What counts"): a published result of this club, our non-substitute row linked to a registered profile, on `REGULAR` innings only. Guests, opposition rows, substitutes and unconfirmed import guesses never count. **The played rule (decision 17):** WON, TIE or DRAW counts; NO_RESULT or ABANDONED counts only when at least one ball was bowled (a `REGULAR` innings with `balls > 0`, or a `bowling_entry.balls > 0`), and adds to none of won, lost, tied or drawn; a FORFEIT never counts. A deactivated match with a published result still counts (`match.active` is not a counting rule).
- **Stored credits are never recomputed.** Bowler `wickets` and fielder `catches`, `stumpings`, `run_outs` are read as stored, whether `DERIVED` or `MANUAL` (spec 101).
- **Bounded server-side ranking is a deliberate exception to the `LIMIT`/`OFFSET` rule above.** A leaderboard needs the whole ordered set for competition ranking, ties, the optional minimum and one set of definitions, so the service ranks one aggregate row per player (refused with a 400 and logged above 5,000 players) and slices the page (`page`/`size`, default 10, maximum 100) on the server; the browser never receives or slices more than one page. This is the only list allowed to do so, and only because the set is bounded by the roster.
- **A table figure equals the Player page figure.** Both come from the same counters through `PlayerStatsCalculator`; a parity test asserts it for every player on every column, and a change to a definition changes both.
- **The calculator, `LeaderboardBoard`/`LeaderboardColumn`, the rankers (`LeaderboardRanker`, `LeaderboardTableRanker`) and `LeaderboardQualification` carry no access information** (no caller, role, section list or Spring/entity dependency), so a later player-facing controller reuses them unchanged. Access (`canAccessClub`, section narrowing) lives in the controller and the service entry methods only.
- **Names are never logged** (a player name appears in no log line or exception message in the statistics services).
- **Dashboard (spec 117, shown to users as "Overview").** Two read-only routes, `GET /players/{playerId}/stats/dashboard` (`seasonId`, `leagueId`, `teamId`, `sectionId`, `competition`) and `GET /teams/{teamId}/stats/dashboard` (`seasonId`, `leagueId`, `competition`), on `PlayerStatsController` / `TeamStatsController`; services `PlayerDashboardService` / `TeamDashboardService` (+ `Impl`, `@Transactional(readOnly = true)`), `StatsScopeResolver` called, not copied. The rules:
  - **The builders define no value.** `PlayerDashboardSeriesBuilder` and `TeamDashboardSeriesBuilder` (`service.support`, pure, no access information) only shape series and call `PlayerStatsCalculator` / `TeamStatsCalculator` (and `StatsTrend` for the trend hints). No figure, pooled average, running value, per-match rate or split is written in a builder; one the calculator lacks is added to the calculator and unit tested there.
  - **Caps are named constants in `DashboardLimits`:** `POINT_LIMIT` 30 (per-match bar and line points, newest kept, oldest first in the response), `HISTORY_CAP` 300 (running trends and donuts) and `HISTORY_READ` 301 (the read asks for one more than the cap; the extra row proves `truncated`). Trend span 5, minimum 3 per half, flat bands 0.25 (economy) and 0.5 (dot percentage points) live there too.
  - **Parity with the tiles and tabs** (untruncated scope), parity-tested: Σ runs per innings = the Runs tile, Σ wickets per match = the Wickets tile, the Bowling tab's Econ (`overallEconomy`), and, for a team, the record and the Extras card's per-type figures.
  - **Every bowler row recorded dots.** A team match's `dots` and `dotPercent` are defined only when every bowler row that bowled at least one ball recorded `dots`; otherwise null (a gap, never a partial sum). A recorded 0 is a real 0.
  - **Wicket-type split** (calculator): per bowling innings, `c` = bowler-credited dismissals on the opposition's batting card naming the player, `w` = the stored wickets. If `c <= w` the innings contributes `c[type]` and `w - c` Not itemised; if `c > w` all `w` is Not itemised. **The stored wickets are authoritative** (`DERIVED` or `MANUAL`), so types + Not itemised always sums to the Wickets tile. Non-bowler dismissals (run-out, retired out, handled ball and so on) are never counted; SQL returns raw counts per (innings, `how_out`) and `DismissalType.isBowlerCredited()` decides in the calculator.
  - **Economy reference over the full scope.** `overallEconomy` and the trend hint are computed over the whole filtered scope (Σ runs / Σ overs through the same calculator method as the Bowling tab), not over the 30 plotted points and not as a mean of match figures.
  - **One request per page, fixed statement count** (pinned by a query-count test); no migration, table or index. DTOs only; no person other than the subject is named in a response, log line or exception message.

## Team statistics (spec 116)

- **`TeamStatsCalculator` (`service.support`) is the only place a team figure is defined.** `TeamStatsSql` only sums, counts and encodes maxima and minima of stored columns into additive counters; rates, percentages, Net Run Rate, coverage, the form lines and the `notCaptured` catalogue all come from the calculator. The classification predicates (complete innings, successful chase, victories, Net Run Rate usability) are **named constants in `TeamStatsSql`, defined once and decoded only in the calculator**; never re-type one in a query, a mapper, a ranker or the client.
- **The team repositories are further permitted readers of the result tables.** `TeamStatsAggregateRepository` and `TeamStatsFactsRepository` may read `match_result`, `match` and `match_innings` under the same published constant and the same ArchUnit rule as the player repositories (`LayeringRulesTest`); touched only by the statistics services.
- **`StatsCountingSql.PUBLISHED` and `PLAYED_RESULT` are shared by the player and team SQL.** A change to what counts changes players and teams together; the `103` and `115` tests must pass unchanged.
- **The counted team result.** Two rows per match (one per side) where the side's team id is set and `team.club_id` is the club, published, and either the played rule or `FORFEIT`. A forfeit is a **win for the receiver (`winning_side`) and a loss for the conceder**, counted in the record, Matches Played and Win Percentage; it is gated on `outcome_type = 'FORFEIT'`, **no innings are ever read for it**, so it feeds no run, wicket, extras or Net Run Rate figure. Only a NO_RESULT or ABANDONED match with no ball bowled is not counted (it is disclosed in the basis counters). A derby counts once for each of its two teams. Super-over innings never feed a figure (`kind = 'REGULAR'`).
- **Net Run Rate** uses the full-quota rule (an all-out innings counts at `scheduled_balls`), is rounded once to **2 decimals**, and takes only WON or TIE results in a league with exactly one regular innings each way, both usable, and the quota known for any all-out innings (DLS, draws, no results and forfeits out). It is shown only for one league in one season (`NOT_ONE_COMPETITION` otherwise, `NO_USABLE_RESULTS` when none qualifies); `matchesUsed` is out of `matchesCounted`, which is the counted results minus forfeits. The response keeps `rule: FULL_QUOTA` for a later per-league rule; the UI does not print it.
- **A table figure equals the team page figure** for the same filters (`TeamStatsParityIntegrationTest`). A **Section filter chooses which teams are listed and never changes a team's own figures**; the team page takes no `sectionId`.
- **Team ranking shares the bounded server-side ranking exception** above: `TeamTableRanker` ranks one aggregate row per team (refused with a 400 and logged above 1,000 teams), `size` defaults to 25, and a size above 100 (or below 1) is a 400, never clamped. `TeamTableRanker`, `TeamStatsColumn` and the calculator carry no access information.
- **No person is named** in a team response, a log line or an exception message; the only names are team, section and opponent names.

## Player match list (spec 115)

- **`GET /players/{playerId}/stats/matches`** (`PlayerStatsController.getPlayerMatches`, service `PlayerMatchListService` / `PlayerMatchListServiceImpl`, `@Transactional(readOnly = true)`) returns one page of a player's counted matches, newest first (`direction=asc` reverses; stable tie-break on match id). Filters, 404s and section narrowing are `StatsScopeResolver`'s, called, not copied; a player with no counted match is a 200 with an empty page.
- **The counting rules still live once, in `PlayerStatsSql`.** The match queries in `PlayerStatsFactsRepository` start from the same `APPEARANCES` fragment as the aggregate. The card-captured predicates (`HAS_BATTING_CARD`, `HAS_BOWLING_CARD`) and the valid-balls expression (`VALID_BALLS`) are shared constants used by the aggregate, the facts queries and the match list; never re-type them.
- **`PlayerMatchRowBuilder` (`service.support`, pure) is the only place a row's statuses, result and sums are decided.** SQL selects stored columns and `PlayerMatchFactsReader` maps raw rows to builder facts; the service, mapper and client decide nothing. It carries no access information, like `PlayerStatsCalculator`.
- **The page query is an ordinary `LIMIT`/`OFFSET`, not the leaderboard ranking exception.** The set is bounded by one player, so no whole-set ranking is needed. `size` defaults to 20; above 100 (or below 1), a negative `page` or a `direction` other than `asc`/`desc` is a 400 (`ValidationException`), never clamped. The number of statements per page is fixed (count, page, batting, bowling, fielding, awards, plus the player and scope lookups) and pinned by a query-count test: no N+1.
- **Parity rule.** The sum of the rows equals the same player's `PlayerStatsDto` totals for the same filters (matches, batting, bowling, fielding, awards, record), enforced by `PlayerMatchListParityIntegrationTest`. A change to a counting rule or to the builder must keep it passing.

## Leaderboard settings (spec 103)

- **The club's chosen Awards categories are the `club_profile.leaderboard_award_categories` column** (`jsonb`, nullable, null means the nine default categories; migration `052-club-leaderboard-award-categories.sql`), read and written only through `ClubLeaderboardSettingsController` and `ClubLeaderboardSettingsService`: `GET` and `PUT /api/v1/manage/clubs/{clubId}/leaderboard-settings`, both guarded by `@access.canAccessClub` (any manager of the club). The club profile `PUT` never resets it, and a club with no profile row reads as the defaults.

## Authorization (see `docs/specs/002-realm-subdomain-auth.md`)

Once auth is implemented, permission checks are **not** `@PreAuthorize("hasRole(...))")` against flat Keycloak roles — they resolve against the scoped `RoleAssignment` model from `docs/specs/001-tenancy-identity-model.md`:

```java
@PreAuthorize("@access.canAdminister(authentication, #teamId)")
```

Don't reintroduce flat role checks for anything club/section/team-scoped — that's the exact pattern this project moved away from.

A platform admin's own actions (`/api/v1/platform/**`, gated by URL in `SecurityConfig`) record who acted as the Keycloak subject, `authentication.getName()`, not a `Person` id, because a `platform_admin` may have no `Person` row (`MeAccessDto`): see `verified_by_subject` on a field (spec 099).

## Draft visibility and validation (match results, spec 100)

- **The publish gate.** A `match_result` in `DRAFT` is visible to managers only. Every non-manager read of `match_result` goes through `ResultVisibility`; nothing else filters drafts. Only the result services touch `MatchResultRepository`, apart from the two statistics repositories (spec 103, the second permitted reader of the result tables, see "Statistics (spec 103)"), so no other service can bypass the gate — enforced by `LayeringRulesTest`.
- **Warnings and errors.** Result validation returns both. Errors block publishing. Warnings are acknowledgeable: the manager confirms them at publish, and the server checks that they were acknowledged.

## Scorecard rows (spec 101)

- **Scorecard rows never belong to a super-over innings in 101.** Batting, bowling and fielding entries attach to `REGULAR` innings only; a super-over entry is rejected (`SCORECARD_SUPER_OVER_NOT_SUPPORTED`). Super-over scorecards are `105`.
- **Innings are reconciled in place**, matched on `(kind, battingSide)`, never deleted and recreated, so the innings ids, and the scorecard attached to them, survive a re-save or a toss-driven resequence. **Only innings ids are stable.** The scorecard section of a save deletes and re-inserts the batting, bowling, fielding and award entry rows (their ids change on every save); `result_player` ids are kept. Never hold or expose an entry id as a durable reference; reference players by `result_player.id`. `ux_match_innings_sequence` is deferrable for this reason.
- **Drafts are lenient, publish is strict.** Draft innings `runs`, `wickets` and `balls` and a batting entry's `how_out` are nullable (migrations 046, 047); `ResultValidator` enforces them at publish.
- **Opposition rows are name-only** (`result_player.opposition`): never linked to a profile, never fed to statistics.
- **Derived credits are recomputed server-side on every save** (`DismissalCredits`): `DERIVED` bowling wickets and fielding credits follow the dismissals; **`MANUAL` rows are never touched**.
- **Validation issue shape:** `ResultIssueDto` with `code`, `step`, `side`, `severity` (and message), built on `WarningCode`/`ErrorCode`; clients read `code`, never message text.
- **Migrations:** `044-match-results-our-side-scorecard` (result_player, batting/bowling/fielding entries, match_award, extras, deferrable sequence), `045-match-results-opposition-scorecard` (opposition flag, dismissal bowler/fielder, credit sources, dots, award keeps its name), `046-match-innings-partial-figures` (nullable runs/wickets/balls), `047-batting-entry-how-out-nullable`.

## Deleting records (spec 109)

- **A delete is allowed only on an empty record.** The service checks, in one place (e.g. `MatchEmptiness`), that nothing is attached (a structural row with nothing chosen in it, such as an empty unannounced `match_side`, is not an attachment and is removed with the record), and refuses otherwise with a `ConflictException` (409) whose message names what exists and the alternative (Deactivate). No cascading deletes. Expose a batched `deletable` flag on the read DTO so screens never need a call per row.

## Enforcement

- **ArchUnit suite** (`backend/src/test/java/com/cricketlegend/architecture/`) — layers depend only downward, no field injection, `service.impl` classes are `@Service`-annotated and suffixed `Impl`. Runs on every build; a violation fails CI the same for an agent's change as a human's.
- **Coverage gate** — diff-coverage on new service classes (Jacoco), not a blanket percentage target.
- **Contract diff** — a change that breaks the checked-in OpenAPI schema without a version bump fails CI.
- **Duplicate-code scan** (PMD CPD) — new blocks above a similarity threshold block the PR; the fix is extraction, not raising the threshold.

## Testing tiers (see `docs/standards/testing.md` for the full pyramid)

- **Unit** — JUnit 5, pure logic, no Spring context.
- **Integration** — `@SpringBootTest` + Testcontainers Postgres via `AbstractIntegrationTest` (`@ServiceConnection`-based, no local Postgres required to run).
