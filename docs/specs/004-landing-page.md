# 004 — Landing Page

**Depends on:** `001-tenancy-identity-model.md` (Club, the root-domain-vs-club-subdomain split), `002-realm-subdomain-auth.md` (subdomain-scoped login flow, ADR-04's vendor-assigned slugs), `003-club-onboarding.md` (vendor-assisted onboarding as the next step after a lead is captured, `Club.status`).
**Status:** draft.

## Problem & Goals

`001-tenancy-identity-model.md`'s White-Labelling section states the root domain (`yourapp.com`) is "the vendor's own sales/marketing site — never club-branded," but nothing yet defines what lives there. Right now a prospective club or an existing club's staff member hitting the root domain has nowhere to land: no product information, no way to express interest, and — because login is scoped per club subdomain (`002-realm-subdomain-auth.md`) — no obvious way to log in without already knowing their club's URL.

**Goals**
- A prospective club (buyer) can learn about the product, read testimonials, and reach the vendor's social media from the root domain, unauthenticated.
- A prospective club can express interest through a lightweight form without the platform creating an account, a `Person`, or a `Club` on their behalf — sales stays vendor-assisted, per `003-club-onboarding.md`.
- A platform admin can see who has expressed interest and manually follow up, reusing `003`'s existing vendor-assisted onboarding flow as the next step once a lead is qualified.
- An existing club's staff member can get from the root domain to their own club's subdomain to log in, without the platform guessing or hard-coding a slug.

## Non-goals

- **Self-service club/account creation.** The "Get started" CTA captures a lead only — it never creates a `Club`, `Person`, or `Invitation`. Creating the actual `Club` stays the vendor-assisted flow in `003-club-onboarding.md`; that spec explicitly lists public self-service signup as a non-goal, and this spec doesn't relitigate that.
- **Payment collection / plan selection.** Same reasoning as `003`'s equivalent non-goal — no payment processor integration here either.
- **A marketing CMS or admin UI for page content/testimonials.** Copy, testimonials, and social links ship as static content in the frontend for v1. Revisit only if the vendor needs to update this copy more often than a code change allows.
- **Spam/bot protection (CAPTCHA, rate limiting) on the lead form.** Deliberately deferred — the form is unauthenticated and public by design; add protection if abuse is observed, not speculatively.
- **Automated lead notification (email/Slack/CRM integration).** A platform admin checks the leads list manually; no alerting on new submissions in v1.
- **Duplicate-lead detection/merging.** Unlike `003`'s `Invitation` handling (which explicitly prevents duplicate `Person` rows), two submissions from the same prospect create two `Lead` rows in v1. A platform admin reconciles duplicates by eye.
- **Per-club marketing pages.** This spec covers the root domain only. A club subdomain's own public content (schedule, branding) is already covered by `001`/`002`/`003`.
- **Localization/i18n and analytics/A-B testing tooling.** No requirement yet.
- **Any club-scoped resolution on the root domain.** The root domain never runs `002`'s `TenantResolutionFilter` and never resolves a `Club` — it stays intentionally club-agnostic, consistent with `001`'s "never club-branded" statement.

## User Stories

- As a prospective club researching the product, I can read what the platform does, see testimonials from existing clubs, and find links to the vendor's social media, all without an account.
- As a prospective club, I can submit a "Get started" form with my name, email, club name, and an optional message, so a platform admin can follow up with me — without the platform creating an account or a `Club` for me.
- After submitting the form, I see a clear confirmation that someone will be in touch, not a dead end or a raw success message.
- As a platform admin, I can see a list of submitted leads, newest first, filterable by status, so I know who to follow up with.
- As a platform admin, I can mark a lead as contacted, converted, or dismissed, so the list reflects real follow-up state over time.
- As a platform admin, once I've vendor-onboarded a lead into a real `Club` via `003-club-onboarding.md`'s flow, I can record which `Club` a lead turned into, so the lead's outcome is traceable.
- As existing club staff visiting the root domain, I can click "Log in," search for my club by name or slug, and be taken to my club's own subdomain to complete login there — because `002-realm-subdomain-auth.md` scopes login per subdomain and there is no generic root-domain login.
- As a visitor searching for a club that doesn't match anything (typo, or a club not yet active), I see a clear empty state pointing me to the contact form instead of a silent dead end.

## Data Model Changes

**New entity — `Lead`** (the one new concept this spec introduces, platform-global like `Person`/`League` — not `club_id`-scoped, since the prospect isn't a `Club` yet):

```
Lead {
    uuid id
    string name
    string email
    string club_name              -- free text as entered by the prospect, not a Club FK
    string phone                  -- nullable
    string message                -- nullable
    string status                 -- NEW | CONTACTED | CONVERTED | DISMISSED
    uuid converted_club_id         -- nullable FK to Club, set manually once 003's onboarding flow creates the real Club
    uuid contacted_by_person_id    -- nullable FK to Person (the platform admin who actioned it)
    timestamp contacted_at         -- nullable
    timestamp created_at
}
```

Allowed status transitions (enforced the same informal way `003` enforces `Invitation.status`): `NEW → CONTACTED`, `NEW → DISMISSED`, `CONTACTED → CONVERTED`, `CONTACTED → DISMISSED`. No transition out of `CONVERTED` or `DISMISSED` — a wrong call gets a new `Lead`, not a reopened one, mirroring how `003` never reopens an accepted/expired `Invitation`.

No changes to the *design* of `Person`, `Club`, `ClubMembership`, or any entity from `001-tenancy-identity-model.md` — this spec doesn't redefine anything `001` already decided. `Lead` deliberately does not reuse `Invitation` — an `Invitation` targets a specific existing `Club`/scope and a specific role; a `Lead` exists before any of that is decided, and converting one into the other is a manual, human judgement call (qualifying a prospect), not a state machine transition.

**Implementation-time addendum (human-approved during `/plan-feature`, not a re-derivation):** at the time this spec was built, `001`/`002`/`003` existed only as specs — no `Club`/`Person` entity, migration, or Keycloak-backed auth had actually been implemented in code yet, despite this spec's Data Model and API Contract assuming they had (FK references, `platform_admin`-gated endpoints). Rather than block this feature on fully implementing `001`/`002`/`003` first, a deliberately minimal prerequisite slice was added alongside `Lead`: a `club` table (`id`, `name`, `slug`, `status`) and a `person` table (`id`, `keycloak_user_id`, `full_name`) — just the columns this spec's FKs need — plus a flat `platform_admin` Keycloak realm-role check (`SecurityConfig`), which is `002`'s own documented exception to its scope-walk authorization model, not a new mechanism. Explicitly **not** built: `Section`, `Team`, `ClubMembership`, `RoleAssignment`, or `002`'s full `KeycloakJwtConverter`/scope-walk `AccessService` — those remain `001`/`002`'s to implement in full when a feature actually needs them.

Migration sketch — `backend/src/main/resources/db/changelog/v1/002-add-lead.sql` (numbered `002` in the actual repo, after the `001` prerequisite migration from the addendum above — sequential migration order, not this spec's number):

```sql
CREATE TABLE lead (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    club_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    converted_club_id UUID REFERENCES club(id),
    contacted_by_person_id UUID REFERENCES person(id),
    contacted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_status ON lead (status);
```

| Entity | Scope | Key fields | Purpose |
|---|---|---|---|
| Lead | Platform-global | id, name, email, club_name, status, converted_club_id? | Vendor's follow-up queue for prospects; not tenant-scoped because no tenant exists yet |

No other data model changes. The "find your club" login step (below) is a read-only query over the `club`/`status` columns from the prerequisite slice above (standing in for `001`'s full `Club` entity and `003`'s `Club.status` field until those specs are implemented in full) — no new entity required.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/leads` | public, unauthenticated | `{name, email, clubName, phone?, message?}` → creates `Lead` (status `NEW`) |
| `GET /api/v1/platform/leads` | `platform_admin` | Paginated (`?page=&size=&status=`), newest first — the admin's follow-up queue. Backend-driven per `docs/standards/backend.md`'s pagination rule, not a full-table fetch |
| `POST /api/v1/platform/leads/{id}/status` | `platform_admin` | `{status, convertedClubId?}` → transitions `Lead.status` per the allowed-transition table above; `convertedClubId` is recorded once `003`'s vendor-assisted flow has created the real `Club` |
| `GET /api/v1/public/clubs?query=` | public, unauthenticated | Typeahead search over `Club` rows with `status = ACTIVE` only (per `003`'s `Club.status`) by name/slug → `{name, slug}[]`, used by the "find your club" login step. Excludes `ONBOARDING`/`SUSPENDED` clubs — same reasoning `003` used to keep those off the public subdomain |

Both public endpoints follow `003`'s pattern for pre-auth public data: `GET /api/v1/public/clubs` returns only `name`/`slug`, never branding detail, membership, or anything else — the equivalent of `003`'s "no sensitive data before acceptance" rule for `GET /api/v1/invitations/{token}`.

`POST /api/v1/leads` uses standard `ValidationException` (400) for a malformed email or missing required field, per `docs/standards/backend.md`'s exception matrix — no new exception type needed.

## UI Requirements

Root-domain page, `ui/src/pages/view/` (public, unauthenticated — the folder's existing convention per `docs/standards/frontend.md`). Composed primarily from the existing shared library (`docs/standards/design-system.md`); two pieces are new.

**Reused as-is, no changes needed:**
- `Card` (`variant="outlined"` default) — feature/benefit tiles, and as the base for the new `TestimonialCard` below.
- `Button` — all CTAs ("Get started," "Log in," social icon links).
- `Input` — the lead-capture form's fields (name, email, club name, phone, message) and the club-search field.
- `EmptyState` — reused twice, not duplicated: (1) the "no clubs matched" state in the "find your club" search, action pointing at the contact form section; (2) the lead-form's post-submission confirmation state, replacing the form once submitted ("Thanks — we'll be in touch").

**New shared components — run the `new-ui-component` skill before this page is built:**
- `TestimonialCard` — quote, attributed name, club/role, optional avatar. A thin wrapper around `Card`, but its content shape (quote + attribution) is distinct enough from `Card`'s generic `title`/`children` contract to warrant its own component and Storybook story rather than ad hoc markup inside `Card`'s children slot.
- `SocialLinksRow` — a row of icon links (`@mui/icons-material` brand icons) to the vendor's social profiles. New because nothing in the current library renders an icon-link list, and this is very likely reused in a site footer beyond just this one page.

**Deliberately not using the existing `Nav` component, and why:** `Nav` (`ui/src/components/Nav/Nav.tsx`) is built around `react-router` paths mapped to a single active tab (`BottomNavigation`/`Tabs`) — in-app section navigation. A marketing page header needs anchor links to on-page sections, two CTA buttons, and no "current tab" concept at all — stretching `Nav`'s contract to fit would be the exact "near-miss extended awkwardly" case `docs/standards/frontend.md` warns against, not genuine reuse. The header is a page-local composition of MUI `AppBar`/`Box`/`Button` inside `pages/view/` — it doesn't need the four-file shared-component anatomy because only this one page uses it today. If a second marketing page is added later and needs the same header, that's the trigger to extract it into `components/**` per the frontend standard's "second use" rule — not before.

**Login CTA — "find your club" resolution (the real wrinkle `002-realm-subdomain-auth.md` leaves open at the root domain):** `002` scopes the entire login flow — Keycloak redirect, session cookie, everything — to a specific club subdomain; there is no generic login on the root domain because there is no `Club` to resolve there. Clicking "Log in" opens a small step, not a login form:
1. An `Input`-based search field calls `GET /api/v1/public/clubs?query=` as the visitor types (typeahead).
2. Matches render as a simple list; selecting one redirects the browser to `{protocol}//{slug}.{rootDomain}/login` — same scheme as the current page (HTTPS in prod, HTTP for local dev, since Vite's dev server doesn't serve HTTPS) — a new, minimal route within *that club's own SPA* (not this spec's backend) that immediately triggers the existing Keycloak redirect from `002`'s login sequence on mount, so the visitor lands on the real login screen in one extra click rather than two. `{rootDomain}` is a new frontend config value (`VITE_ROOT_DOMAIN`), following the same env-overridable pattern as `VITE_KEYCLOAK_URL` in `002`.
3. No matches → the `EmptyState` reuse above, directing the visitor to the contact form instead of a dead end.

This page never embeds Keycloak's login form itself and never calls `/api/v1/me/access` — it only ever resolves *which subdomain* to send someone to, then hands off entirely to the flow `002` already defines there.

**Mobile-first.** All sections authored at 375px first per `docs/standards/frontend.md`; the header collapses its nav/CTAs behind a standard MUI responsive pattern below `md`, consistent with how `Nav` itself handles the same breakpoint (even though this page doesn't use `Nav` directly).

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `Lead` status transition rules (the allowed-transition table above); lead form field validation (required fields, email format) |
| Integration | `POST /api/v1/leads` persists correctly against Testcontainers Postgres; `GET /api/v1/platform/leads` filters by `status`; `GET /api/v1/public/clubs` excludes non-`ACTIVE` clubs |
| Contract | `POST /api/v1/leads`, `GET /api/v1/platform/leads`, `POST /api/v1/platform/leads/{id}/status`, and `GET /api/v1/public/clubs` documented in the checked-in OpenAPI schema |
| Component | `TestimonialCard` and `SocialLinksRow` — one Storybook interaction/story each (new shared components, required per `docs/standards/testing.md`); the page-local lead-capture form gets a Vitest/Testing Library test for its validation error state even though it isn't a shared component, because it carries the one meaningful piece of client-side logic on this page |
| E2E | One golden path (Playwright): a visitor lands on the root domain, fills and submits the lead form, and sees the confirmation state. A second path covers the login redirect: search for a known active club by name and assert the browser is redirected to `{slug}.{rootDomain}/login` |

## Acceptance Criteria

- The root domain landing page renders fully, unauthenticated, without resolving any `Club` or running `002`'s `TenantResolutionFilter`.
- Submitting the lead form with valid data creates a `Lead` row with status `NEW`, visible to a platform admin via `GET /api/v1/platform/leads` — and creates no `Person`, `Club`, or `Invitation`.
- Submitting the lead form with an invalid email is rejected with a 400 `ValidationException`, both client-side and server-side.
- A platform admin can transition a lead's status (`NEW`→`CONTACTED`→`CONVERTED`/`DISMISSED`) and optionally attach a `converted_club_id`, without touching the database directly.
- Clicking "Log in" and selecting a matching, `ACTIVE` club redirects the browser to that club's own subdomain; no login form is ever rendered on the root domain itself.
- Searching for a club with no matches shows the `EmptyState` pointing at the contact form, not a blank or broken result.
- `ONBOARDING` and `SUSPENDED` clubs never appear in the "find your club" search results.

## Rollout Notes

- Ship the backend first: `Lead` entity/migration, `POST /api/v1/leads`, `GET /api/v1/platform/leads`, `POST /api/v1/platform/leads/{id}/status`, and `GET /api/v1/public/clubs` — this alone lets sales start capturing leads manually before the marketing page UI exists.
- `TestimonialCard` and `SocialLinksRow` go through the `new-ui-component` skill before the landing page composition starts, per `docs/standards/design-system.md`'s workflow (library additions before screens).
- The "find your club" login redirect depends on `002-realm-subdomain-auth.md`'s ADR-03 (wildcard redirect URI) being verified against the deployed Keycloak version — that verification is already a documented prerequisite in `002`, not new work this spec introduces, but it blocks the login-redirect path specifically, not the rest of this page.
- Like `003-club-onboarding.md`, this is a deliberately small feature — the product owner is using it as a second, separate run through the spec → plan → build → review → merge pipeline (`CLAUDE.md`'s rollout step 9 covered `003`; this is the same validation exercise applied to a second, simpler feature).

## Open items this spec still assumes

- **Converting a `Lead` into a `Club` stays a manual, two-step process** — a platform admin runs `003`'s `POST /api/v1/platform/clubs` separately, then records the resulting `converted_club_id` on the `Lead` by hand. Wiring these together (e.g. pre-filling `003`'s "New Club" form from a `Lead`) is a plausible future enhancement, not required here.
- **Static testimonial/marketing copy** — flagged above as a non-goal; revisit with a small CMS or admin-editable content model only if the vendor needs to change this copy more often than a code deploy allows.
