# 114: Share a Published Result

**Depends on:** `100-match-results-core.md` (the Results page, the result page, the draft / publish gate, `MatchResult`, `Innings`), `101-match-results-our-side-scorecard.md` (the scorecard read, `ResultPlayer`, batting and bowling entries, the official player of the match, the opposition's names), `104-match-results-import-adaptors.md` (how our side and the opposition appear in a scorecard), `029-league-management.md` and `110-league-age-cutoff-day-and-month.md` (a league's optional `minAge` and `maxAge`), `012-club-profile.md` (club logo), `030-team-sheet-communication.md` and `051-league-schedule-sharing.md` (the browser-side PDF and PNG precedents this copies), `039-team-sheet-whatsapp-text.md` (the text builder precedent), `docs/standards/*.md`.
**Status:** draft, written 2026-10-17 from the approved mockups (`share-result-mockups.html`, published as a Claude artifact) and the product owner's decisions. Part of finishing the Results section, before statistics (`103`). No code is written by this spec.

## Problem & Goals

A manager who has published a result has no way to tell anyone about it except retyping the score into WhatsApp or Facebook, or screenshotting the result page. Clubs want a printable scorecard, a result card for a feed, a widescreen summary for the clubhouse television, and ready-written text for WhatsApp and Facebook. Many of the players named are children, so a share must make it easy to avoid publishing their full names.

Goals:

- **A. Share entry points:** a **Share** button on the result page and an icon button on the Results card, enabled only when the result is published.
- **B. One dialog, five formats:** PDF scorecard, Image, TV summary, WhatsApp, Facebook, each with templates, include switches, a live preview and actions.
- **C. Generated in the browser** with libraries already approved (jsPDF, Canvas2D, plain text builders). No new dependency.
- **D. Delivery that works everywhere:** the browser's share sheet with files where it exists, otherwise Download plus Copy text.
- **E. First names as initials privacy option** (the setting's code name remains Initials only) that applies to every format and to every generated text, locked on for junior leagues, with a club default.
- **F. Remembered choices** per club in the browser.
- **G. Send in WhatsApp everywhere:** one shared action (wa.me link, native share, copy) used by the Result WhatsApp screen and by the existing team announcement, poll, playing conditions and section availability dialogs.

## Non-goals

- **AI match analysis or AI written reports.** The Celebration tone is built from the data by rules, not by a model, and is editable.
- **Custom colours or fonts.** Templates use the club's existing primary colour only (`design-system.md`: brand tokens stay a closed set).
- **A public result link or public result page.** The "Link to the match page" text switch is therefore **not built** (see Open questions 4). Recorded for a later spec that adds public results (`100` deferred player and public result views).
- **Scheduled posting, and posting to Facebook or WhatsApp from the platform.** A web page cannot post to Facebook; this spec copies text and downloads or shares the image. No Facebook or WhatsApp API integration.
- **Sharing a draft.** Share is disabled until published; unpublishing hides nothing already sent.
- **Fall of wickets.** The mockup's "Extras and fall of wickets" switch is reduced to **Extras** only: the scorecard does not store fall of wickets (the STUMPS and CricClubs adaptors read it and ignore it, `107`, `108`). Recorded for the roadmap, not faked.
- **Statistics, milestones and "season so far" lines.** Those arrive with `103`.
- **A per-team or per-section Initials only default.** An open question only (Open questions 2), not built.
- **Backend rendering, stored share images or share history.** Nothing generated is stored.
- **Ball-by-ball, partnership or worm charts.**

## User Stories

- As a club manager, I can choose **Share** on a published result and pick PDF, Image, TV summary, WhatsApp or Facebook, so that I can tell people the result in the form each place needs.
- As a club manager, I find Share only on a published result (a draft shows no Share button, just as a published result shows no Publish button), so that the actions on a card and on the page are always the ones that apply.
- As a club manager, I can choose a template, what to include and (for PDF, WhatsApp and Facebook) both teams or our team only, and see a live preview change as I do, so that I know what will be sent.
- As a club manager on a phone, I tap **Share** and hand the image or PDF and the text to WhatsApp, Facebook or any app through the phone's share sheet in one step.
- As a club manager on a computer, I tap **Download** and **Copy text**, so that nothing is lost where the browser cannot share files.
- As a club manager, I can edit the WhatsApp and Facebook text before sending, so that I can add my own words.
- As a club manager (on a phone or a computer), I can tap **Send in WhatsApp** on a result message, the team announcement, a poll message, the playing conditions message or the section availability message, and have WhatsApp open with the text already filled in, so that I do not copy and paste it.
- As a club manager, I can switch on **First names as initials** (the setting's code name remains Initials only) so that player names read "M. Naidoo" instead of "Mpho Naidoo", and I can set what the club's default is, so that children's names are not published by habit.
- As a club manager of a junior league match, I find First names as initials locked on with the reason shown, so that I cannot publish children's full names by accident.
- As a club manager, my last choices come back next time on this device, so that I do not set the same things for every result.
- As a club manager, I see my club's colours on the templates, so that the output looks like ours.

## Data Model Changes

Only one persisted item, the club-level default for Initials only.

**Where club settings live today.** `Club` is tenancy only (a deliberate stub); there is no generic club settings table, and `docs/roadmap.md` records that `101` chose not to add a `club_result_settings`. The closest existing mechanism is `club_profile` (`012`, 1:1 with `Club`, own audit trail, edited at `PUT /api/v1/manage/clubs/{id}/profile`, which is a **full-resource replace**).

**Proposal (flagged as Open question 1):** add one column to `club_profile`, `share_initials_only boolean not null default false`, in `backend/src/main/resources/db/changelog/v1/NNN-club-share-initials-only.sql` (next sequential number, confirm at plan time). It is **not** added to `UpdateClubProfileRequest`, because that endpoint nulls anything omitted and the field is not part of the profile form. It has its own small endpoint (below), so a profile save never resets it. No other table changes.

**Browser storage (no database):** `share:choices:<clubId>` in `localStorage` (one JSON object: last format, per-format template, include switches, teams, size, and the user's own Initials only choice for non-junior matches), read and written inside `try/catch`, falling back to defaults on a missing key, corrupt JSON or unavailable storage, in the manner of `usePersistedListFilters`. Edited WhatsApp and Facebook text is never remembered.

## API Contract

No new read is needed for the result data: everything comes from endpoints the Results pages already use (see "Data check" below).

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/share-settings` | club manager | Returns `{ initialsOnlyDefault: boolean }` |
| `PUT /api/v1/manage/clubs/{clubId}/share-settings` | club manager | Sets `initialsOnlyDefault`; `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`; one DTO in and out, service interface plus implementation, per `backend.md`. Any club manager can change it (the same rule `100` uses for capture and publish) |

`openapi.yaml` regenerated and committed; the contract diff shows additions only.

### Data check (what already exists, what is missing)

| Need | Source | Status |
|---|---|---|
| Teams, scores, overs, result line, toss, venue, date, league | `ResultListItem.match` and `MatchResult` (`innings[]` with balls, `oversDisplay`, extras; `resultLine.ts`) | Present |
| Batting, bowling, extras per innings, both sides | `getScorecard` (`Scorecard.batting`, `bowling`, `innings[]` extras breakdown) | Present at detail level `OUR_SIDE` (ours) and `FULL` (opposition, free-text names). A result with no scorecard shares the summary only; see acceptance criteria |
| Official player of the match | `Scorecard.awards` (`PLAYER_OF_MATCH`, with `resultPlayerId` and `playerName`) and `ResultListItem.playerOfTheMatch` (a resolved name string) | Present. For First names as initials the structured first and last name is needed, so the share reads the award's `resultPlayerId` and resolves it against `Scorecard.players` (`firstName`, `lastName`, or the guest's `displayName` split by `splitName`), never the pre-formatted string |
| Which players are the opposition's | `ResultPlayer.opposition` | Present |
| Team logos | `Match.homeTeamLogoUrl` and `awayTeamLogoUrl` | Present (null for a free-text opponent: initial tile drawn instead) |
| Club logo | `ClubProfile.logoUrl` via `GET /api/v1/manage/clubs/{id}/profile` | Present, but that endpoint is `canAdministerClub`; a section-scoped manager (`035`) may not be allowed to read it. See Open questions 5 |
| Sponsor logo and name | `listSponsors` (`Sponsor.logoUrl`) | Present. Which sponsor to feature is not decided by any data (no "main sponsor" flag); see Open questions 6 |
| Club primary colour | `useTheme().palette.primary.main` | The theme resolves to the platform green `#2f6e4f` today: `withClubBranding()` has no production caller and `ClubProfile` has no `primaryColor` column (`044`, `001`). The spec reads the theme colour, as `051`'s poster does, so templates pick up a club colour automatically once branding is persisted. Until then every club sees the green. **Missing, not built here** |
| Fall of wickets | none | **Missing** (see Non-goals) |
| Public match link | none | **Missing**, deliberately (Non-goals) |
| League `maxAge`, section age metadata | league and section reads (`029`, `110`) | Present (for the junior rule below) |
| Logos fetched into canvas and PDF | `fetch` to blob, as `leagueSchedulePoster.ts` and `teamSheetPdf.ts` do | Works where the image URL allows cross-origin reads; any failure resolves to the initial tile, never an error |

## UI Requirements

Compose from existing shared components (`design-system.md`); mockups are the approved reference. Pixel values come from `theme.ts`.

### Entry points

- **Result page (`ResultDetailPage`):** a **Share** button, filled primary like Add and Edit, with a share icon, placed with the page actions, **shown only on a published result** (a draft has no Share button, as a published result has no Publish button; decided by the product owner 2026-10-17 for consistency).
- **Results card (`RecordCard` footer):** a labelled **Share** footer button after View, Edit and Publish (the footer has no icon-only variant), **shown only on a published result**, with the same rule as the page.
- Both open the same `ShareResultDialog`.

### `ShareResultDialog` (new shared component)

A dialog on a desktop, **full screen on a phone** (`BottomSheet`-style behaviour from `sm` down, the repo's existing pattern), titled "Share result". Step 1: five tiles (`TileChoiceGroup`, brand icons at 40 px through `BrandIcon`; if an icon does not exist yet it is added to the brand set, otherwise a MUI icon is a temporary fallback): **PDF scorecard** ("Full scorecard, A4, to print or send"), **Image** ("Result card for feeds and chats"), **TV summary** ("Widescreen match summary"), **WhatsApp** ("Message text plus image"), **Facebook** ("Post text plus image"). Choosing a tile opens that format's screen inside the dialog with a Back link to the tiles. The last format used is highlighted on opening.

### Format screen anatomy (shared)

Controls on the left (stacked above the preview on a phone), preview on the right, actions under the controls. A **control strip** per format uses `CompactToggleGroup` for template and size chips, `CompactSwitch` for the include switches, and the shared preview stage. The **First names as initials** switch sits at the top of the Include group on every format and is the same one value across formats within a visit.

| Format | Templates | Other controls | Include switches |
|---|---|---|---|
| PDF scorecard | Club colours, Classic, Compact | Teams: Both teams or Our team only | Batting, Bowling, Extras, Toss and conditions, Player of the match, **Logos group**, Footer line |
| Image | Club green, Night, Daylight | Size: Square 1080, Portrait 4:5, Story 9:16 | Top performers, Player of the match, Venue and date line, **Logos group**, Footer line |
| TV summary | Broadcast, Club colour, Light | Performers per innings: Top 2 or Top 3. Always 1920 x 1080 (16:9) | Batters, Bowlers, Player of the match bar, **Logos group**, Footer line |
| WhatsApp text | Short, With top performers, Scorecard text | Teams: Both teams or Our team only | Attach the result image, Emoji |
| Facebook text | Match report, Celebration, Brief | Teams: Both teams or Our team only | Attach the result image, Hashtags, Mention the sponsor |

The Image and TV cards always show both scores (a card without the opposition's score is meaningless); "Our team only" is therefore not offered there, as in the mockups. The "Club colour" and "Club green" templates use the theme primary colour, with its derived dark and contrast text from the same `withClubBranding` derivation `ShellHeader` uses, so text stays readable on a light club colour.

### Logos and footer (PDF, Image and TV)

Added at the product owner's request (2026-10-17). Each of these three formats has a **Logos** group in the control strip and a **Footer line** switch.

- **Logos group, each its own switch (all on by default where a logo exists):**
  - **Club logo** (`ClubProfile.logoUrl`).
  - **Team logos** (both sides, `Match.homeTeamLogoUrl` and `awayTeamLogoUrl`; a side with no logo gets the initial tile).
  - **League logo** (`League.logoUrl`, only when the league has one; the switch is hidden when it has none, with no empty box left).
  - **Sponsor logos:** a small chooser lists the club's active sponsors and the active sponsors of the match's teams (`listSponsors`, `teamSponsorApi`) that have a logo; the manager ticks the ones to show, up to **4** (`MAX_SHARE_SPONSORS`, a named constant). The choice is remembered per club. Sponsors appear in a "Proudly sponsored by" strip on the PDF footer band and the bottom of the Image and TV cards. This also settles the old "which sponsor to feature" question: the manager decides, with nothing ticked by default beyond the first active sponsor of the home team.
- **Layout rules:** logos are drawn in fixed slots so nothing overlaps or shifts: club and league logos in the header, team logos beside the team names, sponsors in a strip along the bottom. A logo that fails to load is skipped, never an error, and its slot collapses. Logos keep their aspect ratio inside a square box and never stretch. On the Story size the sponsor strip wraps to two rows.
- **Footer line switch:** the line at the bottom of the card or page ("riverside.cricketlegend.app" in the mockups, and "Generated by Cricket Legend" on the PDF) can be removed. The switch is **Footer line** and is on by default for the platform credit only; it controls: (a) the club web address line, shown only when the club has a website on its profile (`ClubProfile.website`), never an invented address, and (b) the platform credit. Turning the switch off removes both lines and the page or card simply ends. The PDF page number stays on a multi-page PDF because it is navigation, not branding.
- **Text formats** (WhatsApp, Facebook) have no logos; sponsors appear only through the existing "Mention the sponsor" switch, which now names the sponsors ticked in the chooser.
- **Remembered:** the logo switches, the sponsor choice and the Footer line switch are saved per club with the other choices (`share:choices:<clubId>`).
- **Permissions:** logos come from reads a manager already has, except the club logo for section-scoped managers (open question 5).

### What "Our team only" means precisely

"Ours" is decided per player by `ResultPlayer.opposition === false` (`101`, `104`), and per side by the match's `homeTeamId` / `awayTeamId` being set (`100`'s "naming of sides"). With **Our team only**:

- Both innings **totals and the result line stay** (a result with one score is meaningless).
- The **opposition's batting card, bowling card, extras, and their performers and names are omitted**: the PDF drops the opposition's batting tables and the bowling table of the opposition's bowlers; WhatsApp and Facebook texts list only our players' performances; the player of the match is shown only when it is one of ours (the opposition's is dropped).
- Our batting is the batting entries whose `battingSide` is our side; our bowling is the bowling entries of our players (bowling entries carry the *other* side as `battingSide`, `101`).
- **A derby (both teams ours, `100`):** both sides are ours, so the choice changes nothing; the Teams control is disabled with the note "Both teams are ours".
- A result at summary level (no scorecard) has no player rows at all: the Teams control is disabled with "No scorecard recorded".

### First names as initials (the setting's code name remains Initials only)

Two name forms, applied by one pure function (`shareName`, below) to **every player name in every format and every generated text**, including the player of the match, performers, batting and bowling tables, dismissal text ("c M. Naidoo b S. Khumalo"), the Celebration prose and hashtags that could carry a name:

| Setting | Form | Example for Mpho Naidoo |
|---|---|---|
| Off | The full name as stored (first name(s) and surname) | `Mpho Naidoo` |
| On | First initial plus surname | `M. Naidoo` |

The "M. N." form (initials only) does not exist: a manager would never choose it, as it defeats the purpose of a result post.

Rules:

- The first initial comes from the first name(s) only; the surname is always shown in full, **particles stay in the surname** ("Sam van der Westhuizen" is `S. van der Westhuizen` with the setting on, `Sam van der Westhuizen` off). A hyphenated or double first name contributes its first letter only (`J. Smith`). A one-word guest name (no surname) shows its first letter and a full stop (`S.`) with the setting on, and as typed with it off.
- **Collisions:** two different players in the result whose shortened names are identical with the setting on (two "M. Naidoo") are **not** given an invented disambiguator (such as a numeral suffix). Both are shown as written, with a small amber note under the switch ("Two or more players show as M. Naidoo."). This is deliberate: the privacy rule outranks clarity, and outside a junior match the manager can choose to turn the option off.
- The form applies to **generated text and graphics only**. Stored data, the result page and the existing scorecard Full name | First name toggle (`usePlayerNameMode`) are unchanged and independent.
- The toggle never shows team names, club names or venue, only player names.
- **Edited text:** the editable WhatsApp and Facebook text is built with the setting applied, but once the manager types in it, names they type are theirs. A short caption under the box says "Names you type yourself are not changed." Switching the setting or the template rebuilds the text and replaces edits after a confirm ("Replace your edits?") only when the text has been edited.

### Default and junior lock

- **Default for opening a dialog:** for a non-junior match, the value is the user's remembered choice on this device if one exists, otherwise the club default (`initialsOnlyDefault`, from the endpoint above), otherwise off.
- **Club default control:** a small **"First names as initials by default"** switch in the dialog's footer area on the First names as initials row ("Make this the club default"), writing through `PUT share-settings`. Chosen here rather than in Club profile because it is used from this dialog and avoids touching the profile form; the platform admin's profile screen does not change. Every club manager may change it (Open questions 1).
- **Junior lock:** when the match is a junior match, the First names as initials switch is **on and disabled**, with the reason shown as visible helper text, not only a tooltip: "Always on for junior leagues". It cannot be turned off by any means in the UI, and the remembered choice and the club default are ignored for it (they continue to apply to non-junior matches). The club-default switch remains usable but its helper reads "Does not apply to junior leagues". The lock is client-side only (no server enforcement: nothing leaves the browser through our servers; a manager can always type a name into the editable text, which is the caption above).

**Rule: how "junior" is determined (proposed from existing data; Open question 3).** A match is junior when **any** of the following is true, evaluated by the pure function `isJuniorMatch(match, league, sectionPaths)`:

1. its **league** has a `maxAge` and `maxAge <= 18` (a league's `maxAge` is its own enforced age cap, `029`, `110`; "U19" and above are treated as adult), or
2. the match has **no league** (a friendly) or its league has **no `maxAge`**, and the **section** of either of the match's own teams, or any ancestor of that section in the club structure, has a `maxAge` set with `maxAge <= 18` (a section's age range is unenforced metadata, `094`), or
3. neither rule can say (no age data anywhere) and any ancestor section of either own team is named **Juniors** (case-insensitive exact name match on the structure's path, e.g. "Juniors > Boys > U13", `094`, `027`).

The threshold `18` is a named constant, `JUNIOR_MAX_AGE`, in one file. Rule 1 beats the others (a league with `maxAge` 40 is not junior even if a team sits under Juniors, as a Juniors team playing up in an open league is a recognised case, `076`). Rule 3 is a fallback because no section has a "kind" flag today and a name is the only marker; it is the weakest rule and is the first thing to replace if a section type is ever added. In a derby, if either own side qualifies the match is junior. The league and the section paths come from the league and section reads the Results screens already load; if they cannot be loaded, the match is treated as **junior** (fail safe: the lock is on and the reason reads "Could not check the league, so Initials only is on").

### Preview and delivery

- **Live preview** renders from the same data and the same builder the output uses, so what is shown is what is made (the Image and TV previews draw to a `<canvas>`; the PDF preview renders the first page of the generated document to an image through the same generator; text previews are the editable box). Preview redraws are debounced.
- **Primary action label is chosen by capability, not by a setting.** If `navigator.canShare({ files })` is true for the generated file, the main button reads **Share** and calls `navigator.share({ files, text })`; otherwise it reads **Download** and a **Copy text** button sits beside it (clipboard write with a select-and-copy fallback, as the mockup toast shows). A user cancelling the share sheet is not an error. Secure context is required for sharing; where it is missing the Download path is used.
- **PDF:** Share or Download, plus Print (opens the PDF in a new tab). **Image and TV:** Share or Download PNG, plus Copy image where `ClipboardItem` is supported. **WhatsApp:** Share (image plus text) or Copy text and Download image; **Facebook:** the same (Facebook cannot be posted to from a web page, so the screen says so in an info note, as the mockup does).
- File names: `<home> v <away> <yyyy-mm-dd>` with names sanitised for file systems; with First names as initials on, **file names, PDF document titles and metadata never contain a player name** (only team names), and the share sheet title the same.
- Generation failures (a logo that will not load, an oversized canvas) never block: a missing logo becomes the initial tile; a failed generation shows an inline error and keeps the dialog open.

### Send to WhatsApp (shared, used by every WhatsApp text in the product)

Added at the product owner's request (2026-10-17): the same one-tap WhatsApp delivery for **every** WhatsApp message the platform builds, not only results. Today the team announcement (`TeamSheetCommunicationDialog`, `039`/`040`), the poll message (`PollShareDialog`, `064`), the playing conditions message (`PlayingConditionsShareDialog`) and the section availability message (`SectionAvailabilityShareDialog`) only offer Copy, and the manager pastes the text into WhatsApp by hand.

- **One shared component, `components/WhatsAppSendActions`,** takes the message text (and optionally a file, for the result image) and renders the buttons. The four existing dialogs and the new Result WhatsApp screen all use it, so the behaviour is identical and lives in one place.
- **Send in WhatsApp** (the primary button): opens `https://wa.me/?text=<URL-encoded message>` in a new tab. On a phone this opens the WhatsApp app at its chat picker with the text filled in; on a desktop it opens WhatsApp Web (or the installed desktop app) with the text filled in. The manager picks the group or contact and presses send. A web page cannot choose the recipient or press send, and this spec does not pretend otherwise.
- **Share** (shown only where `navigator.share` exists, and for results where `navigator.canShare({ files })` is true): the native share sheet with the text and the image together. This is the best phone path for the Result image, because the image travels with the text. Where the browser cannot share files, Send in WhatsApp sends the text only and the screen says "Attach the downloaded image in WhatsApp", with Download image beside it.
- **Links stay clickable.** Any link a message contains (the poll response link, the availability link) is part of the message text itself, in both the `wa.me` link and the native share call, and is never passed as a separate `url` field (some apps drop it when a file is attached). WhatsApp makes it tappable and shows a preview card only if the target page provides the preview tags; that is a property of the target page, not of this spec.
- **Copy message** stays beside them in every dialog (unchanged behaviour, shared hook `useCopyToClipboard`), so nothing that works today is lost.
- **Length guard.** `wa.me` links over roughly 2,000 characters are unreliable. Above `WHATSAPP_LINK_MAX_CHARS` (a named constant, 1,800 encoded characters) the Send button is replaced by Copy message with a short explanation, never a silently truncated message.
- **Editing first.** The manager can still edit the text in the box before sending; Send in WhatsApp always sends the box's current text.
- **First names as initials** applies to the Result messages only. The team announcement, poll and conditions messages go to players of the same club and are unchanged; this is stated so nobody expects it there.
- No tracking and no WhatsApp Business API: only the public `wa.me` link and the browser's own share sheet.

### New shared pieces

- `components/WhatsAppSendActions` (above), `components/ShareResultDialog`, `components/SharePreviewStage` (the checkerboard stage with a caption), `components/ShareFormatScreen` (the control-strip plus preview layout used by all five formats).
- Pure helpers in `ui/src/utils/share/`: `shareName.ts` (name forms), `isJuniorMatch.ts`, `shareResultData.ts` (assembles one `ShareResultModel` from `ResultListItem`, `Scorecard`, our-team filter and name form, so every format reads one shape), `resultTextWhatsApp.ts` and `resultTextFacebook.ts` (text builders, mirroring `teamSheetWhatsAppText.ts`; WhatsApp bold is `*...*`), `resultPdf.ts` (jsPDF, mirroring `teamSheetPdf.ts`, A4 portrait, page breaks, footer "Generated by Cricket Legend"), `resultImage.ts` (Canvas2D, mirroring `leagueSchedulePoster.ts`; one drawing function with size and template parameters, also used for TV at 1920 x 1080), `shareChoices.ts` (localStorage, try/catch), `useShareCapability.ts`.
- Hooks: `hooks/useShareSettings.ts` (React Query over `api/shareSettingsApi.ts`).
- **No raw hex values outside `theme.ts`** for the app UI; the generator files' fixed template colours (Night `#1b1f24`, Daylight, PDF ink) are declared once at the top of each generator file as `teamSheetPdf.ts` already does, with the club colour always taken from the theme.

### Text content

Builders are pure and take the `ShareResultModel`; none uses a fixed template string with names baked in.

- **WhatsApp Short:** result line and both score lines. **With top performers:** the above plus top bat and ball for each side shown, and the player of the match. **Scorecard text:** the full compact scorecard text as in the mockup.
- **Facebook Match report:** a structured paragraph set; **Brief:** one paragraph; **Celebration:** descriptive prose built by rules from the scores, for example chasing and balls remaining, a top score with its strike rate described in words (the descriptive phrasing the previous system had, such as "a very good strike rate of 160"), bowling figures, closing thanks. It only describes what is in the data, never invents a fact, and every wording threshold (what counts as "very good") sits in one table in `resultTextFacebook.ts` for later tuning. Celebration is offered when the result is a win for our side; for a loss, tie or other outcome it falls back to a neutral wording rather than celebrating (Open questions 7).
- **Emoji** switch removes all emoji. **Hashtags:** `#<ClubName without spaces>`, `#<LeagueName without spaces>` and `#CricketLegend`; never a player name. **Mention the sponsor:** "Thanks to our sponsor, <name>" using the sponsor chosen per Open questions 6.

## Test Plan

Per `docs/standards/testing.md`. Following the user's working rule ("build first, tests after approval"), tests and the standards review run after the user has checked the function in the browser; the plan still lists them.

**Unit (Vitest), the bulk of the weight:**

- `shareName`: full name (off) and first initial plus surname (on) for plain, particle, hyphenated and double-barrelled first names, one-word guest, accents, empty first name, and the identical results for registered players and guests split by `splitName`.
- `isJuniorMatch`: every rule and their order (league `maxAge` 17 and 18 junior, 19 adult, 40 adult even under Juniors; a friendly under a Juniors section junior by section `maxAge`; Juniors name fallback only when no age data; derby where one side qualifies; unavailable data fails safe to junior).
- `shareResultData`: both teams and Our team only (opposition names and tables gone, totals kept), derby, summary-only result, player of the match from our side and from the opposition (dropped when ours only), no player of the match.
- The WhatsApp and Facebook builders: every template with every switch combination, Emoji off has no emoji code points, Hashtags never contain a name, Celebration wording per outcome and thresholds, win, loss, tie and no-result fallbacks.
- `shareChoices`: round trip, corrupt JSON, unavailable storage (`localStorage` throwing), per-club keys.
- **Logos and footer (unit and component):** the layout helper places club, league, team and sponsor logos without overlap for every template and size (fixed-slot arithmetic tested as pure functions); a missing league logo hides its switch; a logo that fails to load collapses its slot; the sponsor chooser caps at four; Footer line off removes the web address and the platform credit from the PDF, Image and TV output and from their previews; the web address line never appears when the club has no website; the choices are remembered per club.
- **WhatsApp send (unit and component):** the link builder encodes emoji, newlines, `*bold*`, `&`, `#` and accented names correctly and round-trips through `decodeURIComponent`; the length guard switches to Copy at the limit; `WhatsAppSendActions` renders Send, Copy and (with a stubbed `navigator.share` and `canShare`) Share; each of the four existing dialogs shows Send in WhatsApp with its current text and its existing copy tests still pass; a Storybook story for the component.
- **Privacy test (required):** for a fixed fixture with distinctive full given names (a name list including accented and particle names), with First names as initials on, assert that **no full given name appears** anywhere in: the WhatsApp text (all three templates), the Facebook text (all three templates, including Celebration prose), the PDF text content (extracted from the generated jsPDF document through its text-capture mock, all three templates, both team scopes), every `fillText` call recorded by a mocked Canvas2D for the Image (three templates, three sizes) and the TV summary, the file names, the PDF metadata title and the share title. The same fixture asserts the shortened form ("M. Naidoo") appears with the setting on and the full name ("Mpho Naidoo") with it off, so the test cannot pass vacuously. Names are matched case-insensitively and accent-folded, as `108`'s privacy test is.
- **Locked-state test:** `ShareResultDialog` for a junior-league match renders the First names as initials switch checked and `disabled` with the visible text "Always on for junior leagues"; clicking it changes nothing; the output (privacy fixture above) has no full given name even when the remembered choice is off and the club default is off; for a non-junior match the same switch is enabled and honours the remembered choice, then the club default.

**Component (Testing Library):** `ShareResultDialog`: tiles open each format and Back returns, Share disabled on a draft with the visible reason (result page and Results card); Share label versus Download label by `navigator.canShare` mocked both ways; Copy text writes the (possibly edited) text; editing text then switching template asks before replacing; localStorage restore of the last choices; the collision note; Teams control disabled for a derby and for a summary-only result. Storybook stories (`ShareResultDialog`, `SharePreviewStage`, `ShareFormatScreen`) at 375, 768 and 1280, including the locked and the draft states.

**Integration (Testcontainers) and contract:** the migration applies (default false for existing clubs); `share-settings` read and write round trip; a manager of another club cannot read or write (tenancy); a profile `PUT` does not reset the value. OpenAPI diff, additions only. A backend unit test for the service where the setting is defaulted for a club with no profile row (the profile row is created on first write, as `012` does for the other fields).

**End-to-end (Playwright, mobile and desktop viewport), one golden path:** manager opens Results, finds a published result with a scorecard, Share, picks Image, switches template and size, sees the preview change, Downloads the PNG (download event, correct 1080 x 1080 dimensions); opens WhatsApp, switches First names as initials on, copies the text, asserts the clipboard has first initials and no full first names; then opens a draft result and sees Share disabled with the reason. A second short test: a junior-league result opens with First names as initials locked on.

## Acceptance Criteria

- A **Share** button on the result page and a Share footer button on the Results card appear for a published result and are absent on a draft.
- **Send in WhatsApp** appears in the Result WhatsApp screen, the team announcement dialog, the poll dialog, the playing conditions dialog and the section availability dialog. It opens `https://wa.me/?text=` with the current (edited) message in a new tab; Copy message still works in each; a message too long for a link shows Copy only, with the reason. Where the browser supports it, Share (native) is also offered.
- Share opens one dialog (full screen at 375 px) with five tiles; each opens its format screen with a control strip, a live preview and actions; Back returns to the tiles.
- PDF offers Club colours, Classic and Compact; Image offers Club green, Night, Daylight and Square 1080, Portrait 4:5, Story 9:16; TV offers Broadcast, Club colour, Light and is always 1920 x 1080; WhatsApp offers Short, With top performers, Scorecard text; Facebook offers Match report, Celebration, Brief. Include switches are as in the table above.
- Changing a template, size, switch or the Teams choice updates the preview without a page reload, and the produced file equals the preview.
- **Our team only** keeps both scores and the result line and removes the opposition's batting, bowling, extras, performers and names; in a derby and for a summary-only result it is disabled with a stated reason.
- The main button reads **Share** where the browser can share files and **Download** (with **Copy text**) where it cannot; cancelling a share is silent.
- WhatsApp and Facebook texts are built from the result data, can be edited before sending, and a switch or template change that would lose edits asks first.
- Facebook screen states that the platform cannot post for the manager and offers Copy text and Download image.
- Templates use the theme's primary colour (the platform green `#2f6e4f` when the club has none); text stays readable on a light colour.
- **First names as initials** (code name Initials only) renders every player name as first initial plus surname ("M. Naidoo") with it on and as the full name ("Mpho Naidoo") with it off, across all five formats, the generated text, file names and document titles; a test proves that no full first name appears with it on.
- For a junior match (rule above) the switch is on, disabled and carries the visible reason "Always on for junior leagues", whatever the remembered choice or club default; for any other match the choice is the remembered one, then the club default, then off.
- A manager can set the club default; it is stored per club, any club manager can change it, another club's manager cannot, and a profile save does not reset it.
- Last choices (format, templates, switches, teams, size, own Initials only choice) return per club on the same browser; unavailable or corrupt storage falls back to defaults with no error.
- A missing or unreadable logo never blocks generation.
- No new dependency; the only backend change is the share-settings column and endpoint; OpenAPI changes are additive.
- The dialog works at 375 px with no horizontal scrolling, every control is reachable by keyboard, and every control has a label.

## Mobile-first and accessibility notes

- Authored at 375 px first: the dialog is full screen; controls stack above the preview; chips wrap; the preview scales to the width of the screen with a caption and never forces a horizontal page scroll (the preview stage scrolls inside itself only for the A4 page if needed); touch targets 44 px; actions in a sticky bottom bar on a phone so Share is always reachable.
- Safe-area insets respected on the full-screen dialog (the mockup's `viewport-fit=cover` handling).
- Keyboard: tiles are a radio group with arrow keys (`TileChoiceGroup`); chips are toggle buttons with `aria-pressed`; switches are real switches with labels; Escape closes; focus returns to the Share button.
- Disabled controls always carry visible text for the reason (draft, derby, summary-only, junior lock), not only a tooltip, and use `aria-describedby`.
- Previews: the canvas has an `aria-label` describing the result ("Result card: Riverside 1st XI won by 5 wickets"); the editable text boxes are labelled text areas ("Message text", "Post text"). Generated images and PDFs carry the text in readable form (PDF text is real text, not a picture), and the Daylight and Light templates meet contrast against their text; checked once at the token stage, in a unit test of the template palette against the WCAG 4.5:1 ratio for each template and for a light club colour.
- Status is never colour alone (the lock reads in words; the collision note reads in words).
- Reduced motion: no animation in the dialog beyond MUI's defaults.

## Rollout Notes

- **Order of work:** pure helpers and their tests (`shareName`, `isJuniorMatch`, `shareResultData`, text builders, choices) first; then the share-settings column and endpoint; then the dialog and format screens one by one (Image and WhatsApp first as the most used, then PDF, Facebook, TV); then the two entry points; then docs, review and the PR. Image and TV share one drawing function, so TV comes cheaply after Image.
- **No feature flag:** Share appears only on published results and is harmless otherwise.
- **Docs to update when built:** `docs/roadmap.md` (this spec's row and its deferred items), `docs/architecture.md` (none expected beyond the club-profile settings column), `docs/standards/frontend.md` (a "Share result" paragraph: share names go through `shareName` only, never format a player name by hand in a generator; juniors are decided by `isJuniorMatch` only), `docs/standards/design-system.md` (the new shared components).
- **Known gaps left visible, not hidden:** club primary colour is not persisted anywhere yet, so every club's templates are the platform green until branding persistence is built (`044`, `001`); no fall of wickets; no public link.
- **Deferred (also in `docs/roadmap.md`):** a public result link and public result page (then add the "Link to the match page" switch); fall of wickets capture and an FoW line; a per-team or per-section Initials only default; a section "kind" or junior flag to replace the name fallback; a "main sponsor" marker; scheduled posting; direct posting to platforms; AI written match reports; stored share history; statistics lines once `103` lands.

## Open questions

1. **Where the club default lives.** Proposed: one column on `club_profile` with its own `share-settings` endpoint, because there is no club settings table and the profile `PUT` is a full replace that would reset it. Alternatives: a new small `club_settings` table (better if more club-wide switches are coming), or `localStorage` only (no club-wide default, rejected because the requirement is a club-level default). Needs the product owner's choice before the migration is written.
2. **Per-team or per-section default.** Not built. A club may want Initials only on for a specific section without it being a junior league (for example a mixed youth team in an open league). Could be a section-level flag later.
3. **The junior rule.** Proposed above (league `maxAge` at or below 18, else section `maxAge` at or below 18, else a section named "Juniors"). Questions: is 18 the right line (some clubs treat under 19 as juniors); should the lock also cover **opposition** children in a junior match (yes, by the match rule, and the lock covers every name); and should a manager with club-admin rights be able to override the lock (proposed: no).
4. **"Link to the match page".** The mockups list a link switch; no public page exists, so it is omitted. Confirm that dropping it from revision one is acceptable.
5. **Club logo for section-scoped managers.** The club profile read is club-admin only. Either the share uses the logo already on each team (and the club logo only when readable), or a minimal read of the club logo and name is exposed to any club manager. Proposed: the second, a read-only field on an existing manager endpoint.
6. **Which sponsors to show.** Resolved by the product owner's request: the manager ticks up to four sponsors in the control strip; nothing else is decided by data. Open: the maximum of four, and whether the club wants a fixed order.
7. **Celebration for a non-win.** Proposed: neutral wording (no "What a win"), never celebratory for a loss. Confirm, and whether the club wants a "commiserations" tone later.
8. **Name collisions under First names as initials.** Two players with the same shortened name (two "M. Naidoo") show as written with a note. Confirm that a clear note is preferred over inventing a disambiguator.
9. **Child safety of images and logos.** Team and club logos are shown; photos of players are never used. Confirm no player photo is ever wanted on a card.
