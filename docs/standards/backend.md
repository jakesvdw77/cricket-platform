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

  Extend this table here before introducing a new *base* type — don't invent a new HTTP-status category ad hoc in a controller.

  **Prefer a specific, named exception over a generic one.** A distinct, recurring failure mode gets its own small subclass of the right base — e.g. `InvalidStatusTransitionException extends ConflictException`, `DuplicateSlugException extends ConflictException` — living in `com.cricketlegend.exception` alongside the three base classes, instead of every call site throwing the same base exception with just a different string message. This keeps call sites self-documenting and makes a specific failure catchable by type where that matters. Never reach for a raw `RuntimeException`/`IllegalArgumentException`/`IllegalStateException` for a business rule violation — it skips the exception→status mapping entirely and `GlobalExceptionHandler` won't handle it meaningfully.

- Every `@Service` method carrying a business rule ships with a unit test in the same PR; every custom repository query ships with a Testcontainers-backed integration test in the same PR (base class: `com.cricketlegend.AbstractIntegrationTest`).
- **Shared logic lives in one place.** Business logic needed by two or more services is extracted into a shared service/utility before the second use is written — never copy-pasted. Same for validation rules, mapping helpers, and query specifications (reusable `Specification<T>` classes over hand-rolled duplicate queries).
- **Pagination is backend-driven, never client-side.** Any list endpoint whose result set can grow unbounded returns a Spring Data `Page<T>` (`Pageable` request param — `page`/`size`/`sort`), fetched with a real `LIMIT`/`OFFSET` (or keyset) query — never the full table handed to the frontend to slice, filter, or paginate in memory. The whole point is keeping that memory and scalability cost on the server, where it's one tunable query, not duplicated per browser tab. See `docs/standards/frontend.md`'s matching rule for how the client consumes this.

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

## Authorization (see `docs/specs/002-realm-subdomain-auth.md`)

Once auth is implemented, permission checks are **not** `@PreAuthorize("hasRole(...))")` against flat Keycloak roles — they resolve against the scoped `RoleAssignment` model from `docs/specs/001-tenancy-identity-model.md`:

```java
@PreAuthorize("@access.canAdminister(authentication, #teamId)")
```

Don't reintroduce flat role checks for anything club/section/team-scoped — that's the exact pattern this project moved away from.

## Enforcement

- **ArchUnit suite** (`backend/src/test/java/com/cricketlegend/architecture/`) — layers depend only downward, no field injection, `service.impl` classes are `@Service`-annotated and suffixed `Impl`. Runs on every build; a violation fails CI the same for an agent's change as a human's.
- **Coverage gate** — diff-coverage on new service classes (Jacoco), not a blanket percentage target.
- **Contract diff** — a change that breaks the checked-in OpenAPI schema without a version bump fails CI.
- **Duplicate-code scan** (PMD CPD) — new blocks above a similarity threshold block the PR; the fix is extraction, not raising the threshold.

## Testing tiers (see `docs/standards/testing.md` for the full pyramid)

- **Unit** — JUnit 5, pure logic, no Spring context.
- **Integration** — `@SpringBootTest` + Testcontainers Postgres via `AbstractIntegrationTest` (`@ServiceConnection`-based, no local Postgres required to run).
