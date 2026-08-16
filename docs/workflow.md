# Feature Development Workflow

The repeatable spec-to-PR pipeline for this project, validated end to end on `docs/specs/003-club-onboarding.md` (backend-only) and `docs/specs/004-landing-page.md` (full stack, including a design-first pass through Claude Design). Follow this for every new feature unless there's a specific reason not to — consistency here is what makes each feature faster than the last, not slower.

This file describes *process*. Code shape still comes from `docs/standards/*.md`; this file just orders the steps and says which agent/skill/command does each one.

## The cycle at a glance

| # | Step | Tool |
|---|---|---|
| 1 | Write the spec | `/spec <feature description>` |
| 2 | Design new components (if any) | Claude Design, by hand |
| 3 | Pull the design into code | `design-token-sync` / `new-ui-component` skill |
| 4 | Branch | `git checkout -b feature/NNN-feature-name` |
| 5 | Plan the implementation | `/plan-feature NNN` |
| 6 | Build it | `backend-builder`, `frontend-builder` agents |
| 7 | Fill in the tests | `test-writer` agent |
| 8 | Smoke-test in a browser | `claude-in-chrome` |
| 9 | Commit in logical chunks | Conventional Commits, per `CLAUDE.md` |
| 10 | Review before PR | `standards-reviewer` agent |
| 11 | Open the PR | `gh pr create` |

## Step by step

### 1. Write the spec

Run `/spec <short feature description>`. This drives the `spec-author` agent, which reads `CLAUDE.md` and every `docs/standards/*.md` file, writes `docs/specs/NNN-feature-name.md` from the template, and touches no source code.

**Read it before moving on.** If the request has any real ambiguity — scope that could reasonably go two ways, a decision that contradicts an earlier spec's ADR — resolve it *before* the spec is written, not after. Cheaper to redirect a spec draft than a built feature.

### 2. Design new components (if any)

Not every feature needs this step — skip straight to step 3 if the feature composes entirely from existing `ui/src/components/**`. When it doesn't, the new spec's UI Requirements section should already say which pieces are genuinely new (see how `004-landing-page.md` called out `TestimonialCard`/`SocialLinksRow` explicitly, with a stated reason each was a real gap rather than a near-miss on an existing component).

For each new component: open the "Cricket Legend Platform" project in Claude Design and hand-author a static HTML/CSS preview matching the real token set (`docs/standards/design-system.md`'s token table — colours, 8px radius, the MUI type scale, `variant="outlined"` card styling). There's no code-generation pipeline here; the point is to settle the visual design and content shape before writing React, cheaply.

### 3. Pull the design into code

Run the `design-token-sync` skill's "pulling a change from Claude Design" flow, or `new-ui-component` directly if you're translating a fresh component with no existing near-miss. Either way:

- Scaffold the four-file anatomy (`Component.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`) per `docs/standards/frontend.md`.
- Match what MUI actually renders, not an idealised mockup — reuse real defaults (uppercase button labels, theme radius, etc.).
- Run `npm run build`, `npm run lint`, `npm run test`, and `npm run test:storybook` before moving on.
- Push a matching static preview back to Claude Design so the design pane doesn't drift ahead of the code.

### 4. Branch

`git checkout -b feature/NNN-feature-name`, off `master`, before any implementation work starts.

### 5. Plan the implementation

Run `/plan-feature NNN` — enters plan mode, reads the spec fully plus `CLAUDE.md`, every `docs/standards/*.md`, and any spec the new one depends on.

**The single most valuable thing this step does is surface gaps between what the spec assumes and what actually exists in code.** `004-landing-page.md` assumed `Club`/`Person` entities and Keycloak auth already existed — they didn't, because `001`/`002`/`003` were specs, not yet implementations. That gap got caught here, not mid-build. When plan mode finds something like this:

- **Don't quietly patch around it.** Use `AskUserQuestion` and lay out real options (e.g. "build a minimal prerequisite slice," "ship the reduced scope now," "stop and build the dependency first") with a recommendation.
- Write the resolution into the plan file's own "Flags for your review" section so it's visible at `ExitPlanMode` approval time, not buried in a tool call.
- If the decision changes what the spec itself documents (new entities, a changed API contract), the *spec* needs a follow-up edit once built — see step 6's note on this.

Only call `ExitPlanMode` once you're not guessing about scope.

Once approved, the plan is copied into `docs/plans/NNN-feature-name.md` — a git-tracked permanent record alongside the spec it implements. The working copy Claude Code keeps under `~/.claude/plans/` is a scratch file, not part of the repo's history.

### 6. Build it

Dispatch `backend-builder` and `frontend-builder` (in that order if the frontend depends on real backend endpoint shapes) via the `Agent` tool, each with a **self-contained prompt** — they start with zero conversation context, so restate exactly which files to touch, the relevant DTO/endpoint shapes, and any constraints the plan settled (e.g. "don't build the full scope-walk auth model, only the flat role check").

**Independently verify every agent's report before trusting it.** Re-run the build/lint/test commands yourself — don't just relay what the agent said passed. This caught real things: a stale process an agent killed without asking, a package-lock regenerated wider than expected, a Storybook config change worth a second look.

**If something discovered mid-build should become a durable rule** (e.g. "pagination must be backend-driven, never client-side"), add it to `docs/standards/backend.md`/`frontend.md` immediately, and check whether any agent currently mid-flight needs a course-correction message (`SendMessage` to the running agent) rather than a fix-it-later note. Update the spec file too if the change alters something it documented (an API contract row, a data model assumption) — the spec should never describe something the code no longer does.

### 7. Fill in the tests

Dispatch `test-writer` — but first, **compare the spec's Test Plan section against what actually exists on disk.** Builder agents sometimes write the tests they think of as they go, which can leave real gaps against what the spec asked for (a missing bean-validation unit test, no controller-level integration test exercising security, zero E2E setup at all). Name the specific gaps in the prompt rather than a generic "write the tests."

Independently verify again: re-run `mvn test`, `npm run test`, and (once bootstrapped) `npm run test:e2e` yourself.

### 8. Smoke-test in a browser

`CLAUDE.md`'s own rule for UI/frontend changes: use the feature in a real browser before calling it done. Use the `claude-in-chrome` skill — start both dev servers, walk the actual golden paths a user would (fill and submit forms, follow redirects, check empty states), and verify server-side effects where relevant (a database row actually persisted, not just a success toast).

This step is not redundant with automated tests. It caught a real bug in `004` — a hardcoded `https://` redirect that every E2E assertion missed because the test intercepted the navigation request before the browser ever tried to load the page and hit the scheme mismatch. Manual browsing hit the real failure; the automated test didn't.

### 9. Commit in logical chunks

Per `CLAUDE.md`'s Commit Convention (Conventional Commits, `type(scope): summary`). **Don't bundle everything into one commit** — split by concern the same way the work was actually done: spec changes, standards changes, backend feature, backend tests, frontend feature, frontend tests/E2E bootstrap. Each should tell its own story in `git log`.

### 10. Review before PR

Dispatch `standards-reviewer` (or run `/code-review`) over the *whole branch diff against `master`*, not just the last commit — `git diff master...feature/NNN-feature-name`. Give it the spec, the standards docs, and specific things to scrutinize given the branch's own history (e.g. "a standard was added mid-implementation — check the code that predates it actually follows it").

**Verify every finding against the actual code before fixing it** — don't fix on the review's word alone, confirm the claim first (a wrong finding fixed anyway is wasted work and possible new bugs). For findings that check out, fix for real, re-verify the full test suite, and commit the fixes separately with a note that they came from the review pass — that history is useful later.

### 11. Open the PR

Push the branch (`git push -u origin feature/NNN-feature-name`) and `gh pr create` with a summary that reflects the actual diff: what was built, what was tested and how, and anything genuinely unverified (e.g. "CI job added but not yet run in real GitHub Actions") called out explicitly rather than implied as done.

## Why this works (the parts worth not skipping)

- **Flag spec/reality gaps to a human — never quietly reinterpret them.** The plan step exists specifically to catch these before code gets written around a wrong assumption.
- **Verify, don't trust.** Every agent's final report is a claim about what it did, not proof. Re-running the actual build/test/lint commands yourself is cheap insurance against an agent's mistake — or its own mistaken confidence — compounding into the next step.
- **Manual smoke testing and automated tests catch different bugs.** Neither replaces the other.
- **Standards docs are living, not fixed at project start.** When something new and durable is learned mid-feature, write it down immediately, and check whether it applies retroactively to work already in flight.
- **Small, scoped commits and an adversarial review pass are cheap relative to the alternative** — a large diff that's hard to review honestly, or a bug that ships because nothing re-checked the diff against the spec it was supposed to implement.
