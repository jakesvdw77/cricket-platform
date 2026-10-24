# 121: Player Hub Menu and Field Directory (a two level menu with room to grow, and a Field Directory for parents)

**Depends on:** `001-tenancy-identity-model.md` (`Club`, club isolation, `RoleAssignment` is untouched), `094-club-structure-and-seasons.md` (the club's current season, used to find this season's fixtures), `099-fields-directory.md` (`PlayingArea`, `ClubPlayingArea`, `Match.playing_area_id`, the verification states and the https-only `map_url`; **its Non-goals on photos, facilities, map embed and a public field page stand**; the "Fields" screen there is manager-only, and this spec adds a read-only linked-account view of the same data, called **Field Directory** in the Player Hub), `119-login-account-journey.md` ("My players" and the Player Hub: Decision 6 linked accounts see only their players and polls, Decision 7 one person with several hats, Decision 8 the player selector, Decision 26 no count badges in the manager menu, Decision 29 one "Player Hub" card, Decision 30 date of birth editing; `MyPlayerAccess`, `/api/v1/me/players`, `HubFrame`, `hubStyle.ts`), `120-manager-theme-alignment.md` (`ui/src/brandTokens.ts`, the Barlow files, the shared gold avatar; the console look is unchanged), `079-manager-shell-and-overview.md` (`managerNav.ts`, the typed menu list this follows in shape), `docs/roadmap.md` (the "Player hub: a game-like player view" idea, which this spec prepares room for but does not build), `docs/standards/frontend.md`, `docs/standards/design-system.md`, `docs/standards/backend.md`, `docs/standards/testing.md`.
**Status:** approved 2026-10-24 (the owner accepted every recommended default for the open questions, now Decisions 17 to 21). Written 2026-10-24 from the owner's approved mockup (`player-hub-nav-mockup.html`, artifact `SRaaJaW8T7CyVmact9Jd9p`, version 7) and Decisions 1 to 9, 15 and 16 below, which the owner made before or during writing. Plan: `docs/plans/121-player-hub-menu-and-fields.md`.

## Terminology (binding on the UI copy and this spec)

- **Player Hub**: the dark console at `/account/players/:key/...` (`119` Decision 29). Not a new screen; this spec changes its menu and layout.
- **Main menu**: the six top-level items. **Sub menu**: the children of an item, which replace the main menu list inside the same console.
- **Leaf**: an item that opens a page in the content panel (it has no children).
- **Selected player**: the player chosen in the Player Hub (`:key`). Profile and the Club items follow it.
- **Soon item**: a leaf shown but locked, with a dashed "Soon" pill and a dashed "Coming soon" panel, because its own spec, data or club switch does not exist yet.
- **Account** (this spec's meaning): the signed-in person, who may be a parent, an agent or the player. Not "Me", because the signed-in person can be the agent. Unrelated to the manager-side "Access" item (`119` Decision 26).
- **Field Directory**: the user-facing name, in the Player Hub only, of the read-only fields list for linked accounts (menu label, page title, copy). Internal names stay as they are: id `club.fields`, `HubFields`, the endpoint `.../fields`, `FieldDto`. The manager-side screen keeps the name "Fields" (`099`).
- **Away field**: a field the club's fixtures are played on that the club has not linked as a home field (`099`).
- **Footer Back**: the footer bar's single Back control (Decision 15). The only control named Back anywhere in the Hub.

## Decisions

Settled by the owner before this spec was written (1 to 9) or during its review (15, 16), binding on it.

1. **The main menu has six items, in this order.**
   - **Availability** (pill: the number of open polls, as today).
   - **Matches** (sub menu: Schedule, Results, Team sheets).
   - **Stats** (sub menu: My stats, Leaderboards, Team stats).
   - **Club** (sub menu, in this order: Messages, Club info, Gallery, Bookings, Field Directory; Decision 16).
   - **Profile** (the selected player: details, date of birth, agents, edit; **unchanged from today**, `119` Decision 30 and `HubProfile`).
   - **Account** (the signed-in person; sub menu: Invitations, Link requests, Find more players, Sign out).
   "Me" was rejected as a label because the signed-in person can be an agent rather than the player. **Link requests leaves the main menu** (it is today a top-level item) and moves under Account; its pill bubbles up to Account (Decision 2).
2. **Two levels, inside the same console.** Choosing an item with children replaces the menu list with its sub menu; the console title shows the path ("Player Hub", then "Player Hub / Club"); pills on sub items bubble up to their parent (a sub item's pill shows on the parent row; the parent shows the sum or a single "new" pill, see UI Requirements). Phone: the main menu screen, then the sub menu screen, then the page full screen. Tablet between 600 and 900 px: two columns with a 220 px menu. Desktop from 900 px: the 300 px menu column. Where the Back control sits and what it says is Decision 15.
3. **The menu is defined once as a typed list**, like `managerNav.ts`: `id`, `label`, `children`, a pill source, a `soon` flag, and a `visibleWhen` that combines what linked accounts may see (**decided per item by that item's own spec**) with a **club switch**. A new item therefore appears only when its own spec says what linked accounts may see and the club has turned it on. Soon items show as locked entries with the dashed "Soon" pill and panel (today's Schedule and Stats behave this way). **Maximum six top-level items; a seventh needs an owner decision.**
4. **The console fills the window height on desktop**: it stops about 24 px above the bottom of the window, the cricket scene stays visible in the side margins, and the pitch strip under the console is dropped on desktop. Width is up to 1400 px or 90 vw. The player card sits at the top of the menu column and the menu starts under it. The content panel starts at the top on a solid dark ground (about 92 percent opaque) with lighter cards, larger type and gold for key figures.
5. **Club items are club-wide and follow the selected player's club.** A parent with players at two clubs sees each club's items when they switch players.
6. **Field Directory (Club, Field Directory) for linked accounts** is a read-only list of the club's home fields and the away fields from this season's fixtures, with a search box. Each card shows name, address, owner when present, an "Address checked" or "Address not checked yet" tag from the platform verification, and a **Directions** button that opens the stored map URL (https only, already validated by `099`) in a new tab. No editing, no map embed, no photos or facilities. Only fields **linked to a field record** appear: a fixture with a free-text venue only is not listed (and the screen says so, see UI Requirements). It needs a **new read endpoint under `/api/v1/me`**, authorised through `MyPlayerAccess`, returning only the selected player's club's fields with no manager-only data.
7. **Every Soon item is listed in a table in this spec** with what it needs before it can ship (Rollout Notes).
8. **"Next match here" on a field card is a later idea**, not built here (it needs fixtures linked to field records). It is listed under Later, and in `docs/roadmap.md`.
9. **Quality is part of the scope**: keyboard navigation of the menu (arrow keys, Enter, and Escape as the footer Back), correct aria roles, 44 px targets, `prefers-reduced-motion`, and sweeps at 375, 768 and 1280 px.

Decisions made while writing, flagged for the owner to overrule (15 and 16 are the owner's):

10. **Account items follow the signed-in person, not the selected player.** Invitations, Link requests, Find more players and Sign out look the same whichever player is selected; the player card still shows the selected player.
11. **Sign out and Find more players are actions, not pages.** Sign out calls the existing sign-out; Find more players navigates to `/welcome` (today's behaviour, which leaves the console). Neither shows a panel. Invitations and Link requests render the existing components in the panel.
12. **The footer bar changes.** The "Find more players" footer button for a single-player account is removed, because the same action now lives under Account (one place, not two). What the footer's Back says and where it goes is Decision 15; for a single-player account at the main menu there is no picker to return to, so the footer has no Back there.
13. **No club switch storage is built here.** The `visibleWhen` shape accepts a club switch, but no switch exists yet for any item in this spec. Field Directory has no club switch (a club that has captured its fields has opted in by doing so, and linked accounts only see a club's own fields). The first Soon item that needs a switch (Leaderboards is the likely one) specifies where it lives and its data model in its own spec.
14. **Old URLs keep working.** `/account/players/:key/requests`, `/schedule` and `/stats` redirect to their new homes (Account, Link requests; Matches, Schedule; Stats, My stats), and `/account/invitations` stays reachable, as `LegacyDetailsRedirect` already does for details.
15. **The footer bar is the one Back on every screen and every layout, and its label says where it goes (owner, from the mockup review, which showed three Backs on one phone screen).**
    - **There is no Back button in the header, no "Back" row in the menu list and no Back inside a page, on any layout.** Exactly one element named Back exists on any Hub screen, and it is the footer's.
    - **Labels by state:**
      - Main menu: **"Back to players"** (to the picker).
      - Inside a sub menu: **"Back to menu"** (up one level to the main menu).
      - Phone, inside a page opened from a sub menu: **"Back to <sub menu name>"**, for example "Back to Club".
      - Phone, inside a top-level page (Availability, Profile): **"Back to menu"**.
      - Desktop and tablet keep the menu column visible, so the footer there only goes up to the main menu ("Back to menu", whenever a sub menu is open, whichever page is shown) or, when the main menu is showing, to the picker ("Back to players").
    - **Keyboard:** **Escape triggers the same action as the footer.**
    - The Profile sub views (edit, hand over, add agent, leave, cancel invitation) take the same rule: the footer reads "Back to Profile" and goes to the Profile page, replacing any Back those views draw themselves (a plan item: their own Back buttons are removed).
    - A single-player account has no picker, so the main menu's footer has no Back (zero Back controls on that screen).
16. **The Club sub menu order and the Field Directory name (owner).** Club lists, in this order, **Messages, Club info, Gallery, Bookings, Field Directory** (Field Directory last). The only built item is therefore the last row, so, to avoid choosing Club on desktop and landing on a locked panel, **choosing a parent shows its first child that is not a Soon item, falling back to its first child when all are Soon** (Club opens on Field Directory; Matches and Stats open on their first, locked child; Account opens on Invitations). The user-facing label is "Field Directory" everywhere (menu, page title, copy); ids, routes and API names are unchanged.

## Problem & Goals

The Player Hub menu is one flat list of five bars (Availability, Profile, Schedule, Stats, Link requests, plus Invitations when there are any). Every future feature for linked accounts named by the owner (Matches, Results, Leaderboards, Messages, Bookings, Gallery and more) would add a bar, and the list would grow into the long menu the club manager's side already struggles with. The Hub is also meant to be more controlled than the manager's view: a linked account should see an item only when someone has decided it may. Parents also cannot find a field today; the fields directory (`099`) is manager-only.

Goals:
- **A. A menu with room to grow** without a long list: six top-level items, two levels, defined once as a typed list.
- **B. A controlled menu**: an item appears only when its own spec says what linked accounts may see and the club has turned it on.
- **C. A Field Directory for parents** under Club, read-only, club-scoped, with Directions.
- **D. A console that uses the window**: full height on desktop, a real tablet layout, one screen at a time on a phone, and exactly one Back on every screen, always in the footer and always saying where it goes.
- **E. Accessible by construction**: keyboard, roles, targets, motion, three viewport sweeps.
- **F. No change to what is already built behind the menu**: Availability, Profile (and its edit, hand over, add agent, leave and cancel invitation sub views), Invitations and Link requests keep their components and endpoints.

## Non-goals

- **No new feature behind a Soon item.** Schedule, Results, Team sheets, My stats, Leaderboards, Team stats, Messages, Club info, Gallery and Bookings are listed and locked; each needs its own spec (Rollout Notes table). Their locked panels carry copy only.
- **No game-like player view** (cards, achievements, levels, the roadmap's "Player hub" idea). This spec only makes room; the feel is still undecided.
- **No change to the Profile section's content or to the agent journey** (`119` Decisions 4, 5, 14, 30). Only where its sub views draw their Back changes (Decision 15).
- **No editing of fields by linked accounts**, no map embed, no photos, facilities, opening hours or contacts, no "suggest a correction", no public (unauthenticated) field page. The `099` Non-goals stand.
- **No "Next match here" line** on a field card (Decision 8; Later).
- **No fields from other clubs**, nearby fields or a platform-wide directory for parents. Club-scoped only (Decision 5).
- **No club switches built** (Decision 13) and no manager screen to turn items on or off.
- **No change to the manager shell, the manager Fields screens or `099`'s endpoints.** A new read endpoint is added beside `MePlayersController`'s; nothing under `/api/v1/manage` or `/api/v1/platform` changes.
- **No change to authorization semantics.** A link never grants a `RoleAssignment` (`119` Non-goals); the new endpoint reads only through `MyPlayerAccess`.
- **No notification bell or menu count badges beyond today's pills.** `119` Decision 26 is about the manager menu; the Hub's pills (open polls, invitations) are the only ones and are unchanged in meaning.
- **No more than six top-level items** and no third menu level.
- **No header Back, menu-list Back row or in-page Back** on any layout (Decision 15).
- **No per-club time zone handling** (known gap, unchanged).
- **No change to the chooser (`/account`) or Find players screens** beyond the shared `HubFrame` height behaviour.

## User Stories

- As a parent, I see six short menu items on the Player Hub, so I can find Availability, my player's Profile and everything else without scrolling a long list.
- As a parent on a phone, I open Club, then Field Directory, and read one screen at a time, and the one Back at the bottom says "Back to Club", so I never wonder which Back to press or where it goes.
- As a parent on a tablet, I see the menu and the page side by side, so I do not tap through screens.
- As a parent, I search the Field Directory and tap Directions on a field, so I can drive to Saturday's away game.
- As a parent whose players are at two clubs, I see Riverside's fields when Anna is selected and Hillside's when Tom is selected, so I never see a field list that is not relevant.
- As a parent, I see "Address not checked yet" on a field no platform admin has verified, so I check before I drive.
- As an agent who is also a player, I find Invitations, Link requests, Find more players and Sign out under Account, whichever player is selected.
- As a person who relies on a keyboard or screen reader, I move through the menu with arrow keys, open with Enter, go back with Escape, and hear which item is current.
- As a club, I see a new Hub item appear only when it has been specified for linked accounts and my club has switched it on, so nothing reaches parents by accident.
- As a developer, I add a Hub item by adding one entry to one typed list.
- As the owner, I see every Soon item with what it needs, so I can decide what to specify next.

## Data Model Changes

None. No migration, no new column, no club switch storage (Decision 13). The endpoint reads `playing_area`, `club_playing_area` and `match.playing_area_id` from `099`, and the club's current season from `094`. `openapi.yaml` gains one path and one schema (below), regenerated by hand as in `099` (no `mvn` under the live backend).

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/fields` | Authenticated; authorised only through `MyPlayerAccess.resolve` (the caller's own ACTIVE links and own verified record). A key the caller does not hold, a malformed key and a dropped-out player are all **404**, never 403; a SUSPENDED caller is 403 (as `MyPlayerAccess` already does) | The read-only fields list for the selected player's club (the Field Directory): the club's home fields plus the away fields from the club's current season fixtures, as `List<FieldDto>` |

No other endpoint is added or changed. The API keeps the name `fields` (no clash found; "Field Directory" is a user-facing label only).

**Rules (server-side, in a new `MyFieldService` interface and impl, called from `MePlayersController` like the existing services; `@Transactional(readOnly = true)`).**
- The club is the resolved held player's `clubId`. The caller cannot supply a club.
- **Home**: `club_playing_area` rows for that club with `is_home = true`, `home = true`.
- **Away**: distinct `playing_area_id` values on that club's matches in the club's current season (`094`) whose `playing_area_id` is not null, not already home, `home = false`. A match with only a free-text `venue` contributes nothing. A merged-away id is resolved to its target (`099`).
- **Excluded**: `REJECTED` and merged-away rows, and any `area_type` other than `CRICKET_FIELD`. `UNVERIFIED` rows are included and flagged by `verified = false`.
- Order: home first, then away, each by name (case-insensitive). The list is **not paged**: it is bounded by one club's fields (tens), and the search box filters it in the browser. If a club ever exceeds 200 entries the service caps at 200 and the plan adds a `truncated` marker; flagged as an open question.
- Error handling follows `docs/standards/backend.md`: no new exception base type; `NotFoundException` from `MyPlayerAccess`.

**`FieldDto`** (response only, DTOs cross the controller boundary, MapStruct mapper from `PlayingArea`; the Java class may be named `MyFieldDto` if `FieldDto` clashes with a `099` type, the plan checks):

| Property | Type | Notes |
|---|---|---|
| `id` | uuid | The field record id; the only identifier exposed |
| `name` | string | |
| `owner` | string, nullable | `owner_name`; null or blank means the UI hides the line |
| `addressLine1` | string, nullable | Number and street, joined |
| `city` | string | Required on every field (`099`) |
| `provinceState` | string, nullable | |
| `postalCode` | string, nullable | |
| `country` | string | ISO 3166-1 alpha-2 (`099`); the UI shows the name |
| `mapUrl` | string, nullable | Already validated as https and not `javascript:` or `data:` by `099`; returned as stored, and the UI re-checks the scheme before use |
| `verified` | boolean | `verification_status = VERIFIED` |
| `home` | boolean | True for a home field, false for an away field |

**Deliberately absent (manager-only or internal):** `verificationStatus` as an enum, `verifiedAt`, `verifiedBySubject`, `rejectionReason`, `createdByClubId` and its club name, the list of clubs linked to the field, match counts, `category` and `ownerType`, `locationNotes` (not requested; see open questions), `groundId`, `areaType`, `mergedIntoId`. A test asserts the JSON has exactly these keys.

## UI Requirements

Composed from `HubFrame`, `hubStyle.ts` (`HUB`, `hubHeading`, `hubOutlineButton`, `hubGoldButton`, `darkFieldSx`), `brandTokens.ts`, the existing `MyPlayerPolls`, `HubProfile`, `MyLinkRequests`, the invitations view, `Button` (compact), and `PageBackdrop` as today (`docs/standards/frontend.md`, `design-system.md`). **Dark console only; no light variant.** The approved mockup (version 7) is the reference for structure and look, including the Club sub menu order.

### 1. The menu model (`ui/src/pages/view/myPlayers/hubNav.ts`, new)

One typed list, in the shape of `managerNav.ts`:

```
interface HubNavItem {
  id: string
  label: string
  children?: HubNavItem[]
  pill?: HubPillSource        // 'openPolls' | 'invitations' | 'linkRequests' | ...
  soon?: boolean              // locked, dashed "Soon", dashed "Coming soon" panel
  soonCopy?: string           // the panel text for a Soon item
  action?: 'signOut' | 'findPlayers'   // not a page (Decision 11)
  visibleWhen?: (ctx: HubNavContext) => boolean
}
```

`HubNavContext` carries the selected player, the signed-in person, and `clubSwitches` (an object keyed by switch id; empty for now, Decision 13). `visibleWhen` is the only gate: an item with no `visibleWhen` is visible. A child that is not visible is not rendered; a parent whose children are all invisible is not rendered. A module-level check (unit test) enforces **at most six top-level entries** and **no third level**.

**The exact menu (ids, labels and order are binding on routes, tests and copy):**

| Level | `id` | Label | Notes |
|---|---|---|---|
| 1 | `availability` | Availability | Leaf. Pill: open polls ("3 open"), as today |
| 1 | `matches` | Matches | Sub menu |
| 2 | `matches.schedule` | Schedule | Soon |
| 2 | `matches.results` | Results | Soon |
| 2 | `matches.sheets` | Team sheets | Soon |
| 1 | `stats` | Stats | Sub menu |
| 2 | `stats.mine` | My stats | Soon |
| 2 | `stats.boards` | Leaderboards | Soon; club switch needed (Rollout table) |
| 2 | `stats.teams` | Team stats | Soon |
| 1 | `club` | Club | Sub menu; opens on Field Directory (Decision 16) |
| 2 | `club.messages` | Messages | Soon |
| 2 | `club.info` | Club info | Soon |
| 2 | `club.gallery` | Gallery | Soon |
| 2 | `club.bookings` | Bookings | Soon |
| 2 | `club.fields` | Field Directory | **Built here** (checkpoint B); last in the Club sub menu |
| 1 | `profile` | Profile | Leaf, unchanged (its `edit`, `hand-over`, `add-agent`, `leave`, `cancel-invite` sub views keep their routes) |
| 1 | `account` | Account | Sub menu; pill bubbles up from its children |
| 2 | `account.invitations` | Invitations | Pill: pending invitations |
| 2 | `account.requests` | Link requests | Pill: see open question 2 |
| 2 | `account.find` | Find more players | Action: navigates to `/welcome` |
| 2 | `account.signout` | Sign out | Action: signs out |

**Routes.** The existing `/account/players/:key/:section` stays for a top-level leaf (`availability`, `profile`), with `/:section/:item` for a child (`club/fields`, `account/requests`). Profile's existing `:sub` segment (`/profile/edit` and the rest) is unaffected because `profile` has no children. Section and item ids in the URL are the part after the dot (so the Field Directory route stays `club/fields`). An unknown section or item means Availability, as today. A phone at `/account/players/:key` shows the main menu, a phone at `/account/players/:key/club` shows the Club sub menu, and `/club/fields` shows the page. A deep link to a Soon item shows its locked panel. On desktop and tablet, `/account/players/:key/club` shows the Club sub menu with the first non-Soon child's page (Field Directory, Decision 16).

**Pills and bubbling.** A pill source returns a count or nothing. A parent row shows: nothing if no child has a pill, otherwise one pill, "N new" where N is the sum of its children's counts. A leaf with its own pill (Availability "3 open") shows it as today. Pills are shown on the row only; there is no count badge anywhere else and no bell (Non-goals).

### 2. Two level navigation, the title and the footer Back

- State is the URL (above), not component state, so refresh works and the browser Back button agrees with the footer Back.
- **The footer Back (Decision 15).** The footer bar is shown on every Hub screen at every width and holds the one Back. A single `hubBack(state)` helper (unit tested) returns its label and target, used by the footer and by Escape, so they cannot drift:

  | Screen | Footer label | Goes to |
  |---|---|---|
  | Main menu (any layout, no page shown on a phone; on desktop and tablet, whenever the menu column lists the main menu, with the page beside it) | Back to players | The picker (`/account`); absent for a single-player account |
  | Sub menu open, desktop and tablet (page beside the menu, any page) | Back to menu | The main menu (the column swaps back to the main list) |
  | Phone, sub menu screen | Back to menu | The main menu screen |
  | Phone, page opened from a sub menu | Back to <sub menu name>, for example Back to Club | That sub menu screen |
  | Phone, top-level page (Availability, Profile) | Back to menu | The main menu screen |
  | Profile sub view (edit, hand over, add agent, leave, cancel invitation), any layout | Back to Profile | The Profile page |

  There is no header Back, no "Back" row at the top of a menu list and no Back inside a page, on any layout. The Profile sub views' own Back buttons are removed (the footer replaces them).
- **Desktop and tablet:** the menu column stays visible. It shows the main menu or the open sub menu (children only, no up row). Choosing a child shows its page in the content panel and marks the child `aria-current="page"`. Choosing a parent opens its sub menu and shows the page of its first child that is not a Soon item, or its first child when all are Soon (Decision 16). Choosing a leaf at the top level shows its page and keeps the main menu listed.
- **Title:** "Player Hub" at the top level; "Player Hub / Club" in a sub menu, the parent label in gold. The existing right-aligned condensed title style is kept. A Profile sub view keeps its current title (`Edit Profile` and the rest). The title bar carries no controls.
- **Phone (below 600 px):** screen 1 is the main menu, screen 2 the sub menu (not auto-opening a page), screen 3 the page full screen. A top-level leaf (Availability, Profile) is two screens. The footer is always visible (pinned to the bottom of the console, safe-area padding included, 56 px high) and the content scrolls above it. The player card is shown on the main menu screen and compactly (name only) on the page screen, as today.
- **Tablet (600 to 899 px):** two columns, a **220 px** menu column and the content. The phone's "one screen at a time" does not apply.
- **Desktop (900 px and above):** a **300 px** menu column and the content, as in the mockup.

### 3. Layout of the console (Decision 4)

- `HubFrame` gains a `fill` behaviour (default for the hub, opt-in so the chooser and Find players are unchanged): on desktop the console's height is the window height minus about 24 px at the bottom and the existing top offset, the menu column is scrollable if the menu is taller than the window, and the content panel scrolls independently. A minimum height of 560 px applies. The pitch strip under the console is not rendered on desktop; the scene stays visible in the side margins through `PageBackdrop`.
- Width: `min(1400px, 90vw)`.
- **Menu column:** the player card (60 px avatar on a phone, 64 px on desktop, name, club and group) is the first element, then the menu starts under it, then flexible space. Bars follow the existing `barSx` look (condensed 600, uppercase, right aligned, cream, gold and `rgba(232,184,61,.16)` when selected, 56 px minimum height on a phone and 64 px on desktop, dashed "Soon" pill, a chevron on a parent). A Soon row is dimmed (opacity 0.6 to 0.75) but fully focusable and activatable. The label "Field Directory" is longer than the other bars, so it must fit the 220 px tablet column at 22 px condensed (wrapping to two lines if needed, never clipped).
- **Content panel:** starts at the top, solid dark ground at about 92 percent (`rgba(5, 30, 22, 0.92)`), page heading in sand condensed 26 px uppercase, cards in `rgba(247,243,232,.07)` with `HUB.line` borders and 4 px radius, larger body type (17 px on cards), and gold for key figures. Colours come from `brandTokens.ts`/`hubStyle.ts`; no new hex literals (the `120` grep gate).
- **Footer bar:** the existing `HubFrame` footer and `HubFooterButton` (condensed 20 px, uppercase, 44 px minimum height, arrow icon), now carrying the footer Back of Decision 15. `HubBackButton` (the outlined Back at the top left of a panel) is no longer used inside the Hub.

### 4. Soon panels

A dashed `HUB.line` panel with "Coming soon" in condensed 22 to 24 px and a one line `soonCopy` (the mockup's copy is the starting text). Never a spinner, never a fake figure.

### 5. Field Directory screen (`club.fields`, `ui/src/pages/view/myPlayers/HubFields.tsx`, new)

- Heading **"Field Directory"**. Under it, a single search input ("Search fields", 44 px, `darkFieldSx`) that filters the loaded list client-side by name, address, city and owner, case-insensitively, and is not persisted. A cleared search shows everything.
- A responsive grid of cards (one column on a phone, two from 700 px of panel width). Each **FieldCard** (a hub-local component, not the manager `FieldCard`, so the manager screens are untouched; a shared `components/` piece is not warranted for one dark-only use) shows: the name in condensed 26 px uppercase; the address lines joined (`addressLine1`, `city`, `provinceState`, `postalCode`, the country name); the owner line when present ("Owner: X", hidden when empty); a tag row with **"Address checked"** (gold outline) when `verified`, otherwise **"Address not checked yet"** (muted); a **Home field** tag when `home`; and a **Directions** outlined button (44 px) when `mapUrl` is an `https:` URL. Directions is an `<a target="_blank" rel="noopener noreferrer">`; the UI re-validates the scheme and hides the button if it is not https. With no map URL the button is not shown (the card keeps the same height by reserving the row).
- Order from the server: home fields first, then away. No group headings are required; the Home tag marks them.
- **States:** loading (skeletons, the existing `Skeleton` pattern); error ("We could not load the fields. Please try again." with a retry); empty (no fields at all: "Your club has not added any fields yet."); empty search ("No fields match."). A short note under the list always reads: "Only fields the club has added to its field list are shown. Matches with a venue typed in by hand are not listed." (Decision 6.)
- No Edit, no Add, no map embed, no photos (Decision 6). The page has no Back of its own (Decision 15).
- **Switching players** re-fetches (the query key includes the player key), so the list follows the selected player's club (Decision 5).

### 6. API client and state

`ui/src/api/myPlayersApi.ts` gains `useMyPlayerFields(playerKey)` (React Query, key `['my-players', playerKey, 'fields']`, no direct axios in components) and the `FieldDto` type. The pill counts reuse `useMyPlayerPolls`, `useMyInvitations` and `useMyLinkRequests`.

### 7. Accessibility and motion (Decision 9)

- The menu is a `nav` with `aria-label="Player sections"`; the list is a `ul` of `li` with buttons (not `role="menu"`, because it navigates and does not perform commands; the roving behaviour below is added by script). The selected item has `aria-current="page"`. A parent that opens a sub menu has `aria-haspopup` omitted (it replaces the list, it is not a popup) and its accessible name includes "opens sub menu". The content panel is a `section` with `aria-live="polite"` as today, labelled by its heading. Soon items carry "Soon, not available yet" in their accessible name. The footer is a `footer` landmark whose button's accessible name is its visible label (for example "Back to Club").
- **Keyboard:** one tab stop for the list (roving `tabindex`); Up and Down arrows (and Home and End) move focus; **Enter** or Space activates (opens a sub menu, shows a page, or runs an action); **Escape runs the same action as the footer Back** (so it goes up one level, or to the picker from the main menu of a multi-player account, and does nothing for a single-player account at the main menu). Escape inside the Field Directory search box with text first clears the text, and a second Escape runs the footer action. After opening a sub menu, focus moves to the first child; after going up, focus returns to the parent that was opened. Right and Left arrows are not used.
- **Targets:** every interactive control is at least 44 px high and wide (the footer Back, bars, search, Directions, chips that are buttons).
- **Contrast:** gold on the dark ground and cream on dark meet 4.5:1 (as `120` proves); the muted tag text is at least 4.5:1 on the card ground; focus is a 2 px gold outline with 2 px offset, never removed.
- **Motion:** the bar hover and any sub menu transition sit under `@media (prefers-reduced-motion: no-preference)`; with reduce, the sub menu appears with no animation.
- State is never colour alone: selected has bold plus `aria-current`; Soon has the pill text; verified has the tag text.
- Sweeps at **375, 768 and 1280 px** (Test Plan): no horizontal scroll, no overlap, text legible at 200 percent zoom, the pinned phone footer never covers content (the content scrolls above it).

### 8. Standards docs updated in the same change set

`docs/standards/design-system.md` (a "Player Hub menu and layout" section: the two level menu, the typed list, the three layouts, the footer-is-the-one-Back rule and its label table, `HubFrame` fill, the Soon pattern, the hub Field Directory card), `docs/standards/frontend.md` (the route shape and the one typed list rule: no Hub item is added anywhere but `hubNav.ts`), `docs/roadmap.md` (Later items below, and the Player hub idea gains a pointer to this spec), and `docs/architecture.md` only if it lists the Hub's sections.

## Test Plan

Per `docs/standards/testing.md`. A new endpoint and new UI need backend and frontend tiers; no migration, so no migration test.

- **Unit (Vitest):**
  - `hubNav.test.ts`: the table above is exactly the list (ids, labels, order, levels), **including the Club order Messages, Club info, Gallery, Bookings, Field Directory**; at most six top-level entries; no third level; `soon` flags match the Soon table; `visibleWhen` hides an item, and hides a parent when all its children are hidden; a club switch in the context shows a gated item and its absence hides it; an unknown route resolves to Availability; legacy redirects map (`requests`, `schedule`, `stats`) to their new homes; the default child of a parent is its first non-Soon child (Club gives Field Directory, Account gives Invitations, Matches gives Schedule).
  - `hubBack` helper: returns the label and target for every state in the table in UI Requirements section 2 (main menu: "Back to players" to `/account`, none for a single-player account; sub menu: "Back to menu"; phone page from Club: "Back to Club"; phone top-level page: "Back to menu"; desktop page inside a sub menu: "Back to menu"; Profile sub view: "Back to Profile").
  - Pill bubbling: a parent shows "N new" from the sum of its children and nothing when none; Availability keeps its own "N open".
  - Field helpers: https-only Directions check (`javascript:`, `data:`, `http:` and empty yield no button); address line joining; country code to name; client-side search matches name, address, city and owner and ignores case.
- **Component (Vitest + Testing Library, mocking the API clients):**
  - **Exactly one Back per screen, and it is the footer (Decision 15):** at 375, 768 and 1280 px (`matchMedia` mocked), on the main menu, a sub menu (Club), and a page (Field Directory, a Soon panel, Profile, Availability), and on a Profile sub view (Edit Profile), the number of elements whose accessible name is "Back" or starts with "Back to" is exactly one, it lives inside the `footer` landmark, and its label is the one for that state: main menu "Back to players"; phone sub menu "Back to menu"; phone Field Directory "Back to Club"; phone Availability or Profile "Back to menu"; tablet and desktop with a sub menu open, "Back to menu"; Edit Profile "Back to Profile". Also asserted: no button in the header or title bar, no first row of any menu list named Back (or named for the parent), and no Back inside a page (Field Directory, Profile and its sub views). For a single-player account the main menu screen has zero Back controls. Clicking the footer Back goes to the target in the table; pressing Escape does the same (including Escape in the Field Directory search box clearing text first, then going back).
  - `HubMenu`: renders the six items; Club opens its sub menu with the five children in the order Messages, Club info, Gallery, Bookings, Field Directory, and no up row; on desktop, choosing Club shows the Field Directory page (not a locked panel) with Field Directory marked `aria-current="page"`; the title shows "Player Hub / Club"; Account shows a bubbled pill from Invitations; Link requests is not on the main menu; Soon rows show the dashed pill and open the "Coming soon" panel; Sign out calls the sign-out and Find more players navigates to `/welcome`.
  - Keyboard: Down and Up move focus with roving `tabindex`; Enter opens a sub menu and focuses the first child; Escape returns to the main menu and restores focus to Club; Home and End; `aria-current` follows the selection.
  - Layouts (with `matchMedia` mocked): phone shows main menu, then sub menu, then the page, with no menu beside the page and the footer pinned; 768 px shows two columns with the 220 px menu and "Field Directory" not clipped; 1280 px shows the 300 px menu column; the pitch strip is absent on desktop.
  - `HubFields` (the Field Directory screen): heading "Field Directory"; renders home then away cards; the verified tag text for each state; owner hidden when empty; Directions opens with `target="_blank"` and `rel="noopener noreferrer"` and is absent for a non-https URL; search filters and "No fields match." shows; empty, loading and error states; the free-text-venue note is always present; changing the selected player refetches with the new key; there is no Edit or Add control.
  - Existing tests updated, not deleted: `MyPlayerPage` tests for the old flat bars and footer, `HubProfile.test.tsx` and `AgentViews.test.tsx` for the removed in-view Back buttons, the Link requests tests (now reached through Account).
  - Storybook: stories for the menu (main, sub menu, Soon, pills, long labels), the footer states, the Field Directory screen (loaded, empty, error, verified and unverified) at 375, 768 and 1280, checked with the a11y addon.
- **Integration (Testcontainers via `AbstractIntegrationTest`):** `GET /api/v1/me/players/{playerKey}/fields`:
  - Returns the club's home fields and the away fields from the current season's matches that carry a `playing_area_id`; a fixture with only free-text `venue` adds nothing; a field that is both home and played at appears once with `home = true`; a field used in a season other than the current one is not returned as away; merged rows resolve to the target; `REJECTED` rows are excluded; `UNVERIFIED` rows are returned with `verified = false`; order is home first then by name.
  - **A linked account only gets its own club's fields:** with players at Club A and Club B linked to one account, each key returns only that club's fields, and a field linked home only to Club B never appears for Club A's key; another club's fields never appear.
  - **A key the caller does not hold returns 404**, as does a malformed key, a key of a player that dropped out (inactive or rejected), and another account's valid key; an unauthenticated call is 401; a SUSPENDED caller is 403.
  - **No manager-only data:** the response JSON has exactly the `FieldDto` keys and none of `verificationStatus`, `verifiedBy*`, `rejectionReason`, `createdByClubId`, `groundId`, `areaType`, `mergedIntoId`, match counts or linked clubs.
  - A caller with a manager `RoleAssignment` but no link to the player gets 404 (the endpoint ignores roles).
  - Runs without an ambient class-level `@Transactional` (the `open-in-view=false` trap in `docs/standards/backend.md`).
- **Unit (JUnit 5, no Spring):** `MyFieldServiceImpl` rules: home and away merge, de-duplication, exclusion of rejected, merged and non-field areas, ordering, and the 200 cap if adopted.
- **ArchUnit and contract:** existing layering rules pass (controller to service interface to repository, DTOs only at the boundary); the hand-regenerated `openapi.yaml` diff (one path, one schema) is reviewed. No CI contract step exists today (noted in `099`).
- **E2E (Playwright, existing tier, not run by default in this repo):** one golden path at 375 and 1280: sign in as a parent with one player, open Club, then Field Directory (the last row), search, see "Address checked" or "not checked yet", Directions has the expected `href` and opens a new page; at 375 the footer reads "Back to menu" in the sub menu and "Back to Club" on Field Directory, and is the only Back.
- **Manual:** the three sweeps (375, 768, 1280) of every menu state and the Field Directory screen, a keyboard-only pass, a screen reader pass of the menu and footer, `prefers-reduced-motion` on, 200 percent zoom, and a two-club parent switching players.

## Acceptance Criteria

1. The Player Hub main menu shows exactly six items in the order Availability, Matches, Stats, Club, Profile, Account, whatever the player; Link requests and Invitations are not on it.
2. Matches, Stats, Club and Account open a sub menu inside the same console (children only, no up row); the title reads "Player Hub / <Item>" while it is open; the browser Back button and the footer Back agree. The Club sub menu lists Messages, Club info, Gallery, Bookings, Field Directory, in that order.
3. A pill on a sub item shows on its parent (Account shows "N new" when there are pending invitations); Availability still shows its open poll count.
4. Link requests, Invitations, Find more players and Sign out are under Account and work as they did (same components, same endpoints); Sign out signs out; Find more players opens `/welcome`.
5. Profile is the selected player's profile exactly as today, including edit, hand over, add agent, leave and cancel invitation.
6. Schedule, Results, Team sheets, My stats, Leaderboards, Team stats, Messages, Club info, Gallery and Bookings are listed as locked "Soon" entries, open the dashed "Coming soon" panel and do nothing else. No fake data is shown.
7. The menu is defined only in `hubNav.ts`; a test fails if a seventh top-level item or a third level is added or the Club order changes, and an item hidden by `visibleWhen` is not rendered anywhere.
8. On a phone (375 px) the flow is main menu, sub menu, page; at 768 px the hub is two columns with a 220 px menu; at 1280 px it is a 300 px menu column with the content beside it.
9. On desktop the console fills the window height (about 24 px clear at the bottom), is at most 1400 px or 90 vw wide, has no pitch strip under it, shows the scene in the side margins, has the player card at the top of the menu column with the menu under it, and the content panel starts at the top on the solid dark ground.
10. Club, then Field Directory shows the selected player's club's home fields and the away fields from this season's fixtures that are linked to a field record, home first; a venue typed by hand is not listed and the screen says so. On desktop and tablet, choosing Club opens on Field Directory, not on a locked panel.
11. Each field card shows the name, address, the owner when present, "Address checked" or "Address not checked yet", and a Directions button that opens the stored https map URL in a new tab with `rel="noopener noreferrer"`; a non-https URL produces no button. There is no edit, add, map embed or photo. The page title and menu label read "Field Directory".
12. A search box filters the list by name, address, city or owner without a request; with no match, "No fields match." shows.
13. Switching to a player at another club shows that club's fields and none of the previous club's.
14. `GET /api/v1/me/players/{playerKey}/fields` returns only the held player's club's fields, 404 for a key the caller does not hold (including a valid key of another account and a manager who is not linked), 401 unauthenticated, and a response with exactly the `FieldDto` keys, none manager-only.
15. The menu works by keyboard: Up, Down, Home and End move focus, Enter opens, Escape runs the footer Back action, focus is visible and moves sensibly, `aria-current` marks the current item, and every control is at least 44 px.
16. With `prefers-reduced-motion: reduce`, no menu animation runs.
17. The 375, 768 and 1280 px sweeps show no horizontal scroll and no overlap, and text stays legible at 200 percent zoom.
18. Old URLs (`/account/players/:key/requests`, `/schedule`, `/stats`, `/account/invitations`) still land on the right screen.
19. **The footer is the one Back:** on every Hub screen at 375, 768 and 1280 px exactly one element is named Back (or starts with "Back to"), it is in the footer, and its label says where it goes: "Back to players" at the main menu (none for a single-player account), "Back to menu" in a sub menu and on a phone top-level page, "Back to <sub menu name>" on a phone page opened from a sub menu (for example "Back to Club"), "Back to menu" on desktop and tablet while a sub menu is open, and "Back to Profile" on a Profile sub view. There is no Back in the header, in a menu list or inside a page, and Escape does what the footer Back does.
20. `design-system.md`, `frontend.md` and `docs/roadmap.md` are updated in the same change set; `package.json` gains no dependency; no new hex literal for a brand colour is added in `ui/src` outside `brandTokens.ts`.

## Rollout Notes

No feature flag: the new menu replaces the old one when a checkpoint merges, and the old routes redirect. No migration and no data change, so rollback is a revert. Tell parents nothing in advance; the menu is the same console with fewer, grouped items. Build first, tests and review after the owner has looked, per the standing working rule.

**Checkpoints**

- **A: menu model, two level navigation and the layouts, no new data.** `hubNav.ts` and its context type (with the Club order and the first non-Soon default child); `HubMenu` (main and sub menu, pills and bubbling, Soon rows, actions, roving focus and keyboard); the nested routes and legacy redirects; the footer Back with its `hubBack` labels and Escape, and the removal of every other Back (header, menu row, Profile sub views' own buttons); `HubFrame` fill behaviour and the dropped pitch strip on desktop; the phone three screen flow with the pinned footer and the 220 px / 300 px layouts; Account's Invitations and Link requests rendered in the panel; the player card at the top of the menu column. Every Soon item locked with copy; Field Directory present as a Soon-style placeholder until B. Owner checks at desktop width and on a phone.
- **B: the Field Directory endpoint and screen.** `MyFieldService` and impl, the `MePlayersController` method, `FieldDto` and mapper, the `openapi.yaml` hand edit; `useMyPlayerFields`; `HubFields` with search and the hub-local card; the backend and component tests for it. Owner checks Field Directory against real data, including a two-club account if one exists.
- **C: tablet and responsive pass, tests, docs.** The 600 to 900 px tablet layout polish (if not finished in A), keyboard and screen reader pass, reduced motion, the 375, 768 and 1280 px sweeps, 200 percent zoom, the full test plan (unit, component including the exactly-one-Back-in-the-footer count, Storybook, integration, authorization, E2E written), `design-system.md`, `frontend.md`, the roadmap entries, and the `design-token-sync` note if any token changed (none is expected).

### Soon items and what each needs before it can ship (Decision 7)

Each item below needs **its own spec** that states what linked accounts may see (the controlled part of the Hub), a **club switch** where the owner wants clubs to opt in, and the **data that must exist**. Data that does not exist today is marked "missing".

| Item | What linked accounts may see (to be decided in its spec) | Club switch | Data needed |
|---|---|---|---|
| Matches, Schedule | Fixtures for the selected player's teams and training; whether other teams' fixtures show | Likely yes (a club may not want to share fixtures yet) | Fixtures exist (`029`, `037`); player to team and training sessions, the latter missing; `115` (player match list) is related |
| Matches, Results | Published results for the player's teams; player scorecard detail | Likely yes | Results exist (`100`, `101`); what counts as published for linked accounts, missing |
| Matches, Team sheets | The announced team sheet for a match; whether the whole XI or only "selected or not" shows | Yes | Team selection exists (`076`, `093`); an "announced to players" state, missing |
| Stats, My stats | The player's own personal figures; never ranked against others (the roadmap guardrail for children) | Optional | Player stats exist (`103`); a linked-account read path via `MyPlayerAccess`, missing |
| Stats, Leaderboards | Whether a club shows any leaderboard to parents and players, and whether children appear | **Yes, off by default** | Leaderboards exist for managers (`103`); a safeguarding rule for children and the switch storage, both missing |
| Stats, Team stats | The player's teams' season record | Optional | Team stats exist (`116`); a linked-account read path, missing |
| Club, Messages | Notices from the club to parents and players; no free-text replies | Yes | A messaging or notice model, missing (the roadmap's header bell is related) |
| Club, Club info | Contacts, the club's places and links | Optional | Club profile and contacts exist (`012`); what is safe to show linked accounts, to decide |
| Club, Gallery | Photos and highlights, with consent rules for children | Yes | Media storage and consent, missing; the roadmap's gallery idea, if any |
| Club, Bookings | Nets and facility booking by a parent or player | Yes | Facility management and booking is `099`'s deferred step 2, missing |

Soon items stay in this table until shipped; a spec that ships one removes its `soon` flag and its row here. Field Directory is not in the table because this spec ships it.

### Later (indexed in `docs/roadmap.md`)

- **"Next match here" on a field card** (Decision 8): needs fixtures linked to field records, which is `099`'s deferred resolution of imported venue text and the venue to field attach on existing matches; when it exists, the Fields endpoint gains an optional next fixture per field for the selected player's teams.
- **Club switch storage and a manager screen** to turn Hub items on or off, specified by the first Soon item that needs one.
- **Fields beyond the club**: nearby fields, other clubs' fields a parent's team visits, a public field page (`099` Non-goals).
- **Location notes** ("Enter via the school gate") on the parent view, if the owner wants them (open question 4).
- **Player Hub game-like feel** (the roadmap idea): collectible cards, achievements, avatar; still needs the feel to be decided first.

## Open questions

None, all answered 2026-10-24. The owner accepted every recommended default, recorded here as Decisions:

17. **Field Directory has no club switch (owner, 2026-10-24).** A club that captured its fields has opted in by doing so, and a parent only sees their own club's list.
18. **The Link requests pill counts requests still waiting for the club (owner, 2026-10-24).** It uses data that already exists and bubbles up to Account.
19. **A thin or empty away-fields list is acceptable at launch (owner, 2026-10-24).** Away fields appear once managers attach a field record to matches; an on-screen note explains it.
20. **Field location notes are left out of the parent view for now (owner, 2026-10-24).** They can be added later without a contract break.
21. **The Field Directory endpoint is unpaged and capped at 200 with a "showing the first 200" note (owner, 2026-10-24).** Searching happens in the browser; a `q` parameter and paging are a later change if a club outgrows it.
