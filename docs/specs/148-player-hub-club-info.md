# 148: Player Hub Club Info (the club's details, contact directory, links and logos for parents and players)

**Depends on:** `001-tenancy-identity-model.md` (`Club`, club isolation), `012-club-profile.md` (`ClubProfile`: type, address, email, phone, website, `logo_url`, `banner_url`; `MediaUpload`, files served from `/media/**`), `021-club-contacts.md` (`ClubContact`: name, role, email, phone, photo, primary, active; the manager endpoints and `ClubContactList`/`ClubContactForm` this spec extends), `022-club-social-media.md` (`SocialLink`, `club_profile_social_link`), `027-team-profile.md` and `035-section-scoped-access.md` (`TeamContact` and `SectionContact` only LINK a `ClubContact` to a team or section; they hold no person data of their own), `114-share-result.md` and `122-league-sharing.md` (the club-wide settings that live on `club_profile`, are written only by their own settings service and are honoured by the Hub: the mechanism this spec reuses), `099-fields-directory.md` and `121-player-hub-menu-and-fields.md` (the Hub menu, `hubNav.ts`, the "Club, Club info" Soon row, Decision 13 "no club switch storage is built here; the first Soon item that needs a switch specifies where it lives and its data model in its own spec", Decision 16, the Field Directory that stays beside it), `119-login-account-journey.md` (`MyPlayerAccess`, held players, Decisions 6 and 15), `123-player-hub-leagues.md` and `135-player-hub-match-view.md` (the pill row, the facts card, framed icon buttons, the 2026-11-12 amendments), `147-player-hub-stats.md` (the "no export" rule, the deferred legal item on showing children, the rule that full names stay inside the Hub), `docs/standards/page-anatomy.md` section 9a (Player Hub decisions of 2026-11-12), `docs/standards/backend.md`, `docs/standards/frontend.md`, `docs/standards/design-system.md`, `docs/standards/testing.md`.
**Status:** draft (written 2026-11-13 from the owner's requirements of 2026-11-12; nothing is built, no plan exists yet).

## Problem & Goals

The Player Hub menu has a **Club info** item (`club.info`, Club group) that is a locked "Soon" panel reading "Contacts, the club's places and links." (`ui/src/pages/view/myPlayers/hubNav.ts`). Parents and players cannot find who to call at their club, the club's website, social pages or logo, although the club has already entered all of it for the manager screens (`ClubProfile`, `ClubContact`, social links). Nothing in the Hub reads this data today, and no safe rule exists for what a linked account may see of it: the data holds **adults' names, phone numbers and emails**, and the Hub's viewers are parents of children, agents and adult players.

This spec makes Club info a real Hub page, with a **club-controlled privacy model that is off by default for anything personal**.

**Goals**
- Club info opens on a pill row (**About**, **Contacts**, **Links**) in the Hub console look, with the club's logo and banner shown on **About** itself (owner, 2026-11-12: logos are part of the screen, not a pill of their own), built from the pieces the league page and Matches already use (pill row with `?tab=`, label/value facts card with cream values, framed icon buttons, friendly empty states).
- A **contact directory like a phone book** for phone and email: alphabetical, searchable, grouped by letter or by role, with tap-to-call, tap-to-email and copy.
- **Contact and social links** and the **club logos** are available, with a defined meaning of "available" (view; download only if the club allows it).
- A **club switch per block**, set by the club administrator, stored with the existing club-wide settings. The directory lists **all of the club's active contacts** (owner, 2026-11-12: per-person opt-in is not built now; roles and permissions come later), so the club-level directory, phone and email switches, all off by default, are the deliberate act that publishes them.
- Read-only, never exported, no children's data, bounded against scraping, and the same 404/403 behaviour as every other `/api/v1/me/players/{playerKey}/...` read.

## Non-goals

- **No players, parents, agents or children in this page, ever.** The directory lists club contacts only (adults entered through `021`). There is no player or parent directory and no player-to-player phone numbers or emails; adult players cannot see each other's numbers (that is a different feature with its own consent question, not an omission).
- **No export of the directory**: no share, print, CSV, vCard, "add all to phone" or copy-all. Single-value copy and the platform's own tap-to-call and tap-to-email are the only ways a value leaves the page (Decision 14). Logos are the one downloadable thing (Decision 8).
- **No messaging, bookings, gallery, social feed or notices.** Messages, Gallery and Social Media stay Soon items under **Updates**, Bookings and Other Services stay Soon items under **Club** (see Decision 3 for where the menu really stands today). Club info reads the profile; it does not create content.
- **No new club data fields.** `ClubProfile` has no description, founding year, ground or colours, so the About tab shows only what exists (type, address, phone, email). Adding those fields is a manager-side spec of its own; the facts card simply grows when they exist.
- **No new logo formats or vector logos.** `012` stores one uploaded PNG, JPEG or WebP per `logo_url` and `banner_url`. Conversion, a brand-asset library, a brand-guidelines PDF and several variants per club are later (Decision 8).
- **No contact photos in the directory** (Decision 12). The avatar is the initials tile.
- **No automatic inclusion of team managers or coaches** from `TeamContact`/`SectionContact`. They appear only if the club has them as a `ClubContact` and has opted that contact in (Open question 1).
- **No per-viewer or per-section filtering of the directory** ("only contacts of my child's team"). Every eligible viewer of the club sees the same contacts. Section-aware directories are later.
- **No hiding of the Club info menu item by a switch** and no `clubSwitches` field on `MyPlayerDto` (Decision 4). The item is always there and shows a friendly empty state when the club shares nothing.
- **No legal sign-off in this spec.** It builds the controls; the owner confirms the legal basis for showing adults' contact details to members (Open question 8). The legal question about showing **children** (`147`) does not apply, because no child's data is in this feature.
- **No audit table and no new rate-limit infrastructure** (Decision 15, Open questions 6 and 7).
- **No change to the manager Club Contacts list rules** (`021`: primary auto-unset, deactivate, no hard delete) beyond the three new flags.

## Owner decisions (2026-11-12)

The owner asked for Club info "in a familiar way based on the other screens" and decided:

1. **Look.** The Player Hub console look; the pill row as on Matches, Availability and the league page (Title Case labels, counts where known, `?tab=` in the URL); a League-facts-style card (label and value pairs, cream values, gold only for the selected pill and the primary action); framed icon buttons for links (36 px from `sm`, 44 px on a phone, as on the league page header); friendly empty states (icon, title, friendly line, never "None yet"); no "you" or "your" in Hub copy; the shared compact `Button` only; mobile-first at 390 px.
2. **Content.** Contact and social media links and the club's logos must be available. A contact directory like a phone book for both phone and email, with tap-to-call and tap-to-email.
3. **Privacy is the heart of it.** A club switch per block, controlled by the manager in the club settings; personal items off by default; a contact opts in individually, the manager can override; children's data never exposed; read-only; never exported; scraping and audit considered; suspended and unlinked accounts treated like every other `me/players` endpoint.
- **Logos are part of the screen (owner, 2026-11-12, after the first mockup):** the club logo and banner are shown on About itself, not behind a Logos pill. The pills are About, Contacts, Links.
- **Club contacts only (owner, 2026-11-12):** the directory and its search contain the club's own contacts (`ClubContact`) and nothing else. **No player, and no player's manager (parent or agent), has their contact information searchable or shown from the Player Hub**, whatever the viewer: the search runs over club contacts only, never over `person`, `player_profile` or `person_link`. This closes open question 3 (adult players seeing each other's numbers: no).
- **Existing clubs start visible (owner, 2026-11-12):** the organisation facts a club has already entered (name, address, club phone and email, website, socials, logos) show to linked accounts from release, switchable off per block. The release notes tell administrators this on the day (Rollout Notes).
- **Team managers and coaches appear (owner, 2026-11-12):** they are club contacts and show in the directory with their role (superseded in detail by the next line: all active club contacts appear).
- **All club contacts for now, roles and permissions later (owner, 2026-11-12):** the directory shows every active club contact (including team managers and coaches), never a player or a player's manager. The per-contact opt-in of the first draft is dropped; the club-level switches (all off until the administrator turns them on) are the control until roles and permissions are built.

## Decisions

1. **One page, three pills, three read calls.** Route `/account/players/:key/club/info`, pills **About**, **Contacts**, **Links** (`?tab=about|contacts|links`; an unknown value means the first visible pill). A pill is **hidden** when its block is switched off or has no data; a club with nothing to show gets ONE friendly empty state and no pill row (Decision 11).
2. **Who the viewer is.** Authorisation is `MyPlayerAccess.resolve` first (Decision 5). Viewer types come from the resolved `HeldPlayer` only, never from a role or a request value: **parent or agent** (a linked account, `link != null`, main or not), **adult player** (`self()` with a date of birth of 18 or more, or none: the existing `canEditMedical` rule `119` Decision 20 uses), and **a junior's own login** (`self()` under 18). A new `HeldPlayer.canSeeClubDirectory()` (adult player or any linked account) is the one place the rule lives. The three viewers who can see the directory see exactly the same data: the block table below differs only for the junior's own login.
3. **Menu change.** `club.info` loses `soon: true` in `hubNav.ts` (and `soonCopy`). **Correction to the brief:** the Club group today is Club info, Bookings, Field Directory, Other Services; Messages, Gallery and Social Media were moved to **Updates** by `121`'s 2026-11-12 amendment. Club info and Field Directory are live; Bookings and Other Services stay Soon. Consequence: `defaultChild` (first child that is a page and not Soon) now opens **Club** on **Club info** instead of Field Directory (`121` Decision 16, the hubNav comment "The one live item (so Club opens on it)" and the tests that assume it are updated in the same change; Open question 9 asks whether the owner wants Field Directory to stay the landing page).
4. **No `clubSwitches` slot and no hidden menu item.** Club info is always in the menu. What is on or off is returned by the page's own read, so `MyPlayerDto` and `HubNavContext.clubSwitches` stay as they are (`121` Decision 13's empty slot stays reserved for an item that must disappear). A club that shares nothing sees the friendly empty state, not a missing item.
5. **Authorisation and failure modes are those of every `me/players` read.** `MePlayerClubInfoController` (`/api/v1/me/players/{playerKey}/club-info`) calls the service, whose first statement is `MyPlayerAccess.resolve(authentication, playerKey)`; the club comes from the held player's profile, never from the request. A key the caller does not hold, a malformed key and a player who dropped out (suspended or rejected player, revoked link) are **404** `Player not found`; a SUSPENDED caller is **403**; unauthenticated is 401. A junior's own login asking for the directory is **404** (`Contacts are not shared`), as a missing resource, so nothing is confirmed. A linked account cannot reach any `/manage` route (`LinkedAccountCannotReachManagerSurfaceIntegrationTest` extended).
6. **Switch storage reuses the club-wide settings mechanism.** Settings are columns on `club_profile` (as `share_initials_only`, `share_disabled_formats`, `leaderboard_award_categories`), read and written **only** by a dedicated `ClubHubSettingsController`/`ClubHubSettingsService` (`GET` and `PUT /api/v1/manage/clubs/{clubId}/hub-settings`, `ClubHubSettingsDto`), exactly the endpoint, DTO name and manager card that `147` designed for its leaderboard switch and then cancelled (its amendment forbids only that switch and its migration; the shape is free and is built here). The club profile `PUT` never resets them; a club with no profile row reads as the defaults; only a club administrator may read or change them (`@access.canAdministerClub`). No second mechanism is invented. The DTO starts with the Club info switches; a later Hub switch (the deferred leaderboard or ranking rule of `147`) is an additive field.
7. **Defaults (justified).**
   - **Organisation facts on** (About facts: type and address; club phone, email and website; social links; the logo shown): the club typed them to be seen, they describe the organisation and not a person, and they are shown only to verified held players behind sign-in. A block shows only when the club has actually set a value, so "on" with nothing set is invisible. A manager who entered a personal mobile as the club phone can switch the contact block off; the manager card says so.
   - **Logo download off:** viewing is harmless, handing out files is the club's call.
   - **The contact directory, and its phone and email parts, off:** every row is a named adult's number, so the club must choose to publish it; a new club shows nothing personal until an administrator acts twice (club switch, then each person).
   - **No per-contact flags (owner, 2026-11-12):** the first draft had a per-contact opt-in (`hub_listed`, `hub_share_phone`, `hub_share_email`, `hub_consent_at`). It is **dropped for now**: when the club switches the directory on, every active `ClubContact` appears. A later roles-and-permissions spec decides who is listed and who may see what; this spec adds no column to `club_contact`.
   - **Existing clubs:** the organisation-fact switches start on, so after release a club's already-entered website, socials, address and club phone or email become visible to its linked accounts without the administrator touching anything. This is the one deliberate behaviour change; the release notes and the manager card state it (Open question 5). Confirmed by the owner on 2026-11-12.
8. **What "available" means for contacts and logos.**
   - **Contact and social media:** viewable text and links. Website and social links are `https` only (anything else is dropped by the server); phone is `tel:`, email is `mailto:`; the address has an "Open in maps" link built in the browser from the address text (a plain `https://www.google.com/maps/search/?api=1&query=` URL; only the address leaves the browser; the club has no coordinates).
   - **Logos (owner, 2026-11-12: shown on the About screen itself, no pill):** the club logo and the banner (the two stored files) are displayed on About: the banner as a wide band across the top of the page, the logo large beside the club name. **Download** is a small framed icon button on the image, offered per file only when the club switched "Allow Logo Download" on. The file is the one stored, in the format it was uploaded (PNG, JPEG or WebP); there is no conversion or resizing. The download is a link to the stored `/media/**` file with a suggested name (`<club-slug>-logo.<ext>`, `<club-slug>-banner.<ext>`). **Known limit:** `/media/**` is world-readable by URL (`012`, `SecurityConfig` `permitAll`), and the club logo is already on public pages; so the download switch controls what the Hub offers and shows, not the secrecy of the file. Moving media behind authorisation is a separate platform decision, not made here. The one file that may be downloaded is a logo; nothing personal is.
9. **Contacts that appear (the directory rule).** **All the club's contacts (owner, 2026-11-12).** A contact appears when the directory switch is on and the contact is `active`; nothing else gates it. Team managers and coaches are club contacts and appear too. A value is shown only when the club's switch for that column is on (`phone` when the club's phone switch is on; `email` when the club's email switch is on) and the contact has one on file; a missing value reads **"Not shared"** (muted, no button) while the column is drawn, and the column is not drawn at all when the club switched it off (`phoneShown`/`emailShown`). Contacts are the adults the club entered through `021` (committee, office bearers, ground and team contacts that exist as `ClubContact`); the endpoint never joins to `person`, `player_profile` or `person_link`, so a player, parent, agent or child can never be returned or searched. The manager card says "Adults only".
10. **No per-contact consent in this spec (owner, 2026-11-12).** The club administrator's decision to switch the directory (and its phone and email) on is the club's deliberate publication of its own contacts; contacts are already club-held records entered for the club's purposes. The per-person agreement flag, its date and the "In Player Hub" chip are not built. **Roles and permissions will be built later** and will decide who is listed and who may see what; the switches here are the interim control. The club administrator can switch the directory, the phone column or the email column off at any time, which removes them at once, and deactivating a contact removes it.
11. **Pill visibility and the empty state.** Computed on the server and returned (Decision 17): **About** when the identity block or the contact block is on and at least one of type, address, club phone, club email, logo or banner exists (the logos block counts toward About, since the images live there); **Contacts** when the directory is on and at least one contact qualifies (Decision 9); **Links** when the links block is on and a website or social link exists; The logos have **no pill**: with the logos block off or no file stored, About simply has no image band and the initials tile stands in for the logo. The club name is always shown (it is already on `MyPlayerDto.clubName`) and is not a block. With no pill: one empty state (icon, title "Nothing to Show Yet", line "The club has not shared its details here yet. Check back soon." The line never says "None yet" or "you").
12. **No photos, no teams, no extra person data.** A directory row is name, role, optional phone, optional email, a "Main contact" tag for the club's primary contact. No photo, no team or section line, no date, no address of a person.
13. **Search and A to Z.** `query` matches the contact's first name, last name or role, case-insensitive, 60 characters at most. Order is last name then first name. Two views through a compact toggle (`CompactToggleGroup`, dark tone) **A To Z | By Role**: A To Z groups under letter headings with a letter jump strip; By Role groups under the role text (A to Z within a role). The server sorts and pages; the letter jump is a `letter` parameter, never a client slice.
14. **Read-only and never exported.** There is no write endpoint. The directory page offers no Share, Print, Download, CSV, vCard, "Copy All" or "Add To Contacts". The only actions on a value are **Call** (`tel:`), **Email** (`mailto:`) and **Copy** of that one value. A guard test (modelled on `hubStatsNoExport.test.ts`) pins it for the directory files; the single allow-listed exception in the whole feature is the logo download link (Decision 8). A print stylesheet hides the directory (`@media print`) as a deterrent; the page cannot stop a screenshot, and the copy says nothing that suggests it can. Responses carry `Cache-Control: private, no-store`.
15. **Scraping, rate and audit (bounded by design, no new infrastructure).** The set is the club's active contacts (a club's committee and team contacts, tens not thousands), so a full walk returns what the club switched on. `size` defaults to 25 and is at most 50 (a size above 50 or below 1, a negative `page`, a `query` over 60 characters or a `letter` that is not `A` to `Z` or `#` is a 400, never clamped); there is no bulk or "all" endpoint; every call is authorised per held player. Every directory read writes ONE `INFO` line with club id, person id and the counts returned and never a name, number or email (`backend.md`: names are never logged); that log is the audit of who read what, and no audit table is built. A per-account hourly limit is not built (Open question 6).
16. **Club-level switches (the "block x viewer x default" table).** Each club switch is a boolean on `club_profile`; "set?" means the data exists. A cell says what the viewer gets.

   | Block (club switch, default) | Parent or agent of a junior | Adult player (self) | Agent of an adult | A junior's own login |
   |---|---|---|---|---|
   | **Identity** (`hub_info_identity`, **on**): type, address, map link | shown if set | shown if set | shown if set | shown if set |
   | **Contact** (`hub_info_contact`, **on**): club phone, club email | shown if set | shown if set | shown if set | shown if set |
   | **Links** (`hub_info_links`, **on**): website, social links | shown if set | shown if set | shown if set | shown if set |
   | **Logos** (`hub_info_logos`, **on**): logo and banner viewing | shown if set | shown if set | shown if set | shown if set |
   | **Logo download** (`hub_info_logo_download`, **off**) | if on | if on | if on | if on |
   | **Directory** (`hub_info_directory`, **off**): all active contacts, names and roles | if on | if on | if on | never (404) |
   | **Directory phone** (`hub_info_directory_phone`, **off**) | if on and the contact has a phone | same | same | never |
   | **Directory email** (`hub_info_directory_email`, **off**) | if on and the contact has an email | same | same | never |

   Directory phone and email can only be on while the directory is on (the service rejects the save with a `ValidationException`, and a read treats them as off whenever the directory is off). Organisation blocks are visible to a junior's own login because they hold no personal data; the junior's own login is refused the directory only. The unfinished item the owner may want later: a separate switch for the viewer types themselves is not built (Open question 2).

## User Stories

- As a parent, I can open Club Info from the Club menu and see the club's address, phone, email, website and social links, so that I know where and how to reach the club.
- As a parent, I can search the club's contact directory by name or role and tap a number to call or an address to email, so that I reach the right office bearer without asking around.
- As a parent, I can copy one phone number or email address, so that I can paste it into a message.
- As an adult player, I can use the same page for my own club, and I do not see other players' numbers, only the club contacts the club chose to publish.
- As an agent linked to a player, I see the same Club Info as the parent, for the player's club.
- As a parent, when the club has shared nothing, I see a friendly message and not an error, a broken tab or an empty list.
- As a parent, I can download the club logo when the club allows it, so that I can use it for a team banner or a fundraising poster.
- As a club administrator, I can switch each Club Info block on or off for the Hub, so that I control what members see.
- As a club administrator, I can switch the Player Hub contact directory, its phone numbers and its email addresses on or off for the whole club at any time, so that the club decides when its contacts' details are shown to parents and players (all off until I turn them on).
- As a club administrator, I can see which contacts are in the Player Hub, so that I can check before a season starts.
- As a club administrator of club A, I never expose or see club B's contacts; and as a parent at club A, I never see club B's details when I switch to a player at club B (I see club B's, and only club B's).
- As a player whose link was revoked or whose account is suspended, I get the same refusal as on every other Hub page, so that nothing about the club leaks.

## Data Model Changes

**One migration, the next free number: `063-hub-club-info.sql`** (the files end at `062-result-visible-to-players-backfill.sql`; `063` was reserved by `147` for a leaderboard switch that its amendment cancelled and was never created, so it is free). **Applied migrations are never edited** (`backend.md`): if `063` has been applied anywhere by the time this is built, the next free number is used and any change is a NEW migration.

```sql
-- backend/src/main/resources/db/changelog/v1/063-hub-club-info.sql
-- docs/specs/148-player-hub-club-info.md: what a club shows its linked accounts on Player Hub Club Info.
ALTER TABLE club_profile ADD COLUMN hub_info_identity           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_contact            BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_links              BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_logos              BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_logo_download      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory_phone    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory_email    BOOLEAN NOT NULL DEFAULT false;

-- The directory query: a club's active contacts in name order (no per-contact columns: owner, 2026-11-12).
CREATE INDEX ix_club_contact_hub ON club_contact(club_id, last_name, first_name) WHERE active;
```

- `ClubProfile` (`012`) gains the eight booleans (`@Builder.Default`, primitives, same pattern as `shareInitialsOnly`). `ClubContact` (`021`) is **unchanged** (no new column, DTO field or form control). Existing entities are not redefined.
- `ClubContactDto` and the contact requests (`021`) are unchanged: the Hub directory reads the existing contact fields through its own read model.
- No new table, no new index on `club_profile`, no change to `Person`, `PlayerProfile` or `PersonLink`.
- `docs/architecture.md`'s Club/Contact diagram is updated with the hub columns (living doc).

## API Contract

All reads are `GET`, authenticated, authorised only by `MyPlayerAccess` inside the service (no role, no `@PreAuthorize`), `@Transactional(readOnly = true)`, controller to service interface to `Impl`. As the other Hub read models (`backend.md` exception of 2026-11-12) the response records are built by hand in one private method; they are `record`s with the exact keys below, and no entity crosses the controller. The switches are applied inside the service, so a switched-off block is `null` in the payload (the data is not sent and then hidden by the client).

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/club-info` | held player (`MyPlayerAccess.resolve`); 404 not held / dropped out, 403 suspended caller | The whole page minus the directory rows: `MyClubInfoDto` |
| `GET /api/v1/me/players/{playerKey}/club-info/contacts?query=&sort=&letter=&page=&size=` | held player who `canSeeClubDirectory()`; 404 for a junior's own login, for a directory that is off, and for everything the first row says; 400 on a bad parameter | One page of the listed contacts: `MyClubContactPageDto` |
| `GET /api/v1/manage/clubs/{clubId}/hub-settings` | `@access.canAdministerClub` | `ClubHubSettingsDto` (a club with no profile row reads as the defaults) |
| `PUT /api/v1/manage/clubs/{clubId}/hub-settings` | `@access.canAdministerClub` | Replace the switches; 400 (`ValidationException`) if directory phone or email is on while the directory is off |
| `PUT /api/v1/manage/clubs/{clubId}/contacts/{contactId}` (`021`, additive fields) | `@access.canAdministerClub` | Carries the three hub flags (Data Model Changes) |

**`MyClubInfoDto`** (exact keys; `null` where a block is off or has no data):

```
{
  "clubName": "Riverside CC",
  "tabs": [ { "id": "about", "count": null }, { "id": "contacts", "count": 7 }, { "id": "links", "count": 3 } ],
  "about": { "type": "CLUB", "address": { "number": "12", "street": "Main Road", "city": "Pretoria", "provinceState": "Gauteng", "country": "South Africa", "postalCode": "0181" },
             "phone": "012 555 0100", "email": "info@riverside.example" },
  "links": { "website": "https://riverside.example", "social": [ { "platform": "facebook", "url": "https://facebook.com/riverside" } ] },
  "logos": { "logoUrl": "/media/abc.png", "bannerUrl": "/media/def.jpg", "downloadable": false },
  "directory": { "total": 7, "phoneShown": true, "emailShown": true }
}
```

`tabs` is the ordered list of visible pills with the counts that are known (contacts: the listed total; links: website plus socials; about: `null`; there is no logos pill). `about.type` is the `ClubProfileType` name; `about.address` and its parts are `null` when not set; `phone`/`email` follow the contact switch. `directory` is `null` unless the directory is on AND the caller `canSeeClubDirectory()`; `phoneShown`/`emailShown` say which parts the club allows (so the UI draws no empty column). No internal id appears in this response; no `clubId`.

**`MyClubContactPageDto`** (exact keys): `{ "items": [ { "id": "<uuid>", "firstName": "Ann", "lastName": "Botha", "role": "Treasurer", "primary": false, "phone": "082 555 0100", "email": "ann@riverside.example" } ], "letters": ["A","B","T"], "page": 0, "size": 25, "total": 7, "hasMore": false }`.
- `phone` is present only when the club's phone switch is on AND the contact has a phone on file, else `null`; `email` likewise. The server never sends a number or address the club has not switched on.
- `id` is the contact id used only as a list key; no endpoint takes it (there is no contact detail read), so it is not an enumeration handle.
- `letters` is the distinct first letters of last names (`#` for other) of the **filtered** set, ascending, for the jump strip. `sort` is `name` (default: last name, first name) or `role` (role, then last name, first name). `letter` narrows to one letter. All parameters are server-side; the client never slices.

**`ClubHubSettingsDto`**: `{ "identityShown": true, "contactShown": true, "linksShown": true, "logosShown": true, "logoDownloadAllowed": false, "directoryShown": false, "directoryPhoneShown": false, "directoryEmailShown": false }`.

**Query counts (pinned by a test, no N+1).** `club-info`: the `MyPlayerAccess` statements, then the club and its profile (1 to 2) and the social links (1, lazy collection inside the read transaction) and ONE count of listed contacts: a fixed number independent of how many contacts or links exist. `contacts`: the access statements, one count, one page query, one `letters` query. The exact numbers are measured at build and fixed in the test.

**OpenAPI.** The checked-in `openapi.yaml` gains the four new paths and the schemas `MyClubInfoDto`, `MyClubContactPageDto`, `MyClubContactDto`, `MyClubTabDto`, `MyClubAddressDto`, `MyClubLinksDto`, `MyClubLogosDto`, `MyClubDirectoryDto`, `ClubHubSettingsDto`, and the three flags on the contact schemas (regenerated by hand, no `mvn` under the live backend). The contract diff passes with additive changes only.

**Exceptions.** No new type: `NotFoundException` (404), `ValidationException` (400), Spring `AccessDeniedException` (403, suspended). Messages never contain a name, number or email.

## UI Requirements

All of it is Player Hub (dark console, `HUB` tokens, `hubStyle.ts`) under `pages/view/myPlayers/`, following `design-system.md` "Player Hub match view / results / stats" and `page-anatomy.md` section 9a. Page-level pieces need no four-file anatomy; anything promoted to `components/` gets its test and story.

**Page (`HubClubInfo`, route `/account/players/:key/club/info`, wired in `MyPlayerPage`):**
- `HubPageHeader` title **Club Info**, context line the club name (from `clubName`). The header's right side holds no controls on this page (there is no primary action; Gold means one thing, so nothing is gold here except the selected pill and a headline).
- Under it the shared **pill row** (`HubPillStrip` style: Title Case labels, a count where the number is known, selected pill gold, `?tab=` in the URL, `role=tablist` arrow keys as the league tab bar). Only the pills in `tabs`. Wide screens draw the same row (as Matches and Availability do).
- **Footer Back:** the footer owns it (`hubBack` in `hubNav.ts`, unchanged: a phone goes "Back to menu"; wide layouts "Back to menu" while a sub menu is open). The page draws no Back. Escape runs the footer action as everywhere. A unit case for `club/info` is added to the `hubBack` tests.
- Loading is a skeleton in the pill row and card; an error is the Hub's standard friendly error with a compact Try Again; a 404 for the page (player dropped out) is the Hub's existing "not found" screen.

**About.** A header band with the club logo (`LogoAvatar`/`LeagueLogo`, initials tile when no logo or the logos block is off) and the club name in the display face, then the **facts card** in the league Details look: label and value pairs (Type, Address, Phone, Email), values cream, no gold. Address is lines (street; city, province postal code; country) with an **Open In Maps** framed icon button; Phone and Email values are `tel:`/`mailto:` links with the framed Call and Email icon buttons (36 px, 44 px on a phone). A fact with no value is omitted, not a dash. The existing `Fact` and `FactTile` (in `HubLeagueTabs.tsx`) are extracted into a shared `HubFacts` file used by both pages, with no visual change to the league page (reuse before writing).

**Contacts (the phone book).**
- Controls row: a search field (dark field look, label "Search Contacts", clear button, 300 ms debounce into the `query` parameter, never persisted) and the **A To Z | By Role** `CompactToggleGroup` (dark tone), the toggle last. On a phone the search is full width and the toggle sits on the next row.
- **A To Z view:** a letter jump strip (only the letters in `letters`; 44 px targets on a phone, a horizontally scrolling row; from `md` a sticky vertical rail at the right) that sets `letter` (tap again to clear); letter headings in the display face; **By Role** uses role headings.
- **Row:** name (cream, bold), role under it (muted), a gold **Main Contact** tag for the primary, then the value lines (a value that is not shared reads "Not shared", muted, with no button). A value line is the number or address as text plus its framed icon buttons: **Call** and **Copy** for a phone, **Email** and **Copy** for an email. From `sm` the row is one line (name and role left, phone and email in two aligned columns); on a phone the values stack under the name, each full width with 44 px buttons. The phone column or email column is absent when `phoneShown`/`emailShown` is false, so a name and role row has no empty icons.
- **Copy** uses the existing clipboard hook with a polite status line ("Number copied", "Address copied"); on failure it says so. `tel:` hrefs are built only by `clubInfoFormat.phoneHref` (digits and a leading `+`), `mailto:` hrefs by `emailHref`; both are unit tested.
- **Paging:** the first page of 25; **Show More** (shared compact `Button`) asks the server for the next page (`useInfiniteQuery`, `initialPageParam: 0`), never a client slice.
- **Empty states:** a club with no active contact is the page-level empty state; a search or letter with no match shows an icon, "No Contacts Match" and a friendly line with a "Clear Search" underlined link.
- No Share, Print, Download, CSV, vCard or Copy All control exists anywhere in the folder (Decision 14); the directory root has the `@media print` rule.

**Links.** A row of framed icon buttons (website, Facebook, Instagram, X, YouTube and the rest of the `SocialLinksRow` set, the generic link icon for a custom platform), each with a tooltip and accessible name ("Riverside CC on Facebook"), opening in a new tab with `rel="noopener noreferrer"`; below them labelled link rows (platform name as the label, the host as the value) so a screen reader and a keyboard user have a text list. The existing `socialFor` and `LinkButton` in `HubLeagueTabs.tsx` are extracted into a shared `HubSocialLinks` (no visual change to the league page).

**Logos (on About, no pill).** The banner is a wide band at the top of About (`object-fit: cover`, a fixed 16:5 ratio, alt text "Riverside CC banner"; absent when there is no banner); the logo is the large avatar beside the club name (`object-fit: contain` on a neutral disc, alt "Riverside CC logo", initials tile when none). When `downloadable` is true each image carries a compact **Download** framed icon button at its corner (an `a` with `download` and the suggested name, accessible name "Download logo" / "Download banner"). With download off the image only displays; no disabled control is drawn.

**Phone (390 px).** The pill row scrolls under the header; facts stack label over value; directory values stack under the name; icon buttons are 44 px; no horizontal scroll, text stays legible at 200 percent. **Desktop:** the page uses the console width; the facts card is two columns from `md` (About) and the directory is one wide list with the letter rail on the right.

**Manager side (`ui/src/pages/manage/`):**
- **Club profile (`ClubOverviewPage`):** a compact flat **Player Hub** card (club administrators only, beside Share formats, as `147` designed it): labelled switches "Show Club Details", "Show Club Phone And Email", "Show Website And Social Links", "Show Logos", "Allow Logo Download", "Show Contact Directory", and, indented under the directory, "Show Phone Numbers" and "Show Email Addresses" (disabled with the reason while the directory is off). One line of explanation: "Parents and players of this club see what is switched on. The directory shows all of the club's active contacts, adults only, once it is switched on." Saves through `hub-settings` (compact `Button`, Title Case). Built from existing `InfoCard`, switch and `Button` components.
- **Club contact form:** unchanged (no Player Hub section). The Contacts page shows no "In Player Hub" chip. A short line on the Player Hub card says which contacts the directory will show ("All active contacts, adults only").

**Copy rules.** No "you" or "your" anywhere in the Hub text (use "the club", "parents and players", or the first name where one exists); Title Case labels; no em dashes; no "None yet".

**Hub nav and docs hooks.** `hubNav.ts` (Decision 3); `HubMenu`, `hubNav.test.ts`, `HubMenu.test.tsx`, `MyPlayerPage.back.test.tsx` updated for Club opening on Club info.

**New client files.** `pages/view/myPlayers/HubClubInfo.tsx`, `HubClubAbout.tsx`, `HubClubDirectory.tsx`, `HubClubLinks.tsx`, `HubClubImages.tsx` (the banner and logo inside About), `HubFacts.tsx`, `HubSocialLinks.tsx`, `clubInfoFormat.ts` (pure: `phoneHref`, `emailHref`, `mapsUrl`, `letterOf`, filename suggestion); `ui/src/api/meClubInfoApi.ts` (hooks, keys under `['me', 'players', playerKey, 'club-info', ...]`, one file per resource); manager additions in `ui/src/api/clubApi.ts`-side hub settings file and `ClubContactForm`.

## Test Plan

Tiers per `docs/standards/testing.md`; targeted tests per step, one full run at the end; no tests are written before the owner approves the build (project working rule).

**Backend unit (JUnit 5, same PR as the service)**
- `MyClubInfoServiceImplTest`: each switch hides exactly its block (null, not empty); `tabs` visibility and counts (Decision 11); empty club returns no tabs; `https`-only social filter; type and address null handling; the club name is always present.
- `MyClubDirectoryServiceImplTest`: only active contacts of the club (all of them, including team managers and coaches); phone only with the club's phone switch; email likewise; a contact with no phone or email on file still returns the row with `phone` and `email` null; order; `query` match on first name, last name, role; `letter`; `letters` of the filtered set; paging; parameter validation (size 51, size 0, negative page, `letter` "AB", query of 61 characters are 400).
- **Club contacts only (guard):** `MyClubDirectoryServiceImplTest` and a Testcontainers case seed a player, a parent and an agent with phone and email in the same club and assert that no `query` or `letter` (including their exact names, phone numbers and email addresses) ever returns them, and that the query touches only `club_contact` (the SQL joins no `person`, `player_profile` or `person_link`).
- `HeldPlayerTest`: `canSeeClubDirectory()` for self adult, self junior, self with no date of birth, linked main, linked non-main.
- `ClubHubSettingsServiceImplTest`: defaults for a club with no profile row; directory phone or email on while directory off is rejected; a profile `PUT` does not reset the settings (and the settings `PUT` does not touch the profile).
- `ClubContactServiceImplTest`: unchanged behaviour (regression only); deactivating a contact removes it from the directory without any other change.

**Backend integration (`AbstractIntegrationTest`, Testcontainers Postgres, no class-level `@Transactional`, so a missing service-level `@Transactional` is caught)**
- `063` applies on a clean database and on one with `062`; defaults are as in Decision 7; the partial index exists and the directory query uses it (checked with `EXPLAIN` on a seeded club).
- **Access matrix** on both read endpoints: own verified player (adult), linked main parent, linked non-main agent, a junior's own login (directory 404, club-info 200), a key of another account (404), a malformed key (404), a revoked link (404), a rejected or inactive player (404), a SUSPENDED caller (403), unauthenticated (401), a manager who is not linked (404), club isolation (a held player at club A never receives club B's contact, even with club B's contact listed).
- **Privacy matrix**: every switch combination (directory off or on, phone off or on, email off or on) asserting presence or absence of every contact and of phone and email in the exact response; a contact of another club is never returned; an inactive contact is never returned; no response ever contains a player, person, parent, agent or child name.
- **Exact JSON keys** (contract test): the key sets of `MyClubInfoDto`, its nested objects, `MyClubContactPageDto`, `MyClubContactDto` and `ClubHubSettingsDto` are asserted verbatim (no `clubId`, no profile id, no consent timestamp, no `active`, no switch names other than documented).
- **Query count**: `club-info` and `contacts` statement counts are fixed numbers, asserted equal for a club with 1 and with 40 contacts (no N+1).
- `LinkedAccountCannotReachManagerSurfaceIntegrationTest` extended: a linked account gets 403 on `hub-settings` GET and PUT and on the contact `PUT`; a club administrator of another club gets 403.
- `ClubHubSettingsControllerIntegrationTest`: club administrator reads and writes; a plain manager of the club is refused; cross-club refused.
- Response header `Cache-Control: private, no-store` on both reads; logs: a read writes one INFO line with ids and counts and (asserted with a log capture) no name, phone or email.
- **ArchUnit**: the existing layering suite passes; no class in the new read services depends on `PersonLinkRepository`/`PlayerProfileRepository` except through `MyPlayerAccess`; the directory repository query lives only in `ClubContactRepository` and is called only by the directory service.
- **Contract**: OpenAPI diff passes (additive).

**Frontend (Vitest + Testing Library)**
- `clubInfoFormat.test.ts`: `phoneHref` (spaces, brackets, a leading `+`, rejects letters), `emailHref`, `mapsUrl`, `letterOf`, filename suggestion.
- `hubNav.test.ts`: `club.info` is live (no `soon`), Club order unchanged (Club info, Bookings, Field Directory, Other Services), `defaultChild(Club)` is Club info, the two-level and seven-item pins hold; `HubMenu.test.tsx` and `MyPlayerPage.back.test.tsx` updated; a `hubBack` case for `club/info` on phone and wide layouts.
- `HubClubInfo.test.tsx`: renders only the pills in `tabs`; `?tab=` selects and an unknown value falls back; empty state when `tabs` is empty (icon, title, friendly line, no "None yet", no "you"); loading and error states; 404 handling.
- `HubClubAbout` (including the banner and logo, and Download only when `downloadable`), `HubClubLinks`: facts omit missing values; address lines; `https`-only links with `rel="noopener noreferrer"`; framed buttons have accessible names and tooltips; Download shows only when `downloadable`.
- `HubClubDirectory.test.tsx`: search debounce sends `query`; A To Z and By Role toggle sends `sort`; the letter strip shows `letters` and sends `letter`; phone and email columns follow `phoneShown`/`emailShown`; Call and Email are `tel:`/`mailto:` links; Copy writes exactly one value and announces it; Show More requests the next server page and appends (no slice); empty and no-match states; Main Contact tag.
- **`hubClubInfoNoExport.test.ts`** (guard, modelled on `hubStatsNoExport.test.ts`, proven non-vacuous): no file under the directory folder imports `utils/share/**`, `jspdf`, a canvas-to-image helper or `WhatsAppSendActions`, uses `navigator.share`, `window.print`, `Blob`, `URL.createObjectURL`, builds an `a[download]`, or renders a Share, Print, Download, Export or Copy All control; the only `download` attribute in the feature is in `HubClubLogos`.
- `HubFacts` and `HubSocialLinks`: the existing league page tests pass unchanged after the extraction.
- Manager: the Player Hub card (switches, disabled directory children, save); `ClubContactForm` Player Hub section (dependent disabling, payload) and `ClubContactList` chip.
- Storybook: stories for `HubFacts` and `HubSocialLinks` if promoted to `components/`; page-level files need none.

**End-to-end (Playwright, golden path only):** a club administrator switches the directory and phone on; a linked parent opens Club Info on a phone viewport and a desktop viewport, finds a contact by search, sees the Call link, and finds no player or parent by name. Not wired into CI, like the other Hub flows.

**Owner's manual checks (not automated):** 375 px sweep (no horizontal scroll, 44 px buttons, readable at 200 percent zoom), screen reader pass (pill tablist, row names, copy status line, framed button names), keyboard pass (pill arrows, letter strip, Call/Email/Copy reachable, Escape runs the footer Back), reduced motion, a real phone tapping Call and Email, a club with nothing set, a club with everything on, and a junior's own login.

## Acceptance Criteria

1. The Club menu's **Club info** is a live page at `/account/players/:key/club/info`; it is no longer a Soon item; Bookings and Other Services remain Soon; Club opens on Club info on wide layouts.
2. With every default setting, a linked parent sees About (with the club's logo and banner) and Links for data the club has set, and **no Contacts pill and no phone number or email of any person**.
3. A club administrator can switch each block on or off from the Club profile Player Hub card; a switched-off block is absent from the API response (null) and from the page; the directory's phone and email cannot be on while the directory is off.
4. A contact appears in the directory when the directory is on and the contact is active (by name and role even when a value is missing, the missing value reading "Not shared"); its phone shows only when the club's phone switch is on; its email likewise; the migration changes no contact.
5. The directory can be searched by name or role, shown A To Z or By Role, jumped by letter, and paged by the server (25 per page, 50 at most); a request for more than 50, a negative page, an over-long query or a bad letter is a 400.
6. Each shown phone has working Call and Copy; each shown email has working Email and Copy; copying announces itself politely; nothing else leaves the page (no Share, Print, Download, CSV, vCard or Copy All), pinned by the guard test.
7. A junior's own login sees About (with the images) and Links but gets 404 on the directory; an adult player and any linked parent or agent see the directory when it is on.
8. A key the caller does not hold, a dropped-out player and another club's data all answer 404 with no information about the club; a suspended caller gets 403; a linked account cannot reach any `/manage` route.
9. The responses contain exactly the documented keys; no person other than a club contact is named; no ids other than the contact list key; the number of SQL statements per call is fixed regardless of the number of contacts.
10. A read writes one log line with ids and counts and no name, number or email; responses carry `Cache-Control: private, no-store`.
11. The club logo and banner show when the logos block is on; Download appears only when the club allows it and downloads the stored file with a suggested name; with the block off the initials tile shows.
12. A club with nothing set (or everything off) shows ONE friendly empty state, no pill row, no error.
13. Every control is the shared compact `Button` or a framed icon button (36 px from `sm`, 44 px on a phone); labels are Title Case; Hub copy contains no "you" or "your"; the page works at 390 px with no horizontal scroll.
14. Migration `063` (or the next free number) is the only schema change, adds only columns and one index, and no applied migration was edited.

## Open questions

Each carries the default that applies if the owner does not answer.

1. **Do team managers and coaches appear in the directory?** **Resolved (owner, 2026-11-12): yes.** They are `ClubContact` rows linked through `TeamContact`/`SectionContact`; as the directory shows every active club contact (Decision 9), they appear with their role as the role line (for example "Team manager, U15", "Coach, Over 40") and under their own heading in the By Role view. Still open: whether the directory should also show a team or section line for a contact linked to the held player's team (needs a join and a small DTO addition); *default:* no.
2. **Which viewers may see the directory?** *Default:* adult players and every linked account (parent or agent); a junior's own login does not. Alternative: only the main parent and the adult player, not other agents.
3. **May adult players see each other's numbers?** **Resolved (owner, 2026-11-12): no.** The directory is club contacts only; no player, parent or agent contact information is searchable or shown from the Player Hub.
4. **Logo download formats.** *Default:* the stored file only (PNG, JPEG or WebP, as uploaded), one logo and one banner. Alternative: a later spec adds a brand-asset set (SVG, PNG sizes, a guidelines PDF) managed by the club.
5. **Default for existing clubs.** **Resolved (owner, 2026-11-12): existing clubs start visible.** The organisation-fact switches (identity, contact, links, logos) start on at migration, so a club's already-entered name, address, club phone and email, website, socials and logos are visible to its linked accounts after release; the administrator can switch any block off at once on the Club profile page. Logo download, the directory and every per-contact flag still start off.
6. **Rate limiting.** *Default:* none beyond the page cap and the single-page-per-call design; the log line is the audit. Alternative: a per-account limit (for example 60 directory reads an hour) if the existing link-request limiter of `119` is generic enough to reuse; a new limiter is not built for this.
7. **Audit.** *Default:* the INFO log line only. Alternative: an `access_log` table with who read the directory and when, if the club's privacy officer needs a record (a separate spec).
8. **Legal basis for adults' contact details (owner to confirm before real clubs).** The legal question about showing **children** in `147` does not apply here, because contacts are adults. With the per-person opt-in dropped (Decision 10), the basis for showing the club's own contacts' phone numbers and emails to its members is the club's decision to switch the directory on, as the holder of that information (for example under the South African POPIA if the clubs operate there, or the equivalent elsewhere). *Default:* ship with the club-level switches (all off until the administrator turns them on) and revisit when roles and permissions are specified; the owner confirms before the directory is switched on for any real club.
9. **Which Club page opens first?** *Default:* Club info (the first live child by the existing rule). Alternative: keep Field Directory as the landing page by listing it first, which changes the owner's Club order.
10. **Contact photos.** *Default:* none (Decision 12). Alternative: show the `021` photo for a contact, with its own decision.
11. **A deactivated contact.** *Default:* deactivating a contact removes it from the directory at once; reactivating restores it.

## Rollout Notes

- **Sequencing.** (1) Mockup `docs/mockups/player-hub-club-info-round1-mockup.html` (phone and desktop, About with the logo and banner, Contacts with both views, Links, empty state, the manager card), owner review, **before the plan**. (2) `/plan-feature` into `docs/plans/148-player-hub-club-info.md`. (3) Build in slices: migration `063`, entities and the settings service and endpoints, the contact flags; the two Hub reads; nav and route; About and Links; the directory; manager card and contact form; tests after the owner has checked function. The directory slice ships last so About and Links can be reviewed with no personal data in play.
- **No feature flag.** The club switches are the control; the personal parts are off by default. Release notes tell club administrators that already-entered organisation details become visible to linked accounts (Decision 7, Open question 5) and where to turn each block off.
- **Roadmap:** `docs/roadmap.md` is a living index and the human updates it; entries to add or change are listed below (this spec does not edit it).
- **Parked, not built:** player directory, section-aware or team-aware contacts, contact photos, brand-asset downloads, an audit table, a per-account rate limit, moving `/media` behind authorisation, a club description or founding year or colours on `ClubProfile`, a "Messages" notice feed (`121` Soon rows).

### Docs to update in the same change set

- `docs/standards/page-anatomy.md`: section 9 review log row "Player Hub: Club Info" (built, owner hand-check pending) and, in section 9a, one line recording that framed icon buttons also carry Call, Email and Copy, and that the Hub directory is never exported.
- `docs/standards/design-system.md`: a "Player Hub Club Info" section (pill row, `HubFacts`, `HubSocialLinks`, the directory row anatomy, framed icon buttons for Call, Email and Copy, the logo tile) and a pointer from the Club info row.
- `docs/standards/frontend.md`: a "Player Hub Club Info (`148`)" paragraph (routes, pages import no export path, `hubClubInfoNoExport` guard, `HubFacts` and `HubSocialLinks` extraction) and, in `backend.md`, a "Player Hub Club Info (spec 148)" section (the club switches are columns on `club_profile` written only by `ClubHubSettingsService`, the directory rule of Decision 9, the fixed query counts, no names logged).
- `docs/specs/121-player-hub-menu-and-fields.md`: the Soon table row `club.info` becomes "Built by `148`", Decision 16's "opens on Field Directory" and Decision 13 get an amendment line (Club info is the first Hub item with club settings, stored per `148` Decision 6; Club now opens on Club info).
- `docs/specs/012-club-profile.md` and `docs/specs/021-club-contacts.md`: a short note that the profile and contacts are now read by the Player Hub (read only; `021` is unchanged).
- `docs/specs/147-player-hub-stats.md`: one line that the `hub-settings` endpoint and manager card it cancelled are built by `148` for the Club info switches, with no leaderboard field.
- `docs/roadmap.md`: mark the "Club info" Hub item as specified (`148`); add the parked items above, the open legal item on adults' contact details (Open question 8) beside the existing open legal item for children's rankings, and the "media behind authorisation" platform item.
- `docs/architecture.md`: the Club/Contact diagram with the hub flags and the Hub read path.
- `docs/mockups/player-hub-club-info-round1-mockup.html`: to be created before the plan (above).
