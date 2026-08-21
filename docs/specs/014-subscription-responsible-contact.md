# 014 — Subscription Responsible Contact

**Depends on:** `009-subscriptions.md` (the `Subscription` entity and its `POST`/`PUT /api/v1/platform/subscriptions` endpoints — this spec amends both again, replacing what an earlier draft of this same spec already built on them), `001-tenancy-identity-model.md` (`Person` — Global scope, the minimal stub this spec grows into a real, login-capable identity shape, the same incremental-growth pattern `Club` followed across `010`/`011`/`012`), `003-club-onboarding.md` (`Invitation`'s "an invited person who already has an account attaches to my *existing* `Person`, I never end up with two accounts" resolution-by-email precedent — this spec's `PersonService` find-or-create is a slice of that same concern, built here first, ahead of `003`'s own `Invitation` implementation), `011-inline-club-creation-in-subscription-form.md` (`ClubPicker`'s exact "search existing / add inline, deferred until the whole form submits" UX pattern this spec's `PersonPicker` mirrors), `012-club-profile.md` (the generic-embeddable / "one component, two audiences" reasoning pattern this spec's `Person`-vs-`Contact` split mirrors, and `PhoneInput`, reused unchanged below).
**Status:** draft — supersedes an earlier draft of this same spec that was partially implemented (see Rollout Notes for exactly what's being replaced and why).

## Problem & Goals

`009-subscriptions.md` links a `Club` to a `Product` — owner, product, status, dates — but records no human accountable for it. An earlier version of this spec closed that gap with a bespoke, embedded `Contact` value object (first name/last name/email/phone) directly on `Subscription`, and that version was partially built. Mid-implementation, a live design discussion surfaced the real question this spec now answers instead: the responsible party isn't a throwaway contact fact, it's a **future login**. This platform already has a confirmed, non-speculative future need — a self-serve signup flow (`docs/roadmap.md`'s "Next up — self-serve signup" section) — where the person accountable for a Subscription registers, then logs back in later to manage it. That's exactly what `001-tenancy-identity-model.md`'s `Person` entity is for: "one row per human, forever," the identity anchor everything else — including a future Keycloak login — hangs off. A bespoke `Contact` type would have modeled the wrong concept and needed unwinding later; this spec builds the right one now, while `Person` is still an all-but-unused stub (confirmed zero rows in the current database, referenced from exactly two places in code) and safe to reshape.

**Goals**
- `Subscription` gains a required `responsiblePersonId` — a real `Person`, not a bespoke embedded contact — because this responsible party is specifically, already-confirmed meant to log in later, not a speculative "might need auth someday" guess.
- `Person` grows from its current minimal stub (`id`, `keycloak_user_id?`, `full_name`) into a real identity shape — `first_name`, `last_name`, `email`, `phone?` — sufficient for both login and for personalized notification templates (`Hi Jaco, thank you for signing up`) a later notifications spec will need, without forcing that spec to touch `Person` itself.
- Creating a Subscription resolves its responsible party through **find-or-create by email** — the same "don't create a second `Person` for an email that already has one" guarantee `003-club-onboarding.md`'s `Invitation` promises, built here first as a reusable `PersonService` primitive rather than a `Subscription`-specific special case.
- The UI reuses the established "pick an existing record or create one inline, deferred until the whole form submits" pattern `ClubPicker` (`011`) already proved out, rather than inventing a second interaction pattern for the same underlying need.
- `Contact`/`ContactDto` (already built in this codebase, currently unused) stay exactly as they are — untouched, reserved for a future "Club Contacts" spec whose entries genuinely never need login.

## Non-goals

- **`RoleAssignment` / any administrative capability grant.** A `Person` existing — whether resolved by this spec's find-or-create or created fresh — implies zero administrative capability. `RoleAssignment` is `001`'s own, separate, later concern, still blocked per `docs/roadmap.md`'s "Blocked on the full tenancy model" section. This spec does not touch it and does not imply it's coming as a side effect of a Subscription's responsible party existing.
- **Any change to `Contact`/`ContactDto`.** `backend/src/main/java/com/cricketlegend/domain/Contact.java` and `dto/ContactDto.java` stay exactly as built, completely unused by this spec — reserved for the future "Club Contacts" spec (`012`'s Rollout Notes already named this follow-up), where most entries genuinely never need login. `Person` and `Contact` are different concepts, not a hierarchy: `Person` is the identity/auth anchor for anyone who has or will have system access; `Contact` is a lightweight "how to reach this human" fact with no inherent login capability. See Data Model Changes for how the two stay bridged only implicitly, by email — never a schema-level FK.
- **Keycloak account linkage.** `Person.keycloakUserId` stays exactly as it is today — nullable, unset by this spec. Actually provisioning a Keycloak user for a responsible party is the self-serve signup flow itself (`docs/roadmap.md`), not built here.
- **Notification/email sending of any kind.** `Person.email`/`phone` exist so a future notifications spec (`docs/roadmap.md`'s "Next up — notifications / email infrastructure") has something real to send to — no SMTP config, provider integration, or template mechanism is added here. Confirmed by grep (same check the earlier draft of this spec already ran): no matches for `JavaMailSender`/`smtp`/`SendGrid`/`Postmark`/`spring.mail`/`AmazonSimpleEmailService` anywhere in this codebase.
- **`Person.dateOfBirth`.** `001`'s original `Person` Field Reference row listed `date_of_birth`, but it was never actually built in code (`Person.java` has never had this field). This spec doesn't add it either — not needed for a Subscription's responsible party, and adding it now would be scope creep unconnected to this spec's actual goal. See the `001` edit below for exactly how its Field Reference row is worded now.
- **Editing an existing `Person`'s own fields through this spec's UI.** `PersonPicker` (below) only ever sets a new `Person`'s name/phone at the moment of *creating* them. An existing `Person` found by email is linked read-only from this form's perspective — see Data Model Changes' "link, don't overwrite" decision for why.
- **A standalone Person management screen or full CRUD surface.** No list/edit page for `Person` is built here — only `GET /api/v1/platform/persons` (search, for the picker) exists; no `POST`/`PUT`/`DELETE` is exposed directly. The same "no generalized abstraction until a second real consumer needs it" restraint `011`'s own Non-goals applied to `ClubPicker` applies here to `Person` management itself.
- **Changing a Subscription's responsible person after creation.** `PUT /api/v1/platform/subscriptions/{id}` cannot reassign who's responsible — see Data Model Changes / API Contract for the full reasoning. **Flagged as a judgment call** — if reassignment turns out to be a real, recurring need, it should be its own explicit action/endpoint, not a silent side effect of an unrelated field edit. Not built here.
- **Concurrency handling for two simultaneous find-or-create calls racing on the same brand-new email.** Two admins creating a Subscription for the same not-yet-known person at almost the same instant could both miss the email lookup and both attempt an insert; the DB's unique index on `lower(email)` prevents a duplicate row but means one of the two requests fails rather than silently retrying. Accepted as a rare-edge-case limitation of this pass, not solved with application-level locking here — the same posture `011`'s Rollout Notes already accepted for `ClubPicker`'s own non-atomic two-step create.
- **`SECTION`-owned subscriptions, payment/invoice processing, usage-limit enforcement, automatic expiry/renewal, self-serve subscription changes, `Product.maxPeriodMonths` enforcement, or proration/billing-cycle mechanics.** All already ruled out by `009`'s own Non-goals, none reopened here.

## User Stories

- As a platform admin creating a Subscription, I can search for an existing person by name or email and select them as the responsible party, so I don't create a duplicate identity for someone the system already knows.
- As a platform admin, if the responsible person isn't found, I can add their first name, last name, email, and phone inline without leaving the Subscription form — they become a real `Person` the moment the Subscription is actually created, not before.
- As a platform admin, I never end up with two `Person` records for the same email — typing or selecting an email that already belongs to an existing `Person` always links to that same `Person`, using their existing name/phone even if I typed something different for those fields.
- As a platform admin, I can see a Subscription's responsible person — name, email, phone — on its record.
- As a platform admin editing an existing Subscription, I can change its Product or dates without any risk of silently reassigning who's responsible for it — that's not something an unrelated field edit does.
- As the person who's actually accountable for a Subscription, the `Person` record created for me today is the same one a future self-serve login would resolve to — nothing about this spec needs rebuilding when that flow ships.

## Data Model Changes

**`Person` grows from its current stub into a real identity shape.** Today (`backend/src/main/java/com/cricketlegend/domain/Person.java`): `id`, `keycloak_user_id?`, `full_name` — its own Javadoc already calls this "NOT the full identity entity from `001`... minimal prerequisite stub," referenced from exactly two places in code (`SecurityConfig.java`, `PersonRepository.java`) and confirmed to have zero rows in the current database. This spec is what grows it, the same way `Club` grew incrementally across `010`/`011`/`012` rather than being fully modeled up front:

```java
// backend/src/main/java/com/cricketlegend/domain/Person.java (amended)
@Entity
@Table(name = "person")
public class Person {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "keycloak_user_id", unique = true)
    private String keycloakUserId;   // unchanged — still nullable, still unset by this spec
}
```

- `full_name` is dropped entirely, replaced by `first_name`/`last_name` — split specifically so a future notification template can address someone by first name alone ("Hi Jaco, thank you for signing up"), not just because it's the more normalized shape.
- `first_name`/`last_name`/`email` are required — matches the "always know who this is" intent that started this whole redesign; a `Person` that exists at all should always be addressable and reachable.
- `email` is new and required — the reason this spec exists: a future login needs a real, unique-enough identifier to authenticate against.
- `phone` is new and optional — never asked to be mandatory, unlike the other three.
- `date_of_birth`, present in `001`'s original (never-built) Field Reference row, is deliberately not added — see Non-goals.

**Migration** (next sequential file after `007-add-subscription-responsible-contact.sql` — `008` was never committed or applied anywhere; see Rollout Notes for why the sequence restarts there, not at `009`):

```sql
-- backend/src/main/resources/db/changelog/v1/008-restructure-person-identity.sql
ALTER TABLE person
    DROP COLUMN full_name,
    ADD COLUMN first_name VARCHAR(255) NOT NULL,
    ADD COLUMN last_name  VARCHAR(255) NOT NULL,
    ADD COLUMN email      VARCHAR(255) NOT NULL,
    ADD COLUMN phone      VARCHAR(32);

CREATE UNIQUE INDEX ux_person_email_lower ON person (lower(email));
```

Safe as a single-step migration with no backfill — `person` has zero rows today, so `ADD COLUMN ... NOT NULL` with no default is valid; there's nothing to violate the constraint. The case-insensitive unique index is what `PersonService`'s find-or-create (below) relies on, and what makes email a safe anchor for a future Keycloak login (no two `Person`s can silently claim the same address in different casings).

**New service — `PersonService`/`PersonServiceImpl`**, following `docs/standards/backend.md`'s controller → service (iface+impl) → repository skeleton:

```java
public interface PersonService {
    Person findOrCreatePerson(String firstName, String lastName, String email, String phone);
}

@Service
public class PersonServiceImpl implements PersonService {
    private final PersonRepository personRepository;

    @Override
    public Person findOrCreatePerson(String firstName, String lastName, String email, String phone) {
        return personRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> personRepository.save(Person.builder()
                        .firstName(firstName)
                        .lastName(lastName)
                        .email(email)
                        .phone(phone)
                        .build()));
    }
}
```

**"Link, don't overwrite" — a real design decision, stated plainly so a reviewer can see and challenge it, not an assumption baked in quietly.** If `findByEmailIgnoreCase` finds an existing `Person`, that row is returned exactly as stored — the incoming `firstName`/`lastName`/`phone` are discarded, never applied. A `Person` found by email is presumably that human's own authoritative record by then (they may have since corrected a typo'd name, changed their number, or simply be a different `Subscription`'s admin typing slightly differently). A Subscription-creation form is the wrong place to silently edit someone else's identity — if that person's own details need correcting, that's a `Person`-editing capability this spec deliberately doesn't build (see Non-goals), not something that happens as a side effect of an unrelated form submission.

`PersonRepository` gains what this needs:

```java
public interface PersonRepository extends JpaRepository<Person, UUID> {
    Optional<Person> findByEmailIgnoreCase(String email);

    @Query("select p from Person p where lower(p.firstName) like lower(concat('%', :search, '%')) "
         + "or lower(p.lastName) like lower(concat('%', :search, '%')) "
         + "or lower(p.email) like lower(concat('%', :search, '%'))")
    Page<Person> search(@Param("search") String search, Pageable pageable);
}
```

**`Subscription` gains a required `responsiblePersonId`, replacing `responsibleContact` entirely.** The earlier draft of this spec embedded a `Contact` directly on `Subscription` (`@Embedded responsibleContact`, backed by `responsible_contact_*` columns from `007`/`008`) — that approach was implemented once already, mid-discussion, and is discarded here, not extended. "1 Subscription = 1 Person" — a straightforward required 1:1 FK, not a list:

```java
// backend/src/main/java/com/cricketlegend/domain/Subscription.java (amended)
@Column(name = "responsible_person_id", nullable = false)
private UUID responsiblePersonId;   // plain FK column, no @ManyToOne — matches this codebase's
                                     // existing convention (ownerId/productId are the same shape)
```

**Second migration**, applying after `009` above:

```sql
-- backend/src/main/resources/db/changelog/v1/009-subscription-responsible-person.sql
ALTER TABLE subscription ADD COLUMN responsible_person_id UUID REFERENCES person(id);

-- Resolve every existing subscription's embedded contact (real or the 008 placeholder) into a
-- Person row, deduping by email exactly the way PersonService.findOrCreatePerson does at
-- request time — two subscriptions sharing the placeholder unknown@test.co.za, or any other
-- repeated email, collapse into one Person, not one each.
INSERT INTO person (id, first_name, last_name, email, phone)
SELECT gen_random_uuid(),
       min(s.responsible_contact_first_name),
       min(s.responsible_contact_last_name),
       lower(s.responsible_contact_email),
       min(s.responsible_contact_phone)
FROM subscription s
WHERE NOT EXISTS (
    SELECT 1 FROM person p WHERE lower(p.email) = lower(s.responsible_contact_email)
)
GROUP BY lower(s.responsible_contact_email);

UPDATE subscription s
SET responsible_person_id = p.id
FROM person p
WHERE lower(p.email) = lower(s.responsible_contact_email);

ALTER TABLE subscription ALTER COLUMN responsible_person_id SET NOT NULL;

ALTER TABLE subscription
    DROP COLUMN responsible_contact_first_name,
    DROP COLUMN responsible_contact_last_name,
    DROP COLUMN responsible_contact_email,
    DROP COLUMN responsible_contact_phone;
```

Two files, not one — `008` restructures `person` (safe, zero rows), `009` migrates `subscription` off the columns `007` added (not safe to assume zero rows, hence the backfill) — matching this codebase's own "never edit an already-applied Liquibase changeset" discipline: `007` is already committed (part of the discarded draft, PR #12) so it's amended-forward by a later file, never edited in place. `Contact.java`/`ContactDto.java` themselves are untouched by either migration — they're generic embeddables with no table of their own; only `Subscription`'s use of them is removed.

**`PersonDto`**, the read shape `SubscriptionDto` and any future consumer reuse directly:

```java
public record PersonDto(UUID id, String firstName, String lastName, String email, String phone) {
}
```

**`SubscriptionDto` gains `responsiblePerson`, replacing `responsibleContact`:**

```java
public record SubscriptionDto(
        UUID id,
        SubscriptionOwnerType ownerType,
        UUID ownerId,
        ClubSummaryDto club,
        ProductSummaryDto product,
        SubscriptionStatus status,
        LocalDate startDate,
        LocalDate endDate,
        PersonDto responsiblePerson,   // replaces ContactDto responsibleContact — never null post-migration
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
```

**`CreateSubscriptionRequest` takes wire-shaped input, not a `personId` the caller can't yet have:**

```java
public record ResponsiblePersonRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        String phone) {   // optional, matching Person.phone
}

public record CreateSubscriptionRequest(
        @NotNull SubscriptionOwnerType ownerType,
        @NotNull UUID ownerId,
        @NotNull UUID productId,
        LocalDate startDate,
        LocalDate endDate,
        @NotNull @Valid ResponsiblePersonRequest responsiblePerson) {
}
```

`SubscriptionServiceImpl.create()` resolves the `Person` before saving:

```java
Person responsiblePerson = personService.findOrCreatePerson(
        request.responsiblePerson().firstName(),
        request.responsiblePerson().lastName(),
        request.responsiblePerson().email(),
        request.responsiblePerson().phone());
Subscription subscription = subscriptionMapper.toEntity(request);
subscription.setResponsiblePersonId(responsiblePerson.getId());
subscription = subscriptionRepository.save(subscription);
```

Whether the request's email matched an existing `Person` or created a new one is invisible to the caller either way — `findOrCreatePerson` is unconditionally safe to call, which is exactly what lets the UI (below) skip a separate "does this email already exist?" round trip.

**`UpdateSubscriptionRequest` drops `responsibleContact`/any person-related field entirely — a deliberate, flagged judgment call.** `PUT /api/v1/platform/subscriptions/{id}` can change `productId`/`startDate`/`endDate` but has no way to touch `responsiblePersonId` at all, not even to leave it "as-is via omission" the way the discarded draft's `PUT` semantics worked for `responsibleContact`:

```java
public record UpdateSubscriptionRequest(
        @NotNull UUID productId, LocalDate startDate, LocalDate endDate) {
}
```

**Why:** reassigning who's accountable for a Subscription is a bigger identity operation than editing a subscription's own fields — closer in kind to a transfer-of-ownership action than a routine edit. Folding it into the same endpoint as a Product/date change risks it happening as an unintended side effect of an admin re-saving the form for an unrelated reason. If reassignment turns out to be a real, recurring operational need, it should get its own explicit action/endpoint (e.g. `POST /subscriptions/{id}/reassign-responsible-person`) that makes the intent unambiguous — not built here, flagged for whoever needs it next.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/platform/subscriptions` | `platform_admin` | Same path as `009`/the discarded draft. Payload's `responsiblePerson` (`firstName`/`lastName`/`email`/`phone?`) replaces the old `responsibleContact` shape — resolved via `PersonService.findOrCreatePerson` before the Subscription row is saved, so the caller never needs to already know a `personId`. Response's `responsiblePerson` is the resolved `PersonDto` (real `id` included). |
| `PUT /api/v1/platform/subscriptions/{id}` | `platform_admin` | No `responsiblePerson`/person-related field in the payload at all — who's responsible cannot be changed through this endpoint (judgment call, see Data Model Changes). Response still returns the unchanged `responsiblePerson`. |
| `GET /api/v1/platform/subscriptions` / `GET /api/v1/platform/subscriptions/{id}` | `platform_admin` | Read-shape change only: `SubscriptionDto.responsiblePerson` is always populated post-migration — never `null`, for a Subscription created before or after this spec ships. |
| `GET /api/v1/platform/persons` | `platform_admin` | **New.** Search-by-name-or-email, paginated (`search?`, `page`, `size`) — backs `PersonPicker`'s on-focus/debounced search, mirroring `GET /api/v1/platform/clubs`'s reuse by `ClubPicker` (`011`). No `POST`/`PUT`/`DELETE` on this resource — `Person` creation only ever happens implicitly, through `PersonService.findOrCreatePerson` as part of `POST /subscriptions`, never through a direct write endpoint in this spec. |

`POST /subscriptions/{id}/cancel` is untouched — cancelling doesn't change the responsible person.

## UI Requirements

Extends `ui/src/components/SubscriptionForm/` — no new page, no new route, matching `009`'s "one form, two modes" shape and `011`'s precedent of extending that same form rather than building a new surface.

- **New shared component: `ui/src/components/PersonPicker/`** (four-file anatomy per `docs/standards/frontend.md`), mirroring `ClubPicker`'s (`011`) exact interaction pattern rather than inventing a new one — this codebase already solved "pick an existing X or create one inline," reused here, not redesigned:

  ```ts
  export type PersonPickerValue =
    | { mode: 'existing'; id: string; firstName: string; lastName: string; email: string; phone: string | null }
    | { mode: 'new'; firstName: string; lastName: string; email: string; phone: string }
    | null
  ```

  - **Create mode is the default** — First name / Last name / Email (`EmailInput`) / Phone (`PhoneInput`) fields are visible immediately, no search step first. **Revised after real-world use** (this component originally mirrored `ClubPicker`'s search-first pattern, matching the "no-results affordance" text this replaces): creating a Subscription almost always means a brand-new responsible person, not one who already exists in the system. Search-first made the common case the awkward one — the on-focus default list is rarely empty, so the old "only offer + Add when zero results" affordance was effectively never reachable in practice. `ClubPicker` itself is unaffected by this change and keeps its own search-first pattern, since clubs don't have the same "almost always new" skew a Subscription's responsible person does.
  - **"Link to an existing person instead"** — a secondary affordance, always visible below the create-mode fields, for the real but rarer case where this person already manages another Club. Switches to search mode.
  - **Search mode** (secondary, entered only via the affordance above): on focus, shows up to 10 people via `GET /api/v1/platform/persons?size=10` (no status filter needed — `Person` has no lifecycle field the way `Club` does); typing re-queries the same endpoint with `search`, same debounce timing `ClubPicker` established. Each option renders as "First Last — email". A **"Create a new person instead" affordance is always visible here too** — deliberately *not* gated on the result set being empty (that gating is exactly the old design's flaw) — and carries over the same pre-fill heuristic the old "+ Add" affordance used: the typed query becomes the email if it looks like one (contains `@`), otherwise it's treated as a name hint. Leaving search with nothing typed preserves whatever create-mode draft already existed rather than discarding it.
  - **Selecting an existing person** renders their `firstName`/`lastName`/`email`/`phone` as disabled/read-only display fields, never editable from this component — the UI's own visible reinforcement of the backend's "link, don't overwrite" rule, not just a server-side guarantee the admin can't see, and the explicit point where the admin can confirm they're about to link an existing identity (relevant if that person is already responsible for another Club) before submitting. A "Change" affordance clears back to create mode (the default), not search.
  - **Deliberately, structurally different from `ClubPicker` in one way, flagged here rather than left implicit:** `ClubPicker`'s "new" draft requires a separate `POST /clubs` call before `POST /subscriptions`, because Club creation has its own real validation/conflict surface (reserved slugs, duplicate slugs). `PersonPicker`'s "new" draft needs **no separate create call at all** — the four typed fields travel directly inside `CreateSubscriptionRequest.responsiblePerson`, and `PersonService.findOrCreatePerson` resolves them server-side as part of the single `POST /subscriptions` request. If the typed email happens to already belong to an existing `Person` by the time the request lands, the backend just links to it silently — the same "link, don't overwrite" behavior applies uniformly whether the UI thought it was searching or creating. `PersonPicker`'s "create mode" is honestly closer to "compose part of the request" than "create anything" — nothing is created until the whole Subscription form submits, satisfying the same "no orphan record from an abandoned form" requirement `ClubPicker` established, but for a structurally different (idempotent-resolution) reason.
  - Nothing in this component calls any endpoint to create a Person — matching the existing convention that shared form components own no mutations of their own.
- **`ui/src/components/SubscriptionForm/SubscriptionForm.tsx`**:
  - **Create mode:** replaces the four flat `contactFirstName`/`contactLastName`/`contactEmail`/`contactPhone` fields — and the `contactTouched` state that governed their "required as a set" validation — with a single `<PersonPicker />`. Submit validation requires either an `existing` selection or a complete `new` draft (`firstName`/`lastName`/`email` non-blank and email-shaped, `phone` optional), matching the backend's `@NotNull @Valid` on `ResponsiblePersonRequest`.
  - **Edit mode:** `PersonPicker` is not rendered at all — mirrors how `ClubPicker` is skipped entirely in edit mode today. Instead, a simple disabled `Input` shows the current responsible person ("First Last — email"), matching the existing disabled-Club-field pattern already used for the immutable owning Club. This is a real simplification versus the discarded draft's edit-mode design (which needed `contactTouched` to support "leave it, edit it, or clear it") — there is no more edit-mode contact interaction at all, since `PUT` can't touch this field (see API Contract).
- **`ui/src/pages/admin/SubscriptionFormPage.tsx`**: no new sequencing step for the responsible person — unlike the Club draft (which still needs its own `POST /clubs` before `POST /subscriptions` when a new-club draft is present, unchanged from `011`), the person's fields simply ride along inside the one `POST /subscriptions` payload. When both a new Club draft and a new Person draft are present in the same submit, the flow stays exactly `011`'s existing two-step (`POST /clubs` → `POST /subscriptions`) — the Person resolution happens for free inside that second call, no third step added.
- **New frontend API home — `ui/src/api/personApi.ts`** (not appended to `subscriptionApi.ts`), following `docs/standards/frontend.md`'s "one file per backend resource" convention — `Person` now has its own backend endpoint (`GET /persons`), unlike the discarded draft's `Contact`, which piggybacked on `subscriptionApi.ts` for lack of one:

  ```ts
  export interface Person {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }

  export interface ResponsiblePersonInput {
    firstName: string
    lastName: string
    email: string
    phone: string
  }

  export async function listPersons(params: { search?: string; page: number; size?: number }): Promise<Page<Person>> { /* ... */ }
  ```

  `ui/src/api/subscriptionApi.ts` drops its `Contact` interface/re-export entirely; `Subscription.responsiblePerson: Person` (imported from `personApi.ts`, never `null` post-migration); `SubscriptionPayload.responsiblePerson: ResponsiblePersonInput` (required); `UpdateSubscriptionPayload` drops `responsibleContact` entirely, matching the backend's `UpdateSubscriptionRequest`.
- **`EmailInput`/`PhoneInput` are unchanged, reused as-is inside `PersonPicker`'s create mode** — both are already generic, format-agnostic thin wrappers around `Input`, not `Contact`-specific despite originating alongside the discarded draft's UI work; nothing about this spec's redesign invalidates them.
- **Mobile-first**, per `docs/standards/frontend.md` — `PersonPicker` inherits the same responsive field-grid/full-row-span behavior `ClubPicker` already established, no new breakpoint handling needed.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `PersonServiceImplTest` — `findOrCreatePerson` creates a new `Person` when no email match exists; returns the existing `Person` unchanged (asserting `firstName`/`lastName`/`phone` are *not* overwritten) when a case-insensitive email match exists (`Jaco@Example.com` matches a stored `jaco@example.com`); `SubscriptionServiceImplTest` — `create()` resolves `responsiblePerson` via `PersonService` and stores its `id` as `responsiblePersonId`; `update()` never accepts or touches `responsiblePersonId` (no such field exists on `UpdateSubscriptionRequest` to even attempt it); `PersonMapper`/`SubscriptionMapper` DTO round-trips correctly. |
| Integration | `PersonRepositoryTest` (Testcontainers) — `008-restructure-person-identity.sql` applies cleanly; inserting a `NULL` `first_name`/`last_name`/`email` fails at the DB level; inserting two rows differing only by email casing violates the `ux_person_email_lower` unique index. `SubscriptionRepositoryTest` — `009-subscription-responsible-person.sql` applies cleanly after `008` against a seeded `subscription` table with pre-existing `responsible_contact_*` data (including two rows sharing the same placeholder email), and the resulting `person` table has exactly one row per distinct email, not one per subscription; `responsible_person_id` is `NOT NULL`-enforced and the four old `responsible_contact_*` columns no longer exist. |
| Contract | `CreateSubscriptionRequest`/`SubscriptionDto`/`PersonDto`/`ResponsiblePersonRequest` schema changes, and the new `GET /persons` endpoint, reflected in the checked-in OpenAPI schema; `UpdateSubscriptionRequest`'s schema confirmed to carry no contact/person field at all. |
| Component | `PersonPicker.test.tsx` (mirroring `ClubPicker.test.tsx`'s structure where the two components' behavior actually overlaps) — defaults to create mode with blank First/Last/Email/Phone fields and no fetch; "Link to an existing person instead" switches to search mode, which on focus requests and renders up to 10 people from `GET /api/v1/platform/persons`, typing re-queries with `search`; selecting an existing person renders their fields read-only/disabled; "Create a new person instead" stays visible in search mode regardless of whether results are present (the regression test for the original search-first design's core flaw); discarding a selection returns to create mode, not search, with no side effects; Storybook stories at 375/768/1280 for both modes, per `docs/standards/design-system.md`. `SubscriptionForm.test.tsx` (extended) — create mode renders `PersonPicker` in place of the four flat fields and the submitted payload's `responsiblePerson` shape is correct for both an existing selection and a new draft; edit mode renders the responsible person as a disabled display only, with no interactive element for it at all. |
| E2E | Extends `009`/`011`'s existing golden path (Playwright, not wired into CI, same precedent as `009`–`013`): creating a Subscription searches for a person with no match, adds one inline via `PersonPicker`, submits, and the created Subscription's detail view shows that person as responsible; a second Subscription created against the same person's email (searched and selected this time, not retyped) confirms the picker surfaces them as an existing match rather than offering to create a duplicate. |

## Acceptance Criteria

- Creating a Subscription without a responsible person (no `existing` selection and no complete `new` draft) is rejected — `400` server-side, blocked client-side before submit.
- Selecting or typing an email that already belongs to a `Person` always links to that exact `Person` — that `Person`'s own stored `firstName`/`lastName`/`phone` are what the created Subscription's `responsiblePerson` shows, even if different values were typed into the form for those fields.
- No two `Person` rows ever exist for the same email (case-insensitive) — enforced at the DB level, not just application logic.
- A newly-created Subscription's `responsiblePerson` is visible on `GET`/list responses immediately after creation, with a real `Person.id`.
- A Subscription created before this spec shipped (i.e. one migrated from the discarded draft's `responsible_contact_*` columns) shows a resolved `responsiblePerson` after migration, not an error or a `null`.
- `PUT /api/v1/platform/subscriptions/{id}` has no way to change which `Person` is responsible for a Subscription — verifiable by reading `UpdateSubscriptionRequest`'s fields, not just by testing behavior.
- No `RoleAssignment`, Keycloak account, or any administrative capability is created as a side effect of a `Person` being created or linked by this spec.
- `Contact.java`/`ContactDto.java` are unmodified by this spec's implementation, and `Subscription` no longer references either.

## Rollout Notes

- **This spec replaces, not extends, an earlier draft of the same file.** That draft embedded a generic `Contact` value object directly on `Subscription` (`Subscription.responsibleContact`, `SubscriptionServiceImpl`'s email-immutable-on-`PUT` handling) and was partially implemented before a design discussion concluded the responsible party should be a real `Person`, not a bespoke `Contact` — because it's specifically, already-confirmed meant to log in later via the future self-serve signup flow. Only one migration from that draft ever reached a commit — `007-add-subscription-responsible-contact.sql` — and it's not reverted (never edit an already-applied Liquibase changeset); `009-subscription-responsible-person.sql` above migrates its data forward into `person` and drops the columns it added. A second migration, `008-subscription-responsible-contact-not-null.sql`, was written and briefly present locally but never committed or applied to any database — it was deleted outright as part of discarding this draft, which is why this spec's own migrations restart the sequence at `008`, not `009`. Anyone reading `009-subscriptions.md`'s already-merged `Subscription`/`SubscriptionServiceImpl` alongside the earlier draft's history should treat this file, not that one, as authoritative going forward.
- **Stale cross-references to flag for whoever implements this spec:** `Contact.java` and `ContactDto.java`'s own Javadoc currently cite this file (`014-subscription-responsible-contact.md`) as their origin and reasoning — accurate for the discarded draft, no longer accurate now. Update those two Javadoc comments to stop citing `014` (they're not built or used by this version of it) and instead describe themselves purely as reserved for the future "Club Contacts" spec, per `012`'s Rollout Notes. Not actioned here — this file doesn't touch code — flagged so it isn't a confusing stale reference once this ships.
- Ships as its own PR, independent of any other in-flight spec, amending `009`'s already-merged `Subscription` entity/screen and `011`'s already-merged `ClubPicker`/`SubscriptionForm` wiring.
- Migrations `008-restructure-person-identity.sql` and `009-subscription-responsible-person.sql` are the next two sequential migrations after `007-add-subscription-responsible-contact.sql` (the only migration from the discarded draft that was ever actually committed).
- **Flag for the future self-serve signup spec** (`docs/roadmap.md`): the `Person` a Subscription resolves to today via `PersonService.findOrCreatePerson` is exactly the `Person` that flow's own eventual "register, then log back in" path should resolve to for the same email — this spec deliberately keeps `email` as the sole resolution key so that flow doesn't need to invent a second lookup mechanism or reconcile two different identities for the same human.
- **Flag for the future notifications/email-infrastructure spec** (`docs/roadmap.md`): `Person.firstName`/`email` are what "Hi Jaco, thank you for signing up" needs — this spec stops at capturing the data, same posture the discarded draft already took, just anchored to `Person` instead of `Contact` now.
- **Flag for the future "Club Contacts" spec** (`012`'s Rollout Notes, still unscoped): its people-list entries should still embed `Contact`/`ContactDto` for name/email/phone, exactly as `012`'s original reasoning intended — this spec doesn't change that plan. If a Club Contact entry ever needs to become login-capable, the bridge is the same one this spec establishes for Subscriptions: whoever builds that invite/upgrade path resolves the contact's email through `PersonService.findOrCreatePerson` (or its equivalent by then) rather than adding a schema-level `person_id` column to `Contact` itself — `Contact`'s actual consumers don't need that solved at the schema level, and speculatively adding it now would be exactly the kind of unused column this spec's own history (the discarded `Contact`-on-`Subscription` design) was a lesson in avoiding.
- `docs/roadmap.md` is updated alongside this spec to reflect this redesign — see that file's own diff for what changed.
- **Legacy NULL-contact `Subscription` rows must be cleared before `009-subscription-responsible-person.sql` runs against a database that already has data.** Confirmed empirically against the local dev database: all `Subscription` rows created via `009-subscriptions.md`'s original flow (before `007`'s `responsible_contact_*` columns existed) have `responsible_contact_email IS NULL`. `009`'s backfill (`GROUP BY lower(email)`, inserting into `person.email NOT NULL`) fails outright against any such row — a NULL email collapses into one NULL-keyed group and violates the constraint. Since nothing is deployed to real users yet, the accepted fix is operational, not a SQL change: `DELETE FROM subscription WHERE responsible_contact_email IS NULL;` run by hand against any pre-existing local database immediately before applying `008`/`009` — the migration SQL itself stays exactly as written above, unmodified. A fresh environment (CI's Testcontainers Postgres, a clean clone) never hits this, since `subscription` is empty when `008`/`009` run there.
- **`PersonPicker`'s default mode was reversed after this spec had already shipped**, based on real-world use rather than a design review: the original search-first UI (mirroring `ClubPicker`) meant the "+ Add a new person" affordance only ever appeared when a search returned zero results — and since the on-focus default list is rarely empty, an admin creating a Subscription for a genuinely new person had no visible way to add one at all. Create mode is now the default (see UI Requirements above, already updated in place rather than superseded as a whole file — this is a UI-only revision, not a design reversal on the scale of `014`'s own `Contact`→`Person` rewrite). No backend/API contract change — `PersonPickerValue`'s shape, `CreateSubscriptionRequest.responsiblePerson`, and the "link, don't overwrite" resolution rule are all untouched. Shipped as its own follow-up PR against `master`, same pattern as the `ClubPicker` dropdown-close fix below.
- **Unrelated but discovered in the same session: `ClubPicker` had a pre-existing bug (since `011`, not introduced by this spec) where the dropdown never visually closed after selecting a club** — selecting an option re-syncs the input's query to the chosen club's name, which re-triggers the same search and gets the same single match back, so the "stay open while results exist" logic never saw a reason to close. Fixed in its own PR, unrelated to `PersonPicker`'s redesign above beyond both surfacing from the same round of real local testing.
