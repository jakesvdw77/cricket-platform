# 033 — Availability-Aware Playing XI Builder

**Depends on:** `029-league-management.md` (`PlayingXiBuilder`, `ui/src/components/PlayingXiBuilder/` — the component this spec augments with a new prop and two new visual treatments, not replaces; `MatchFormPage.tsx`'s `MatchSideTab` — the page-local wrapper this spec gives a second, small data fetch to, mirroring `MatchAvailabilityPanel`'s existing shape rather than inventing a new one), `032-match-availability-polls.md` (`MatchAvailabilityPoll`/`PlayerAvailability`, the `AvailabilityStatus` enum, and the existing admin endpoints `GET .../matches/{matchId}/polls` and `GET .../polls/{pollId}/responses` — this spec's only data source, read-only, unmodified; `MatchAvailabilityTab.tsx`'s tinted-status visual convention, reused verbatim rather than redesigned).
**Status:** draft.

## Problem & Goals

`029` built `PlayingXiBuilder` with no notion of who's actually available for a match — an admin picking a batting order works entirely from the team's squad list, blind to whether a given player has already said they can't make it. `032` closed that information gap on the *admin's own poll-reading side* (a response-count summary and a read-only squad list on a new Availability tab), but deliberately kept it fully independent from XI selection — its own Non-goals named this explicitly: "no 'auto-add players who said Available' automation... an admin reads the Availability tab and still manually builds the XI in the existing `PlayingXiBuilder`." That's still true after this spec — nothing here changes how a player gets added to an XI. What's missing is smaller and more specific: while an admin is actually inside `PlayingXiBuilder` picking players, they have to tab away to Availability and back to check whether the player they're about to add has said Unavailable. This spec closes that one gap — it surfaces the same poll data `032` already serves, inline, at the two moments an admin is actually looking at a specific player's name in `PlayingXiBuilder` itself.

**Goals**
- A club admin building a playing XI sees, without leaving `PlayingXiBuilder`, a visual indicator on any squad candidate in the "Add player" `Autocomplete` who has responded `UNAVAILABLE` or `UNSURE` to that side's poll (if one exists).
- The same indicator appears on a player's own row in the ordered XI list if their current poll status is `UNAVAILABLE`/`UNSURE` — covering the case where a poll opens, or a player's response changes, after they were already added.
- `UNAVAILABLE` and `UNSURE` get two distinct, purpose-fit treatments — a red full-row/option colour tint plus a caption for `UNAVAILABLE`, an orange/warning full-row/option tint plus a caption for `UNSURE` — not one generic "flagged" state, and not text-only for either (revised after a live browser review found a subtle 12%-opacity tint with no colour at all on the `UNSURE` side too easy to miss — see Rollout Notes).
- This is informational only: an admin can still add, keep, or select any player regardless of status. No new validation, no new rejected-add case.
- No backend change of any kind — every field this spec needs is already served by `032`'s existing endpoints.

## Non-goals

- **Blocking or disabling the add action for an `UNAVAILABLE`/`UNSURE` player.** Deliberate — "admin stays in control," not an oversight. The indicator is advisory; `onAddPlayer` fires exactly as it does today regardless of status.
- **Any backend change** — no new entity, no new endpoint, no migration, no DTO change. `Data Model Changes` and `API Contract` below are both `None`.
- **Auto-linking poll responses into XI selection** (e.g. auto-removing an `UNAVAILABLE` player, auto-suggesting `AVAILABLE` ones) — still exactly the Non-goal `032` already named; this spec only makes the existing, already-visible-elsewhere data visible in one more place.
- **Any change to `029`'s existing age-eligibility, squad-cap, or twelfth-man validation rules.** Unrelated and unchanged — a server rejection for those reasons still surfaces via `PlayingXiBuilder`'s existing `errorMessage` prop, untouched by this spec.
- **Any change to `MatchAvailabilityTab.tsx` or the public `PublicAvailabilityPoll.tsx` page.** Both stay exactly as `032` built them — this spec is a one-directional read into `PlayingXiBuilder`, not a second surface for opening/closing polls or reading response counts.
- **An indicator on the Captain/Wicketkeeper `Select`s.** A deliberate scope decision, not an oversight — see UI Requirements' dedicated sub-decision below.
- **Any automated notification when a player's availability status changes** — no push, no email, no toast outside the component itself; matches `032`'s own "no automated delivery of any kind" Non-goal.
- **A new Claude Design pass.** This spec reuses `032`'s already-approved, already-shipped tinted-status visual language verbatim — see UI Requirements' dedicated note below for why that's a considered call, per `docs/standards/design-system.md`'s own Workflow step 4, not a shortcut.
- **Any change to how/when a poll is created or opened.** If no poll exists yet for a side, `PlayingXiBuilder` shows no indicators at all and never prompts the admin to open one from within itself — that prompt already exists, unchanged, on the Availability tab (`032`).

## User Stories

- As a club admin adding a player to the XI, I can see in the "Add player" `Autocomplete`'s option list which squad candidates have said `Unavailable` or `Unsure` for this match, before I add them.
- As a club admin who's already added a player to the ordered XI, I can see the same indicator on that player's own row if their current poll status is `Unavailable`/`Unsure` — even if that status changed, or the poll was opened, after they were added.
- As a club admin, I can still add, keep, or select any player regardless of their availability status — nothing is blocked.
- As a club admin picking a Twelfth Man, I can see the same indicator on that `Select`'s own options, for the same reason I see it in the "Add player" `Autocomplete` — both are "picking a player from the squad" moments.
- As a club admin, I see no indicator at all for a player who's `Available`, or for a side with no poll yet, or for a squad member who simply hasn't responded — this feature never implies a poll is required to build an XI.

## Data Model Changes

None. This spec adds no entity, no field, no migration. Every value it displays — `AvailabilityStatus` per squad member — is already returned by `032`'s `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/responses` (`MatchAvailabilityPollResponsesDto.responses: PlayerAvailabilityRowDto[]`, each row carrying `playerProfileId`/`status`).

## API Contract

None. No new endpoint, and no change to any existing one. This spec is entirely a frontend consumer of `032`'s already-shipped, unmodified admin endpoints:

| Endpoint | Access | Purpose (unchanged, `032`) |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls` | `@access.canAdministerClub` | Resolves whether a poll exists for this side (and its `id`) — already fetched by `MatchAvailabilityPanel`; this spec's `MatchSideTab` change fetches the identical resource via the identical query key (see UI Requirements), not a second copy. |
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/responses` | `@access.canAdministerClub` | Resolves each squad member's current `status` — the only field this spec reads. |

## UI Requirements

**No new component, no new Claude Design pass.** This spec extends `ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx` and `ui/src/pages/manage/MatchFormPage.tsx`'s existing `MatchSideTab` — both already-built, already-shipped surfaces — and reuses `MatchAvailabilityTab.tsx`'s exact tinted-status visual language (`alpha(theme.palette.success/error/warning.main, 0.12)` backgrounds, `${status}.dark` text — itself matching `RecordCard.tsx`'s own tinted-badge precedent) rather than inventing anything new. Per `docs/standards/design-system.md`'s Workflow step 4 ("a screen needing a new visual pattern spins that off as a library addition first"): this screen does not need that step, since the pattern this spec needs already exists and already shipped in `032` — a deliberate, considered call, not a shortcut taken without thought.

### 1. `PlayingXiBuilderProps` — one new prop

```ts
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
export type { AvailabilityStatus } // re-exported, matching PlayingRole's existing re-export above

export interface PlayingXiBuilderProps {
  // ...unchanged...

  // docs/specs/033-availability-aware-xi-builder.md — this side's current poll responses, keyed by
  // playerProfileId. Absent key = no poll yet for this side, or that squad member hasn't responded
  // (status: null on the server's PlayerAvailabilityRowDto) — both render no indicator at all
  // (graceful no-op, per Non-goals). AVAILABLE entries are included but render no visual treatment
  // (see below) — the component owns 100% of the display decision for a given status, the caller
  // just passes through whatever the server returned. Defaults to an empty Map when the poll/
  // responses queries haven't resolved yet or don't apply — never blocks rendering the rest of the
  // builder (see MatchSideTab change below).
  availabilityByPlayerId?: Map<string, AvailabilityStatus>
}
```

Default value inside the component's destructuring: `availabilityByPlayerId = new Map()`.

### 2. `MatchSideTab` (`MatchFormPage.tsx`) — one new data fetch, mirroring `MatchAvailabilityPanel`'s existing shape exactly

`MatchSideTab` gains its own fetch of the same side's poll responses, reusing `matchAvailabilityApi.ts`'s existing `listPolls`/`getPollResponses` functions and **the identical query-key shape** `MatchAvailabilityPanel` already uses for the same match — not a new data-fetching pattern, and not a second, differently-shaped cache entry for the same underlying resource:

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
    if (row.status) {
      map.set(row.playerProfileId, row.status)
    }
  })
  return map
}, [responsesQuery.data])
```

`listPolls`/`createPoll`/`getPollResponses`/`MatchAvailabilityPoll` are already imported at the top of `MatchFormPage.tsx` for `MatchAvailabilityPanel`'s own use — `MatchSideTab` reuses those same imports, no new import statement needed beyond `AvailabilityStatus`.

**This new fetch does not gate `MatchSideTab`'s existing render condition.** The current guard (`sidesQuery.isLoading || squadQuery.isLoading || createSideMutation.isPending || !side`) is unchanged — `pollsQuery`/`responsesQuery` load asynchronously in the background and `availabilityByPlayerId` simply starts empty (no indicators) until they resolve, then re-renders with indicators once they do. Building an XI is never blocked or delayed waiting on poll data, consistent with the "graceful no-op when there's no poll yet" decision.

`availabilityByPlayerId={availabilityByPlayerId}` is passed straight through to `<PlayingXiBuilder>` alongside the existing props.

### 3. Visual treatment — two distinct mechanisms, not one generic flag

- **`UNAVAILABLE` → red full-row/option tint plus a caption.** `bgcolor: (theme) => alpha(theme.palette.error.main, 0.16)` on the row/option itself, plus a second line of inline text under the player's name: `<Typography variant="caption" color="error.dark">Unavailable for this match</Typography>`.
- **`UNSURE` → orange/warning full-row/option tint plus a caption.** `bgcolor: (theme) => alpha(theme.palette.warning.main, 0.16)`, plus `<Typography variant="caption" color="warning.dark">Marked Unsure for this match</Typography>` — the exact copy, chosen so a builder agent doesn't have to invent any.
- **Revised from this spec's original draft**, which gave `UNAVAILABLE` a tint with no caption and `UNSURE` a caption with no tint (the user's own initial framing — "highlight" for Unavailable, "a warning message" for Unsure — read as two different mechanisms). A live browser review after the first build found the 12%-opacity error tint too subtle to register as an indicator at all next to the text-only Unsure treatment, and asked for both statuses to read as an obvious full-row colour (red vs orange, the common traffic-light convention) — color is never the only signal, so both keep their caption too, just symmetrically now. Opacity raised from 12% to 16% to read clearly against the row's own border/background at the same time.
- **`AVAILABLE` and no-entry → no visual change at all.** Matches the current, unmodified row/option appearance exactly.

**Where this applies, precisely:**

| Location | Current shape | Change |
|---|---|---|
| "Add player" `Autocomplete` option rows | Default MUI text rendering via `getOptionLabel`, no `renderOption` | Add a `renderOption` rendering each option as a `Box component="li"` (spreading the supplied `props`) containing the existing `squadDisplayName(option)` text plus, for `UNSURE` only, the caption line below it; the `Box` itself carries the `UNAVAILABLE` background tint via `sx` when applicable. |
| Ordered XI list rows | A single-line `Stack direction="row"` holding name + Captain/Keeper `Chip`s | Wrap in an outer `Stack direction="column"` so the existing name row can sit above the new `UNSURE` caption line; the row's own outer `Box` (already styled with `border`/`borderRadius`) gains the `UNAVAILABLE` background tint via `sx` when applicable. |
| Twelfth Man `Select` options (`MenuItem`s) | Plain-text `MenuItem` | **Included — see sub-decision below.** `UNAVAILABLE` tints the `MenuItem` itself via `sx`; `UNSURE` appends the same caption text as a second line inside the `MenuItem` (a `Box` wrapper with two stacked `Typography`s, since a `MenuItem` can wrap onto two lines at this width without layout breakage). |
| Captain/Wicketkeeper `Select` options (`MenuItem`s) | Plain-text `MenuItem` | **Not included — see sub-decision below.** No change. |

### 4. Sub-decisions, named explicitly rather than left implicit

- **Twelfth Man `Select` options: included, same treatment as the "Add player" `Autocomplete`.** Both are "picking a player from the squad" moments with identical framing — the Twelfth Man picker draws from the same `notYetAdded` pool the Autocomplete does. Consistency wins here; excluding it would make one "pick a squad member" control informative and an adjacent, structurally identical one silent, for no principled reason.
- **Captain/Wicketkeeper `Select` options: deliberately excluded.** Both selects are scoped only to players already in the ordered XI (per `029`) — the exact same information is already visible on that player's own row, directly above or below these selects, in the ordered list this spec already flags. Repeating it inside a smaller, denser control adds visual noise without adding information. A deliberate scope decision, not an oversight.
- **The `UNSURE` warning's copy and placement: "Marked Unsure for this match", as a second line directly under the player's name** (not an icon+tooltip, and not a separate alert banner) — chosen for a 375px-first component (`docs/standards/frontend.md`): a tooltip requires a hover/press interaction that doesn't reveal itself passively on a touch viewport, and a page-level banner can't scope itself to one specific player among several. An inline caption under the name is always visible, requires no interaction, and reads unambiguously as belonging to that one row/option.

**Mobile-first**, per `docs/standards/frontend.md` — every treatment above (background tint, second caption line) is a plain colour/typography change to markup that already stacks full-width at 375px; nothing here introduces horizontal scrolling, a new breakpoint, or a control that doesn't already work at that width.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | None — no new `@Service` method or business rule. |
| Integration | None — no new repository query. |
| Contract | None — no new/changed endpoint or DTO; nothing to diff against the OpenAPI schema. |
| Component | `PlayingXiBuilder.test.tsx` extended — no indicator renders anywhere when `availabilityByPlayerId` is omitted/empty (the current, unmodified appearance); an `UNAVAILABLE` entry renders the tinted background on that player's Add-player option row and, once added, on their ordered-XI row; an `UNSURE` entry renders the exact "Marked Unsure for this match" caption in both of those same two places; an `AVAILABLE` entry renders no visual change in either place; the Twelfth Man `Select`'s options carry the same treatment as the Add-player `Autocomplete` for an `UNAVAILABLE`/`UNSURE` squad member not currently in the XI; the Captain and Wicketkeeper `Select`s' options carry **no** indicator regardless of status (asserting absence, not just non-testing it); clicking "Add player" for an `UNAVAILABLE`/`UNSURE` candidate still calls `onAddPlayer` exactly as it does today — nothing is blocked or disabled by status. Storybook story (`PlayingXiBuilder.stories.tsx`) extended with one example passing a populated `availabilityByPlayerId` (a mix of `AVAILABLE`/`UNAVAILABLE`/`UNSURE`/no-entry across the fixture squad) so the two treatments are visible in isolation, matching the viewport addon convention (`docs/standards/design-system.md`, 375/768/1280). |
| End-to-end | Extends `032`'s existing golden path (which already builds a side's playing XI, then opens that side's poll and sets a squad member's status via the public link) rather than a new standalone path: after setting a not-yet-added squad member's public response to `Unavailable`, return to `MatchFormPage`'s Home XI tab and confirm the red-tinted "Unavailable for this match" treatment appears on that player's option in the "Add player" `Autocomplete`; add them to the XI anyway and confirm the same treatment now appears on their ordered-XI row; set a different squad member's response to `Unsure` via the public link and confirm the orange-tinted "Marked Unsure for this match" treatment appears wherever that player's name is shown in the builder. Not wired into CI, same precedent as every prior `/manage` spec. |

## Acceptance Criteria

- A squad candidate who has responded `Unavailable` or `Unsure` to this side's poll carries a visual indicator in the "Add player" `Autocomplete`'s option list, before an admin adds them.
- A player already in the ordered XI whose current poll status is `Unavailable`/`Unsure` carries the same indicator on their own row in the ordered list.
- `Unavailable` renders a red-tinted row/option with an "Unavailable for this match" caption; `Unsure` renders an orange-tinted row/option with a "Marked Unsure for this match" caption — two visibly distinct colour treatments, not one generic flag and not text-only for either status.
- An admin can add, keep, or reorder any player regardless of their availability status — no add is blocked, disabled, or rejected because of it.
- The Twelfth Man `Select`'s own options carry the same indicator as the "Add player" `Autocomplete`; the Captain and Wicketkeeper `Select`s' options carry no indicator.
- A player who is `Available`, or a side with no poll yet, or a squad member with no response yet, shows no indicator anywhere in `PlayingXiBuilder`.
- No backend endpoint, DTO, or database schema changed to ship this spec.

## Rollout Notes

- **Frontend-only PR, no backend deploy coordination needed.** Ships entirely on top of `029`'s already-built `PlayingXiBuilder`/`MatchSideTab` and `032`'s already-built, unmodified admin poll endpoints — no migration, no API version bump.
- **No Claude Design pass required, stated explicitly rather than skipped silently.** This spec's own UI Requirements section names the exact reasoning: the visual language it needs (`alpha(theme.palette.success/error/warning.main, ...)` tinted treatments) already exists and already shipped in `032`'s `MatchAvailabilityTab`/`RecordCard` precedent — reused verbatim, not redesigned. Per `docs/standards/design-system.md`'s Workflow step 4, a genuinely new visual pattern gets spun off as a library addition first; this spec's own position is that it isn't one.
- **UI Requirements §3 was revised once, post-build, after a live browser smoke test.** The first build shipped exactly the original draft (tint-only for `UNAVAILABLE`, caption-only for `UNSURE`); a real click-through found the indicator too subtle to notice at a glance. Both statuses now get a full-row/option colour tint (red/orange) plus their caption, tint opacity raised 12%→16%. This is the shipped, current behavior — the spec text above already reflects it, not the original draft.
- **Both named sub-decisions (Twelfth Man included, Captain/Wicketkeeper excluded) are considered, stated calls, not default omissions** — see UI Requirements §4 for the reasoning; a future spec revisiting either should treat this as the prior deliberate decision, not an oversight to "fix."
- **Still fully independent of XI selection mechanics**, matching `032`'s own Non-goal: nothing here auto-adds, auto-removes, or auto-suggests a player based on their availability status. An admin who ignores every indicator on screen can still build exactly the XI they intend to.
- No `docs/roadmap.md` entry needed — this spec doesn't resolve or open a roadmap-level item; `032`'s own roadmap entry (the login-gated `/player` availability view, still open) is unaffected by this spec, which touches only the admin-side `PlayingXiBuilder`.
