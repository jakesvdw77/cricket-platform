# Roadmap

The forward-looking backlog for this project — what's next, what's known but not yet spec'd, and why each item is sequenced where it is. Every entry here already has its full reasoning written down in a real spec's Non-goals / Deliberately Deferred / Rollout Notes section; this file doesn't repeat that reasoning, it just indexes it so there's one place to scan instead of hunting through every spec. **If an entry's rationale ever needs updating, edit it at the spec it links to — this file should never become a second source of truth.**

Update this file whenever a spec's own forward-references change (a new "Flag for a future spec" note, a Deliberately Deferred item added/resolved) — it's a living index, not a one-time snapshot.

## Active

| # | Spec | Status |
|---|---|---|
| 009 | [Subscriptions](specs/009-subscriptions.md) | Built, on `feature/009-subscriptions`, pending review/PR — links `Club` to `Product`, admin-driven, `CLUB`-owner-only this pass. |

## Next up — Configuration hub modules

Sequenced by `007-configuration-hub-overview.md`'s own Rollout Notes. Each is a card in `Configuration`, currently `EmptyState` until its own spec ships.

| Module | Status | Notes |
|---|---|---|
| Products | ✅ Shipped (`008`) | Subscription-tier catalog: pricing, usage limits, capability toggles. |
| Subscriptions | 🔶 Built, pending review (`009`) | Links a `Club` to a `Product`. |
| Discounts & Promotions | Unscoped | Named for roadmap visibility only (`007`, `008` Non-goals) — no spec yet. |
| Invoicing | Unscoped | Named for roadmap visibility only (`007`, `008` Non-goals). Also the spec that should decide whether `AdminHome.tsx`'s top-level `Subscriptions & Invoices` nav item becomes real or narrows to `Invoices` only (`009` Rollout Notes), and owns the billing-mechanics decisions below. |
| System Settings | Unscoped | Named for roadmap visibility only (`007`). |

## Next up — self-serve signup (Free tier only)

Decided during `009`'s planning discussion, not yet spec'd. Pick a Free (`price = 0`) Product on the landing page → create an account → configure the Club → claim a subdomain, no vendor involved. **Paid tiers stay vendor-assisted (`003`) until real payment processing exists** — self-serve is explicitly Free-only until then. See `009` Rollout Notes for the full call.

Depends on:
- `009` (needs a real `Subscription`↔`Product` link to attach at the end of signup).
- A real self-registration auth path — `005`'s login is platform-admin-only by design; this needs something new, not a variant of it.
- `002`'s "Self-service slug selection" Deliberately Deferred item (currently vendor-controlled per ADR-04) — this is exactly what would need to become real.
- `008`'s `allowSubdomain`/`showAds` toggles become load-bearing here for the first time — they gate what a self-signed-up Free club actually gets.

Existing lead-capture flow (`004`'s "Get started" form) stays as-is for sales/callback purposes — this doesn't replace it, it adds a second, Free-tier-only path that doesn't need a human.

## Next up — billing mechanics (for the future Invoicing spec)

Discussed during `009`'s planning, deliberately not implemented there — `009`'s `Subscription.startDate`/`endDate` are entitlement markers only, no charge is ever computed from them. Decisions recorded here so the Invoicing spec doesn't re-litigate them from scratch:

- **Anniversary billing, not calendar-month billing.** A billing period should run from the Subscription's own `startDate` in `billingInterval`-sized increments (subscribe on the 15th → billed the 15th of every following month), not aligned to the 1st of the calendar month. Avoids proration for the common case — calendar-aligned billing would require prorating almost every first invoice, since `003`'s vendor-assisted onboarding can happen any day of the month.
- **Proration for mid-cycle Product changes** — `009`'s `PUT /api/v1/platform/subscriptions/{id}` already lets an admin change a Club's Product at any point; whether/how that's prorated on the next invoice is real, unresolved billing logic.
- **Enforcing `Product.maxPeriodMonths`** against a Subscription's date range (`009` Non-goals) — `009`'s `SubscriptionForm` only suggests `endDate = startDate + maxPeriodMonths` as a UI convenience, nothing rejects a mismatch server-side.

## Blocked on the full tenancy model (`001`)

`Section`, `Team`, `ClubMembership`, and `RoleAssignment` don't exist in code yet — only a minimal `Club` stub does (built for `004`'s public search). Everything below is blocked on that model actually being built, which is its own, larger spec (or several) before any of these can start:

- **`SECTION`-owned subscriptions** and ADR-03's walk-up-the-tree resolution rule (`009` Non-goals, `001` ADR-03).
- **"Section subscription lapse behaviour"** — what a team sees if its section's own subscription lapses while the club's stays active (`001` Deliberately Deferred; `009` confirms it's still blocked, not resolved).
- **Enforcing `Product`'s usage limits** (`maxSections`/`maxTeams`/`maxPlayers`) when a club tries to exceed its plan (`008` Non-goals, `009` Non-goals).
- **Vendor-run league administration** — fixture scheduling, standings, a `LEAGUE` scope type (`001` ADR-02, Deliberately Deferred).
- Everything `006` named and hasn't built: club onboarding's real screen (see `003` below), whitelisting, sections/teams/players management, results capture, communication, availability polls, player profile/results/fixtures views.

## `003` — Club Onboarding (vendor-assisted)

Spec'd, not yet built. Stays vendor-assisted — a human sets a club up by hand, matching the landing page's own "Vendor-assisted onboarding" pitch. Self-serve (above) is a second, Free-tier-only path added alongside this, not a replacement for it.

**Noted during `009` planning, not yet actioned:** `Club` is used as the umbrella term throughout the product and code, but a real "club" in this system can be a School, Academy, or Cricket Club (or similar) — `001`'s `Club` entity (and its current minimal code stub, `id`/`name`/`slug`/`status` only) has no field capturing which. Needs an "organization type" field, set during onboarding (`003`) — the term `Club` stays as the internal/technical name either way (same resolution as the `Section`/"Age Group" naming decision), this is about adding a real data field, not a rename. Update `001`'s `Club` Field Reference and this entry once actually spec'd.

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
