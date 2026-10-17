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

  The four public-availability exceptions (spec 077) are deliberately their own types rather than subclasses of the three bases, because no base carries 401, 403, 423 or 429; they are mapped in `GlobalExceptionHandler` to a `ProblemDetail` with their extra properties. They are the only exceptions allowed to extend `RuntimeException` directly.

  Extend this table here before introducing a new *base* type — don't invent a new HTTP-status category ad hoc in a controller.

  **Prefer a specific, named exception over a generic one.** A distinct, recurring failure mode gets its own small subclass of the right base — e.g. `InvalidStatusTransitionException extends ConflictException`, `DuplicateSlugException extends ConflictException` — living in `com.cricketlegend.exception` alongside the three base classes, instead of every call site throwing the same base exception with just a different string message. This keeps call sites self-documenting and makes a specific failure catchable by type where that matters. Never reach for a raw `RuntimeException`/`IllegalArgumentException`/`IllegalStateException` for a business rule violation — it skips the exception→status mapping entirely and `GlobalExceptionHandler` won't handle it meaningfully.

  **An exception may carry structured detail for the client**, as a `ProblemDetail` property set by its own `GlobalExceptionHandler` method (a more specific type wins over `ConflictException`): `SelectionRejectedException` carries `rejections` and `DuplicateFieldException` (spec 099) carries `existingPlayingAreaId`, so the screen can offer the existing record instead of only showing a message.

  Spec 104 adds `InvalidImportInputException` (abstract, extends `ValidationException`) with `UnsupportedImportFormatException` (carries `supported`), `UnreadableImportInputException` and `ImportInputValidationException` (carries `errors` and `totalErrors`), and three `ConflictException` subclasses, `ImportMatchAlreadyHasResultException`, `ImportExternalIdAlreadyUsedException` (carries `otherMatchId`) and `ImportWouldOverwriteDraftException`. No new base type or status.

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

## Age reference date (spec 110)

- **The date a league judges ages on is computed only by `LeagueAgeReference`** (`service.support`): the league's cut-off day and month in the calendar year the league starts in that season (the league season start date if set (spec 111), else the first active match, else the season start), or the league start itself when there is no cut-off. `SelectionEligibility`, `TeamSelectionBatchRules` and the age-reference-date endpoint all call it; never recompute the date elsewhere, and use its batch method (`ofAll`) rather than one query per match.

## League season dates (spec 111)

- **A match in a league season that has dates must fall within them.** The check lives only in `LeagueSeasonDates.assertWithin` (`service.support`), called by `MatchServiceImpl` create, update and reactivate, and a future bulk or schedule-import path must call it per fixture; it refuses with `MatchOutsideLeagueDatesException` (400, problem property `code` = `MATCH_OUTSIDE_LEAGUE_DATES`). A league season with no `league_season` row, a friendly and a deactivate are not checked. The dates themselves may not exclude an active match (`LeagueDatesExcludeMatchesException`, 409).

## Registered players on a result (spec 113)

- **A registered player of one of our sides is checked only by `ResultPlayerEligibility`** (`service.support`): in the side's team's section or a descendant, and inside the league's age rule (`SelectionEligibility.ageProblems`). The save refusal (`ScorecardServiceImpl` replace, replaceImported and link, newly added players only), the validation errors `PLAYER_NOT_IN_SECTION` and `PLAYER_AGE_INELIGIBLE` and the import candidate filter all call it; never re-implement the rule or query per player.

## Authorization (see `docs/specs/002-realm-subdomain-auth.md`)

Once auth is implemented, permission checks are **not** `@PreAuthorize("hasRole(...))")` against flat Keycloak roles — they resolve against the scoped `RoleAssignment` model from `docs/specs/001-tenancy-identity-model.md`:

```java
@PreAuthorize("@access.canAdminister(authentication, #teamId)")
```

Don't reintroduce flat role checks for anything club/section/team-scoped — that's the exact pattern this project moved away from.

A platform admin's own actions (`/api/v1/platform/**`, gated by URL in `SecurityConfig`) record who acted as the Keycloak subject, `authentication.getName()`, not a `Person` id, because a `platform_admin` may have no `Person` row (`MeAccessDto`): see `verified_by_subject` on a field (spec 099).

## Draft visibility and validation (match results, spec 100)

- **The publish gate.** A `match_result` in `DRAFT` is visible to managers only. Every non-manager read of `match_result` goes through `ResultVisibility`; nothing else filters drafts. Only the result services touch `MatchResultRepository`, so no other service can bypass the gate — enforced by `LayeringRulesTest`.
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
