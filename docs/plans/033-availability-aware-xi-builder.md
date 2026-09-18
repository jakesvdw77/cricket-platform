# Plan: 033 — Availability-Aware Playing XI Builder

## Context

`docs/specs/033-availability-aware-xi-builder.md` (approved, on `feature/033-availability-aware-xi-builder`, branched off `master` now that `032`'s poll feature is merged) closes a small, specific gap `032` deliberately left open: an admin inside `PlayingXiBuilder` has no visibility into a squad candidate's availability-poll status without tabbing away to the Availability tab and back. This is a frontend-only change — no backend, no migration, no new endpoint. Every value needed is already served by `032`'s existing `GET .../polls` and `GET .../polls/{pollId}/responses` endpoints.

I independently read the current `PlayingXiBuilder.tsx` and the relevant section of `MatchFormPage.tsx` (both `MatchSideTab` and `MatchAvailabilityPanel`) before writing this plan — the spec's code snippets and query-key claims are verified accurate against the real files, not just plausible-sounding.

## Files to touch, in order

### 1. `ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx` (edit)

- New prop on `PlayingXiBuilderProps`: `availabilityByPlayerId?: Map<string, AvailabilityStatus>` (import `type { AvailabilityStatus }` from `../../api/matchAvailabilityApi`), defaulting to `new Map()` in the destructured params.
- New import: `alpha` from `@mui/material/styles` (matching `RecordCard.tsx`/`MatchAvailabilityTab.tsx`'s existing tinted-treatment convention — not a new color mechanism).
- A small local helper, e.g. `availabilityIndicator(status: AvailabilityStatus | undefined)`, returning `{ tint: boolean; caption: string | null }` or similar — `UNAVAILABLE` → `{ tint: true, caption: null }`, `UNSURE` → `{ tint: false, caption: 'Marked Unsure for this match' }`, everything else → `{ tint: false, caption: null }`. One shared helper, not four separate inline conditionals across four render sites.
- **Ordered XI rows** (the `.map((entry, index) => ...)` block, current single-line `Box`): wrap the existing name `Stack` (currently `direction="row"`) so the new caption line can render below it when present; apply the `UNAVAILABLE` tint to the row's own outer `Box` via `sx` (existing `border`/`borderRadius` styling untouched, just an added `bgcolor`).
- **"Add player" `Autocomplete`**: currently has no `renderOption` (default text rendering via `getOptionLabel`). Add one, rendering each option as `<Box component="li" {...props}>` — **must spread the supplied `props` onto the wrapping element**, this is the one easy way to accidentally break keyboard navigation/highlighting in a MUI `Autocomplete`'s option list — containing `squadDisplayName(option)` plus the `UNSURE` caption when applicable, with the `UNAVAILABLE` tint applied to that same `Box` via `sx`.
- **Twelfth Man `Select`'s `MenuItem`s** (`twelfthManOptions.map(...)`): same treatment as the Autocomplete option — tint via `sx` on the `MenuItem`, `UNSURE` caption as a second stacked line inside it.
- **Captain/Wicketkeeper `Select`s' `MenuItem`s** (`captainOptions.map(...)`, used by both): **no change** — deliberately excluded per spec.
- Nothing about `onAddPlayer`/`handleAdd`/`atCap`/cap logic changes — purely additive rendering, zero behavior change to any existing callback or validation path.

### 2. `ui/src/pages/manage/MatchFormPage.tsx` (edit — `MatchSideTab` only)

`MatchSideTab` (not `MatchAvailabilityPanel`, which is untouched) gains a second, small data fetch, reusing `matchAvailabilityApi.ts`'s `listPolls`/`getPollResponses` (already imported at the top of this file for `MatchAvailabilityPanel`'s own use — only `AvailabilityStatus` needs a new import) with the **identical query-key shape** `MatchAvailabilityPanel` already uses for the same match:

```ts
const pollsQuery = useQuery({
  queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
  queryFn: () => listPolls(clubId, matchId),
})
const poll = (pollsQuery.data ?? []).find((candidate) => candidate.teamId === teamId) ?? null
const responsesQuery = useQuery({
  queryKey: ['managed-club', clubId, 'matches', matchId, 'polls', poll?.id, 'responses'],
  queryFn: () => getPollResponses(clubId, matchId, (poll as MatchAvailabilityPoll).id),
  enabled: Boolean(poll),
})
const availabilityByPlayerId = useMemo(() => {
  const map = new Map<string, AvailabilityStatus>()
  ;(responsesQuery.data?.responses ?? []).forEach((row) => {
    if (row.status) map.set(row.playerProfileId, row.status)
  })
  return map
}, [responsesQuery.data])
```

**Critical: this new fetch does not gate `MatchSideTab`'s existing loading guard** (`sidesQuery.isLoading || squadQuery.isLoading || createSideMutation.isPending || !side`, line 122 today) — left exactly as-is. `availabilityByPlayerId` starts as an empty `Map` and the XI builder renders immediately as it does today; indicators simply appear once the poll data resolves. Building an XI is never blocked or delayed by poll data being slow, missing, or absent.

`availabilityByPlayerId={availabilityByPlayerId}` passed straight through to the existing `<PlayingXiBuilder>` call alongside its current props.

Two separate `useQuery({ queryKey: [..., 'polls'] })` calls now exist in this file (one in `MatchSideTab`, one in `MatchAvailabilityPanel`) with the identical key for the same match — this is intentional and correct: React Query dedupes/shares cache entries by key automatically, so this is one real network fetch per match, not two, regardless of how many components mount with that key.

### 3. Tests (frontend-builder writes these alongside the above, same PR — per `docs/standards/testing.md`, a shared component's behavior change needs its own coverage, not deferred to a separate pass)

`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.test.tsx` (extended) — per the spec's own Test Plan:
- No indicator anywhere when `availabilityByPlayerId` is omitted/empty (current appearance unchanged).
- `UNAVAILABLE` tint appears on both the Add-player option row and (once added) the ordered-XI row.
- `UNSURE` caption ("Marked Unsure for this match") appears in both of those same two places, exact text.
- `AVAILABLE` entry: no visual change anywhere.
- Twelfth Man `Select` options carry the same treatment as Add-player for an `UNAVAILABLE`/`UNSURE` squad member not in the XI.
- Captain/Wicketkeeper `Select` options carry **no** indicator regardless of status — assert absence explicitly.
- Clicking "Add player" for an `UNAVAILABLE`/`UNSURE` candidate still calls `onAddPlayer` exactly as today — nothing blocked/disabled by status.

`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.stories.tsx` (extended) — one new story passing a populated `availabilityByPlayerId` (mix of all four states across the fixture squad) so both treatments are visible in isolation, at the existing 375/768/1280 viewport addon.

### 4. `ui/e2e/manager-league-management.spec.ts` (extend — test-writer, after frontend-builder)

Per the spec's Test Plan End-to-end row: after the existing flow already builds a side's XI and exercises the poll (from `032`'s own extension), add — using a squad member who is *not yet* in the XI at that point in the script — a step that sets their public response to `Unavailable`, returns to the Home XI tab, and confirms the tinted option appears in the Add-player `Autocomplete`; adds them anyway and confirms the same tint now appears on their ordered-XI row; sets a different not-yet-added squad member's response to `Unsure` and confirms the exact caption text appears. Self-skips locally the same way `032`'s addition does (no live Keycloak `CLUB_ADMIN` fixture on this machine) — not a new gap, matching every prior spec's e2e precedent in this file.

## Agent assignment

1. **`frontend-builder`** — items 1–3 above (component change, `MatchSideTab` change, component test + story extensions). No `backend-builder` — spec confirms zero backend changes.
2. **`test-writer`** (after frontend-builder) — compares the spec's Test Plan against what frontend-builder actually wrote, fills item 4 (e2e extension) and any component-test gaps.

Then: manual smoke test in a real browser (per `CLAUDE.md`'s UI rule) — open a match with a squad and an existing poll with mixed responses, confirm the tint/caption render correctly in the Add-player picker, the ordered XI rows, and the Twelfth Man picker, and confirm adding an Unavailable/Unsure player still works normally — before commit/review.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook` — must pass clean (Node 22.12.0 via nvm).
- Manual smoke test per above.
- `npm run test:e2e` locally for the extended scenario (not CI-gated, same precedent as every prior `/manage` spec).
- No backend commands needed — nothing on that side changed.
