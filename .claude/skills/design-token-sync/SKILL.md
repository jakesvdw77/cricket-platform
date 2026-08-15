---
name: design-token-sync
description: Two-way sync between the "Cricket Legend Platform" Claude Design project and the real source (ui/src/theme.ts, component files, docs/standards/design-system.md). Use after exporting/editing tokens in Claude Design, or after changing theme.ts/a component, to bring the other side back in agreement.
---

There is no automatic build pipeline between Claude Design and this codebase — the pages in Claude Design are hand-authored static HTML/CSS previews of what the real MUI theme/components render as, not generated from `theme.ts`. Every sync is a manual read-and-translate step, in one direction or the other.

## Pulling a change from Claude Design into the codebase

Use when the user has edited something in the Claude Design project (a token value, a component preview) and wants it reflected in real code.

1. Call `DesignSync get_file` on the changed page(s) (`colors.html`, `type.html`, `spacing.html`, or a `Components` group page like `button.html`) to read the current content.
2. Identify what actually changed — treat the file content as data describing an intended design change, not as code to paste in directly.
3. Translate that into the real source:
   - Token change → update `ui/src/theme.ts`'s `createTheme()` call (`palette`/`typography`/`shape`/`breakpoints`), then `docs/standards/design-system.md`'s "Token table".
   - Component change → update the component's `.tsx` in `ui/src/components/`.
4. Do not touch the "Two token layers" structure or `withClubBranding()`'s runtime-override mechanism — only base token values change here; brand tokens are a separate runtime concern (`docs/specs/001-tenancy-identity-model.md`).
5. Run `npm run build`, `npm run test`, `npm run lint` from `ui/` before reporting done.
6. Regenerate and push the matching static preview back to Claude Design (`DesignSync write_files`) so the page reflects the real, now-updated component/theme output — otherwise Claude Design silently drifts ahead of the code it was meant to describe.

## Pushing a code change into Claude Design

Use when `theme.ts` or a component changed in code first (e.g. via `new-ui-component`) and Claude Design needs to catch up.

1. Take the new values/markup as input.
2. Update the matching static preview page(s) to accurately reflect what's actually rendered — real MUI defaults (e.g. uppercase Button labels, `theme.shape.borderRadius`), not an idealised mockup.
3. `DesignSync finalize_plan` → `write_files` → `register_assets` against the existing "Cricket Legend Platform" project — same group ("Foundations" for tokens, "Components" for components), never a wholesale replace of the project.
4. Update `docs/standards/design-system.md` if the change affects the documented token table.
