# Implementation Plan: 036 (View-First Record Detail Screens)

## Context

Every record in `/manage` today — Player, Team, Match, League, Season, Club Contact, Sponsor,
Sponsor Contact — is reached by clicking a `RecordCard`, which lands directly on a live edit
form (`RecordFormScreen`, tabbed for four of the eight entities). There is no read-only way to
look at a record, which matters because not everyone who reaches `/manage` in the future should
be able to edit everything they can see. Spec `036-view-first-record-detail-screens.md` adds a
new read-only `RecordDetailScreen` screen between card and edit form — pure UI restructuring, no
permission gating (that's real, deliberately deferred future scope), no backend changes.

The visual shape was settled with a real Claude Design pass (per `docs/workflow.md` Step 2),
using two legacy Cricket Legend screenshots as inspiration, adapted to this codebase's real
tokens — canvas: https://claude.ai/artifact/BUEBpib4SVF2HtxPacyXhA (5 artboards: Player, Sponsor,
Team, Match, League). Approved by the user. Key decisions from that pass, folded into this plan:

- **Icon-prefixed field rows** replace the current "caption label above bold value" stack
  everywhere on the new screens — a small icon per field, matching the legacy app's look but
  built from `@mui/icons-material`, not a copied asset.
- **Sponsor gets a bespoke single-card body**, not the generic stacked-sections layout every
  other entity uses: logo/name/contact fields in one bordered, tinted card, with social links as
  small circular icon buttons anchored to the card's bottom-right corner — no "Basic
  Info"/"Branding"/"Social Media" section headings at all (this collapses `SponsorForm.tsx`'s own
  internal 3-tab bar too, a real gap the spec's original audit missed — confirmed directly in
  code: `SponsorForm.tsx:131-142`).
- **Team's "N players"/"N matches" stat-pill idea was cut down to "N players" only.** Match count
  has no backend support (`listMatches` is paginated with no `teamId` filter or count endpoint)
  and adding one would break spec `036`'s own "no backend changes" Non-goal. Player count is
  free — it's `listSquad(...).length` from data the Squad section already fetches. Confirmed with
  the user; not silently dropped.
- **No quick-action icon toolbar** (squad/matches/calendar/announce/share, shown on the legacy
  Team screenshot) — those are navigation shortcuts to other screens, genuinely new scope beyond
  `036`, not built here.
- **Richer `RecordCard`s on the LIST screens themselves** (the same icon-row treatment, for
  consistency) is a real, separate follow-up the user asked for — explicitly NOT part of this
  plan. Flag it in `docs/roadmap.md` once `036` ships.

**No backend work at all** — every view screen reads exactly what its sibling edit form already
fetches, through the same existing API functions (confirmed per-entity below). This is entirely
`frontend-builder` + `test-writer`.

## Implementation-level decision, flagged per `docs/workflow.md` step 5 (not a spec redefinition)

The Sponsor mockup shows logo+name twice for standalone visual completeness (once in a would-be
page header, once inside the card). Building it that way would make Sponsor the only one of the
eight entities NOT using `RecordDetailScreen`'s shared header (Back button, avatar, title, badge,
Edit button) — a real inconsistency. **Resolution: all eight entities use the exact same
`RecordDetailScreen` header, no exceptions.** Sponsor's one section has no heading and its
`content` is the bordered/tinted card with icon rows + corner social icons — it does not repeat
the logo/name, since the shared header above it already shows them. Visually identical to the
mockup's intent, just not a literal pixel copy of an artboard that had no shared chrome to work
with in the first place.

## 1. New shared component — `ui/src/components/RecordDetailScreen/` (four-file anatomy)

The read-only sibling `RecordFormScreen` is missing. Composes from existing pieces, not built
from scratch:

- Back button: reuse `RecordFormScreen`'s exact `MuiButton component={RouterLink} ... startIcon={<ArrowBackIcon/>}` markup.
- Header row: `RecordCardAvatar` shape (reused type from `RecordCard.tsx`) + `Typography variant="h6"` title + optional `RecordCardBadge` (reused), with an `EditOutlined`-icon `Button` (outlined, `bgcolor: alpha(primary.main, 0.12)`, `color: primary.dark` — matches the mockup's `.edit-btn`) right-aligned, `editTo: string`.
- `sections: { heading?: string; note?: string; content: ReactNode }[]` rendered top-to-bottom, each separated by `borderTop: 1px solid divider, pt: 3` (first section: no border/padding). `heading` renders as `Typography variant="subtitle2"` with `textTransform: 'uppercase'`, `letterSpacing: '0.04em'` when present; omitted entirely for a single-section page (Season/Club Contact/Sponsor Contact/Sponsor).
- Also export `DetailFieldRow` (`{ icon: ReactNode; label: string; value: ReactNode }`) from the same file/`index.ts` — the small icon+caption+value row every section's field grid is built from (`Stack direction="row" spacing={1.25}`, icon at `text.secondary`/19px, then stacked `caption` label + `body2` bold value). Not a second four-file component — a tiny, tightly-coupled export living alongside `RecordDetailScreen`, same precedent as `RecordCard.tsx` exporting `RecordCardBadge`/`RecordCardField`/etc. from one file.
- Flagged in the spec for a Claude Design pass, now done — build directly from the approved canvas, `RecordDetailScreen.stories.tsx` covering: multi-section (Player-shaped), single custom-card section (Sponsor-shaped), and a section containing nested `RecordCard`s (Team-shaped).

## 2. `RecordCard` — additive `viewTo` prop

`ui/src/components/RecordCard/RecordCard.tsx`: add `viewTo?: string`. When present, it's the
footer's primary action ("View", `VisibilityOutlined` icon, same `MuiButton component={RouterLink}`
shape currently used for `editTo`) and `editTo`/`onEdit` are not rendered even if still passed.
Existing `editTo`/`onEdit`-only call sites (anything not touched by this plan) are unaffected —
purely additive. Extend `RecordCard.test.tsx`/`.stories.tsx` with a `viewTo` case.

## 3. Per-entity `DetailPage`s — `ui/src/pages/manage/`, build simple ones first to prove the shape

Each fetches exactly like its sibling `*FormPage.tsx` already does (same React Query key/data
source — no new API calls anywhere below) and reuses that file's existing `badgeFor(...)` mapping
(export it, one-line change, import into the new `DetailPage` — avoid a second copy) and its
one-line avatar construction (`initialsFromName(...)`/icon fallback — already a single expression
per file, copied directly, not worth extracting further).

**Simple, single-section (build first):**
- `SeasonDetailPage.tsx` — data: `listSeasons(clubId)` find-by-id (same as `SeasonFormPage.tsx`). One section, no heading: label, start date, end date as `DetailFieldRow`s.
- `ClubContactDetailPage.tsx` — data: `listClubContacts(clubId)` find-by-id. One section: role, email, phone, "Primary contact" indicator.
- `SponsorContactDetailPage.tsx` — data: `listSponsorContacts(clubId, sponsorId)` find-by-id. Same shape as Club Contact.

**Bespoke (build after, using the pattern proven above):**
- `SponsorDetailPage.tsx` — data: `listSponsors(clubId)` find-by-id. One section, no heading, custom bordered/tinted card body per the header note above: `DetailFieldRow`s for phone/email/website, `IconButton`s (circular, bordered) for each populated `SocialLink` anchored bottom-right (`position: relative` card, `position: absolute` icon row).
- `PlayerDetailPage.tsx` — data: `listPlayers(clubId)` find-by-id (mirrors `PlayerFormPage.tsx`'s own documented "no single-player GET, list+find" comment). Sections: Basic Info, Contact Info, Cricket Info (all `DetailFieldRow` grids), Sections (unchanged in kind — reuse `listPlayerSections`/`breadcrumbFor` from `ui/src/utils/sectionBreadcrumb.ts`, rendered as `Chip`s, not `RecordCard`s, exactly as `PlayerFormPage.tsx` already does today).
- `LeagueDetailPage.tsx` — data: `listLeagues(clubId)` find-by-id. Details section (`DetailFieldRow`s). Affiliations section: `listSeasons`+the league's own affiliation data (same source `LeagueFormPage.tsx`'s Affiliations tab already uses) rendered as a grid of `RecordCard`s (one per affiliated `Team`, `viewTo` into `TeamDetailPage`) — season selector is a plain, non-edit display control (filtering only).
- `TeamDetailPage.tsx` — data: `listTeamsForClub(clubId)` find-by-id (mirrors `TeamDirectory.tsx`/`TeamList.tsx`'s existing pattern; route carries `sectionId` already). Details section (`DetailFieldRow`s: section breadcrumb, ground, captain/manager/coach/email/phone) + the one "N players" stat pill. Contacts section: grid of `RecordCard`s from the team's existing linked-contacts data (`TeamFormPage.tsx`'s Contacts tab source), `viewTo` into `ClubContactDetailPage`. Sponsors section: same, `viewTo` into `SponsorDetailPage`. Squad section: `listSquad(clubId, teamId, seasonId)` (same current-season default `TeamFormPage.tsx` already computes) rendered as a grid of `RecordCard`s, `viewTo` into `PlayerDetailPage`, season shown as a plain label/`Select` (filtering only, no edit).
- `MatchDetailPage.tsx` — data: `getMatch(clubId, matchId)` (Match is the one entity with a real single-record GET). Details section (`DetailFieldRow`s: date/time, venue, league, season). Home XI / Away XI sections: **new** `ui/src/components/PlayingXiSummary/` (four-file anatomy — `PlayingXiBuilder` has no read-only mode, confirmed: every prop is data-plus-mutation-callback) — ordered batting list with captain/WK/12th-man badges and role chips, sourced from `listMatchSides(clubId, matchId)` + the team's squad (same resolution `PlayingXiBuilder`/`MatchSideTab` already do to turn `playerProfileId` into a name); renders `EmptyState` when no `MatchSide` exists for that side (proven in the mockup). Availability section: reuse `ui/src/components/AvailabilityRespondentAvatars/` (from `034`) verbatim, sourced from `listPolls`+`getPollResponses` (same as `MatchAvailabilityTab.tsx`), split into Home/Away sub-groups exactly as mocked up — no admin-override control.

## 4. Cross-link updates: `editTo` → `viewTo`

Every `RecordCard` anywhere pointing at one of these eight entity types switches from `editTo` to
`viewTo`, pointed at the sibling `DetailPage`'s route (not `FormPage`'s):
- The eight list screens themselves: `PlayerList.tsx`, `TeamList.tsx`/`TeamDirectory.tsx`, `MatchList.tsx` (both `MatchCard` call sites — the component definition and its one usage), `LeagueList.tsx`, `SeasonList.tsx`, `ClubContactList.tsx`, `SponsorList.tsx`, `SponsorContactList.tsx`.
- `TeamDetailPage`'s own Contacts/Sponsors/Squad sections (new, built in step 3 above — not a retrofit).
- `LeagueDetailPage`'s own Affiliations section (same).

Editing UI (link/unlink, create-and-link, add-to-squad, affiliate) is untouched — stays exactly
where it is today, on `TeamFormPage.tsx`'s Contacts/Sponsors/Squad tabs and `LeagueFormPage.tsx`'s
Affiliations tab, reached only via each view screen's single Edit action.

## 5. Routing — `ui/src/App.tsx`

One new bare-`:id` `<Route>` per entity, sibling to its existing `:id/edit` route, exact same
nesting each entity's edit route already uses (Team under `sections/:sectionId/teams/:teamId`,
Sponsor Contact under `sponsors/:sponsorId/contacts/:contactId`, etc.):

```tsx
<Route path="players/:playerId" element={<PlayerDetailPage />} />
<Route path="players/:playerId/edit" element={<PlayerFormPage />} />
```

repeated for all eight, plus the new component imports at the top of the file.

## Tests — `test-writer`, after the builder work above

- `RecordDetailScreen.test.tsx`/`.stories.tsx`, extended `RecordCard.test.tsx`/`.stories.tsx` (per steps 1–2).
- `PlayingXiSummary.test.tsx`/`.stories.tsx` — ordered XI with badges/chips; empty state with no `MatchSide`.
- One test per new `*DetailPage.tsx` (8 total), extending each sibling `*FormPage.test.tsx`'s existing data-fetch setup: loads the record, renders every section, no input/select/button-that-mutates is present anywhere except the single Edit action, Edit's `to` matches the existing edit route, cross-linked cards render `viewTo` targets not `editTo`.
- End-to-end (not wired into CI, same precedent as every prior `/manage` spec): from `PlayerList`, click a card → land on the read-only view (assert no editable input) → Edit → existing tabbed form loads → save → back → view reflects the change.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- `claude-in-chrome` smoke test per `CLAUDE.md`'s UI-change rule: walk all eight list screens →
  card → view page (confirm nothing editable renders) → Edit → confirm the existing edit form is
  completely unchanged; confirm `TeamDetailPage`'s Contacts/Sponsors/Squad cards and
  `LeagueDetailPage`'s Affiliations cards navigate into the right entity's own view page (not an
  edit form); confirm `SponsorDetailPage`'s corner social icons and `MatchDetailPage`'s
  Home-XI-populated/Away-XI-empty-state both render as designed in the approved canvas.
- A human updates `docs/roadmap.md` once this ships, per spec `036`'s own Rollout Notes, adding:
  (a) permission-gated Edit visibility as ready-to-build future scope, and (b) richer `RecordCard`
  list-screen styling (icon rows, consistent with the new view screens) as a separate follow-up.
