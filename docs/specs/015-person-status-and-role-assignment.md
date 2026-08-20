# 015 — Person Status & Role Assignment

**Depends on:** `001-tenancy-identity-model.md` (`RoleAssignment`'s original `person_id`/`role`/`scope_type`/`scope_id?` shape and its "Juniors Admin" worked example — this spec is the first real implementation of that already-settled design, not a redesign of it), `002-realm-subdomain-auth.md` (the identity-vs-authorization split and the `platform_admin` realm role this spec deliberately does not touch), `009-subscriptions.md` (`SubscriptionStatus`'s bare-enum shape this spec's `PersonStatus` mirrors, and the "only one owner/scope type is actually buildable yet" precedent `SubscriptionOwnerType` set, reused here for `ScopeType`), `012-club-profile.md` (introduced `AccessService.canAdministerClub` and the codebase's first `@PreAuthorize("@access...")` wiring — this spec amends that same method's body), `014-subscription-responsible-contact.md` (`Person`'s current real-identity shape, `PersonService.findOrCreatePerson`, and `PersonRepository` — this spec grows all three).
**Status:** draft.

## Problem & Goals

`014-subscription-responsible-contact.md` gave `Person` real identity fields — name, email, phone — because a Subscription's responsible party is a confirmed future login. But a `Person` today has no lifecycle state (nothing distinguishes "in good standing" from "blocked") and no way to actually be granted anything: `RoleAssignment`, named in `001-tenancy-identity-model.md` since this project's foundation, has never been built — it exists only as a row in an ER diagram and a comment in `AccessService`'s own Javadoc anticipating the day it would be. This spec builds both foundational pieces: a `PersonStatus` lifecycle field, and a real `RoleAssignment` entity/table, wired into the one piece of production authorization code that's actually been waiting for it (`AccessService.canAdministerClub`). A separate, later spec — not this one — will provision real Keycloak accounts, send invite emails, and turn a first login into an active account; this spec only builds what that flow will need to exist first.

**Goals**
- `Person` gains a `status` field — `PENDING | ACTIVE | SUSPENDED` — mirroring `SubscriptionStatus`'s exact bare-enum shape and Javadoc-cites-its-own-spec pattern (`009-subscriptions.md`).
- Every `Person` created by `014`'s existing `PersonService.findOrCreatePerson` (i.e. every responsible party resolved today via `POST /subscriptions`) defaults to `ACTIVE` — reasoned through explicitly below, not just asserted.
- `PENDING` is reserved, not built: nothing in this spec's own scope ever creates a `PENDING` Person. It exists in the enum, documented, for the still-unbuilt self-serve signup flow (`docs/roadmap.md`) to set later.
- A real `RoleAssignment` entity/table replaces the pure-stub state `001` left it in — `person_id`, `role`, `scope_type`, `scope_id?`, one row per grant, exactly as `001` already specified.
- Confirm explicitly, in code and in this document, that a `Person` can hold multiple `RoleAssignment` rows simultaneously (e.g. `PLAYER` in one Section and `CLUB_ADMIN` for the whole Club) — this was already solved by `001`'s one-row-per-grant design; this spec is the first to actually build and test it, not a redesign.
- `AccessService.canAdministerClub` does a real lookup — does this `Person` hold a `CLUB_ADMIN` `RoleAssignment` scoped to this `clubId`, OR do they carry the `platform_admin` realm role — replacing the pure hardcoded `platform_admin`-only stub it's been since `012`.

## Non-goals

- **No Keycloak account provisioning, no email sending, no first-login activation logic.** That's a deliberately separate, later spec. This spec only builds the `PersonStatus`/`RoleAssignment` data model and the `AccessService` wiring — nothing here talks to Keycloak's Admin API, and nothing here changes what happens when a Subscription is created beyond `Person.status` defaulting to `ACTIVE`.
- **No UI for assigning/managing roles.** No admin screen exists to grant (or revoke) a `RoleAssignment` for a `Person` — this spec is backend/data-model only, plus the one `AccessService` amendment. This is a real, flagged gap: someone needs a way to actually create these rows before they're useful for anything beyond a future spec calling the repository directly (see Rollout Notes) — building that UI is not this spec's job, parallel to how `Person`-management UI was explicitly out of scope for `014` too.
- **No revoke/delete path for a `RoleAssignment`**, for the same "no UI, backend/data-model only" reason above. A future admin screen or endpoint owns both granting and revoking; this spec builds the table and the read-side lookup only.
- **No self-serve signup flow itself.** `PENDING` is reserved, not activated by anything built here — see Goals.
- **No `GET /api/v1/me/access` endpoint.** `002-realm-subdomain-auth.md`'s Login Flow sketch describes a future endpoint returning a logged-in user's resolved role assignments for the current club — the frontend-facing consumption of `RoleAssignment` data. That needs the login flow's JWT-`sub`-to-`Person` resolution wired up as a real, first-class concept (not the narrow, local lookup this spec adds inside `AccessService` — see Data Model Changes), and has no consumer yet since no UI reads role assignments. Not built here.
- **No change to `SecurityConfig`'s `JwtAuthenticationConverter`.** `002`'s own sketch describes a fuller redesign — mapping a JWT's `sub` claim to a `PersonAuthenticationToken` carrying that person's resolved `RoleAssignment`s, replacing the current flat realm-role-to-authority mapping. This spec does not do that redesign; `AccessService.canAdministerClub` does its own local, narrow lookup instead (`Authentication.getName()` → `Person.keycloakUserId` → `RoleAssignment` rows), scoped to exactly the one method this spec amends. See Data Model Changes for why, and Rollout Notes for the practical consequence of leaving this narrower.
- **`platform_admin` itself is untouched — not migrated, not replaced, not redefined.** `platform_admin` stays exactly what `002` already settled: a flat Keycloak realm role for the vendor's own team, checked both by `SecurityConfig`'s `/api/v1/platform/**` URL gate (unchanged) and, now, as the OR-branch/superset of `AccessService.canAdministerClub`'s real lookup. `RoleAssignment` is an orthogonal, new authorization dimension for club-side humans — scoped to a specific `Club`/`Section`/`Team`, never global, never a Keycloak role. Conflating the two is exactly the mistake this Non-goal exists to rule out.
- **`SECTION`/`TEAM`-scoped `RoleAssignment` resolution.** `001`'s own worked example ("`RoleAssignment: Juniors Admin` — scope = Juniors") implies a section-scoped admin variant, but `Section`/`Team` don't exist as real entities in code yet — the same gap `009-subscriptions.md` already identified and left unresolved for `Subscription.ownerType`. `ScopeType` (below) is a four-value enum matching `001`'s full model (`PLATFORM`, `CLUB`, `SECTION`, `TEAM`) for forward compatibility, but only `CLUB` is actually created, validated, or resolved by anything this spec builds — mirroring `SubscriptionOwnerType`'s exact "recognized value, not yet buildable" precedent. See the Data Model Changes decision log below for the naming call this implies.
- **No role hierarchy or permission-matrix system.** `role` is one of exactly three flat, named values — `CLUB_ADMIN`, `MANAGER`, `PLAYER` — the concrete roles known real consumers need today. No role inheritance, no per-permission granularity beneath a role name. Follows `014`'s own established Non-goals posture: build what's needed, not what might generalize.
- **No concurrency handling for simultaneous grant creation.** Moot in this pass specifically because this spec builds no create/grant path at all (see above) — flagged here so the eventual grant-writing spec inherits the same "accepted, rare-edge-case limitation" posture `011`/`014` already established for their own non-atomic writes, rather than needing to rediscover it.

## User Stories

- As a platform admin creating a Subscription, the `Person` resolved for the responsible party is recorded as `ACTIVE`, so a future login attempt for that person is never blocked by a status this spec's own flow would otherwise have left ambiguous.
- As the platform's authorization layer, I can check whether a given `Person` holds a `CLUB_ADMIN` grant for a specific `Club`, distinct from and in addition to the vendor-level `platform_admin` flag, so club-scoped and platform-scoped administration stay two different concepts instead of collapsing into one flat check.
- As the data model, I can record that one `Person` holds several different role grants at once — e.g. `PLAYER` in one Section and `CLUB_ADMIN` for the whole Club — with no schema change, because `RoleAssignment` was already designed as one row per grant back in `001`.
- As a developer building the next spec (Keycloak account provisioning / invite-and-activate), I have a real `RoleAssignment` table and repository to write a `CLUB_ADMIN` grant into once a Subscription's responsible party is provisioned, rather than inventing the table myself.
- As a developer reading `PersonStatus`, I can see `PENDING` is reserved for the future self-serve signup flow and is never set by anything shipped today, so I don't mistake its presence in the enum for a built feature.

## Data Model Changes

### `Person` gains `status`

Mirrors `SubscriptionStatus`'s exact bare-enum shape (`backend/src/main/java/com/cricketlegend/domain/SubscriptionStatus.java`) and its Javadoc convention of citing the owning spec's own reasoning:

```java
// backend/src/main/java/com/cricketlegend/domain/PersonStatus.java (new)
package com.cricketlegend.domain;

/**
 * Lifecycle of a {@link Person}, per docs/specs/015-person-status-and-role-assignment.md — mirrors
 * {@link SubscriptionStatus}'s bare-enum shape (docs/specs/009-subscriptions.md).
 *
 * <p>{@code PENDING} is a reserved value only — nothing in this codebase sets this status yet.
 * It's reserved for the future self-serve signup flow (docs/roadmap.md), where a Person is created
 * ahead of any admin approving them. That flow, and the Keycloak account provisioning it needs, is
 * a deliberately separate, not-yet-built spec — see 015's own Non-goals. Don't build a code path
 * that sets this value without re-reading that spec's reasoning first.
 */
public enum PersonStatus {
    PENDING,
    ACTIVE,
    SUSPENDED
}
```

```java
// backend/src/main/java/com/cricketlegend/domain/Person.java (amended)
@Enumerated(EnumType.STRING)
@Column(nullable = false)
private PersonStatus status;

@PrePersist
void prePersist() {
    if (status == null) {
        status = PersonStatus.ACTIVE;
    }
}
```

The `@PrePersist` default mirrors `Subscription`'s own defaulting pattern (`Subscription.prePersist()`) exactly, rather than a Lombok `@Builder.Default` — guards any direct `.save()` call, not only ones that go through the builder.

**Why `ACTIVE`, not `PENDING`, for a `Person` resolved via `PersonService.findOrCreatePerson`:** every call site that reaches `findOrCreatePerson` today is `SubscriptionServiceImpl.create()`, itself only reachable behind `POST /api/v1/platform/subscriptions`'s `platform_admin` gate. A platform admin creating that Subscription is already vouching for this human by the act of creating the record — the same trust level this system already extends to an admin directly creating a `Club` or `Product`. `PENDING`'s entire reason for existing is the *absence* of that vouching — a self-serve signup with nobody reviewing it yet. Defaulting an admin-vouched `Person` to `PENDING` would strand every one of them in a state nothing in this codebase can currently move out of (no approval screen exists, and building one is explicitly out of scope here) — `ACTIVE` is the only status that doesn't require unbuilt scope to be usable immediately. `SUSPENDED` was never a candidate — nothing about creating a Subscription implies blocking its responsible party.

**"Link, don't overwrite" (`014`'s own rule) extends to `status` without any code change.** `findOrCreatePerson`'s `orElseGet` branch only runs when no existing `Person` is found; the found-by-email branch returns the stored row exactly as-is, `status` included — no new logic needed, since the field simply isn't touched. Only the create branch needs an explicit default:

```java
// backend/src/main/java/com/cricketlegend/service/impl/PersonServiceImpl.java (amended)
@Override
public Person findOrCreatePerson(String firstName, String lastName, String email, String phone) {
    return personRepository
            .findByEmailIgnoreCase(email)
            .orElseGet(() -> personRepository.save(Person.builder()
                    .firstName(firstName)
                    .lastName(lastName)
                    .email(email)
                    .phone(phone)
                    .status(PersonStatus.ACTIVE)
                    .build()));
}
```

**Flagged judgment call, for a reviewer to challenge:** if `findOrCreatePerson` finds an existing `SUSPENDED` `Person` by email, that `Person` is still linked as the new Subscription's responsible party — `status` is never inspected or gated on here. Whether a `SUSPENDED` person should be blockable from being (re-)linked as a responsible party is a real product question, but it has no answer yet in this codebase (no login exists to be suspended from, and the next spec is what will make `SUSPENDED` load-bearing) — not resolved by this spec, flagged for whoever builds Keycloak provisioning to revisit once `SUSPENDED` actually blocks something.

**Migration** (next sequential file after `009-subscription-responsible-person.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/010-add-person-status.sql
ALTER TABLE person
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
```

**Backfill reasoning, stated explicitly (the same kind of check `014`'s own `Person`-restructuring migration had to make):** `014`'s `008-restructure-person-identity.sql` was safe as a single unqualified `NOT NULL` add because `person` had zero rows at that point. That's no longer a safe assumption here — by the time this spec ships, `014`'s flow has likely been used to create real Subscriptions with real responsible parties in dev. This migration is written for that case: `ADD COLUMN ... NOT NULL DEFAULT 'ACTIVE'` is a single, fast, metadata-only operation in Postgres 11+ — every existing row is backfilled to `'ACTIVE'` as part of adding the column itself, no separate `UPDATE` statement needed, and no data-loss or partial-state risk the way a two-step add-then-backfill-then-constrain sequence would carry.

### `RoleAssignment` — from named concept to real table

`001-tenancy-identity-model.md` already specified the shape (`person_id`, `role`, `scope_type`, `scope_id?`) and the scope-walk resolution rule; this spec builds it for real, unchanged in shape, adding only the ordinary implementation-level `id` (UUID PK) and `created_at` audit column every other entity in this codebase already carries.

```java
// backend/src/main/java/com/cricketlegend/domain/RoleAssignmentRole.java (new)
package com.cricketlegend.domain;

/**
 * The fixed, flat set of role names a {@link RoleAssignment} can grant, per
 * docs/specs/015-person-status-and-role-assignment.md — no hierarchy, no per-permission
 * granularity beneath a name (015's Non-goals). Concrete roles for known, real consumers only:
 * {@code CLUB_ADMIN} is what the next (Keycloak-provisioning) spec grants to a Subscription's
 * responsible {@link Person}.
 */
public enum RoleAssignmentRole {
    CLUB_ADMIN,
    MANAGER,
    PLAYER
}
```

```java
// backend/src/main/java/com/cricketlegend/domain/ScopeType.java (new)
package com.cricketlegend.domain;

/**
 * The four scope levels a {@link RoleAssignment} can bind to, per
 * docs/specs/001-tenancy-identity-model.md's original scope hierarchy. Matches
 * {@link SubscriptionOwnerType}'s "recognized value, not yet buildable" precedent
 * (docs/specs/009-subscriptions.md): only {@code CLUB} is actually created, validated, or resolved
 * by anything built as of docs/specs/015-person-status-and-role-assignment.md. {@code SECTION}/
 * {@code TEAM} are reserved for once those entities exist in code — see 015's Non-goals.
 * {@code PLATFORM} is reserved too, but deliberately unused: the vendor-level equivalent stays the
 * flat {@code platform_admin} Keycloak realm role (docs/specs/002-realm-subdomain-auth.md), not a
 * RoleAssignment row — see 015's Non-goals for why the two are never conflated.
 */
public enum ScopeType {
    PLATFORM,
    CLUB,
    SECTION,
    TEAM
}
```

```java
// backend/src/main/java/com/cricketlegend/domain/RoleAssignment.java (new)
package com.cricketlegend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row per grant — per docs/specs/001-tenancy-identity-model.md's original design, confirmed
 * and first actually built by docs/specs/015-person-status-and-role-assignment.md. A Person can
 * and does hold multiple RoleAssignment rows at once (e.g. PLAYER in one Section and CLUB_ADMIN
 * for the whole Club) — this was never a one-role-per-person model; nothing in this entity
 * enforces or assumes otherwise.
 */
@Entity
@Table(name = "role_assignment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Plain FK column, no @ManyToOne — matches this codebase's existing convention
    // (Subscription.ownerId/productId, Person's own columns).
    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoleAssignmentRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false)
    private ScopeType scopeType;

    // No DB-level FK — scope_id is polymorphic across Club/Section/Team depending on scopeType
    // (and unused for PLATFORM), unlike Subscription.ownerId, which could get away with a hard FK
    // to club(id) only because CLUB is the sole owner type that exists at all. Validated at the
    // service layer once a real create path exists (the next spec) — same posture 009 already
    // established for ownerType.
    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
```

**Migration** (next sequential file after `010-add-person-status.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/011-add-role-assignment.sql
CREATE TABLE role_assignment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID NOT NULL REFERENCES person(id),
    role        VARCHAR(32) NOT NULL,
    scope_type  VARCHAR(16) NOT NULL,
    scope_id    UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_role_assignment_scope_id
        CHECK (scope_type = 'PLATFORM' OR scope_id IS NOT NULL)
);

CREATE INDEX ix_role_assignment_person ON role_assignment (person_id);
CREATE INDEX ix_role_assignment_scope ON role_assignment (scope_type, scope_id);

-- Prevents granting the exact same role at the exact same scope to the same person twice.
-- Postgres treats NULL as distinct in a unique index by default, so scope_id is coalesced to a
-- fixed sentinel UUID for PLATFORM-scoped rows (the only case scope_id is ever NULL) — otherwise
-- two identical PLATFORM grants for the same person/role would silently not collide.
CREATE UNIQUE INDEX ux_role_assignment_grant
    ON role_assignment (person_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
```

No FK on `scope_id` (reasoned in the entity's own comment above); the `CHECK` constraint keeps the one real invariant `001`'s model implies — every non-`PLATFORM` grant must actually name a scope — enforced at the DB level even though nothing creates a `PLATFORM`-scoped row yet.

```java
// backend/src/main/java/com/cricketlegend/repository/RoleAssignmentRepository.java (new)
package com.cricketlegend.repository;

import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.ScopeType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleAssignmentRepository extends JpaRepository<RoleAssignment, UUID> {

    /** The lookup {@link com.cricketlegend.config.AccessService#canAdministerClub} relies on. */
    boolean existsByPersonIdAndRoleAndScopeTypeAndScopeId(
            UUID personId, RoleAssignmentRole role, ScopeType scopeType, UUID scopeId);

    /** Every grant a Person holds — reusable by a future `/me/access` endpoint (see Non-goals). */
    List<RoleAssignment> findByPersonId(UUID personId);
}
```

### `AccessService.canAdministerClub` — the real lookup

The one existing piece of production code this spec amends. Today (since `012-club-profile.md`), it's a pure `platform_admin`-authority re-check, with `clubId` accepted but unused — its own Javadoc already anticipates this exact moment ("swapping in `RoleAssignment` walking later only touches this method's body"). This spec makes that swap real, for the `CLUB` scope only:

```java
// backend/src/main/java/com/cricketlegend/config/AccessService.java (amended)
package com.cricketlegend.config;

import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * Per docs/specs/015-person-status-and-role-assignment.md: the flat {@code platform_admin} check
 * this method has carried since docs/specs/012-club-profile.md stays exactly as-is — it's the
 * vendor/system-operator persona, still checked directly against a Keycloak realm role, still a
 * superset/override of everything else this method checks. What's new is the second branch: a real
 * {@code RoleAssignment} lookup, resolving the caller's {@link com.cricketlegend.domain.Person} by
 * the JWT's {@code sub} claim (via {@code Authentication.getName()}, the same JWT-subject-as-name
 * precedent docs/specs/013-centralized-logging.md's {@code RequestCorrelationFilter} already
 * relies on) and checking for a {@code CLUB_ADMIN} grant scoped to this {@code clubId}.
 *
 * <p><b>Known, honest limitation as of this spec:</b> {@link com.cricketlegend.domain.Person#
 * getKeycloakUserId()} is still nullable and unset everywhere in this codebase (deliberately, per
 * docs/specs/014-subscription-responsible-contact.md's own Non-goals) — no Person row carries one
 * yet. The RoleAssignment branch below is correct but effectively unreachable in production until
 * the next spec (Keycloak account provisioning) starts setting that column on first login. Until
 * then, {@code platform_admin} remains what's actually load-bearing for every existing
 * {@code @PreAuthorize}-guarded call site, exactly as it was before this spec.
 */
@Component("access")
public class AccessService {

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;

    public AccessService(
            PersonRepository personRepository, RoleAssignmentRepository roleAssignmentRepository) {
        this.personRepository = personRepository;
        this.roleAssignmentRepository = roleAssignmentRepository;
    }

    public boolean canAdministerClub(Authentication authentication, UUID clubId) {
        if (authentication == null) {
            return false;
        }
        boolean isPlatformAdmin = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_platform_admin"::equals);
        if (isPlatformAdmin) {
            return true; // superset/override — platform_admin is untouched by this spec
        }
        return personRepository
                .findByKeycloakUserId(authentication.getName())
                .map(person -> roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .orElse(false);
    }
}
```

`PersonRepository` gains the one lookup this needs, matching `002`'s own original `KeycloakJwtConverter` sketch (`personRepository.findByKeycloakUserId(jwt.getSubject())`) — this spec is the first to actually add the method that sketch assumed would exist:

```java
// backend/src/main/java/com/cricketlegend/repository/PersonRepository.java (amended)
Optional<Person> findByKeycloakUserId(String keycloakUserId);
```

No change to `SecurityConfig`'s `JwtAuthenticationConverter` — `authentication.getName()` already returns the JWT `sub` claim for a `JwtAuthenticationToken` with no converter change needed, exactly as `013-centralized-logging.md`'s `RequestCorrelationFilter` already established for the same claim.

## API Contract

None. This spec introduces no controller, no new or changed endpoint, and no DTO. `AccessService.canAdministerClub`'s method signature is unchanged — it's already used by `012`'s `PUT /api/v1/platform/clubs/{id}/profile` endpoint's `@PreAuthorize("@access.canAdministerClub(authentication, #id)")` expression; only that method's internal behavior changes, invisibly to every existing caller (a `platform_admin` caller sees no behavior change at all — see the AccessService Javadoc above for why).

## UI Requirements

None. This spec is entirely backend/data-model — no admin screen to grant, view, or revoke a `RoleAssignment`, and no UI reads `Person.status` anywhere. See Non-goals for the explicit "this is a real gap, not an oversight" framing.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `PersonServiceImplTest` (extended) — `findOrCreatePerson` sets `status = ACTIVE` on a newly-created `Person`; a `Person` found by existing email keeps its own stored `status` untouched (including a `SUSPENDED` one, asserting the "link, don't overwrite" rule now also covers `status`, not just `firstName`/`lastName`/`phone`). `AccessServiceTest` (rewritten for the new constructor) — `platform_admin` authority returns `true` regardless of any `RoleAssignment` state (mocked repositories return nothing/false); a `Person` holding a `CLUB_ADMIN` `RoleAssignment` scoped to the matching `clubId` returns `true`; the same `Person`/role against a *different* `clubId` returns `false`; a `Person` holding only `MANAGER` or `PLAYER` (no `CLUB_ADMIN`) returns `false`; no `Person` found for the caller's `keycloakUserId` (the everyday case today, per the Javadoc's known limitation) returns `false` rather than throwing; `null` `Authentication` still returns `false`, unchanged from before this spec. |
| Integration | `PersonRepositoryTest` (extended, Testcontainers) — `010-add-person-status.sql` applies cleanly against a seeded pre-existing `person` row (inserted before the migration runs) and backfills it to `status = 'ACTIVE'` with no manual step; inserting a `NULL` `status` fails at the DB level. `RoleAssignmentRepositoryTest` (new, Testcontainers) — `011-add-role-assignment.sql` applies cleanly after `010`; the `person_id` FK is enforced; the unique index rejects an exact duplicate grant (same `person_id`/`role`/`scope_type`/`scope_id`) but allows two *different* grants for the same `person_id` (different `role` and/or `scope_type`/`scope_id`) to coexist — the concrete assertion proving the "multiple roles per Person" concern is actually solved, not just documented; the `CHECK` constraint rejects a non-`PLATFORM` row with a `NULL` `scope_id`. |
| Contract | Not applicable — no endpoint or DTO changes; the checked-in OpenAPI schema is untouched by this spec. |
| Component / E2E | Not applicable — no frontend or UI surface (`docs/standards/testing.md`'s Component/E2E tiers are both frontend-facing), same posture `013-centralized-logging.md` took for its own backend-only scope. |

## Acceptance Criteria

- A `Person` created via `PersonService.findOrCreatePerson` (the existing `014` flow, e.g. by creating a Subscription) has `status = ACTIVE`, verifiable by reading its stored row.
- A `Person` subsequently *found* by email (not created) via `findOrCreatePerson` keeps its existing `status` untouched — a `SUSPENDED` `Person`'s status stays `SUSPENDED` even when re-linked as a new Subscription's responsible party (flagged judgment call, see Data Model Changes).
- No code path in this spec's implementation ever sets `PersonStatus.PENDING` — verifiable by reading `PersonServiceImpl` end to end; the only reference to `PENDING` anywhere in the codebase is the enum declaration and its own Javadoc.
- A `Person` can hold more than one `RoleAssignment` row at once — verifiable by a Testcontainers test inserting two rows for the same `person_id` with different `role`/`scope_type`/`scope_id`, confirming both persist and both are returned by `findByPersonId`.
- `AccessService.canAdministerClub(authentication, clubId)` returns `true` for an authenticated principal carrying `platform_admin`, regardless of any `RoleAssignment` state.
- `AccessService.canAdministerClub(authentication, clubId)` returns `true` for a `Person` holding a `CLUB_ADMIN` `RoleAssignment` scoped to that exact `clubId`, and `false` for the same `Person` checked against a different `clubId`.
- `AccessService.canAdministerClub(authentication, clubId)` returns `false` for a `Person` holding only a `MANAGER` or `PLAYER` grant — no role beyond `CLUB_ADMIN` currently satisfies club administration.
- Every existing `person` row is backfilled to `status = 'ACTIVE'` by migration `010`, with no `NULL` statuses remaining and no manual data-fix step required by whoever deploys this.
- The `role_assignment` table's unique index rejects an exact duplicate grant (same `person_id`/`role`/`scope_type`/`scope_id`) at the DB level.
- No new endpoint, controller, DTO, or UI surface is introduced by this spec — verifiable by diffing `backend/src/main/java/com/cricketlegend/controller/` and `ui/src/` for this PR.
- `SecurityConfig`'s `/api/v1/platform/**` URL gate and `platform_admin` role check are byte-for-byte unchanged by this spec.

## Rollout Notes

- Migrations `010-add-person-status.sql` and `011-add-role-assignment.sql` are the next two sequential migrations after `009-subscription-responsible-person.sql` (the current highest-numbered file in `backend/src/main/resources/db/changelog/v1/` as of this spec).
- Ships as its own PR, independent of any other in-flight spec — amends `012`'s already-merged `AccessService` and `014`'s already-merged `Person`/`PersonService`/`PersonRepository`, no dependency on unmerged work from either.
- **`001-tenancy-identity-model.md`'s `RoleAssignment` Field Reference row gains a footnote**, mirroring exactly how `014` added one to `001`'s `Person` row — see that file's own diff alongside this spec.
- **`docs/roadmap.md` is updated alongside this spec** — the "Blocked on the full tenancy model" section's `RoleAssignment` framing no longer applies wholesale (it's real now, for `CLUB` scope); the still-blocked `SECTION`/`TEAM` resolution and the still-missing "grant a RoleAssignment" UI are called out as their own, narrower entries. See that file's own diff.
- **Flag for the next spec (Keycloak account provisioning / invite-and-activate):** when a Subscription's responsible `Person` is provisioned a real account, that spec should call `RoleAssignmentRepository.save(...)` (or a light `RoleAssignmentService` wrapper if one gets introduced then) to create a `CLUB_ADMIN` grant scoped to the Subscription's owning `Club`, and should set `Person.keycloakUserId` on first successful login — the `NOT NULL`/unique-index/`CHECK` constraints this spec ships already support both without any further schema change. That same spec is also what makes `AccessService.canAdministerClub`'s `RoleAssignment` branch actually reachable in production (see the method's own Javadoc above) — until then, it's correct but dormant.
- **Flag for whenever `Section`/`Team` are built for real:** `ScopeType.SECTION`/`ScopeType.TEAM` are reserved enum values, not resolved by anything here. `001`'s own worked example implies `role` and `scope_type` are orthogonal in the original design — a `CLUB_ADMIN`-shaped "administrator" grant reused at `scope_type = SECTION` for a Juniors-section admin, rather than inventing a dedicated role name per scope level. This spec adopts that reading as the intended future direction but doesn't build or test it — re-read `001`'s scope-walk rule fresh at that point, same caution `009`'s own Rollout Notes gave for `SECTION`-owned Subscriptions.
- **The "grant a RoleAssignment" UI gap is real and unscheduled.** No admin screen exists to create these rows at all outside a future spec's own direct repository call. Worth a human deciding whether this becomes its own small spec (a "Role Assignments" admin screen, listable/filterable by Person or scope) or rides along inside the Keycloak-provisioning spec as a narrower "grant CLUB_ADMIN on account activation" step with no general-purpose UI. Not decided here.
