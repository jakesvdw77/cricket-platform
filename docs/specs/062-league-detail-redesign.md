# 062 — League Detail Redesign

**Depends on:** `036-view-first-record-detail-screens.md` (the shared `RecordDetailScreen`/`DetailFieldRow`/`DetailFieldGrid` primitives this spec's own `LeagueDetailPage` stops using for its outer layout — `DetailFieldRow`/`DetailFieldGrid` themselves stay in use inside individual `Card`s, and every other consumer of `RecordDetailScreen`'s `sections` prop is unaffected), `050-league-schedule-and-fixtures.md` (`NextMatchCountdown`/`LeagueFixtures`, reused unchanged), `051-league-schedule-sharing.md` (the Schedule section's existing Share button/`ShareScheduleDialog`, reused unchanged), `052-league-playing-conditions.md` (the Playing Conditions section's existing fields/Share button/`PlayingConditionsShareDialog`, reused unchanged), `053-league-extended-profile.md` (`League.format`/`maxPlayingXiSize`/`minAge`/`maxAge`/`phone`/`email`/`website`/`socialLinks`, all reused unchanged — no new field), `054-league-contacts.md` (`LeagueContact`, reused unchanged — only its presentation changes), `056-club-profile-overview.md` (the "chips under the name, no separate Details-only section" header posture, and the `RecordIconButton` + `RecordQuickViewDialog` Contacts-card pattern this spec applies to League), `057-team-extended-profile.md` (the bespoke-page/`PageHeaderBand`/two-column `Card` grid shape this spec mirrors directly, and the precedent for a page-local, lighter-weight tile component — `SquadPlayerTile` — instead of forcing a denser grid through the full `RecordCard` contract), `059-record-card-click-to-view.md` (the stretched-link click-to-view pattern the new Teams tile uses), `060-player-detail-redesign.md` (the most recent worked example of this exact migration — generic `RecordDetailScreen` stacked sections → bespoke header + card grid — applied to a different entity).

Approved via an HTML design mockup built and confirmed by the user this session (Artifact `https://claude.ai/artifact/Y6SN8mS2JP46F1Eq4RpbeK`) — this spec transcribes that approved design, it does not redesign it.

**Status:** approved.

## Problem & Goals

`LeagueDetailPage.tsx` is the last `/manage` detail screen still built on the generic `RecordDetailScreen` shape (`036`): Details, Playing Conditions, Teams, Fixtures, and Contacts render as five full-width sections stacked one under the other, in that order. This buries the one thing a club admin actually opens this page to check — the schedule — under a Details section and a long Playing Conditions section, wastes horizontal space on anything wider than a phone, and gives a league's Contacts (a handful of people, glanceable) a whole two-per-row card grid of their own near the bottom of the page. `ClubOverviewPage` (`056`), `TeamDetailPage` (`057`), and `PlayerDetailPage` (`060`) already solved the equivalent problem for their own entities: a header with chips under the name for glanceable facts, a two-column card grid for secondary information, and — where one exists — a promoted hero for the page's primary content. League never got the equivalent pass, and its primary content (the schedule) is arguably a stronger case for a hero treatment than any of the three prior redesigns had.

**Goals**
- Rebuild `LeagueDetailPage` on the same bespoke `PageHeaderBand` + `Card` grid pattern `TeamDetailPage`/`PlayerDetailPage` use, replacing its current `RecordDetailScreen` stacked-section layout.
- Promote Schedule (the existing Fixtures section's `NextMatchCountdown` + `LeagueFixtures` content) to a full-width hero card directly under the header — the first thing rendered below it, visually distinguished from the rest of the page.
- Move the league's own format/Playing XI size/age range facts out of a "Details" section and into a chip row under the league's name, alongside a season-scoped teams/fixtures count chip and the existing Active/Inactive badge.
- Rebuild the Contacts section from a full-width `RecordCard` grid into a compact `RecordIconButton` icon-row + `RecordQuickViewDialog`, matching `ClubOverviewPage`'s/`TeamDetailPage`'s own Contacts card, and pair it beside the remaining Details card (phone/email/website/social links) in a two-column row.
- Rebuild the Teams section into a denser, lighter-weight tile grid (logo + name only) instead of a two-per-row full `RecordCard` grid.
- Keep Playing Conditions full-width and unchanged in content, moved to the bottom of the page as reference material.

## Non-goals

- **No change to `LeagueFormPage` (the edit screen).** Its own tab structure and every mutation flow (including Teams affiliation editing, which stays exclusively on `LeagueFormPage`'s own tab) are unchanged — this spec is the read-only view screen only, same posture as `057`'s and `060`'s own Non-goals.
- **No change to `NextMatchCountdown`, `LeagueFixtures`, `ShareScheduleDialog`, or `PlayingConditionsShareDialog`.** All four are reused exactly as they render today — only where `LeagueDetailPage` places them changes, not their internals or props.
- **No change to data fetching.** Every existing `useQuery` in `LeagueDetailPage` (leagues, seasons, teams, affiliations, matches, playing conditions, contacts) stays as-is — this is a presentation-layer restructure only, no new or changed endpoint, no new field on `League`/`LeagueContact`.
- **No change to `LeagueList`'s card layout.** The list/grid view's own card shape (`badgeFor`/`leagueSeasonBadges`/`leagueRecordFields` in `LeagueList.tsx`) is untouched.
- **No new shared component for Contacts.** `RecordIconButton`/`RecordQuickViewDialog` already exist and are reused as-is, per `056`/`057`'s precedent.
- **No change to `RecordCard`'s contract.** The new Teams tile is a page-local component (mirroring `TeamDetailPage`'s own `SquadPlayerTile`), not an extension of `RecordCard`'s fixed slot order — see UI Requirements for why.

## User Stories

- As a club admin, opening a league's detail page shows me its upcoming schedule first, above every other section, so I don't have to scroll past Details/Playing Conditions to find it.
- As a club admin, I can see a league's format, Playing XI size, age range, and Active/Inactive status as chips under its name, without a separate Details section listing them.
- As a club admin, I can see a league's contacts as a row of tappable avatars near the top of the page, and open a quick-view dialog for one without navigating away.
- As a club admin, I can see a league's affiliated teams for the selected season as a denser logo grid, and click through to any team's own detail page.
- As a club admin, I can still see and share a league's full Playing Conditions, now positioned at the bottom of the page as reference material.

## Data Model Changes

None. `League` (`053`), `LeagueContact` (`054`), `LeaguePlayingConditions` (`052`), `LeagueAffiliation`/`Team`, and `Match` (`050`) all already carry every field this redesign displays — this spec only changes where and how they're presented on one screen.

## API Contract

None. `LeagueDetailPage` already fetches everything this redesign needs via its existing `listLeagues` (client-side find-by-id), `listSeasons`, `listTeamsForClub`, `listLeagueAffiliations`, `listMatches`, `getPlayingConditions`, and `listLeagueContacts` calls — no new or changed endpoint.

## UI Requirements

### `ui/src/pages/manage/LeagueDetailPage.tsx` — rebuilt on `TeamDetailPage`'s bespoke pattern

Stops rendering via `RecordDetailScreen`'s `sections` prop; becomes its own bespoke page composed from `PageHeaderBand` (reused unchanged) plus plain `Card`s, mirroring `TeamDetailPage.tsx`'s/`PlayerDetailPage.tsx`'s own structure directly. Order, top to bottom:

**1. Header (`PageHeaderBand`)** — "Back to Leagues" link (unchanged destination/label), league avatar (`logoUrl`, `rounded`, initials fallback — unchanged) + league name (`h6`, bold) + a chip row directly under the name:
- Format chip (`LEAGUE_FORMAT_LABELS[league.format]`, only when `league.format` is set — same condition the current Details section's note slot already uses).
- Playing XI size chip (`league.maxPlayingXiSize`, always — this field is required on `League`, unlike the two below).
- Age range chip (`${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`), only when at least one of `minAge`/`maxAge` is set — same condition the current `DetailFieldRow` uses.
- A teams/fixtures count chip for the **currently selected season** — `"${affiliationsForSeason.length} teams · ${matchesQuery.data?.content.length ?? 0} fixtures"`. This is deliberately re-derived client-side from the same `affiliationsForSeason`/`matchesQuery` the Teams/Fixtures cards below already compute, **not** `League.currentSeasonTeamCount`/`currentSeasonLabel` (`LeagueList.tsx`) — those two fields reflect the club's own "current" season specifically, which can differ from whichever season this page's own season picker has selected.
- The existing `badgeFor(league)` Active/Inactive badge (imported from `LeagueList.tsx`, unchanged), rendered in this same chip row.

Header's right side keeps the existing season `<Input select>` (unchanged: populated from `seasonsQuery.data`, defaulted via `pickDefaultSeasonId`) — it scopes the Schedule/Teams/Playing Conditions cards below, wider scope than `TeamDetailPage`'s own Squad-only season select, so it stays a page-level control in the header rather than moving into any one card. The Edit button is styled like `TeamDetailPage`'s/`PlayerDetailPage`'s (outlined, `bgcolor: alpha(primary.main, 0.12)`, `color: primary.dark`), same destination (`/manage/fixtures/leagues/${league.id}/edit`) as today.

**2. Schedule — the hero (full-width `Card`)** — directly under the header, before every other section. Card header row: "Schedule — `${seasonLabel}`" title (an icon + heading, per the approved mockup) and the existing Share button (opens `ShareScheduleDialog`, unchanged). Body: the existing `NextMatchCountdown` then `LeagueFixtures`, both reused unchanged, in a `Stack` exactly as today. Visually distinguished from every other card on the page via a heavier border (`1.5px`, a `primary`-tinted color rather than plain `divider`) and a soft drop shadow — the only card on the page carrying either, so it reads as the primary content at a glance. When there are no seasons yet, or the season has no matches, the existing empty-state messaging is unchanged, still inside this same hero card (a hero with nothing to show is still the hero — it doesn't disappear or collapse to a smaller placeholder).

**3. Details + Contacts (two-column `Card` grid, `{ xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }`, same shape as `ClubOverviewPage`'s/`TeamDetailPage`'s Contacts+Sponsors row):**
- **Details card**: `league.phone`/`email`/`website` `DetailFieldRow`s + `SocialLinksRow`, identical content to today's Details section minus the four fields that moved to the header chip row (Playing XI size, age range, format — format's chip already existed, the other two are newly promoted). Same `position: relative` + absolutely-positioned `SocialLinksRow` treatment as today, unchanged.
- **Contacts card**: rebuilt from today's full-width `RecordCard` grid into a `RecordIconButton` icon-row (one per `LeagueContact`, `contactBadgeFor`/`contactFullName` reused unchanged for label/initials) + `RecordQuickViewDialog` on click — exactly the pattern `ClubOverviewPage.tsx`'s and `TeamDetailPage.tsx`'s own Contacts cards already use (`openContactId` local state, dialog fields: Role, Email, Phone; `editTo` → the contact's existing edit route). Empty state: "No contacts yet for this league." (unchanged copy).

**4. Teams (full-width `Card`)** — header: "Teams — `${seasonLabel}`". Body: a denser grid than today's two-per-row `RecordCard` grid — `{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }` — of a new page-local `LeagueTeamTile` component (mirroring `TeamDetailPage.tsx`'s own `SquadPlayerTile`: a bordered `Box`, small `rounded` logo avatar + team name, a stretched link (`059`) to `/manage/sections/${team.sectionId}/teams/${team.id}` for the whole tile). No Edit action on the tile itself — same view-first rationale `SquadPlayerTile`'s own comment already states: Edit still lives on the team's own detail page, one click away via the tile's view link, not duplicated here. Same empty states as today ("No seasons yet…" / "No teams affiliated for this season yet.").

**5. Playing Conditions (full-width `Card`, last on the page)** — same content as today: header row with "Share" button (opens `PlayingConditionsShareDialog`, unchanged), `DetailFieldGrid` of all fields, "View full document" link when a `documentUrl` exists. No field changes — this section is repositioned only, per the Non-goals above.

**Mobile-first**, per `docs/standards/frontend.md`: the Details+Contacts grid and the Teams grid both drop to one/two columns at `xs` as specified above; the header's chip row wraps; the hero Schedule card's own internals (`NextMatchCountdown`, `LeagueFixtures`) already handle their own `xs` stacking unchanged.

### New component: `LeagueTeamTile` (page-local, not a shared `components/**` addition)

A lighter-weight grid tile than `RecordCard` for a context where only a logo + name + click-through is needed — same rationale `TeamDetailPage.tsx`'s own `SquadPlayerTile` already documents for its Squad grid: `RecordCard`'s fixed slot order (avatar + title + badge, a required description, a fields row, an optional chips row, a footer edit action) is built for a primary record-list unit, not a dense cross-reference grid inside another entity's detail page. Following that exact precedent, `LeagueTeamTile` stays a private component inside `LeagueDetailPage.tsx` (or extracted alongside it, not into `components/**`) rather than a new shared component or an extension of `RecordCard`'s contract — consistent with `docs/standards/design-system.md`'s "a screen needing a new visual pattern spins that off as a library addition first" applying only when the pattern is genuinely new; a second page-local dense tile following `SquadPlayerTile`'s already-established shape isn't.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `LeagueDetailPage.test.tsx` (rewritten, replacing reliance on generic `RecordDetailScreen` coverage) — header renders format/Playing XI size/age-range chips under the name (each only when its underlying field is set), the season-scoped teams/fixtures count chip reflects `affiliationsForSeason`/`matchesQuery` for the **selected** season (not `currentSeasonTeamCount`), and the Active/Inactive badge renders when the league is inactive; the Schedule card renders above Details/Contacts/Teams/Playing Conditions in DOM order; Contacts renders as an icon row and opens `RecordQuickViewDialog` on click instead of a `RecordCard` grid; Teams renders `LeagueTeamTile`s with a stretched link to each team's detail route; Playing Conditions renders last with its existing Share button and fields intact |
| End-to-end | Extends `050`'s/`052`'s/`054`'s golden paths: view a league with a set season, confirm the Schedule hero renders first with the next-match countdown, confirm a Contacts avatar opens its quick-view dialog, confirm a Teams tile navigates to its team's detail page. Not wired into CI, per this repo's existing E2E posture |

No backend tiers apply — this spec makes no backend change.

## Acceptance Criteria

- The Schedule card (`NextMatchCountdown` + `LeagueFixtures`) renders first in the page body, directly under the header, before Details/Contacts/Teams/Playing Conditions, and is visually distinguished (heavier border + shadow) from every other card.
- The header's chip row shows Format (when set), Playing XI size, Age range (when at least one bound is set), a season-scoped "`N` teams · `M` fixtures" chip for the currently selected season, and the existing Active/Inactive badge — there is no separate "Details" section duplicating these four facts.
- Details and Contacts render side by side in a two-column grid on desktop (`md` and up) and stack to one column below that; Contacts renders as tappable avatars opening a quick-view dialog, not a `RecordCard` grid.
- Teams renders as a grid of at least 4 tiles per row on desktop, each a stretched link to that team's own detail page, with no Edit action on the tile itself.
- Playing Conditions renders full-width, last on the page, with unchanged content, Share button, and "View full document" link.
- A league with no format, no age range, no contacts, no affiliated teams for the selected season, and no seasons at all still renders the full page with no error — every card falls back to its existing empty-state copy, exactly as today.
- Switching the season picker updates the header's teams/fixtures count chip, the Teams grid, the Schedule card, and the Playing Conditions card together, consistent with today's existing season-scoping.

## Rollout Notes

- Ships as one PR, frontend-only — no migration, no backend change, no data loss risk.
- Approved design reference: the HTML mockup built and confirmed in this session (`https://claude.ai/artifact/Y6SN8mS2JP46F1Eq4RpbeK`) — implementers should match its header/hero/grid/card shapes, not re-derive them from this spec's prose alone.
- This is the last `/manage` detail screen still on `RecordDetailScreen`'s stacked-section shape (after `056`/`057`/`060`) — once this ships, a human should confirm whether `RecordDetailScreen`'s `sections` prop still has any real consumer left, or whether it's now dead code worth flagging in `docs/roadmap.md`.
- A human should update `docs/roadmap.md`'s Active table once this ships, same as `057`'s and `060`'s own Rollout Notes required.
