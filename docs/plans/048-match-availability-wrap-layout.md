# Plan: 048 — Match Availability Wrap Layout

## Context

`docs/specs/048-match-availability-wrap-layout.md` (draft) fixes two real, screenshot-confirmed problems on `MatchDetailPage.tsx`'s Availability section: (1) it renders last, after Home XI/Away XI, when it should be the first question a club admin asks; (2) `AvailabilityRespondentAvatars` truncates to a "+N" bubble the moment a status bucket exceeds 3 respondents (MUI `AvatarGroup max={4}`), even on a full-width section with ample room. The fix is a new, additive `layout?: 'compact' | 'wrap'` prop on the shared component — `compact` (default) is today's exact behavior, untouched, keeping `AvailabilityPollsDashboard.tsx`'s genuinely space-constrained card grid unaffected; `wrap` (opted into only by `MatchDetailPage`'s `SideAvailability`) shows every respondent as an individual, non-overlapping avatar wrapping onto as many lines as needed, falling back to a "+N" summary only past a generous cap (`WRAP_LAYOUT_MAX = 24`).

**The spec's own Rollout Notes flag a Claude Design pass before build** (new visual pattern, no existing precedent to copy the way `047` had). That pass already happened, informally but concretely: a live HTML mockup was built and shown to the user directly (three panels — today's truncation, the proposed wrap layout at the real screenshot's 9-Available data, and a 27-respondent case proving the `+N` fallback is a genuine last resort, not the default) and approved as-is ("yeah looks much better"). No further design-tool pass is needed before this build — the literal values below (gap, avatar size, cap) are already the approved values, not placeholders.

Direct reading confirmed:
- `AvailabilityRespondentAvatars.tsx` (58 lines) — its `compact`-equivalent block is exactly `respondents.length > 0 && <AvatarGroup max={4} sx={{...}}>...</AvatarGroup>` (lines 31-52), each avatar `28×28`, `0.6875rem`, `fontWeight: 600`, tinted `alpha(theme.palette[tone].main, 0.12)` bg / `${tone}.dark` text, `1px solid background.paper` border, each wrapped in a `Tooltip` showing `squadDisplayName(respondent)`. The trailing `count`/`STATUS_LABEL` `Typography` sits outside this block in the same outer `Stack direction="row" spacing={1} alignItems="center"`.
- `AvailabilityRespondentAvatars.test.tsx`/`.stories.tsx` — existing coverage is all implicitly `compact`-mode (no `layout` prop passed anywhere today); the "+N" overflow test (`respondents.length=5` → `"+2"` since `max=4` counts the overflow avatar itself) and the `MANY_RESPONDENTS` story fixture are useful references for `test-writer` to mirror in shape for the new `wrap`-mode cases, not to modify.
- `MatchDetailPage.tsx` — `sections` array (lines 232-300): `Details` first, then `Home XI` (`match.homeTeamId` gated) and `Away XI` (`match.awayTeamId` gated) spread blocks, then `Availability` (`hasAnyXiSide` gated) last. `SideAvailability` (lines 48-91) is a local component in the same file — its outer `Stack` (line 82) has no `alignItems` set today; its three `AvailabilityRespondentAvatars` calls (lines 83-85) pass no `layout` prop today.
- `046`'s `ContentCard` (confirmed via that spec, already merged) has no fixed/max height — a taller wrapped Availability section grows the card exactly like a longer `DetailFieldGrid` already does elsewhere. Nothing to special-case there.

## Files to touch, in order

### 1. `ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.tsx` (edited)

- Add `layout?: 'compact' | 'wrap'` to `AvailabilityRespondentAvatarsProps` (JSDoc-style comment per spec's own wording — default `'compact'`, additive).
- Export a module-level `WRAP_LAYOUT_MAX = 24` constant (named, not a magic number inline).
- Existing `AvatarGroup max={4}` block: gate it on `(layout ?? 'compact') === 'compact'`, otherwise **zero changes** to that branch's JSX/`sx` — this is a checkable requirement (a diff of that branch should show only the new surrounding conditional, nothing inside it changed).
- New `layout === 'wrap'` branch: a `Box` (`display: 'flex', flexWrap: 'wrap', gap: 1`) in place of `AvatarGroup`, rendering each respondent as its own `Avatar` (same size/tint/border `sx` as the `compact` branch's avatars — extract that `sx` object to a shared local const both branches reference, rather than duplicating it, per `docs/standards/frontend.md`'s reuse rule within a single file), each still wrapped in its existing `Tooltip`/`squadDisplayName`/`initialsFromName`. If `respondents.length > WRAP_LAYOUT_MAX`, render only the first `WRAP_LAYOUT_MAX` respondents' avatars plus one trailing summary `Avatar` showing `+${respondents.length - WRAP_LAYOUT_MAX}`, styled to match `AvatarGroup`'s own default (neutral) overflow-avatar look — same size, a neutral (non-tinted) background/text rather than the status tint, since it doesn't represent one specific respondent.
- The `count`/`STATUS_LABEL` `Typography` stays exactly where and as it is — outside both branches, unconditional.

### 2. `ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.test.tsx` (edited)

New cases per spec's Test Plan: `layout` omitted and `layout="compact"` both still show the "+N" truncated behavior for a 9-respondent input (proving zero regression); `layout="wrap"` with 9 respondents renders exactly 9 avatars, no overflow avatar; `layout="wrap"` at exactly `WRAP_LAYOUT_MAX` (24) renders all 24, no overflow avatar; `layout="wrap"` at `WRAP_LAYOUT_MAX + 1` (25) renders 24 avatars plus one `"+1"` avatar; the count/label caption is unchanged in both modes regardless of respondent count. Existing 6 tests stay as they are (already `compact`-shaped, still valid).

### 3. `ui/src/components/AvailabilityRespondentAvatars/AvailabilityRespondentAvatars.stories.tsx` (edited)

Add a `wrap`-mode story or two alongside the existing `compact` ones — at minimum a story mirroring the approved mockup's 9-respondent case (`layout: 'wrap'`) and one exercising the `WRAP_LAYOUT_MAX` fallback (25+ respondents), so the pattern is visible in Storybook the way every other new pattern in this codebase is. Existing stories (`Available`/`Unavailable`/`Unsure`/`OverflowBeyondMax`/`Empty`/`MobileViewport`) are unchanged — they're implicitly `compact` already and stay that way.

### 4. `ui/src/pages/manage/MatchDetailPage.tsx` (edited)

- **Section reorder**: move the `Availability` block (currently last, `...(hasAnyXiSide ? [...] : [])`) to immediately after the `Details` section object and before the `Home XI` spread block. No change to any section's own gating condition, heading, or content.
- **`SideAvailability`**: add `layout="wrap"` to all three `AvailabilityRespondentAvatars` calls. Add `alignItems: 'flex-start'` to the outer `Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap` (line 82) — per spec's explicit decision, so a multi-line-wrapped cluster doesn't visually center/stretch against a shorter sibling. The trailing `"{poll.noResponseCount} No response"` caption keeps its own existing `alignSelf: 'center'`, unaffected by this change (an item's own `alignSelf` always wins over the container's `alignItems`).
- No other change to `SideAvailability`'s loading/empty-poll branches, `matchFields`, `iconForMatchField`, or any query/loading logic.

### 5. `ui/src/pages/manage/MatchDetailPage.test.tsx` (edited)

New assertions per spec's Test Plan: rendered section headings place `Availability` before `Home XI`/`Away XI` in DOM order (query the existing `<Typography variant="subtitle2">` section headings `RecordDetailScreen` renders, same pattern `RecordDetailScreen.test.tsx` itself already uses for its own section-order test); for a fixture with more than 4 Available respondents, no "+N" overflow avatar appears (proving `wrap` mode is actually wired up, not just the prop existing); `SideAvailability`'s outer `Stack` computed `alignItems` is `flex-start`.

## Agent assignment

Frontend-only (spec's Data Model Changes / API Contract both "None").

1. **`frontend-builder`** — items 1, 3, 4 (the component's new `wrap` branch + `WRAP_LAYOUT_MAX`, its new Storybook stories, and `MatchDetailPage.tsx`'s reorder + opt-in + `alignItems` fix). Brief it explicitly:
   - `compact` mode must be a byte-for-byte no-op — extracting the shared avatar `sx` into a local const is fine (reduces duplication) but must not change any of that branch's rendered output.
   - `AvailabilityPollsDashboard.tsx` is not touched at all — confirm via grep that nothing there needs a prop change (it doesn't; it just keeps not passing `layout`).
   - The wrap layout's exact visual values (gap, avatar size/tint, overflow-avatar styling) come from the approved mockup, already reflected in item 1's description above — this is not a place to freelance a different spacing/size.
2. **`test-writer`** (after `frontend-builder`) — items 2, 5. Brief it to mirror the existing `AvailabilityRespondentAvatars.test.tsx`'s fixture-building style (`respondent()` helper) and `RecordDetailScreen.test.tsx`'s existing section-order-assertion pattern, not invent new query shapes.

## Flags for your review

- None substantive. The one thing worth restating: this plan treats the mockup you already approved as satisfying the spec's own "Claude Design pass" flag — if you'd still like a formal Claude Design tool pass before build (exact pixel values, a second look at the overflow-avatar's neutral styling), say so now; otherwise `frontend-builder` proceeds straight from the approved mockup's values.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test on a real match's detail page (`/manage/fixtures/matches/:id`) at 375px and desktop: Availability renders directly under Details, above Home XI/Away XI; a side with more than 4 Available respondents shows every avatar wrapped onto additional lines, not a "+N" bubble; `AvailabilityPollsDashboard` (`/manage/availability`) is visually and behaviorally unchanged.
