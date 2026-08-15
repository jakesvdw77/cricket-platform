---
name: new-ui-component
description: Scaffolds a new shared UI component with the required four-file anatomy, after checking for an existing near-match to extend instead. Use when asked to add a reusable component.
---

1. Search `ui/src/components/**` and `docs/standards/design-system.md` for a component that already covers most of the need. If one is a near-miss, extend it with a prop/variant instead of scaffolding a new one — stop here if that's sufficient.
2. Otherwise, scaffold `ui/src/components/<area>/<ComponentName>/`:
   - `<ComponentName>.tsx` — built from `@mui/material` primitives, styled via the shared theme (`ui/src/theme.ts`) and `sx`, mobile-first (375px baseline). No Tailwind, no raw CSS, no competing styling system.
   - `<ComponentName>.test.tsx` — Testing Library, one meaningful interaction.
   - `<ComponentName>.stories.tsx` — Storybook, with the 375/768/1280 viewport addon.
   - `index.ts` — re-export only.
3. Server data, if any, comes through React Query calling a function in `ui/src/api/` — never axios/fetch directly in the component.
4. Run `npm run build`, `npm run test`, `npm run lint` from `ui/` before reporting done.
5. Push a matching static HTML preview for the new component to the "Cricket Legend Platform" Claude Design project (`DesignSync`), under the "Components" group, alongside the existing five — see `docs/standards/design-system.md`. The preview must reflect what's actually rendered (real MUI defaults — e.g. uppercase Button labels, 8px radius), not an idealised mockup. Skipping this step lets the Design pane drift out of sync with the real library.
