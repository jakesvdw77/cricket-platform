# 003 — Club Onboarding

**Depends on:** `001-tenancy-identity-model.md`, `002-realm-subdomain-auth.md`. **Follows:** the spec template in `000-template.md` — this is the first real feature spec, and doubles as `CLAUDE.md`'s rollout step 9: "one deliberately small feature, run end to end."
**Status:** proposed.

## Problem & Goals

`001-tenancy-identity-model.md` and `002-realm-subdomain-auth.md` both assume a `Club`, its branding, its first admin, and its initial structure already exist — neither defines how they come into being. Every future club sold needs a repeatable, low-friction path from "signed a deal" to "their admin is logged into their own branded subdomain."

**Goals**
- A platform admin can take a new club from zero to "their first admin has logged in" in one sitting.
- The process is repeatable — club #2 follows the same steps as club #1, nothing bespoke.
- The mechanism used to bootstrap a club's first admin is the *same* mechanism club admins later use to delegate Section/Team roles themselves — one primitive, not an onboarding-only special case (`CLAUDE.md` Principle 2: reuse before you write).
- No duplicate `Person`/`ClubMembership` rows, even if the invited admin already has an account at another club.

## Non-goals

- **Public self-service signup.** Pick-a-plan-and-pay is out of scope — sales stay vendor-assisted, consistent with `001-tenancy-identity-model.md` ADR-06 and `002-realm-subdomain-auth.md` ADR-04 (slugs and initial branding are vendor-set).
- **Payment collection / plan selection UI.** `Subscription.plan` is set directly by the platform admin; no payment processor integration yet.
- **Bulk player-roster import (CSV).** v1 onboarding adds players one at a time through the normal UI once the club admin is in. Revisit if a club's existing roster size (including your own) makes that impractical — cheap to add later, not required to ship this spec.
- **Batch invitations.** The `Invitation` mechanism below handles one person at a time for v1.

## User Stories

- As a platform admin, I can create a new `Club` with a name and slug, validated against the reserved-word list from `002-realm-subdomain-auth.md` ADR-04, before it's accepted.
- As a platform admin, I can set a new club's initial `ClubBranding` (logo, colours, display name) as part of onboarding.
- As a platform admin, I can create the initial `Section` tree and the current `Season` for a new club before inviting anyone.
- As a platform admin, I can invite a person by email to be a `CLUB`-scope admin for a specific club.
- As an invited person with no existing account, following the invite link lets me set a password, creating a Keycloak user and a new `Person`, linked together.
- As an invited person who already has an account (e.g. I'm a player at another club under the same email), following the invite link attaches the new role and club membership to my *existing* `Person` — I never end up with two accounts.
- As a club admin, I can invite other people to `SECTION`- or `TEAM`-scoped roles within my own club, using the exact same mechanism the platform admin used to invite me — no separate feature needed.
- As a platform admin, I can see an invitation's status (pending / accepted / expired) so I know whether to follow up.

## Data Model Changes

**New entity — `Invitation`** (the one new concept this spec introduces):

```
Invitation {
    uuid id
    string email
    uuid club_id
    string role
    string scope_type        -- CLUB | SECTION | TEAM (never PLATFORM — platform admins are provisioned directly, not invited)
    uuid scope_id             -- nullable for CLUB-level
    uuid invited_by_person_id
    string token_hash
    string status             -- PENDING | ACCEPTED | EXPIRED | REVOKED
    timestamp expires_at
    timestamp accepted_at
    timestamp created_at
}
```

**New field — `Club.status`**: `ONBOARDING | ACTIVE | SUSPENDED`. Distinguishes a club still being set up from a live one — `002-realm-subdomain-auth.md`'s `TenantResolutionFilter` treats a non-`ACTIVE` club's subdomain as not-yet-public rather than serving a half-configured site.

No changes to `Person`, `ClubMembership`, `RoleAssignment`, `Section`, or `Season` — onboarding creates rows in tables `001-tenancy-identity-model.md` already defined, in a specific order, orchestrated by one new entity. Migration: one Liquibase file adding the `invitation` table (FKs to `club`, `person`) and the `status` column on `club`.

> **Why `Invitation` is scope-generic, not onboarding-specific:** if it only handled "invite a club admin," a club admin who later wants to delegate a Juniors-section role to someone would need an entirely different mechanism. Instead, creating an `Invitation` reuses the exact same scope check as everything else (`001-tenancy-identity-model.md`'s Scope Hierarchy & Access): whoever holds a `RoleAssignment` covering `scope_type`/`scope_id` — or an ancestor of it — can invite into it. A platform admin invites at `CLUB` scope to bootstrap a club; a club admin later invites at `SECTION` scope using the identical endpoint.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/platform/clubs` | `platform_admin` | `{name, slug}` → `Club` (status `ONBOARDING`) |
| `PUT /api/v1/clubs/{clubId}/branding` | scope covers `CLUB` (platform admin during onboarding, club admin per ADR-06 afterward) | Sets `ClubBranding` |
| `POST /api/v1/clubs/{clubId}/sections` | scope covers `CLUB` | Creates a `Section` node |
| `POST /api/v1/clubs/{clubId}/seasons` | scope covers `CLUB` | Creates the current `Season` |
| `POST /api/v1/invitations` | scope covers the target `scope_type`/`scope_id` | `{email, clubId, role, scopeType, scopeId}` → `Invitation` |
| `GET /api/v1/invitations/{token}` | public, unauthenticated | Resolves invite + target club's branding for the accept-invite page — no sensitive data before acceptance |
| `POST /api/v1/invitations/{token}/accept` | public (token is the credential) | `{password?}` → creates/links `Person` + Keycloak user + `RoleAssignment` (+ `ClubMembership` if applicable), marks `Invitation` `ACCEPTED` |
| `POST /api/v1/platform/clubs/{clubId}/activate` | `platform_admin` | Flips `Club.status` from `ONBOARDING` to `ACTIVE` once setup is confirmed complete |

## UI Requirements

- **Platform Admin area** — internal only, lives on the root marketing domain (not a club subdomain), gated by the `platform_admin` realm role from `002-realm-subdomain-auth.md`. Screens: New Club form, Branding editor, Section tree editor, Season creator, Invite-a-person form.
- **Branding editor is one component, two audiences** — the same screen the platform admin uses during onboarding is what a club admin uses to self-edit later (`001-tenancy-identity-model.md` ADR-06). Built once.
- **Accept-invite page** — public route, fetches the target club's branding via the invite token *before* the person has an account, so it's correctly branded even pre-login (same pattern as public schedule/tournament pages).
- All screens composed from the existing shared component library (`docs/standards/design-system.md`) — no new visual patterns introduced for onboarding specifically.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | Invitation state transitions (pending→accepted, pending→expired); slug validation against the reserved-word list; "does an existing Person match this email" resolution |
| Integration | Full accept-invite flow against Testcontainers Postgres — assert no duplicate `Person` is created for an email with an existing record |
| Contract | New endpoints documented in the checked-in OpenAPI schema |
| E2E | One golden path (Playwright): platform admin creates a club, invites an admin; a fresh, unauthenticated browser context accepts the invite and lands logged into the branded club subdomain |

## Acceptance Criteria

- A platform admin can go from "no club" to "an invited admin is logged into their own branded subdomain" without touching the database directly.
- Inviting an email that already has a `Person` record never creates a second one.
- An expired or already-accepted invitation link shows a clear, specific error — not a broken page.
- A club's subdomain does not serve full content while `Club.status = ONBOARDING`.

## Rollout Notes

- This is `CLAUDE.md`'s rollout step 9: run it through the full spec → plan → build → review → merge pipeline first, specifically to validate the pipeline itself before committing to the real feature set.
- Ship platform-admin-initiated invitations first. Club-admin-initiated invitations (Section/Team scope) need no separate build — they're the same endpoint and UI, unlocked the moment a `CLUB`-scope `RoleAssignment` exists to invite from.

## Open items this spec still assumes

- **Section subscription lapse behaviour** — flagged as deferred in `001-tenancy-identity-model.md`, needs its own short product spec before section-level billing ships.
- **Bulk player-roster import** — explicitly deferred above; revisit if manual one-at-a-time entry proves impractical for a real club's roster size.
