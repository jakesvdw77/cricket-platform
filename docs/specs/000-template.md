# NNN — Feature Name

*Copy this file to `docs/specs/NNN-feature-name.md` (next sequential number) to start a new spec. Produced by the `/spec` command / `spec-author` agent — see `CLAUDE.md`'s Spec-Driven Lifecycle.*

**Depends on:** (which other specs this assumes)
**Status:** draft | proposed | approved | superseded

## Problem & Goals

What's broken or missing, and what this spec sets out to achieve. 2-4 sentences of problem, then a short goals list.

## Non-goals

What this spec explicitly does NOT cover, and why — scope left out on purpose reads very differently from scope forgotten.

## User Stories

`As a <role>, I can <action>, so that <outcome>.` — one per meaningfully distinct behaviour.

## Data Model Changes

New entities/fields, with a migration sketch (`backend/src/main/resources/db/changelog/v1/NNN-description.sql`). Reference existing entities from `docs/specs/001-tenancy-identity-model.md` rather than redefining them.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| | | |

## UI Requirements

Which shared components this composes from (`docs/standards/design-system.md`), and what's new if anything.

## Test Plan

Which tiers (`docs/standards/testing.md`) and what specifically each one covers.

## Acceptance Criteria

Concrete, checkable statements — "a platform admin can X without Y" — not vague quality goals.

## Rollout Notes

Sequencing, feature flags if any, what ships first vs. later.
