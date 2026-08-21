# Roadmap

The forward-looking backlog for this project — what's next, what's known but not yet spec'd, and why each item is sequenced where it is. Every entry here already has its full reasoning written down in a real spec's Non-goals / Deliberately Deferred / Rollout Notes section; this file doesn't repeat that reasoning, it just indexes it so there's one place to scan instead of hunting through every spec. **If an entry's rationale ever needs updating, edit it at the spec it links to — this file should never become a second source of truth.**

Update this file whenever a spec's own forward-references change (a new "Flag for a future spec" note, a Deliberately Deferred item added/resolved) — it's a living index, not a one-time snapshot.

## Active

| # | Spec | Status |
|---|---|---|
| 009 | [Subscriptions](specs/009-subscriptions.md) | Built, on `feature/009-subscriptions`, pending review/PR — links `Club` to `Product`, admin-driven, `CLUB`-owner-only this pass. |
| 014 | [Subscription Responsible Contact](specs/014-subscription-responsible-contact.md) | Rewritten draft — amends `009`'s `Subscription`/endpoints with a required-on-create `responsiblePersonId`, resolved via a new `PersonService` find-or-create-by-email against `001`'s `Person` (grown from a bare stub into a real `first_name`/`last_name`/`email`/`phone?` identity shape). Replaces an earlier, partially-implemented draft that embedded a bespoke `Contact` directly on `Subscription` — see `014`'s own Rollout Notes for exactly what's superseded. Not yet (re)built against this version. |
| 015 | [Person Status & Role Assignment](specs/015-person-status-and-role-assignment.md) | Draft, not yet built — adds `Person.status` (`PENDING \| ACTIVE \| SUSPENDED`, `PENDING` reserved only) and a real `RoleAssignment` entity/table (`CLUB_ADMIN`/`MANAGER`/`PLAYER`, `CLUB` scope only for now), and wires `AccessService.canAdministerClub` to a real lookup instead of `012`'s flat `platform_admin`-only stub. Deliberately stops short of Keycloak account provisioning — see its own Non-goals and the new "Next up" section below. |

## Next up — Configuration hub modules

Sequenced by `007-configuration-hub-overview.md`'s own Rollout Notes. Each is a card in `Configuration`, currently `EmptyState` until its own spec ships.

| Module | Status | Notes |
|---|---|---|
| Products | ✅ Shipped (`008`) | Subscription-tier catalog: pricing, usage limits, capability toggles. |
| Subscriptions | 🔶 Built, pending review (`009`); `014` (rewritten draft) amends it with a required responsible person | Links a `Club` to a `Product`. |
| Discounts & Promotions | Unscoped | Named for roadmap visibility only (`007`, `008` Non-goals) — no spec yet. |
| Invoicing | Unscoped | Named for roadmap visibility only (`007`, `008` Non-goals). Also the spec that should decide whether `AdminHome.tsx`'s top-level `Subscriptions & Invoices` nav item becomes real or narrows to `Invoices` only (`009` Rollout Notes), and owns the billing-mechanics decisions below. |
| System Settings | Unscoped | Named for roadmap visibility only (`007`). |

## Next up — Keycloak account provisioning for a Subscription's responsible party

Not yet spec'd — the deliberately separate follow-up `015-person-status-and-role-assignment.md` names explicitly and stops short of. Turns a Subscription's already-resolved `Person` (`014`) into a real, login-capable account: provision a Keycloak user, send an invite email, and have first login activate it. Depends on:

- `015`'s `Person.status`/`RoleAssignment` data model — this flow is what should set `Person.keycloakUserId` on first login and grant a `CLUB_ADMIN` `RoleAssignment` scoped to the Subscription's owning `Club`, using the tables/constraints `015` already ships rather than inventing them.
- The notifications/email-infrastructure spec below — an invite email needs a real send mechanism, which doesn't exist yet.
- `003-club-onboarding.md`'s still-unbuilt `Invitation` entity/admin-invite-by-email mechanism is closely related but not identical — `003`'s own roadmap entry below should be read alongside this one so the two aren't accidentally duplicated when either gets spec'd.
- Also owns making `AccessService.canAdministerClub`'s `RoleAssignment` branch (`015`) actually reachable in production — it's dormant until some flow starts setting `Person.keycloakUserId`, which nothing does today.

## Next up — self-serve signup (Free tier only)

Decided during `009`'s planning discussion, not yet spec'd. Pick a Free (`price = 0`) Product on the landing page → create an account → configure the Club → claim a subdomain, no vendor involved. **Paid tiers stay vendor-assisted (`003`) until real payment processing exists** — self-serve is explicitly Free-only until then. See `009` Rollout Notes for the full call.

Depends on:
- `009` (needs a real `Subscription`↔`Product` link to attach at the end of signup).
- A real self-registration auth path — `005`'s login is platform-admin-only by design; this needs something new, not a variant of it.
- `002`'s "Self-service slug selection" Deliberately Deferred item (currently vendor-controlled per ADR-04) — this is exactly what would need to become real.
- `008`'s `allowSubdomain`/`showAds` toggles become load-bearing here for the first time — they gate what a self-signed-up Free club actually gets.
- The OTP-verification step this flow needs is itself blocked on the notifications/email-infrastructure spec below — no mechanism to actually send a code exists yet.
- `014`'s `PersonService.findOrCreatePerson`/`Person.email` resolution — this flow's own "register, then log back in" path should resolve to the *same* `Person` a Subscription's responsible party already links to for that email, not a second identity. `014`'s Rollout Notes flags this explicitly.
- `015`'s `Person.status` enum — this is the flow that actually sets `PersonStatus.PENDING`, the reserved value `015` defines but never sets itself; a `Person` created here stays `PENDING` until an account holder approves it.

Existing lead-capture flow (`004`'s "Get started" form) stays as-is for sales/callback purposes — this doesn't replace it, it adds a second, Free-tier-only path that doesn't need a human.

## Next up — notifications / email infrastructure

Named for roadmap visibility only — no spec yet. No SMTP config, mail provider integration (SendGrid/Postmark/SES/etc.), or template mechanism exists anywhere in this codebase today, confirmed by grep in `014-subscription-responsible-contact.md`'s Non-goals. Motivated by three separate, already-named use cases that all need this before they can be finished:

- **Notifying a Subscription's responsible party when onboarding completes** — `014`'s whole reason for existing (`Subscription.responsiblePersonId` / `Person.firstName`/`email`) was to have this data ready, anchored to a real identity rather than a throwaway contact fact; `014` deliberately stops at capturing it, doesn't send anything. Whenever this spec is written, it should reuse `014`'s `Person` directly as its first real send-to address (and `firstName` for personalization, e.g. "Hi Jaco...") rather than redefining the shape.
- **The self-serve signup flow's OTP-verification step** (above) — needs a real send mechanism to exist first.
- **The Keycloak-provisioning invite email** (above) — same dependency, a second concrete consumer of the same not-yet-built send mechanism.

## Next up — billing mechanics (for the future Invoicing spec)

Discussed during `009`'s planning, deliberately not implemented there — `009`'s `Subscription.startDate`/`endDate` are entitlement markers only, no charge is ever computed from them. Decisions recorded here so the Invoicing spec doesn't re-litigate them from scratch:

- **Anniversary billing, not calendar-month billing.** A billing period should run from the Subscription's own `startDate` in `billingInterval`-sized increments (subscribe on the 15th → billed the 15th of every following month), not aligned to the 1st of the calendar month. Avoids proration for the common case — calendar-aligned billing would require prorating almost every first invoice, since `003`'s vendor-assisted onboarding can happen any day of the month.
- **Proration for mid-cycle Product changes** — `009`'s `PUT /api/v1/platform/subscriptions/{id}` already lets an admin change a Club's Product at any point; whether/how that's prorated on the next invoice is real, unresolved billing logic.
- **Enforcing `Product.maxPeriodMonths`** against a Subscription's date range (`009` Non-goals) — `009`'s `SubscriptionForm` only suggests `endDate = startDate + maxPeriodMonths` as a UI convenience, nothing rejects a mismatch server-side.

## Blocked on the full tenancy model (`001`)

`Section`, `Team`, and `ClubMembership` don't exist in code yet — only a minimal `Club` stub does (built for `004`'s public search). `RoleAssignment` itself is no longer blocked in the same way: `015-person-status-and-role-assignment.md` built it for real, for `CLUB` scope. Everything below is either blocked on `Section`/`Team` specifically, or is a gap `015` itself flagged as still open:

- **`SECTION`-owned subscriptions** and ADR-03's walk-up-the-tree resolution rule (`009` Non-goals, `001` ADR-03).
- **"Section subscription lapse behaviour"** — what a team sees if its section's own subscription lapses while the club's stays active (`001` Deliberately Deferred; `009` confirms it's still blocked, not resolved).
- **Enforcing `Product`'s usage limits** (`maxSections`/`maxTeams`/`maxPlayers`) when a club tries to exceed its plan (`008` Non-goals, `009` Non-goals).
- **Vendor-run league administration** — fixture scheduling, standings, a `LEAGUE` scope type (`001` ADR-02, Deliberately Deferred).
- **`SECTION`/`TEAM`-scoped `RoleAssignment` resolution** — e.g. a Juniors-Section-scoped admin variant of `001`'s own worked example. `015`'s `ScopeType` enum reserves `SECTION`/`TEAM` as recognized values, but nothing creates, validates, or resolves a grant at either scope yet — blocked on `Section`/`Team` existing in code, the same gap `009` already identified for `Subscription.ownerType`.
- **A UI to grant/revoke `RoleAssignment` rows for a `Person`.** No admin screen exists — `015` built the data model and the `AccessService` read-side lookup only, and flags this explicitly as a real gap in its own Non-goals/Rollout Notes. Not blocked on `Section`/`Team` (a `CLUB`-scoped grant is buildable today), just genuinely not built yet; see the Keycloak-provisioning entry above for one plausible place it could ride along.
- **Any `RoleAssignment`/administrative capability arising from a `Person` existing.** Still true after `015`: `PersonService.findOrCreatePerson` (`014`) grants zero admin capability by itself, and `015` doesn't change that — a `Person` being created or linked implies nothing about `RoleAssignment`. Actually granting one (e.g. `CLUB_ADMIN` to a Subscription's responsible party) is the Keycloak-provisioning spec's job, above, not an automatic side effect of `Person` creation.
- Everything `006` named and hasn't built: club onboarding's real screen (see `003` below), whitelisting, sections/teams/players management, results capture, communication, availability polls, player profile/results/fixtures views.

## `003` — Club Onboarding (vendor-assisted)

Spec'd, still not built as a whole — `010`/`011`/`012` are each explicit, deliberate minimal slices of it (bare `Club` CRUD, inline creation from the Subscription form, then a real `ClubProfile`), not a replacement for it. What `003` itself still owns and remains entirely unbuilt: the `Invitation` entity, admin-invite-by-email (and the club-admin-delegates-further-invites reuse of the same mechanism), and Section/Season bootstrapping during onboarding. Stays vendor-assisted — a human sets a club up by hand, matching the landing page's own "Vendor-assisted onboarding" pitch. Self-serve (above) is a second, Free-tier-only path added alongside this, not a replacement for it.

`003`'s own `Invitation` design ("an invited person who already has an account attaches to their existing `Person`") is now backed by a real, reusable primitive — `014`'s `PersonService.findOrCreatePerson` — built ahead of `Invitation` itself. Whoever implements `003`'s `Invitation` should reuse that service rather than writing its own email-resolution logic a second time. `015`'s `RoleAssignment` table is a second such primitive, built ahead of `003`'s own admin-invite mechanism — whoever implements `Invitation`-driven admin invites should grant the resulting access via `RoleAssignmentRepository`, not a second, bespoke authorization mechanism.

**Resolved by `012-club-profile.md`:** the "organisation type" field noted below shipped as `ClubProfile.type` (`CLUB | ACADEMY | SCHOOL | OTHER`) — see `012`'s Rollout Notes. Originally noted during `009` planning: `Club` is used as the umbrella term throughout the product and code, but a real "club" in this system can be a School, Academy, or Cricket Club (or similar); `001`'s `Club` entity had no field capturing which. Resolved on the `ClubProfile` side entity per `012`'s own data-model call, not as a new column on `Club` itself — `001`'s `Club` Field Reference intentionally wasn't changed.

**Next up, not yet spec'd:** the "Club Contacts" (named people at a club — name, role, phone, email, mobile, one flagged primary) and "Sponsors" (name, website, icon, banner, social links) specs discussed alongside `012` — both intended to reuse `012`'s `Address`/`MediaUpload`/`AddressFields` components directly. Club Contacts should additionally reuse `backend/src/main/java/com/cricketlegend/domain/Contact.java`/`ContactDto` for its own people-list entries' name/email/phone (adding only `role` and a "flagged primary" bit alongside it) — those types were built for, but are no longer used by, `014` after its rewrite; they remain reserved for Club Contacts, per `014`'s current Rollout Notes. If a Club Contact entry ever needs to become login-capable, that upgrade path should resolve the contact's email through `014`'s `PersonService.findOrCreatePerson` rather than adding a schema-level link from `Contact` to `Person` — see `014`'s Rollout Notes for the full "bridge by email, not by FK" reasoning. Not started; no spec number claimed yet (`013` went to `013-centralized-logging.md` instead).

## Other deferred items (`001`/`002`, unscheduled)

Named for completeness — none of these are next, none have a target spec number yet:

- **Concurrent club membership** — a player at two clubs at once (`001` ADR-01, Deliberately Deferred).
- **Team season-history** — grade history season to season, not just current placement (`001` Deliberately Deferred).
- **Custom domains per club** — beyond the subdomain-only model (`001` ADR-04, Deliberately Deferred).
- **Per-section branding** — branding stays Club-scoped only until a real club asks otherwise (`001` Deliberately Deferred).
- **Multi-club subscriptions** — one `Subscription` spanning several `Club`s; deliberately ruled out for now, see the full security-boundary reasoning in `001` Deliberately Deferred.
- **Per-club redirect URI allowlist** — fallback if `002` ADR-03's wildcard doesn't hold up in production (`002` Deliberately Deferred).
- **External identity providers** (Google/Microsoft SSO) — no requirement yet (`002` Deliberately Deferred).
- **Mobile app redirect URIs** — out of scope until a mobile client exists (`002` Deliberately Deferred).
- **Reassigning a Subscription's responsible person after creation** — `014`'s `PUT /api/v1/platform/subscriptions/{id}` deliberately has no way to do this; if it turns out to be a real recurring need, it should be its own explicit action/endpoint, not a side effect of an unrelated field edit (`014` Non-goals, flagged as a judgment call).
- **Whether a `SUSPENDED` `Person` should be blockable from being (re-)linked as a new Subscription's responsible party** — `015`'s `PersonService.findOrCreatePerson` links to an existing `Person` by email regardless of their `status`; flagged as a judgment call in `015`'s own Data Model Changes, unresolved because nothing yet makes `SUSPENDED` load-bearing (see the Keycloak-provisioning entry above).

## Known tech debt (unscheduled, no owning spec)

- **`Page<T>` serialized directly, not via a stable DTO.** Every paginated list endpoint (`ClubController`, `ProductController`, `SubscriptionController`, `LeadController`) returns Spring Data's `Page<T>` straight from the controller, which logs a startup/runtime warning that this JSON shape isn't guaranteed stable across Spring Data versions (`ration$PageModule$WarningLoggingModifier`, pointing at `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` or `PagedResourcesAssembler`). Predates `012-club-profile.md` — present since `008-product-catalog.md`'s first paginated endpoint, confirmed still on `master`. Harmless in practice so far (the shape has been stable), but the real fix is global (`@EnableSpringDataWebSupport`) and touches every paginated response's JSON shape app-wide, so it doesn't belong to any single feature spec — deferred until a pass is willing to touch all of them together.
- **`ClubForm`'s inline `Input type="email"` should be swapped to the existing `EmailInput`** (`ui/src/components/EmailInput/`, built alongside the earlier draft of `014` and still reused as-is by its rewritten UI) — a small drive-by cleanup flagged but not actioned by `014` itself (its own scope doesn't touch `ClubForm`), so it isn't forgotten and doesn't quietly become a second, slightly-different "email input" pattern.
- **`Contact.java`/`ContactDto.java`'s own Javadoc still cites `014-subscription-responsible-contact.md`** as their origin/reasoning — accurate for the discarded embedded-`Contact`-on-`Subscription` draft, not for the rewritten spec, which doesn't use either type. Should be updated (by whoever next touches either file — likely the future Club Contacts spec) to describe themselves purely as reserved for that future spec, per `014`'s own Rollout Notes flag. Harmless as-is — a stale doc comment, not a behavioral bug — but worth fixing opportunistically rather than compounding.
