# 062 — League Detail Redesign: Implementation Plan

## Context

`docs/specs/062-league-detail-redesign.md` (approved) rebuilds `LeagueDetailPage.tsx` on the bespoke `PageHeaderBand` + `Card` grid pattern already established by `056` (`ClubOverviewPage`), `057` (`TeamDetailPage`), and `060` (`PlayerDetailPage`) — replacing the generic `RecordDetailScreen`-driven stacked-section layout, which after this change has no consumer left among the four "big" entity detail pages (only smaller ones — Sponsor, Season, Club Contact, League Contact, Match — still use it, unaffected here). The user reviewed and approved an HTML mockup (`https://claude.ai/artifact/Y6SN8mS2JP46F1Eq4RpbeK`) before the spec was written; the spec transcribes that mockup. This is a pure frontend, read-only presentation restructure — no backend, data-model, or API change, no change to `LeagueFormPage` (edit side).

Net effect: Schedule (`NextMatchCountdown` + `LeagueFixtures`) becomes a visually distinct hero card right under the header; league-level facts (format, Playing XI size, age range, Active/Inactive) become header chips instead of a "Details" section; Contacts becomes a compact tap-to-view icon row (matching Club/Team's own Contacts card) paired with the slimmed-down Details card; Teams becomes a denser 4-up logo-tile grid via a new page-local tile component; Playing Conditions is unchanged in content, just moved to the bottom.

## Files to touch

| File | Change |
|---|---|
| `ui/src/pages/manage/LeagueDetailPage.tsx` | Full rewrite: bespoke header + hero + card grid, per spec's UI Requirements |
| `ui/src/pages/manage/LeagueDetailPage.test.tsx` | Full rewrite to match the new structure (existing assertions target markup that no longer exists) |
| `docs/plans/062-league-detail-redesign.md` | This plan, copied verbatim once approved (git-tracked record) |

No other file changes. `NextMatchCountdown`, `LeagueFixtures`, `ShareScheduleDialog`, `PlayingConditionsShareDialog`, `RecordIconButton`, `RecordQuickViewDialog`, `PageHeaderBand`, `Card`, `DetailFieldRow`/`DetailFieldGrid`, `RecordCard`'s exported `avatarSx`/`badgeSx`, `badgeFor`/`LEAGUE_FORMAT_LABELS` (from `LeagueList.tsx`/`leagueApi.ts`), and `badgeFor`/`fullName` (from `utils/leagueContact.ts`) are all reused unmodified — confirmed by reading each one this session.

## `LeagueDetailPage.tsx` — concrete shape

Reference implementations to mirror line-for-line where the pattern is identical: `TeamDetailPage.tsx` (header shape, `CardHeaderRow` local helper, Contacts icon-row + dialog, page-local dense tile component precedent via its own `SquadPlayerTile`) and `PlayerDetailPage.tsx` (header chip row under the name).

**Imports to add:** `PageHeaderBand`, `Button as MuiButton` + `Link as RouterLink` (header back-link/edit-button), `ArrowBackIcon`, `EditOutlinedIcon`, `alpha` from `@mui/material/styles`, `avatarSx`/`badgeSx` from `../../components/RecordCard`, `RecordIconButton`, `RecordQuickViewDialog`, an icon for the Schedule hero's title (e.g. `EventOutlinedIcon`, matching `TeamDetailPage`'s own usage of it for a "matches" concept).
**Imports to drop:** `RecordDetailScreen` itself (keep `DetailFieldRow`/`DetailFieldGrid` from the same module — still used inside individual `Card`s), `RecordCard` component import (no longer used directly — Teams stops using it; keep only the `avatarSx`/`badgeSx` named imports from that same file).

**Component structure**, top to bottom:

1. **Header** — `PageHeaderBand` containing:
   - Back link: `MuiButton` + `ArrowBackIcon`, "Back to Leagues" → `/manage/fixtures/leagues` (unchanged destination).
   - Row: avatar (`league.logoUrl`, `rounded`, `avatarSx(56)`, initials fallback) + name (`h6`, bold, `noWrap`) + chip row underneath:
     - Format chip — only when `league.format` is set: `<Chip size="small" variant="outlined" label={LEAGUE_FORMAT_LABELS[league.format]} />`.
     - Playing XI size chip — always: `Playing XI: ${league.maxPlayingXiSize}` (with `GroupsOutlinedIcon`, already imported).
     - Age range chip — only when `minAge != null || maxAge != null`: `${minAge ?? 'Any'}–${maxAge ?? 'Any'}` (with `CakeOutlinedIcon`, already imported).
     - Teams/fixtures count chip — always: `${affiliationsForSeason.length} team${affiliationsForSeason.length === 1 ? '' : 's'} · ${matchCount} fixture${matchCount === 1 ? '' : 's'}`, where `matchCount = matchesQuery.data?.content.length ?? 0`. **Computed from the page's own selected-season data (`affiliationsForSeason`, `matchesQuery`), not `league.currentSeasonTeamCount`/`currentSeasonLabel`** — those reflect the club's "current" season specifically, which can differ from the season this page's picker has selected (call this out explicitly in the PR description so a reviewer doesn't "simplify" it back to the League DTO fields).
     - `badgeFor(league)` (existing import from `LeagueList.tsx`) — Active/Inactive, `sx={badgeSx(badge.tone)}`, same as `TeamDetailPage`'s badge chip.
   - Right side: season `<Input select>` (unchanged `MenuItem` loop over `seasonsQuery.data`, same `selectedSeasonId`/`setSelectedSeasonId`), then Edit `MuiButton` → `/manage/fixtures/leagues/${league.id}/edit`, styled identically to `TeamDetailPage`'s/`PlayerDetailPage`'s Edit button (`alpha(primary.main, 0.12)` background, `primary.dark` text, transparent border).

2. **Schedule hero** — full-width `Card`, rendered immediately after the header, before every other section:
   - Header row (local `CardHeaderRow`-style, or inline): icon + "Schedule" (or "Schedule — `${seasonLabel}`") title, and the existing Share button (`ShareOutlinedIcon`, `onClick={() => setShareOpen(true)}`) — unchanged from today's Fixtures section's Share button.
   - Body: `<Stack spacing={3}>` with `NextMatchCountdown` then `LeagueFixtures`, exactly as today's Fixtures section content, unchanged props.
   - Visually distinguished: pass `sx` to this one `Card` only — e.g. `border: '1.5px solid', borderColor: alpha(primary.main, 0.2)`, plus `boxShadow: '0 8px 24px -12px ' + alpha(primary.main, 0.35)` (values from the approved mockup's `.hero-card` CSS, translated to `sx`/`alpha`). Every other `Card` on the page stays the library's default (`variant="outlined"`, no extra border/shadow).
   - When there are no seasons yet, keep today's exact fallback copy ("No seasons yet — matches are scheduled…") inside this same hero card — it does not collapse or move.

3. **Details + Contacts** — `Box` grid `{ xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }`, gap 2 (same shape as `ClubOverviewPage`'s/`TeamDetailPage`'s Contacts+Sponsors row):
   - **Details `Card`**: `CardHeaderRow` title "Details" (no action). Same `position: relative` + `DetailFieldGrid` + absolutely-positioned `SocialLinksRow` block as today's Details section, but with the Playing XI size / age range `DetailFieldRow`s removed (they moved to header chips) — keep only Phone / Email / Website rows and the `SocialLinksRow`.
   - **Contacts `Card`**: `CardHeaderRow` title "Contacts". Body: when `contactsQuery.data` is empty, keep today's exact copy "No contacts yet for this league."; otherwise a `Stack direction="row" flexWrap="wrap" useFlexGap` of `RecordIconButton`s — one per contact, `shape="circular"`, `imageUrl` omitted (League contacts have no photo field — confirmed via `leagueContactApi.ts`'s `LeagueContact.contact` shape), `name={contactFullName(contact)}`, `initials={initialsFromName(contactFullName(contact))}`, `label={`${contactFullName(contact)} — ${contact.role}`}`, `onClick={() => setOpenContactId(contact.id)}`. Add local `openContactId` state (`useState<string | null>(null)`) and render a `RecordQuickViewDialog` (same fields as today's `RecordCard` grid showed: Role, Email, Phone; `editTo={`/manage/fixtures/leagues/${leagueId}/contacts/${selectedContact.id}/edit`}`) at the bottom of the component, `open={Boolean(selectedContact)}`.

4. **Teams** — full-width `Card`. `CardHeaderRow` title "Teams" (optionally "Teams — `${seasonLabel}`"). Body: same three states as today (no seasons / no affiliations for season / grid), but the populated grid becomes `{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }` of a new **page-local** `LeagueTeamTile` component (defined in this same file, above the page component — same posture as `TeamDetailPage.tsx`'s own `SquadPlayerTile`):
   ```
   function LeagueTeamTile({ team }: { team: Team }) {
     // bordered Box, hover shadow, rounded logo avatar (avatarSx-derived small size, e.g. 40) +
     // team name, stretched Link (docs/specs/059) to `/manage/sections/${team.sectionId}/teams/${team.id}`.
     // No Edit action on the tile itself — view-first, same rationale SquadPlayerTile's own
     // comment states: Edit lives one click away on the team's own detail page.
   }
   ```
   Do **not** extend `RecordCard` or add a new shared `components/**` entry for this — the spec's UI Requirements explicitly call this out as following `SquadPlayerTile`'s established precedent for a page-local dense tile, not a library addition.

5. **Playing Conditions** — full-width `Card`, last section, byte-for-byte the same content/fields/Share button/"View full document" link as today — only its position changes (was 2nd, now 5th/last).

**State/queries**: no changes — every existing `useState`/`useQuery`/`useMemo`/handler in the current file (`selectedSeasonId`, `shareOpen`, `playingConditionsShareOpen`, all seven queries, `teamsById`, `affiliationsForSeason`, `seasonLabel`, `nextMatchCountdown`, `shareTeams`, `handleSharePdf`/`handleSharePoster`/`handleShareCalendar`/`handleSharePlayingConditionsPdf`, `playingConditionsPayload`) carries over unchanged, just consumed by the new JSX shape. Only new local state: `openContactId`.

**Dialogs**: `ShareScheduleDialog` and `PlayingConditionsShareDialog` render at the bottom exactly as today (unchanged props); add the new `RecordQuickViewDialog` for Contacts alongside them.

## `LeagueDetailPage.test.tsx` — rewrite plan

The existing file's `makeLeague`/`makeSeason`/`makeTeam`/`makeAffiliation`/`makeMatch`/`makeLeaguePlayingConditions`/`makeContact` factories, `vi.mock` setup, and `renderPage`/`OutletContextWrapper` harness all carry over unchanged — only the assertions need to change, since they target markup this rewrite removes. Test-writer should:

- Keep: "Not authorized" guard test, "couldn't load this league" error test — unaffected by this rewrite.
- Rewrite the "Details fields" test: assert Playing XI size (`11`) and age range (`13–17`) now render as **chips in the header** (e.g. query by chip text, no longer inside a "Details" heading's field grid), and that phone/email/website/social-links/format-chip assertions (the "extended profile fields" `describe` block) now live inside the **Details Card** (that block's assertions mostly still hold, just confirm they're not also asserting anything about Playing XI/age-range's old location — check the current file for any such coupling).
- Replace "renders the Teams section heading, not Affiliations" + the affiliated-teams test: still assert a "Teams" heading exists and a team tile is a link to `/manage/sections/section-1/teams/team-1`, but **drop** the "Edit" link assertion for the team tile (`LeagueTeamTile` has no Edit action per the spec) — keep a separate assertion elsewhere that the *league's own* header Edit link still points at `/manage/fixtures/leagues/league-1/edit`.
- Rewrite the Fixtures-section tests ("renders Fixtures section", "renders LeagueFixtures empty state", "renders NextMatchCountdown above LeagueFixtures", "opens ShareScheduleDialog") to assert against the new **Schedule hero card** instead of a "Fixtures" heading — update the heading text expectation (`'Schedule'` or similar, per whatever exact title the implementation uses) and confirm the Schedule card is the **first** card after the header (a DOM-order assertion, `compareDocumentPosition`, similar to the existing Fixtures-vs-Contacts ordering test) — add a new ordering assertion: Schedule renders before Details/Contacts/Teams/Playing Conditions.
- Rewrite the Playing Conditions tests: same field/Share-button/document-link assertions as today, but update any DOM-order assumption (today's comment notes Playing Conditions render "right after Details, ahead of Teams/Fixtures" — now it's last, after Teams) and update the `shareButtons` array indexing if the Share buttons' page order changes (Schedule's Share button now likely comes first in DOM order since Schedule is now the hero, ahead of Playing Conditions — re-verify and fix the `shareButtons[0]`/`shareButtons[1]` indices actually used).
- Rewrite the "Contacts section" `describe` block: replace `RecordCard`-grid assertions (role/email/phone text directly in the DOM, a `link` with the contact's name) with icon-row + dialog assertions — click the `RecordIconButton` (found via its accessible name, e.g. `getByRole('button', { name: /Jane Smith/ })`), assert `RecordQuickViewDialog` opens showing Role/Email/Phone, and assert its "Edit" button links to `/manage/fixtures/leagues/league-1/contacts/contact-1/edit`. Keep the empty-state test ("No contacts yet for this league.") unchanged.
- Add a new assertion (per the spec's Acceptance Criteria) that the header's teams/fixtures count chip reflects the **selected season's** `affiliationsForSeason`/`matchesQuery` counts, not `league.currentSeasonTeamCount`/`currentSeasonLabel` — e.g. set `currentSeasonTeamCount` on the mocked league to a different number than the actual affiliations returned for the selected season, and assert the chip shows the latter.

## Build order

1. `frontend-builder` — rewrite `LeagueDetailPage.tsx` per the shape above. Self-contained prompt should paste this plan's "concrete shape" section plus the spec file path, and explicitly list the reused components/helpers so it doesn't reinvent any of them.
2. Independently verify: `cd ui && npm run build && npm run lint` — confirm no dangling imports (`RecordDetailScreen`/`RecordCard` component, if fully unused) and no type errors.
3. `test-writer` — rewrite `LeagueDetailPage.test.tsx` per the rewrite plan above, comparing against the spec's Test Plan section.
4. Independently verify: `cd ui && npm run test -- LeagueDetailPage` (or the equivalent Vitest invocation this repo uses) actually passes, not just that the agent claimed it does.
5. Smoke-test in a browser (`claude-in-chrome` or the `run` skill): open a real league's detail page, switch seasons, click a Teams tile through to the team's own page, click a Contacts avatar to open its quick-view dialog, confirm the Schedule hero renders first and visually stands out, confirm both Share buttons (Schedule, Playing Conditions) still open their respective dialogs.
6. Commit in logical chunks (frontend feature, frontend tests) per `CLAUDE.md`'s Commit Convention — only once the user asks for the commit.
7. `standards-reviewer` (or `/code-review`) over `git diff master...feature/062-league-detail-redesign` before opening a PR.
8. A human should update `docs/roadmap.md`'s Active table once this ships, per the spec's own Rollout Notes — flag this rather than doing it silently mid-build.

## Verification

- `npm run build`, `npm run lint`, `npm run test` (frontend) must all pass.
- Manual browser walkthrough (step 5 above) is required per `CLAUDE.md`'s UI/frontend rule — this is a visual layout change, automated tests won't catch a genuinely ugly or broken render.
- Re-read the diff against the spec's Acceptance Criteria checklist directly before calling this done.
