# 122: League Sharing

**Depends on:** `114-share-result.md` (the standard this copies: the share dialog shell, format screens, preview stage, delivery by capability, `shareName`, remembered choices, `ShareSettingsDto`), `051-league-schedule-sharing.md` (the Schedule PDF, poster and calendar generators this reuses), `091-leagues-gold-standard.md` (League card, list view and league page header) and `095-league-edit-gold-standard.md` (the League tabs), `029-league-management.md`, `110-league-age-cutoff-day-and-month.md` and `111-league-season-dates.md` (league fields, `maxAge`, season start and end dates), `100-match-results-core.md` (published results), `121-player-hub-menu-and-fields.md` (the Player Hub this feeds later), `docs/standards/*.md`.
**Status:** approved (2026-10-28), open questions settled below. Part of the leagues completion work. No code is written by this spec.

## Problem & Goals

A league can be shared today only as a schedule (`ShareScheduleDialog`, PDF, poster, calendar) and its playing conditions (`PlayingConditionsShareDialog`), each from a different button with a different dialog. A manager cannot send the league's details, teams, results or key dates, and cannot choose what goes into one message. Results already have a better pattern (`114`): choose what to share, then the format, with a preview. League sharing should work the same way.

Goals:

- **A. One Share League dialog** with step 1 "What to share" (multi-select) and step 2 "Output format", following `114`'s dialog, format screen and delivery rules.
- **B. Entry points** on the league card, the league list row (list and card view), the Playing conditions tab and the league view header, all opening the same dialog.
- **C. First-round contents:** League details, Playing conditions, Teams, Schedule, Results, Key dates.
- **D. Formats:** PDF, Poster, Calendar (ICS), WhatsApp, Facebook, each available only for the contents that make sense, and each switchable on or off per club.
- **E. Privacy by default** for any person shown (contacts later, and any player names in results).
- **F. One read model** (`LeagueShareModel`) the Player Hub reuses later.

## Non-goals

- **Contacts, Venues, Next fixtures and Standings as contents.** Later follow-ups (Rollout Notes). Standings and points tables are out of the first round because the league has no points table read yet.
- **Replacing the existing generators.** `leagueSchedulePoster.ts`, the schedule PDF and the ICS builder are reused as they are; this spec adds the dialog and the other contents.
- **Player Hub UI.** The Player Hub (Schedule > Leagues, group D) shows league information to players and parents, with a parent seeing the whole league schedule and their team's games highlighted. That screen, and the player-scoped read it needs, belong to group D. This spec defines the shareable content and the model only.
- **A public league page or link.** Same reasoning as `114` (no public pages exist).
- **Posting to WhatsApp or Facebook from the platform**, scheduled posting, share history, stored files (`114` Non-goals apply unchanged).
- **A per-section or per-league format setting.** Format switches are per club only.
- **Custom colours or fonts.** Club primary colour only, as `114`.
- **TV summary and Image formats.** Not offered for leagues (Poster covers the visual need).

## User Stories

- As a club manager, I can tap Share on a league (card, list row, Playing conditions tab or league page) and choose what to include, so that I send exactly the league information the recipient needs.
- As a club manager, I find the content I came for already ticked (Schedule from the league page, Playing conditions from that tab), so that I can go straight to the format.
- As a club manager, I pick a format and only see the formats that work for what I ticked, so that I never build a poster of a results table that cannot be drawn.
- As a club manager, I get a live preview and the same Share, Download and Copy text delivery as results, so that sharing feels the same everywhere.
- As a club manager, I can add a schedule or the key dates to a phone calendar through an ICS file, so that dates are not retyped.
- As a club manager, I can edit the WhatsApp and Facebook text before sending, and send it with Send in WhatsApp, as for results.
- As a club administrator, I can switch formats on or off for my club, for results and leagues alike, so that members of staff only see the formats the club uses.
- As a club manager, I see people shown by role and name only unless I opt in to phone and email for this share, and junior first names appear as initials, so that no one's details leave the club by accident.
- As a player or parent (later, group D), I see the league information of the leagues my linked players play in, and a parent sees the whole league schedule with their team's games highlighted.

## Data Model Changes

**Per-club format switches: `114` did not build them.** The brief for this spec calls for enabling and disabling formats "exactly like Results". The code does not have that: `114` stored one value, `initialsOnlyDefault` (`club_profile.share_initials_only`, `ShareSettingsDto`, `GET`/`PUT /share-settings`), and the Results dialog always offers all five formats. This spec therefore **builds the mechanism once, for both**, rather than building around it: the existing `share-settings` resource gains a list of disabled formats per content type, and the Results dialog starts honouring it in the same change (see Rollout Notes).

- `club_profile` gains `share_disabled_formats text not null default '{}'` holding a small JSON object, for example `{"RESULT":["TV"],"LEAGUE":["POSTER"]}`; absent means all enabled. Migration `backend/src/main/resources/db/changelog/v1/NNN-club-share-disabled-formats.sql` (next sequential number, confirmed at plan time). Like `share_initials_only`, it is not part of `UpdateClubProfileRequest`, so a profile save never resets it.
- Format codes: Results `PDF`, `IMAGE`, `TV`, `WHATSAPP`, `FACEBOOK` (`114`); League `PDF`, `POSTER`, `CALENDAR`, `WHATSAPP`, `FACEBOOK`.
- A club cannot disable every format of a content type: the service rejects it (`400`).

**Browser storage:** `share:choices:<clubId>` gains a `league` branch (last contents, last format, per-format switches and the opt-in states below are **not** remembered for contact details; the opt-in is per share by rule).

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/share-settings` | club manager | **Extended, additive:** `{ initialsOnlyDefault, disabledFormats: { RESULT: [...], LEAGUE: [...] } }` |
| `PUT /api/v1/manage/clubs/{clubId}/share-settings` | club administrator (`canAdministerClub`) for `disabledFormats`; unchanged for `initialsOnlyDefault` | Same single DTO in and out. An omitted `disabledFormats` leaves the stored value as is. `400` if a content type would have no format left |

`ShareSettingsDto` is extended (not duplicated); `openapi.yaml` is regenerated and the contract diff shows additions only. Who may change the format switches is Open question 1.

**No other new endpoint.** The league share reads what the League pages already load:

| Content | Source (existing) |
|---|---|
| League details | `LeagueDto` (name, description, logo, `minAge`, `maxAge`, contact and social fields, `matchCount`, `firstMatchDate`, `lastMatchDate`, `nextMatchDate`) |
| Playing conditions | the season's conditions read the Conditions tab uses (`LeagueConditionsView`, `PlayingConditionsShareDialog`) |
| Teams | the season's affiliations (`LeagueTeamsView`) |
| Schedule | the season's matches the league page loads for `ShareScheduleDialog` |
| Results | published results of the league and season (the Results list filtered by league and season, `100`); confirmed at plan time that the filter exists, otherwise an additive `leagueId` and `seasonId` filter on the existing list, not a new endpoint |
| Key dates | season start and end dates (`111`, `.../seasons/{seasonId}/dates`), plus the first, last and next match dates already on `LeagueDto` |

**Read model.** One pure assembler in `ui/src/utils/share/shareLeagueData.ts` builds a `LeagueShareModel` (league, season, ticked contents, teams with the user's own teams flagged, schedule rows, published results, key dates, conditions, privacy flags) from those reads, mirroring `shareResultData`. Every format reads that one shape. The Player Hub (group D) will reuse the same shape, but a player or parent cannot call the manager endpoints above: a **player-scoped read of the same league data** (leagues of the user's linked players, whole schedule, own teams flagged) is a dependency for group D and is **not built here**. If group D needs a backend DTO, it is specified there and should be the server-side twin of `LeagueShareModel` so the field names match.

## UI Requirements

Compose from the `114` pieces; mockups are needed before building (below).

### Entry points

All open `ShareLeagueDialog` with a league (and season where known) and a preselection.

- **League card** (`leagues/LeagueCard`): a labelled **Share** footer button in the `footerButtons` row (cards have no icon-only variant, `114`). Preselects League details and Schedule.
- **League list row** (`LeagueTable`): a Share action in the row actions, and the same in the card view of the list. Both views get it; the list-view test list and the card-view test list each check it. Season is the list's selected season.
- **Playing conditions tab** (`LeagueConditionsView`): the existing outlined **Share** button now opens this dialog **preselecting Playing conditions**; `PlayingConditionsShareDialog` is no longer opened from here.
- **League view header** (`LeagueViewLayout`): the existing **Share schedule** button becomes **Share** and preselects Schedule. It works on every tab (the dialog and the season's matches already live in the layout).
- `ShareScheduleDialog` is retired from the league entry points once this lands; its generators stay. `PlayingConditionsShareDialog` stays for any other caller (Open question 2).

### `ShareLeagueDialog` (new)

Built on the `114` shell: a dialog, full screen from `sm` down, titled "Share league", actions in the pinned footer through `ShareFooterContext`, safe-area insets, `SharePreviewStage`, `ShareFormatScreen`, `ShareDeliveryActions`, `useShareCapability`, `useEditableShareText`, `WhatsAppSendActions`, `ShareInitialsControl`, `ShareLogoControls` and `shareChoices` are **reused, not copied**. Where one of them names "result" in its API it is made content-neutral in the same change, rather than forked.

**Step 1, What to share.** A checkbox list (the `114` tile pattern is for single choice, so `CompactSwitch` rows or a multi-select tile group, final choice in the mockups): League details, Playing conditions, Teams, Schedule, Results, Key dates. Preselected as the entry point says; at least one must be ticked (Next disabled with visible text otherwise). A content with nothing to share (no conditions set, no published result, no season dates) stays listed but disabled with the reason ("No playing conditions set for this season yet"). A season pill (`HeaderSeasonSelect`, as `091`) is shown at the top when the dialog is opened without one.

**Step 2, Output format.** Tiles for the formats the club has enabled **and** that every ticked content supports:

| Content | PDF | Poster | Calendar (ICS) | WhatsApp | Facebook |
|---|---|---|---|---|---|
| League details | yes | no | no | yes | yes |
| Playing conditions | yes | no | no | yes | yes |
| Teams | yes | yes | no | yes | yes |
| Schedule | yes | yes | yes | yes | yes |
| Results | yes | no | no | yes | yes |
| Key dates | yes | yes | yes | yes | yes |

A format is offered when **all** ticked contents support it. A format that is hidden because of a tick is shown greyed with the reason ("Poster is not available for Results") rather than silently removed, so the manager can go back and untick. A format the club disabled is not shown at all. If no format remains, a message says so and points to the club's share settings. Back returns to step 1 with ticks kept.

**Format screens** follow `114`: control strip left, preview right, actions in the footer; Teams as a content on PDF and Poster and in text; the Poster reuses `leagueSchedulePoster.ts` and its templates for Schedule and extends it for Teams and Key dates. Mixed PDFs (several contents) are one A4 document with a section per ticked content, in the order of the list above. WhatsApp and Facebook text build one message with a section per content; Facebook offers the `114` templates that make sense (Match report becomes "Full post", plus Brief). Calendar produces an `.ics` of the schedule fixtures and the key dates ticked, with the usual Download and (where available) native share; there is no preview image, the screen lists the events that will be added.

**Switches on the format screens:** League logo, club logo and Footer line as `114`; Team logos on Teams and Schedule; Results can be shown with scores only or with the result line.

### Privacy

- **Contact details** (when Contacts arrives as a content, and for any contact named in League details): role and name only by default. Phone and email appear only if the manager ticks **Include phone and email** on that share; it is off every time the dialog opens, never remembered, and shown with the line "Only share contact details people expect to be public".
- **Junior names:** any player name that could appear (Results, and later Teams with players) goes through `shareName` (`114`); under-18 first names are initials, locked as `114` locks them, using `isJuniorMatch` with the league's `maxAge`. A league with `maxAge` at or below 18 is treated as junior for the whole share, so the lock applies to every format and every text.
- Wording: players are never called "children" anywhere in the dialog, the text or the generated output.
- File names and document titles contain the league, season and club names only.

### New or changed pieces

- New: `components/ShareLeagueDialog` (steps, content list, format availability), `utils/share/shareLeagueData.ts`, `leagueTextWhatsApp.ts`, `leagueTextFacebook.ts`, `leaguePdf.ts` (sections), `leagueIcs.ts` (extends the existing calendar builder), `leagueShareFormats.ts` (the content-by-format table above as one data table, never repeated in components).
- Changed: `ShareSettingsDto` and `shareSettingsApi.ts`/`useShareSettings.ts` (disabled formats), `ShareResultDialog` (honours disabled formats), `LeagueCard`, `LeagueTable`, `LeagueList` card view, `LeagueConditionsView`, `LeagueViewLayout`.
- A small **Share formats** control for the club (switches per format, per content type) in the place the club default lives today, `ShareInitialsControl`'s neighbour, or the club profile page (Open question 1).
- **Mockups needed (before build):** the two-step dialog on desktop and at 375 px; the greyed-format reason state; the card and list-row Share affordances; the mixed-content PDF page; the Teams and Key dates posters; the calendar event list screen; the club Share formats control.

## Test Plan

Per `docs/standards/testing.md`. Tests are written once, at the end of the whole leagues work, after the owner has checked the function.

**Unit (Vitest):** `leagueShareFormats` (every content combination gives the right offered, greyed and hidden formats; club-disabled formats hidden; none left); `shareLeagueData` (each content present, absent and empty, own teams flagged, season scoping); the WhatsApp, Facebook and ICS builders (every content, mixed contents, ICS line folding, time zone and all-day key dates, escaping); contact privacy (no phone or email unless opted in; opt-in never remembered); junior privacy (league `maxAge` 18 locks initials, no full first name in any text, PDF text, canvas `fillText`, file name or title, extending the `114` privacy fixture); `shareChoices` league branch.

**Component (Testing Library) and Storybook:** `ShareLeagueDialog` preselects per entry point, blocks Next with none ticked, disables empty contents with their reason, offers the right formats, keeps ticks on Back; each entry point (league card, list row and card view, Playing conditions tab, league header) opens it with the right preselection; the `ShareResultDialog` hides a disabled format. Stories at 375, 768 and 1280.

**Integration (Testcontainers) and contract:** the migration applies (defaults to all enabled); `share-settings` round trip with `disabledFormats`; a profile `PUT` does not reset it; last-format rejection returns `400`; another club's manager is refused; OpenAPI diff additions only. Backend unit test for the defaulting when a club has no profile row.

**End-to-end (Playwright, mobile and desktop):** one golden path, open a league, Share, tick Schedule and Key dates, choose Calendar, download the ICS, and check the events; one for a junior league where a Results WhatsApp text has initials only.

## Acceptance Criteria

- Share opens the same dialog from the league card, the league list row in both list and card view, the Playing conditions tab (Playing conditions preselected) and the league view header (Schedule preselected; the old "Share schedule" label is gone).
- Step 1 lists the six contents, at least one must be ticked, and a content with nothing to share is disabled with a visible reason.
- Step 2 offers a format only when every ticked content supports it and the club has it enabled; unsupported formats show greyed with the reason; Back keeps the ticks.
- PDF is offered for all contents; Poster only for Schedule, Teams and Key dates; Calendar only for Schedule and Key dates; WhatsApp and Facebook for all.
- The dialog, preview, delivery (Share or Download plus Copy text), Send in WhatsApp, editable text with a replace confirm, remembered choices and 375 px behaviour match `114`.
- A club administrator can switch formats off per club for results and leagues, a club cannot switch off every format of a content type, and the Results dialog honours the same setting.
- Contacts show role and name only unless the manager opts in for this share, and the opt-in is not remembered.
- Under-18 players appear by first initial in every format of a junior league share, with no full first name in any generated output, file name or title.
- The word "children" appears nowhere in the UI, text or output.
- No new dependency; the only backend change is the additive share-settings field; existing league endpoints are reused; `LeagueShareModel` is documented for the Player Hub.

## Rollout Notes

- **Order of work:** make the shared share pieces content-neutral and add `disabledFormats` (migration, DTO, endpoint, `ShareResultDialog` honouring it) first, so Results and Leagues move together; then `leagueShareFormats` and `shareLeagueData`; then the dialog with PDF and WhatsApp, then Poster, Facebook and Calendar; then the five entry points; then retire the two old league dialogs from the league screens; then docs, tests (once, at the end of the leagues work) and review.
- **Docs to update when built:** `docs/roadmap.md`, `docs/architecture.md` (none expected), `docs/standards/design-system.md` (the new component), `docs/standards/frontend.md` (league names and contacts go through the share helpers only).
- **Player Hub dependency:** group D builds Schedule > Leagues on `LeagueShareModel` and adds the player-scoped read; nothing here blocks on it and nothing there blocks this.
- **Follow-ups (to `docs/roadmap.md`):** Contacts, Venues, Next fixtures (and its Poster) and Standings (needs a points table read) as contents; a per-section format setting; a public league page and link; sharing a league from the Player Hub.

## Decisions (owner, 2026-10-28, all proposals accepted)

1. Club administrators only change the format switches; the control lives on the club profile page, next to the share settings.
2. `PlayingConditionsShareDialog` is retired if the plan finds no non-league caller; the new dialog preselects Playing conditions.
3. A league share's Results are the published results of the selected season, scores and result lines only, no scorecards or player performances in the first round.
