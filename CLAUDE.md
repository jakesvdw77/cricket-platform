# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository. This file stays short on purpose — it states the non-negotiables and points elsewhere for detail. If a rule isn't written down here or in `docs/standards/*.md`, it doesn't bind an agent, no matter how obvious it feels.

## What this is

Cricket Legend Platform — a multi-club cricket management system: Spring Boot 3 (Java 17) backend + React 18/TypeScript frontend, PostgreSQL storage, Keycloak auth, sold to multiple clubs from one codebase (white-labelled per club subdomain). Successor to the original single-tenant Cricket Legend — see `docs/specs/` for why this one is built differently.

**Full context lives in `docs/specs/`. Read in order before touching anything:**
1. `docs/specs/001-tenancy-identity-model.md` — the club/section/player domain model everything else depends on
2. `docs/specs/002-realm-subdomain-auth.md` — Keycloak realm strategy and per-club subdomain auth
3. `docs/specs/003-club-onboarding.md` — the first feature spec, and the template every future spec follows

**Building a feature? Follow `docs/workflow.md`.** It's the validated spec → design → plan → build → test → review → PR cycle, step by step with which agent/skill/command runs each part — not a one-off, the default way every feature gets built here.

## Principles

1. **Spec before code, always.** No implementation starts without an approved spec in `docs/specs/`. Plan mode consumes the spec file, not a one-line ticket title.
2. **Reuse before you write.** Search for an existing component, service, or utility that covers the need and extend it before writing a new one. Duplication is a defect, not a shortcut.
3. **One shape per concern.** Every controller/service/repository/DTO/mapper follows the same skeleton (`docs/standards/backend.md`); every UI component follows the same file anatomy (`docs/standards/frontend.md`). Enforced by ArchUnit and dependency-cruiser, not memory.
4. **Mobile-first, not desktop-retrofitted.** Breakpoints and layout primitives are decided at the design-token stage, before a screen is drawn.
5. **Tests are a build gate.** A PR missing the test tier its change type requires (`docs/standards/testing.md`) fails CI. No "add tests later."
6. **Standards live in files, not in your head.** This file plus `docs/standards/*.md` are the only source of truth.
7. **Autonomy is earned per layer.** Agents implement freely inside a layer whose contract the spec already fixed. They don't redefine the contract without a human approving a spec change first.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Spring Boot 3 / Java 17, package `com.cricketlegend` |
| API contract | springdoc OpenAPI, schema checked into git |
| Database | Postgres + Liquibase, sequential migrations under `backend/src/main/resources/db/changelog/v1/` |
| Backend layering | Controller → Service (iface+impl) → Repository, DTOs only cross the controller boundary — see `docs/standards/backend.md` |
| Auth | Keycloak, single shared realm across all clubs — see `docs/specs/002-realm-subdomain-auth.md` |
| Frontend | React 18 + TypeScript + Vite, `ui/` |
| UI library | **Material UI (MUI) v5** — `@mui/material` + `@mui/icons-material`, styled via the shared theme in `ui/src/theme.ts`. Carried forward from the original Cricket Legend app, not a new choice — see `docs/standards/design-system.md`. No other component/styling system (no Tailwind, no CSS-in-JS alternatives). |
| Component library | Storybook, one story per shared component, thin wrappers around MUI primitives |
| Server state | React Query over `ui/src/api/*` per-resource files |
| Backend tests | JUnit 5 + Testcontainers (Postgres), ArchUnit, OpenAPI contract diff |
| Frontend tests | Vitest + Testing Library, Playwright e2e |

## Repository layout

```
project-root/
├── CLAUDE.md
├── docs/
│   ├── workflow.md                  # the spec → design → plan → build → test → review → PR cycle, step by step
│   ├── specs/                       # one file per feature, numbered — docs/specs/000-template.md is the shape
│   ├── plans/                       # approved /plan-feature output, one per spec, numbered to match
│   └── standards/
│       ├── backend.md
│       ├── frontend.md
│       ├── design-system.md
│       └── testing.md
├── .claude/
│   ├── commands/                    # /spec, /plan-feature, /review
│   ├── agents/                      # spec-author, architect, backend-builder, frontend-builder, test-writer, standards-reviewer
│   ├── skills/                      # new-endpoint, new-ui-component, new-migration, design-token-sync
│   └── settings.json
├── backend/                         # Spring Boot
└── ui/                              # Vite + React
```

## Local development

- **Backend**: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` — runs on port `8082` (the legacy app uses `8081`, deliberately different so both can run at once). Expects Postgres on `localhost:5432` (db `cricketlegend_platform`, same Docker instance as the legacy app — `docker exec <postgres-container> psql -U cricket -d postgres -c "CREATE DATABASE cricketlegend_platform OWNER cricket;"` to create it, credentials match the legacy app's) and, once Part 3 of the spec is implemented, Keycloak on `auth.localhost:8180`.
- **Frontend**: `cd ui && npm run dev` — Vite on port 5173, proxies `/api` to `http://localhost:8082`. Requires Node ≥20 (this repo's `package.json` was scaffolded and verified against Node 22.11).
- **Subdomain testing**: `*.localhost` resolves to `127.0.0.1` in every modern browser — no `/etc/hosts` editing needed, e.g. `riverside.localhost:5173`.

## Commit convention

Every commit message follows **Conventional Commits**: `type(scope): summary`.

- `type` — one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`.
- `scope` — optional, the area touched: `backend`, `ui`, `docs`, `spec`, `ci`.
- `summary` — imperative mood, no trailing period, e.g. `feat(ui): add landing page hero section`.

Enforced by `.githooks/commit-msg`, a Conventional-Commits regex check with no external dependency (no husky/commitlint). It applies to every commit regardless of who or what makes it, so it isn't Claude-specific — but the intended workflow is to let Claude Code draft and create commits from the actual diff, rather than typing `git commit -m` by hand, so the message is consistent with the diff and the convention every time.

One-time setup per clone (not run automatically — an agent should never change `git config` on its own):
```
git config core.hooksPath .githooks
```

## Getting started (rollout order)

This repo has been scaffolded through step 5. The remaining steps, in order:

6. Flesh out `.claude/commands/spec.md` and the spec template against a real feature.
7. Refine the six `.claude/agents/*.md` definitions after they've run through one full cycle.
8. Add the ArchUnit + dependency-cruiser rules described in `docs/standards/backend.md` / `frontend.md`, then prove each by deliberately breaking it once and watching CI catch it.
9. Run `docs/specs/003-club-onboarding.md` through the full spec → plan → build → review → merge pipeline — the deliberately small feature that validates the pipeline itself.
10. Only then, scope the real feature set.
