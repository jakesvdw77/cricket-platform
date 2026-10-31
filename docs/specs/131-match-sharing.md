# 131: Match Sharing

**Depends on:** `114-share-result.md` (the dialog shell, format screens, preview stage, delivery by capability, `shareName`, `isJuniorMatch`, remembered choices, `WhatsAppSendActions`, `ShareSettingsDto`), `122-league-sharing.md` (the multi-step "What to share, Format, Preview" dialog, content-by-format table, club format switches, `ShareCore`), `030-team-sheet-communication.md` and `039-team-sheet-whatsapp-text.md` (the dialog this replaces), `130-matches-pages-revamp.md` (the row kebab and Manage Match menu this plugs into), `076`/`093` (team selection, the selected XI, captain and wicketkeeper), `099` (Field Directory, `PlayingArea`), `100`/`101` (results, sides), `103`, `116`, `117` (player and team statistics, form, milestones), `051` (poster generator precedent), `docs/standards/page-anatomy.md`, `design-system.md`.
**Status:** approved 2026-10-31 (owner approved the mockups in `docs/mockups/match-sharing-mockup.html`; TV summary for matches stays as proposed: Fixture Card, Countdown, Team Selection). Building.

## Problem & Goals

The match "Communicate Team Sheet" dialog (`TeamSheetCommunicationDialog`) is thin: a PDF, WhatsApp text and a greyed-out Facebook. Results (`114`) and leagues (`122`) already have a proper Share dialog with formats, templates, a live preview and privacy rules; a match has none, and it is the thing clubs most want to promote before it is played. The legacy system could make a team selection image with a chosen picture beside the XI; the new platform cannot.

Goals:

- **A. One match Share dialog** replacing `TeamSheetCommunicationDialog`, on the `114`/`122` engine: step 1 What to share, step 2 Format, step 3 Preview (near full screen); choice steps are a 720 px card.
- **B. Creative contents** from data we hold: Team selection poster (a chosen image beside the XI, the legacy idea, not its code), Countdown poster, Fun facts (rule-built), Fixture card, printable A4 Team sheet.
- **C. Our side, Opposition or Both** toggle as results have, and for Both a layout toggle (Side by side or Separate); the same formats as results (PDF, Image, TV summary, WhatsApp, Facebook).
- **D. Same privacy, delivery and remembered choices as `114`** (initials-only, junior lock, Share/Download/Copy, Send in WhatsApp).
- **E. Match weather** (forecast only) on cards, the match page, the Player Hub and the visual contents.
- **F. Three entry points** with preselection.

## Non-goals

- **Backend rendering, stored images or share history.** Everything is generated in the browser; the chosen poster picture is held in memory only.
- **Posting to Facebook or WhatsApp** from the platform; no API integrations (`114`).
- **Custom fonts or colours.** Brand tokens stay a closed set; templates use the theme primary colour (`114`).
- **AI in version 1.** Fun facts and captions are built by rules from stored data. AI-generated layouts and wording are **Later**.
- **Facts the data cannot support.** No ground records, no "unbeaten at home" unless computed from stored results; a fact that cannot be computed is not offered. Weather is a forecast only, never a guess or a past observation.
- **Player photos on cards.** Same child-safety position as `114`: the only picture is the one image the manager chooses for the poster.
- **Umpire and official capture** (backlog, Decisions 4).
- **A saved picture gallery** (Later, Decisions 6).
- **Combining several visuals into one image, or a stepper over them** (Decisions 5).
- **A backend weather proxy** (Later).
- **A public match link or page** (as `114`).
- **Retiring the team announcement.** `AnnounceTeamDialog` (`040`) is unchanged; only the sharing dialog is replaced.

## User Stories

- As a club manager, I can open Share on a match and choose what to share (fixture card, team selection poster, countdown, fun facts, team sheet), so that I send the right thing for the moment.
- As a club manager, I can choose our side, the opposition or both, and for both choose Side by side or Separate, so that I share the lineup the way I mean.
- As a club manager, I can share the fixture card, countdown or match-level fun facts before a team is selected, so that I can promote a match early.
- As a club manager, I can upload a picture, place it beside the selected XI and see the poster update, so that the announcement looks like our club's.
- As a club manager, I can make a "3 days to go" poster in club colours.
- As a club manager, I get ready-written fun facts (form, head to head, milestones) I can switch on or off.
- As a club manager, I can print an A4 team sheet.
- As a club manager, I can choose PDF, Image, TV summary, WhatsApp or Facebook for the content, and share, download or copy as for results.
- As a club manager, I see the forecast on the match, and can include it on a poster, so that supporters know what to expect.
- As a player or parent, I see the forecast on my match rows in the Player Hub.
- As a club manager of a junior team, I find first names locked to initials with the reason shown.
- As a club manager, I tap Team Sheet in a team panel and land with that content ticked.
- As a club manager of a played match, I tap Share Match and am handed to the result Share dialog.
- As a club manager, my last choices return next time on this device.

## Data Model Changes

None for version 1. Browser storage only: `share:choices:<clubId>` gains a `match` branch (last content, format, template, side, layout, size, include switches; never the uploaded picture, never edited text, as `114`). The picture is a local `File` or object URL, discarded when the dialog closes.

### Data gaps (what is not stored today)

| Need | Status | Handling |
|---|---|---|
| Umpires (per match) | **Not stored** (no field anywhere in `backend/`). | Fixture card omits the umpires line. On the backlog (Decisions 4); do not fake it. |
| Team or squad photo | **Not stored** (only logos). | Picked at share time, never saved; a gallery is Later. |
| **Field coordinates (weather)** | **Not stored.** `PlayingArea` (`099`) has an address and `mapUrl` (https, max 500, validated by `PlayingAreaWriter`) but no latitude or longitude (checked in `domain/PlayingArea.java`, `PlayingAreaDto`). | Proposal, flagged for owner choice (Open question 2): **(a) fallback in v1, UI only:** parse coordinates from the field's `mapUrl` in the browser, as the legacy app did (`@lat,lng` and `!3d..!4d..` patterns; short links such as `maps.app.goo.gl` cannot be resolved in the browser, so no weather for them, never a guess). **(b) later, backend:** store `latitude` and `longitude` on `PlayingArea` (migration, DTO, form), set from the map URL on save or by a map pick; this is the durable fix and the only way short links work. |
| Head-to-head, form, milestones | Derivable from published results and statistics reads (`103`, `116`, `117`) | Present; each fact states its basis; a fact with too little data (for example fewer than 3 prior meetings) is hidden. Plan time: check a head-to-head read exists for the opponent, as an additive filter only. |
| Captain, keeper, batting order | Present (`076`, `093`) | Shown when set. |
| Opposition's selected XI | Only when the opposition is a platform team | Opposition and Both disabled with a reason otherwise. |
| Venue, date, time, league, logos | Present on `Match` | Used. Club colour is the platform green (`114` known gap). |

## API Contract

No new endpoint in v1. The dialog reads what the Match page and Team Selection already load, plus statistics and results reads for fun facts. `share-settings` (`114`, `122`) gains a `MATCH` content type in `disabledFormats` (additive; `400` if a club disables every format). Weather is fetched **from the browser** straight from the free Open-Meteo forecast API (no key); there is no platform endpoint (a backend proxy is Later, which would also give caching, a privacy buffer and an outage fallback). Any other backend need is an open question, not built.

## UI Requirements

Built on the `114`/`122` pieces, reused not copied (`ShareFooterContext`, `SharePreviewStage`, `ShareFormatScreen`, `ShareDeliveryActions`, `useShareCapability`, `useEditableShareText`, `WhatsAppSendActions`, `ShareInitialsControl`, `ShareLogoControls`, `shareChoices`). Names that say "result" are made content-neutral in the same change.

### Entry points

- **Matches list row kebab:** the disabled "Share Match" item is enabled and opens the dialog (Share last, `page-anatomy.md` 6b). The existing "Share Team Sheet" item opens the same dialog with Team sheet ticked.
- **Match page, Manage Match menu:** **Share Match** last (the per-side Share Team Sheet items become preselections).
- **Team panels on the match page:** the Team Sheet button opens the dialog with Team selection poster and Team sheet ticked and that side chosen. Disabled with a visible reason until a team is selected.
- **A played match** (a result exists): Share Match hands over to `ShareResultDialog` (published result) with the reason line "Opening the result share"; a played match with no published result offers the dialog as normal.
- Title Case labels; one `ShareMatchDialog`.

### `ShareMatchDialog` (new shared component)

Dialog on desktop, full screen from `sm` down, titled "Share match". Back keeps choices.

1. **What to share** (720 px card): the contents as **one choice** (the manager picks one visual or text content per share; radio-style tiles, no multi-select, no combined image, no stepper). Our side, Opposition, Both toggle, and for Both the **Side by side / Separate** toggle (Separate means one image per side, stepped on screen and downloaded separately, or two pages in a PDF). Contents needing data are disabled with a visible reason: Fixture Card, Countdown and match-level Fun Facts work before a team is selected; Team Selection poster, Team Sheet and team-based facts need a selected XI ("Select the team first"). Season pill only when opened without a match season.
2. **Format** (720 px card): tiles for formats the chosen content supports and the club has enabled; unsupported ones greyed with the reason.
3. **Preview** (near full screen): controls left, live preview right, actions pinned in the footer (Share or Download, Copy text, Print, Send in WhatsApp), zoom as `114`.

### Content catalogue

Formats: PDF, Image, TV (summary), WhatsApp (text), Facebook (text). "Poster" is an Image template. Sides: O our side, P opposition, B both (with layout toggle).

| Content | Data needed | Needs selected XI | PDF | Image | TV | WhatsApp | Facebook | Sides |
|---|---|---|---|---|---|---|---|---|
| Fixture card | date, time, venue, teams, league, logos, weather (umpires: gap) | no | yes | yes | yes | yes | yes | n/a |
| Team selection poster | XI, captain, keeper, order, chosen picture, logos, weather | yes | yes | yes (Square, 4:5, Story) | yes | yes (list text) | yes | O, P, B |
| Countdown poster | date and time, teams, logos, league, weather | no | yes | yes | yes | yes ("3 days to go") | yes | n/a |
| Fun facts | match-level: head to head, last meeting, form of each side; team-level: our form, milestones near reach (`103`, `116`, `117`) | match-level no, team-level yes | yes | yes (3 to 5 facts) | yes | yes | yes | O, P, B for team facts |
| Team sheet (A4) | XI, roles, match header, blank lines for officials | yes | yes (printable) | no | no | yes (as `039`) | yes | O, P, B |

TV summary is offered for Fixture Card, Countdown and Team Selection only (Open question 1). Countdown wording: "N days to go", "Tomorrow", "Today", "Match day"; not offered for a past match.

### Team selection poster

- **Picture:** a left panel shows the chosen image beside the XI (legacy idea: photo left, names right). Controls: Choose picture, Remove, Position X and Y, Zoom, Opacity, Filter chips (None, Black and White, Sepia, Vivid; canvas filters only). Cropped, never stretched. None chosen: a club-colour panel with logos. Text sits on a solid or scrimmed panel, never directly on the photo.
- **Layout:** XI in batting order, C and WK marked, names, date, venue, league, logos, optional weather. Both with Side by side puts both XIs on one image (tight at Square and Story: there it falls back to Separate with a note); Separate gives one image per side.
- Names pass through `shareName`.

### Fun facts

Rule-built, one table of facts and thresholds (`matchFunFacts.ts`), each a pure function returning text and basis or null. Examples: "Riverside have won 4 of their last 5", "Head to head: 3 wins each from 6", "M. Naidoo is 21 runs from 1,000 for the club". Person facts use `shareName`; facts about the opposition only when it is a platform team, juniors initials only. The manager ticks facts (up to five preticked). Never AI; never a fact without data.

### Weather

Forecast only, from the free Open-Meteo API, in the browser (no key), the legacy idea (`cricketlegend ui/src/components/cricket/shared.tsx`): daily weather code, max and min temperature, maximum precipitation probability, `forecast_days` 7, icons mapped from WMO codes.

- **`hooks/useMatchWeather`** takes the match date and the field (coordinates) and returns `{ status, summary }`; React Query caches by rounded location and date (long stale time, no refetch on focus, a failed fetch is quiet and retried later).
- **`components/WeatherBadge`:** MUI icons (all under 32 px, so `BrandIcon` is not needed), the temperature range, the rain chance and a text label ("Mostly sunny, 14 to 27 degrees, 20% rain") that is also the accessible name; never colour or icon alone.
- **Never a guess:** nothing is shown for a date beyond the forecast range (more than 7 days ahead), for a past date, or when the field has no usable coordinates; the slot collapses, no placeholder and no error.
- **Coordinates:** from the Field Directory field of the match (`099`). `PlayingArea` stores none (Data gaps), so v1 uses the `mapUrl` parsing fallback; storing coordinates is the proposed later backend change.
- **Where shown:** match cards and rows, the match page (a figure or the Venue card line, no icon tile, per `page-anatomy.md` figure rules), as an **Include weather** switch on Fixture Card, Countdown and Team Selection posters (off when no forecast, with the reason as text), in WhatsApp and Facebook text for those contents, and in the Player Hub match rows (group `121`; read-only badge, same hook).
- **Privacy and cost:** only a rounded location and a date are sent to Open-Meteo; no user data. A club that dislikes the third-party call is served by the backend proxy (Later).

### Control strips (selection)

| Format | Templates | Other controls | Include switches |
|---|---|---|---|
| PDF | Club colours, Classic, Compact | Side, Layout (for Both) | Captain and keeper marks, Venue and date, Weather, Logos group, Footer line |
| Image | Club green, Night, Daylight | Size: Square 1080, Portrait 4:5, Story 9:16; Side, Layout | Picture, Captain and keeper marks, Venue and date, Weather, Logos group, Footer line |
| TV | Broadcast, Club colour, Light | always 1920 x 1080 | as Image |
| WhatsApp | Short, With facts | Side | Emoji, Weather, Attach image where shareable |
| Facebook | Announcement, Countdown, Brief | Side | Hashtags, Mention the sponsor, Weather, Attach image |

Privacy, junior lock (`isJuniorMatch`, covering the opposition's names), logos and footer line, delivery by capability, edit-text confirm, Send in WhatsApp and length guard follow `114` unchanged.

### Phone behaviour and accessibility

Authored at 375 px: full-screen dialog, controls stack above the preview, 44 px targets, sticky bottom actions, safe-area insets, no horizontal page scroll (the A4 preview scrolls inside its stage). Contents and formats are radio groups with arrow keys; side and layout toggles and chips are toggle buttons with `aria-pressed`. Every disabled control shows its reason as text with `aria-describedby`. Canvas previews have an `aria-label` ("Team selection poster: Riverside 1st XI v Hillcrest, Saturday 8 November"); PDF text is real text. Template palettes are tested at WCAG 4.5:1, including a light club colour and the picture scrim. Weather is conveyed in words. Escape closes; focus returns to the opener. A failed logo, picture or weather fetch collapses its slot, never an error.

## Test Plan

Per `docs/standards/testing.md`; build first, tests after the owner's check (working rule).

- **Unit (Vitest):** `shareMatchData` (our, opposition, both, no XI, derby, past match); `matchShareFormats` table (offered, greyed, hidden, club-disabled, TV limits); `matchFunFacts` (enough, too little and no data; wording); countdown wording; picture crop and filter maths; layout helper for side by side, separate and the narrow-size fallback; WhatsApp and Facebook builders (every template and switch, emoji off, hashtags carry no name); `shareChoices` match branch.
- **Weather (unit and component):** WMO code to label and icon mapping for every code group; `mapUrl` coordinate parser (`@lat,lng`, `!3d!4d`, `q=lat,lng`, short link gives null, malformed gives null); `useMatchWeather` with a mocked fetch: in range returns a summary, 8 days ahead and a past date return nothing without any request, no coordinates returns nothing without any request, a failed fetch is quiet, the cache serves a second call for the same rounded location and date with one request; `WeatherBadge` renders text, never shows a placeholder; the Include weather switch is disabled with its reason when there is no forecast; weather text appears in the WhatsApp and Facebook builders only when on.
- **Privacy (required, extends `114`'s fixture):** with initials on no full given name appears in any text, PDF text, canvas `fillText`, fun fact, file name, document title or share title, for all contents and sides; shortened and full forms asserted so the test is not vacuous. Junior match: switch checked, disabled, "Always on for junior leagues", also covering opposition names.
- **Component (Testing Library) and Storybook (375, 768, 1280):** each entry point opens with the right preselection and side; one content at a time; Team Sheet and poster disabled until selected with reason while Fixture Card, Countdown and match-level facts stay enabled; greyed formats show their reason; Back keeps choices; Share versus Download by `navigator.canShare`; Side by side or Separate toggle (and narrow fallback); a played match hands over to `ShareResultDialog`; picture controls update the preview; edit-then-switch asks to replace; disabled club format hidden.
- **Integration and contract:** only the `disabledFormats` `MATCH` addition (round trip, `400` on all disabled, tenancy, OpenAPI additions only). No other backend tests.
- **End-to-end (Playwright, mobile and desktop):** open a match with a selected XI, Share, pick Team selection poster, Image, choose a picture, Portrait, download a 1080 x 1350 PNG; then Countdown by WhatsApp with initials on and a stubbed forecast, copy text and assert no full first names and the weather line.
- **Retirement:** `TeamSheetCommunicationDialog` and its tests removed or ported; its PDF and WhatsApp behaviour (`030`, `039`) is covered by the new Team sheet tests.

## Acceptance Criteria

- Share opens the one dialog from the row kebab (Share Match enabled, last), the Manage Match menu (Share last) and the team panels' Team Sheet buttons (content and side preselected). A played match with a published result hands over to the result Share dialog.
- Three steps: What to share (720 px card), Format (720 px card), Preview (near full screen); full screen at 375 px; Back keeps choices; one content per share.
- Fixture Card, Countdown and match-level Fun Facts can be shared before a team is selected; Team Selection poster, Team Sheet and team facts are disabled with a visible reason until an XI exists.
- Our side, Opposition and Both work; Both offers Side by side or Separate (Separate gives one image per side or two PDF pages); Opposition and Both are disabled with a reason when the opposition's XI is unavailable.
- The poster shows the chosen picture beside the XI with position, zoom, opacity and filter controls; the picture is never uploaded or stored.
- Countdown text is correct for N days, tomorrow, today and match day, and not offered for a past match.
- Fun facts come from stored data only, each can be switched off, a fact without enough data is not shown, no AI is called.
- The A4 Team sheet prints on one page and matches the preview.
- **Weather:** a forecast badge shows on match cards, the match page and Player Hub match rows when the match is within 7 days and the field has usable coordinates, and shows nothing otherwise (past, further than 7 days, no coordinates, failed fetch); Include weather appears on Fixture Card, Countdown and Team Selection posters and in their texts; weather text always states conditions in words; the forecast is requested from the browser only, once per location and date per cache window; no platform endpoint and no key.
- Initials-only, junior lock, remembered choices, Share or Download by capability, Send in WhatsApp and editable text behave as `114`; no full given name appears with initials on, in any output or file name.
- Umpires are not shown anywhere and no field is invented for them.
- No new dependency; no backend change beyond the additive `MATCH` format switches; `TeamSheetCommunicationDialog` is gone from the match screens.
- Works at 375 px with no horizontal scrolling; keyboard reachable; every control labelled; contrast tested.

## Rollout Notes

- **Order:** make the shared share pieces content-neutral; `shareMatchData`, formats table, builders and tests; dialog with Fixture card, Team sheet and WhatsApp first (parity with today); then Team selection poster, Countdown, Fun facts; then PDF, Image, TV, Facebook templates; then weather (`useMatchWeather`, `WeatherBadge`, coordinates parser), first on the dialog, then match cards, match page and Player Hub rows; then entry points; then retire the old dialog; then docs and review.
- **Mockups needed before build:** the three steps on desktop and at 375 px; Team selection poster in Portrait and Landscape with picture controls; Both sides in Side by side and Separate; Countdown poster; Fun facts card; A4 team sheet; weather badge placements; TV summary for matches (Open question 1).
- **Docs when built:** `docs/roadmap.md`, `design-system.md` (new components), `page-anatomy.md` (Matches list and Match page rows), `docs/architecture.md` (none expected).
- **Roadmap lines to add (one line each, `docs/roadmap.md`, Suggestions):** (1) **Umpires and officials:** store umpires per match, then show them on the Fixture card and Team sheet (spec 131 data gap). (2) **Picture gallery:** a stored club image library for poster pictures, replacing per-share upload (spec 131). (3) **Weather:** store latitude and longitude on `PlayingArea`, and a backend weather proxy with caching (spec 131). (4) **AI-generated layouts and wording** for match sharing (spec 131).
- **Later:** AI-generated layouts and wording; umpire capture; picture gallery; stored field coordinates and weather proxy; a public match page and link.

## Decisions (owner, 2026-10-31)

1. **Both sides layout:** both are offered, as a toggle **Side by side / Separate** for Both. Separate is one image per side, stepped on screen, or two PDF pages.
2. **Content before a team is selected:** allowed where it applies (Fixture Card, Countdown, match-level Fun Facts). Selection-based contents (Team Selection poster, Team Sheet, team facts) need a selected XI and are mostly used once a team is selected; disabled items state the reason.
3. **TV summary:** kept as proposed (Fixture Card, Countdown, Team Selection); still open, see Open Questions.
4. **Umpires:** backlog item, not built here (roadmap line).
5. **One visual per share:** the manager chooses one content; no stepper and no combined image.
6. **Picture:** uploaded per share, not saved; a gallery is a later feature (roadmap line).
7. **Played matches:** Share Match hands over to `ShareResultDialog`.
8. **Fun facts about the opposition:** yes, platform-team opposition only, and juniors by initials only.
9. **Weather:** added (Open-Meteo forecast, browser-only, forecast range only, never a guess); backend proxy is Later.

## Open Questions

1. **TV summary for matches:** the owner is unsure. Kept for Fixture Card, Countdown and Team Selection; decide at the mockup stage whether it earns its place.
2. **Field coordinates for weather:** parse them from the existing `mapUrl` in the browser for v1 (short links give no weather), or add `latitude` and `longitude` to `PlayingArea` first (backend, migration, form)? Proposed: the parsing fallback now, stored coordinates as the follow-up.
