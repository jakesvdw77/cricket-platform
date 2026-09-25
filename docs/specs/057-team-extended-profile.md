# 057 — Team Extended Profile, Captain, Card & Detail Redesign

**Depends on:** `026-teams.md`/`027-team-profile.md` (`Team`, `TeamContact`, `TeamSponsor` — this spec extends `Team` and redesigns how `TeamContact`/`TeamSponsor` render, not their own shape), `029-league-management.md` (`TeamSquadMember`, season-scoped squads), `031-jersey-numbers.md` (`TeamSquadMember`'s first mutation endpoint, `UpdateTeamSquadMemberJerseyNumberRequest` — this spec extends that same endpoint rather than adding a second one), `022-club-social-media.md` (`SocialLink`, reused unchanged), `053-league-extended-profile.md` (the identical `abbreviation`/social-links/card-redesign shape already built for `League` — this spec applies the same pattern to `Team`), `056-club-profile-overview.md` (the icon-plus-quick-view-dialog pattern and bento-grid posture this spec's Detail page reuses). Approved via an interactive design-canvas mockup reviewed and confirmed by the user this session (the "Detailed" card density and the "Squad-Focused" detail-page layout) — this spec transcribes that approved design, it does not redesign it.

**Status:** approved.

## Problem & Goals

`Team` today carries almost nothing beyond a name and a logo (`id`/`clubId`/`sectionId`/`name`/`logoUrl`/`active`) — no ground, no abbreviation, no social links, and no way to mark a captain, even though `TeamContact`/`TeamSponsor` already let a team link real people and sponsors. The result: the Team card shows almost nothing useful, `TeamDetailPage` renders its four sections as one long vertical stack (visibly less polished than `056`'s Club Profile bento layout), and the back-navigation from a team reached off the club-wide Teams directory incorrectly routes through the section-scoped Teams list, landing on "Back to Club Structure" instead of the dashboard the user actually came from.

**Goals**
- Give `Team` a real profile: ground/venue name, a short abbreviation, and social links — the same shape `053` already gave `League`.
- Let a club admin mark one player as a team's captain, from the Squad tab, season-scoped like the rest of the squad.
- Redesign the Team card (`TeamDirectory`/`TeamList`) to the approved "Detailed" density: ground, captain, manager, coach, player/match counts, sponsor and social icons.
- Redesign `TeamDetailPage` to the approved "Squad-Focused" bento layout: header chips (mirroring `056`'s "badges under the name," not a stacked Details section), Contacts/Sponsors as tap-to-view icon grids side by side, Squad as a full-width grid of richer player tiles with the captain highlighted.
- Fix `TeamDetailPage`/`TeamFormPage`'s back-navigation so it returns to wherever the admin actually came from — the club-wide Teams directory by default, the section-scoped Teams list only when genuinely reached that way.

## Non-goals

- **Auto-selecting the squad captain into a match's Playing XI** — that's `058-team-captain-auto-select.md`, a separate spec building on this one's `isCaptain` flag. This spec only lets an admin *mark* a captain; it does not change `PlayingXiBuilder`'s behavior at all.
- **A dedicated `Venue`/`Ground` entity.** `groundName` is a plain free-text field on `Team`, the same posture `Match.venue` already has — no new entity, no relationship between a team's ground and a match's venue.
- **A `matches` count field or endpoint.** The approved card/detail mockups show a match count pill — this spec computes it client-side from the team's existing match data the same "batch-resolve, don't add an endpoint" way `LeagueServiceImpl.list()` already resolves `currentSeasonTeamCount` (see UI Requirements) rather than a new backend field.
- **Retrofitting this same card/detail treatment onto `TeamContact`/`TeamSponsor`'s own screens** — only `Team`'s own card and detail page change here.
- **Any change to `TeamContact`/`TeamSponsor`'s data model or link/unlink flow.** They're reused exactly as `027` built them — only how they're *displayed* on the redesigned card/detail page changes.
- **A photo/logo for a squad captain specifically** — the captain is shown via the existing player avatar (photo or initials), no separate captain-only image field.

## User Stories

- As a club admin, I can set a team's ground/venue name, a short abbreviation, and social links, the same way I already can for a League.
- As a club admin, from a team's Squad tab I can mark one player as captain — doing so automatically un-marks whoever held it before, for that team and season specifically.
- As a club admin, a team's card shows me its ground, captain, manager, coach, player/match counts, and its sponsors/social links as icons, without opening the team.
- As a club admin, opening a team shows me everything about it — profile facts as chips under the name, contacts and sponsors as tap-to-view icons, and its full squad with the captain clearly marked — without one long scroll through stacked sections.
- As a club admin, clicking "View" on a team card and then its back link returns me to the same Teams screen I actually came from — the club-wide directory if that's where I started, the section's own Teams list only if I genuinely navigated there via Club Structure.

## Data Model Changes

**`Team` gains three new columns**, every one nullable/optional:

```
Team {
    ... (id, clubId, sectionId, name, logoUrl, active, createdAt, updatedAt, updatedBy — unchanged)
    string  abbreviation  -- nullable, short free text (e.g. "ICL"), purely descriptive, shown as a
                             chip on the card — no uniqueness constraint, no validation beyond length
    string  ground_name   -- nullable, free text (e.g. "Irene Country Club") — same posture as
                             Match.venue, no FK, no new entity
    List<SocialLink> socialLinks  -- @ElementCollection over the existing SocialLink @Embeddable
                                     (022), new owning table team_social_link, FK team_id — exact
                                     mirror of League.socialLinks (053)
}
```

**`TeamSquadMember` gains one new column**, `NOT NULL DEFAULT false`:

```
TeamSquadMember {
    ... (id, teamId, seasonId, playerProfileId, jerseyNumber, createdAt, createdBy — unchanged)
    boolean is_captain  -- at most one true per (team_id, season_id) — same auto-unset +
                           partial-unique-index pattern as SponsorContact/LeagueContact's isPrimary
}
```

**Migration** (`031-add-team-profile-fields.sql`, next sequential after `030-add-league-contact.sql` — confirm against `db.changelog-master.xml` at build time):

```sql
ALTER TABLE team ADD COLUMN abbreviation VARCHAR(16);
ALTER TABLE team ADD COLUMN ground_name VARCHAR(255);

CREATE TABLE team_social_link (
    team_id  UUID NOT NULL REFERENCES team(id),
    platform VARCHAR(64) NOT NULL,
    url      VARCHAR(512) NOT NULL,
    PRIMARY KEY (team_id, platform)
);

ALTER TABLE team_squad_member ADD COLUMN is_captain BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX ux_team_squad_captain ON team_squad_member(team_id, season_id) WHERE is_captain;
```

**`TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest`** each gain `abbreviation`/`groundName`/`socialLinks` (mirror `053`'s `LeagueDto`/`CreateLeagueRequest`/`UpdateLeagueRequest` exactly — `socialLinks` as `@Valid List<SocialLinkDto>`, `TeamMapper` gains the same `SocialLinkDto toDto(SocialLink)`/`SocialLink toEntity(SocialLinkDto)` element-mapping pair `LeagueMapper`/`SponsorMapper` already declare). `TeamServiceImpl.create`/`update` call the existing shared `SocialLinkValidation.requireNoDuplicatePlatform` and set the three new fields, mirroring `LeagueServiceImpl`'s own identical extension in `053`.

**`UpdateTeamSquadMemberJerseyNumberRequest` is renamed to `UpdateTeamSquadMemberRequest`** and gains `boolean isCaptain` alongside its existing `Integer jerseyNumber` — a full-resource replace of this join row's two editable fields, same posture every other `Update*Request` in this codebase already has. **This is a real, easy-to-get-wrong point, flagged explicitly**: the frontend's jersey-number-edit and captain-toggle actions are two separate, independently-triggered UI interactions (inline blur-to-save vs. a toggle button), but both now call the *same* full-resource PUT — each must send the sibling field's current value along with the one actually changing, or it will silently clear/reset whichever field wasn't included. `TeamSquadServiceImpl.update` gains the same `saveAndFlush`-based auto-unset-other-captains logic `SponsorContactServiceImpl.unsetOtherActivePrimaries` already established (same Hibernate flush-ordering trap, same fix), scoped to `(teamId, seasonId)`.

`TeamSquadMemberDto` gains `isCaptain` (boolean, read-only, mapped from the entity).

## API Contract

No new endpoints. `PUT /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}` (the existing jersey-number endpoint) now accepts `UpdateTeamSquadMemberRequest {jerseyNumber, isCaptain}` and returns the updated `TeamSquadMemberDto`. `Team`'s existing three CRUD endpoints (`GET`/`POST`/`PUT`, `026`) carry the wider `TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest` payload, exactly as `053` did for `League`.

## UI Requirements

### `ui/src/components/TeamForm/` — gains the new fields

Mirrors `LeagueForm.tsx`'s own `053` extension: an **Abbreviation** `Input`, a **Ground** `Input`, and a `SocialLinksFields` block, added to the existing form (this form has no inner Tabs today — `TeamFormPage.tsx`'s own outer Tabs already separate Details/Contacts/Sponsors/Squad, so these three fields join the flat Details tab's existing Name/logo fields directly, not a new inner-Tabs structure).

### Team card — `ui/src/pages/manage/TeamDirectory.tsx` and `TeamList.tsx`'s shared card shape (the approved "Detailed" density)

Both files' own `TeamCard` functions are redesigned to the same new shape (a bespoke card, not a `RecordCard` retrofit — `RecordCard.fields` has no icon slot, and giving every `RecordCard` consumer an icon-row option is a larger blast radius than this spec's own scope; mirror `RecordCard`'s outer shell — avatar, title, badge, footer actions — but build the icon-row body directly, same "bespoke page, shared shell" posture `056`'s `ClubOverviewPage` already established for a similar reason):

- Avatar (`logoUrl`, rounded, initials fallback) + name + a chip row: `abbreviation` (when set) and the section-scope chip (Detailed adds a second descriptive chip here, e.g. the leaf section's own name, alongside `abbreviation`).
- Icon rows, each omitted when its underlying data is absent: Ground (`groundName`), Captain (this season's squad captain, resolved client-side — see below), Manager and Coach (the first `TeamContact` whose `role` case-insensitively equals "Manager"/"Coach" respectively; no match omits that row entirely — this is a display convenience over already-linked `TeamContact` data, not a new relationship).
- Footer: player-count and match-count stat pills, sponsor icons (from `TeamSponsor`, small logo/initials tiles, no click interaction on the card itself — full detail is one click away via View), and a social-link icon row (from the new `Team.socialLinks`).
- **Captain/Manager/Coach/match-count resolution is genuinely extra data a card wasn't fetching before** — `TeamDirectory`/`TeamList` need to additionally fetch each visible team's current-season squad (for captain) and `TeamContact`s (for manager/coach), batched the same "resolve once for the visible set, not per-card" way `LeagueServiceImpl.list()` already resolves `currentSeasonTeamCount` server-side, OR — since there's no existing club-wide "current season squad summary" endpoint — resolved client-side per visible team via the existing per-team endpoints, accepting the N-small-requests cost matching this section's own "small, bounded, unpaginated" posture (`026`'s own Architecture note). Match count: computed client-side from `listMatches` filtered to that team's own `homeTeamId`/`awayTeamId` for the resolved current season, same club-wide "current season" resolution `LeagueList`/`LeagueDetailPage` already do via `pickDefaultSeasonId`.

### `ui/src/pages/manage/TeamDetailPage.tsx` — the approved "Squad-Focused" bento layout

Restructured to match `056`'s `ClubOverviewPage` posture directly:

- Header: avatar, name, a chip row directly under the name (replacing today's separate "Details" section entirely — the "badges under the team name" instruction applies here exactly as it did for `056`'s Club Profile): section breadcrumb, ground (when set), captain (when this season has one), player-count and match-count pills, the active/inactive badge. "Edit team" button.
- Two-column row: **Contacts** card (icon-only avatar buttons, `RecordQuickViewDialog` — reused unchanged from `056` — for each `TeamContact`, fields Role/Email/Phone, Edit → that contact's real edit route) and **Sponsors** card (same pattern, `TeamSponsor`, fields Website/Email, Edit → that sponsor's real edit route), side by side, stacking to one column at `xs`.
- Full-width **Squad** card below: a grid of player tiles (avatar, name, jersey number, the captain's tile visually distinguished — a highlighted border/background plus a small "Captain" label, matching the approved mockup), a Season picker in the card's header (same `pickDefaultSeasonId`-driven default the existing Squad section already uses), "Add player" action.
- Reuses `RecordQuickViewDialog` (`056`) for Contacts/Sponsors rather than building a third dialog component.

### Navigation fix — `TeamDetailPage.tsx` and `TeamFormPage.tsx`'s back link

Both currently hardcode their back link to the section-scoped `TeamList` (`/manage/sections/{sectionId}/teams`, "Back to Teams") regardless of whether the admin arrived via `TeamDirectory` (club-wide, dashboard-linked) or `TeamList` (section-scoped, reached via Club Structure). Fixed the same way `056` resolved `MatchList`'s default-vs-override split:

- `TeamList.tsx`'s own `viewTo`/`editTo` links append a marker signalling section-scoped origin — the simplest option is a query string, e.g. `?from=section` (read via `useSearchParams`, not persisted anywhere, purely a same-navigation signal). `TeamDirectory.tsx`'s own `viewTo`/`editTo` links add no such marker.
- `TeamDetailPage`/`TeamFormPage` read that marker: present → `backTo={`/manage/sections/${sectionId}/teams`}`, `backLabel="Back to Teams"` (i.e. today's existing behavior, genuinely correct for that origin); absent (the default, whether reached from `TeamDirectory`, a bookmark, or typed URL) → `backTo="/manage/teams"`, `backLabel="Back to Teams"` (the club-wide directory `056` already promoted to the dashboard).
- `TeamList.tsx`'s own back link (`backTo="/manage/sections"`, `backLabel="Back to Club Structure"`) is unchanged — it was never the bug; the bug was `TeamDetailPage`/`TeamFormPage` routing a directory-originated visit through it in the first place.

**Mobile-first**, per `docs/standards/frontend.md`: the Contacts/Sponsors two-column row stacks to one column at `xs`; both card layouts' icon/chip rows wrap.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `TeamServiceImplTest` extended — `create`/`update` persist `abbreviation`/`groundName`/`socialLinks`; duplicate social-link platform rejected (mirrors `LeagueServiceImplTest`'s identical `053` case). `TeamSquadServiceImplTest` extended — setting `isCaptain=true` auto-unsets any other captain for the same team+season via `saveAndFlush` (mirrors `SponsorContactServiceImplTest`'s pattern); a `PUT` that only changes `jerseyNumber` while passing the *current* `isCaptain` value leaves the captain flag untouched (proving the full-replace contract doesn't silently clear it) |
| Integration | `TeamControllerIntegrationTest` extended — real HTTP round trip for the three new `Team` fields. `TeamSquadControllerIntegrationTest` extended — captain auto-unset through the real HTTP layer (create-a-second-captain-succeeds, no `409`), migration `031` applies cleanly, `ux_team_squad_captain` rejects two simultaneous captains at the DB level |
| Contract | Expanded `TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest`/`TeamSquadMemberDto`/`UpdateTeamSquadMemberRequest` schemas in the checked-in OpenAPI doc |
| Component | `TeamForm.test.tsx` extended (new fields). `TeamCard` (both `TeamDirectory.test.tsx`/`TeamList.test.tsx`) — every icon row renders only when its data is present, sponsor/social icons render. `TeamDetailPage.test.tsx` — header chips, Contacts/Sponsors quick-view dialogs, Squad grid with the captain tile visually distinguished, back-link destination correct both with and without the section-origin marker. `TeamFormPage.test.tsx` — same back-link coverage; a captain-toggle control in the Squad tab calls the renamed endpoint with both fields |
| End-to-end | Extends `026`'s golden path: set a team's ground/abbreviation/social links, mark a squad member captain (confirm a second captain un-marks the first), confirm the card and detail page both reflect it, confirm View from the club-wide directory returns there via Back, confirm View from Club Structure's section-scoped list still returns to Club Structure. Not wired into CI |

## Acceptance Criteria

- A club admin can set and clear a team's ground, abbreviation, and social links.
- A club admin can mark exactly one squad member as captain per team per season; marking a new one un-marks the previous one with no error.
- The team card shows ground/captain/manager/coach/player-count/match-count/sponsors/social icons, each omitted cleanly when unset — no error, no empty icon.
- `TeamDetailPage` shows chips under the team name (no separate "Details" section), Contacts/Sponsors as tap-to-view icon grids, and a full-width Squad grid with the captain visually distinguished.
- Viewing a team from the club-wide Teams directory and clicking Back returns to the dashboard-linked Teams directory; viewing one from Club Structure's section-scoped list and clicking Back returns to Club Structure — never crossed.
- A team with none of the new fields set (an existing pre-migration team) still displays and edits with no error.

## Rollout Notes

- Ships as one PR — additive migration (`ALTER TABLE ... ADD COLUMN`, all nullable/defaulted, plus one new table and one partial index), no data loss, no backfill needed.
- **The `UpdateTeamSquadMemberJerseyNumberRequest` → `UpdateTeamSquadMemberRequest` rename touches a real, already-shipped endpoint** — update every call site (backend controller/service, the one existing frontend `updateSquadJerseyNumber` caller in `TeamFormPage.tsx`'s `SquadPlayerCard`) deliberately, not by chasing compiler errors blind.
- **The full-resource-PUT trap for the Squad row is this spec's single biggest implementation risk** — flagged twice already (Data Model Changes, Test Plan) because it's exactly the kind of bug that passes a cursory manual test (toggle captain, looks fine) while silently corrupting jersey numbers on the next unrelated edit, or vice versa.
- `058-team-captain-auto-select.md` (sibling spec, not built here) consumes this spec's `isCaptain` flag to pre-select the squad captain in `PlayingXiBuilder`'s per-match captain field, unless marked unavailable.
- A human should update `docs/roadmap.md`'s Active table once this ships.
