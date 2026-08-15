# Testing Strategy

Five tiers, deliberately not exhaustive at the top — exhaustive end-to-end coverage is a trap for a solo operator; the lower tiers carry most of the weight.

| Tier | Tooling | Scope |
|---|---|---|
| Unit | JUnit 5 / Vitest | Pure logic, runs on every save |
| Integration | Testcontainers (Postgres), via `com.cricketlegend.AbstractIntegrationTest` | Service + repository roundtrip |
| Contract | OpenAPI schema diff | Fails CI on an undocumented breaking change |
| Component | Testing Library + Storybook interaction tests | One critical interaction per shared component |
| End-to-end | Playwright, mobile + desktop viewport | Golden paths only: login, create match, capture scorecard, view public schedule |

## What each tier is for

- **Unit** catches logic bugs cheaply and runs constantly — most tests should live here.
- **Integration** proves a service and its repository actually work against real Postgres (via a disposable Testcontainers instance, not a shared dev database), including Liquibase migrations applying cleanly.
- **Contract** exists solely to stop backend and frontend drifting apart silently — see `CLAUDE.md`'s tech stack table.
- **Component** tests one meaningful interaction per shared component (e.g. a form's validation error state), not every prop permutation.
- **End-to-end** is intentionally small. Don't grow this tier to cover things unit/integration/component already cover — it's the slowest, flakiest tier and should stay reserved for "does the whole system actually work" golden paths.

## Required per change type

Per `docs/standards/backend.md` and `docs/standards/frontend.md`:

- New `@Service` method with a business rule → unit test, same PR.
- New custom repository query → integration test, same PR.
- New shared component → component test + Storybook story, same PR.
- New feature spec's "golden path" (see the spec's own Test Plan section) → one E2E test.

A PR missing the tier its change type requires fails CI — see `CLAUDE.md` Principle 5.
