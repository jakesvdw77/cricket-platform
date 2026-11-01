# 133: Field Location and Directions

**Depends on:** `134-fields-pages-revamp.md` (the revamped Fields list, Field page with its Manage Field menu, and Field form, which this spec's UI is specified on), `099-fields-directory.md` (`PlayingArea`, verification, who may edit), `131-match-sharing.md` (weather, `useMatchWeather`, `mapCoords.ts`, Fixture Card, Countdown, WhatsApp text; Decisions 10 and Open question 2), `121` (Player Hub match rows), `130` (match page), `114` (share engine), `docs/standards/*.md` (including `page-anatomy.md`).
**Status:** approved 2026-11-01 (owner accepted all proposed answers: QR code Later, Apple Maps on iOS only, town-only directions labelled approximate, no back-fill). Build after 134.

## Problem & Goals

A field's position today lives only inside its free-text `mapUrl`, parsed in the browser for weather (`131`, Decision 10). Short links (`maps.app.goo.gl`) cannot be read, so weather fails for them, and nothing tells a player how to get to the ground. `131` named stored coordinates as the later backend fix and left the Player Hub rows without field data, so they have no weather. This spec delivers both.

Goals:

- **A.** Store `latitude` and `longitude` on `PlayingArea` as the source of truth, filled from the pasted map URL, always editable by hand.
- **B.** An optional **access point** (entrance or parking): a second coordinate pair and a note, used for directions when set.
- **C.** One resolution chain for weather and directions: stored coordinates, then map URL, then town (geocoded), then nothing.
- **D.** A **Get Directions** action on the match page, Player Hub match rows, the Field page (as an item of its Manage Field menu), and a Directions line (with an optional QR code) in the match share content.
- **E.** Weather in the Player Hub rows (closes the `131` gap).

## Non-goals

- **No in-app map, no embedded map tiles, no map library.** Directions hand off to the user's own map app.
- **No live location or tracking.** The platform never asks for the device position.
- **No drive time, distance or route estimate.** No routing API is called.
- **No short-link resolution in v1.** A browser cannot follow `maps.app.goo.gl` (CORS); a backend resolver is **Later** and would be a server-side fetch needing its own review.
- **No Google Places or paid geocoding.** Town lookup uses Open-Meteo geocoding only (as `131`).
- **No silent rewriting of existing fields.** Existing rows are not back-filled by a job; coordinates appear when a manager or admin saves or asks the form to read the link.
- **No change to verification workflow** (`099`) beyond the rule below.
- **No re-layout of the Fields pages.** Their structure (Back alone, Manage Field menu, static counters, flat cards, compact form) is `134`; this spec only adds content to it.
- **Multiple access points per field, and ground-level facilities** (`099` step 2) are Later.

## User Stories

- As a club manager, I paste a Google Maps link and the latitude and longitude fill in, so that I do not type them.
- As a club manager, I can type or correct coordinates by hand at any time, so that a wrong link does not leave the field wrong.
- As a club manager with a short link, I am told it cannot be read and can type coordinates or use Find on Map, so that I am never stuck.
- As a club manager, I can add an entrance or parking point with a note ("Use gate 2 off Main Rd"), so that directions end at the right place.
- As a player or parent, I tap Get Directions on a match and open my map app, so that I find the ground.
- As a player or parent, I see the forecast on my Player Hub match rows.
- As a club manager, I get a Directions line and optional QR code in the Fixture Card, Countdown and WhatsApp text, so that supporters can navigate from the share.

## Data Model Changes

Migration `backend/src/main/resources/db/changelog/v1/060-playing-area-coordinates.sql` (next free number after `059`; confirm at build) plus its `db.changelog-master.xml` entry; entity and migration ship in one PR. Four nullable columns on `playing_area`:

| Column | Type | Rule |
|---|---|---|
| `latitude`, `longitude` | `numeric(9,6)` | Both or neither. CHECK `latitude BETWEEN -90 AND 90`, `longitude BETWEEN -180 AND 180`, and `(latitude IS NULL) = (longitude IS NULL)` |
| `access_latitude`, `access_longitude` | `numeric(9,6)` | Same checks, same pair rule |
| `access_note` | varchar(200) | Optional; only allowed with an access pair |

`map_url` is kept as a reference, unchanged. Coordinates are public location data of a sports field, not personal data; they are never derived from a user's device.

**Verification rule (chosen):** a coordinate or access-point edit **does not change** `verification_status`, because by `099` only a platform admin can edit a verified field, and an admin's edit is itself a verification act. The edit stamps `verified_at` and `verified_by_subject` with the admin, so the audit trail shows who last confirmed the position. A club manager can edit coordinates only while the field is unverified and their club created it (`099`); it stays unverified. Rejected alternative: re-verification on every edit, which would add an admin queue entry for a change the admin made themselves. Merge (`099`) keeps the surviving field's coordinates.

## API Contract

No new endpoint. Additive fields only (OpenAPI additions only, schema in git updated):

| Endpoint | Access | Change |
|---|---|---|
| `POST/PUT .../playing-areas` (manage and platform) | club manager / platform admin | `PlayingAreaRequest` gains `latitude`, `longitude`, `accessLatitude`, `accessLongitude`, `accessNote`; validated in `PlayingAreaWriter` (ranges, both or neither, note needs a pair) with `ValidationException` (400) |
| `GET` playing-area reads, `PlayingAreaDto`, `PlatformPlayingAreaDto`, `MyFieldDto` | existing | gain the same five fields (`MapStruct` mappers updated) |
| `MatchDto` | existing | gains `playingAreaLatitude`, `playingAreaLongitude`, `playingAreaAccessLatitude`, `playingAreaAccessLongitude`, `playingAreaAccessNote` (null when no field). `MatchServiceImpl.enrichList` positional rebuild updated |
| **Player Hub match rows** (`/me/players/...` matches and leagues reads, `MyLeagueServiceImpl`) | existing | **Backend change flagged:** the hub row DTO carries no field data today. It gains `playingAreaId`, `playingAreaName` and the same five coordinate fields, so the row can show weather and Get Directions without a second call. Confirm the exact DTO at plan time; additive only |

## UI Requirements

All Fields-page changes sit on the pages as revamped by `134` (page-anatomy, 6b); nothing here adds a loose header button, tile or one-off layout.

**Field form** (`FieldFormFields`, used by the manager, admin and dialog forms inside the compact `RecordFormScreen` card of `134`; one change, no copies):

- A **Location** section (compact heading, 36 px fields, three columns from `md`) under the map URL: Latitude, Longitude and a **Read From Map Link** button (compact, text-only, outlined; Title Case).
- Pasting a link never overwrites typed values. Reading happens only when the manager presses Read From Map Link; if coordinates already differ, a confirm says "Replace latitude and longitude with the ones in the link?". On a successful read the form shows the values and a text line "Read from the map link". Patterns: `/@lat,lng/` and `?q=lat,lng` (plus the existing `!3d!4d` and `ll=`), reusing `parseMapCoords`.
- **Short links:** a recognised short link shows "This short link cannot be read. Type the coordinates, or use Find On Map." Never a guess.
- **Find On Map:** geocodes the town (Open-Meteo geocoding, as `131`); shows up to five matches as a list; the manager picks one to fill the pair. Nothing fills without a confirmed pick. The result is the town centre, labelled approximate.
- **Access point** (collapsed section "Entrance Or Parking"): Latitude, Longitude, Note, same validation. Inline errors; the both-or-neither error shows on the pair.

**Field page** (as `134`): the coordinates and the access point (with its note) appear as read-only lines in the flat Address info card, plus an "Approximate" text note when the point comes from a town. **Get Directions** is an item of the one filled **Manage Field** menu (after Edit Field and before Open In Maps, group order of `134`), not a header button and not a figure. Where the destination is the access point, the item's description says so. Hidden, not disabled, when no point resolves. The Fields list kebab (`134`) does not gain it.

**Resolution helper** `utils/fieldLocation.ts` (pure): `resolveFieldLocation(field)` returns `{ point, source }` with source `STORED`, `MAP_URL`, `TOWN` or none; `useMatchWeather` and Directions both call it. Town geocoding is used only when no coordinates exist; a directions point from a town or map URL is labelled "approximate" in the menu. The destination is the access point when set, else the resolved point.

**Get Directions** (`components/GetDirectionsButton` and a menu-items builder so the Manage Field menu can reuse the same logic; MUI only, icons under 32 px):

- **Phone and tablet (touch):** opens a menu: **Google Maps** (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`), **Apple Maps** (`https://maps.apple.com/?daddr=lat,lng`, iOS only), **Waze** (`https://waze.com/ul?ll=lat,lng&navigate=yes`), **Copy Address** (field name, address lines, and the access note when set). Links open with `rel="noopener noreferrer"`.
- **Desktop:** a single click opens Google Maps in a new tab.
- **Placement:** match page (an item of **Manage Match** from `130`, and an inline link in the Venue card, no new button row), Player Hub match rows (compact outlined button, text-only per the icon rule, 44 px target on phone), and the Field page Manage Field item above.
- Outbound only coordinates; no user data, no key.

**Match share** (`131` engine, reused): a **Directions** line in the Fixture Card, Countdown and WhatsApp/Facebook text (field name and a Google Maps link; the access note when set), behind an **Include Directions** switch (on by default when a point resolves, off with its reason otherwise). **QR code on the image and PDF** is included only if built without a new dependency (a small in-repo encoder is judged at plan time); otherwise it is **Later** and the link text ships alone. Initials and junior rules (`114`) are unaffected: no person data is in directions.

## Test Plan

Per `docs/standards/testing.md`.

- **Unit (Vitest):** `parseMapCoords` (`@lat,lng`, `?q=`, `!3d!4d`, short link null, malformed null, out of range null); `resolveFieldLocation` order (stored, map URL, town, none; access point wins for directions); directions URL builders (exact URL shapes, negative numbers, iOS-only Apple); Copy Address text; form: paste does not overwrite, Read From Map Link confirms on difference, short link message, Find On Map needs a pick.
- **Component and Storybook (375, 768, 1280):** Get Directions menu on touch versus single open on desktop; hidden with no point; Manage Field shows Get Directions in the `134` order and nothing in the header; Player Hub row shows weather and directions; field form Location and Access point sections inside the compact card; Address card lines.
- **Backend unit and integration (Testcontainers):** writer validation (ranges, both or neither, note without pair, boundaries 90 and 180); round trip on create and edit; manager cannot edit a verified field's coordinates (409, `099`); admin edit keeps `VERIFIED` and restamps `verified_at`; merge keeps survivor; `MatchDto` and hub rows carry coordinates; tenancy as existing; CHECK constraints reject bad data directly.
- **Contract:** OpenAPI diff additive only. **ArchUnit:** unchanged layering.
- **Share tests:** Directions line present only when switched on; no person name added; QR only if built.
- **End-to-end (Playwright):** manager pastes a Google link, reads coordinates, edits one by hand, saves; a player opens the match and the Google Maps URL has the stored coordinates.

## Acceptance Criteria

- A field stores latitude and longitude (both or neither, in range), editable by hand at any time; the map URL is kept.
- Pasting a link never changes existing values; values change only on Read From Map Link, after a confirm when they differ.
- A short link shows the cannot-read message and never produces coordinates; Find On Map fills only after the manager picks a result.
- An optional access point with a note is stored and, when set, is the directions destination.
- Weather and directions use stored coordinates first, then the map URL, then the town, then nothing; with nothing, no weather and no directions control appear.
- Coordinate edits never silently change verification: managers cannot edit verified fields, an admin edit keeps `VERIFIED` and restamps the verifier.
- Get Directions is a menu on phone (Google, Apple on iOS only, Waze, Copy Address) and opens Google Maps in a new tab on desktop; it is an item of Manage Field on the Field page, an item of Manage Match and a Venue link on the match page, and a button on Player Hub rows; no new header button on any Fields page.
- Player Hub match rows show the weather badge and Get Directions; the backend hub DTO change is additive.
- Fixture Card, Countdown and WhatsApp text include a Directions line when switched on; QR is delivered or recorded as Later.
- No in-app map, no device location, no new dependency, no routing call.

## Rollout Notes

- **Build `134` first, then this spec on top, on one branch, with the UI revamp before the migration.** Within this spec: migration, entity, writer, DTOs and OpenAPI; `MatchDto` and hub DTO additions; `fieldLocation` helper and weather chain switch; form Location section and Find On Map; Get Directions on the Field page, match page and hub rows; hub weather; share lines; QR last.
- **Existing fields:** nothing is back-filled automatically. The map URL fallback keeps weather working until a field is saved with coordinates.
- **Docs when built:** `docs/roadmap.md` (resolve the `131` stored-coordinates line; add short-link resolver and multiple access points as Later), `page-anatomy.md` (Get Directions in Manage Field and Manage Match), `design-system.md` (`GetDirectionsButton`), `docs/architecture.md` (none expected).
- **Mockups needed before build:** field form Location section on the compact card, directions menu on phone, hub row.

## Open Questions (defaults stated)

1. **QR code without a dependency:** default Later unless a small in-repo encoder passes review at plan time.
2. **Apple Maps detection:** default user-agent iOS check; if unreliable, show it on every touch device.
3. **Town geocoding precision on directions:** default allowed but labelled approximate; alternative is to hide directions for a town-only point. Default shown because a rough pointer beats nothing.
4. **Back-fill of existing fields:** default none; a one-off admin tool is Later.
