# 053 — League Extended Profile

**Depends on:** `029-league-management.md` (the `League` entity/endpoints this spec extends — `LeagueDto`/`CreateLeagueRequest`/`UpdateLeagueRequest`/`LeagueMapper`/`LeagueServiceImpl`/`LeagueController`, and `LeagueList.tsx`/`LeagueFormPage.tsx`/`LeagueDetailPage.tsx`/`LeagueForm` on the frontend), `023-sponsors.md` (`Sponsor.website`/`email`/`phone` — this spec's `League.website`/`email`/`phone` match that shape and "no validation beyond basic format" posture exactly), `022-club-social-media.md` (`SocialLink` `@Embeddable`, reused unchanged here via a new `league_social_link` owning table), `012-club-profile.md` (`ClubProfile.logoUrl`/`ClubProfileType`, the first entity in this codebase to pair a plain logo column with a descriptive enum), `026-teams.md`/`028-players.md` (`Team.logoUrl`/`PlayerProfile.photoUrl`, the "plain nullable String column, no upload-history, `MediaUpload` in the UI" posture `League.logoUrl` matches), `052-league-playing-conditions.md` (`LeaguePlayingConditions` — the entity this spec's `format` label is explicitly *not* validated against; see Non-goals).
**Status:** approved.

## Problem & Goals

`029` built `League` as purely operational/scheduling data — a name, a playing-XI size, age eligibility. `012`/`022`/`023` already gave `ClubProfile` and `Sponsor` a real club-facing profile (logo, contact details, social links); `League` never got the equivalent, even though a club running several internal leagues (different age groups, different formats, a Vets league alongside a traditional one) has the same real need to give each one its own visual identity, a quick-scan format tag, and contact info a committee wants attached to that specific competition — not just a bare name in a list.

**Goals**
- Give `League` the same club-facing profile shape `ClubProfile`/`Sponsor` already have — a logo, phone/website/email, and social links — reusing existing entities/components rather than inventing a parallel shape.
- Add a purely descriptive `format` tag (T20/T30/T45/T50/1 Day/3 Day/5 Day) a club admin can set per league, shown as a quick-scan chip on the league's list card.
- Surface all five additions inside `LeagueFormPage`'s existing **Details** tab and `LeagueDetailPage`'s existing **Details** section — no new tab, since these are all League-level fields, exactly like `name`.

## Non-goals

- **Season-scoping any of these five fields.** `logoUrl`/`format`/`phone`/`website`/`email`/`socialLinks` are single-valued per `League`, regardless of season — the same posture as `League.name` itself, and a deliberate contrast with the season-scoped fields `docs/roadmap.md`'s "Deferred by `052` — the rest of `League`'s per-season fields" section already flags as real future work (`maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` "plausibly varies by season, not by League"). That item stays exactly as deferred as `052` left it; a sibling spec (`055`, not this one) is the one addressing it, for a different field set. Nothing here should be read as resolving or touching it.
- **The `format` label driving any validation.** It is cosmetic display text only — no relationship to, and no cross-check against, `LeaguePlayingConditions.maxOversPerInnings`/`powerplayOvers`/`maxOversPerBowler` (`052`, genuinely per-season match-format data). A club admin can set `format = T20` and `maxOversPerInnings = 50` on the same league/season with no rejection, no warning. Keeping match-format *enforcement* entirely inside `LeaguePlayingConditions` — never duplicating or partially re-deriving it here — is the explicit point of this Non-goal.
- **A banner image.** Unlike `ClubProfile`/`Sponsor` (which carry both `logoUrl` and `bannerUrl`), `League` gets a logo only here — no requirement was raised for a league banner, and adding an unused column isn't this spec's call to make speculatively.
- **Named contact *people* for a league.** `phone`/`website`/`email` stay organisation-level fields on `League` itself, mirroring `Sponsor`'s own explicit deferral of "naming a sponsor's own contact people" to a separate spec (`024-sponsor-contacts.md`). A `LeagueContact` entity, if ever needed, is its own future spec, not built here.
- **Any new endpoint.** `LeagueController`'s existing `list`/`create`/`update` endpoints (`029`) already round-trip the full `League` resource; this spec only grows the request/response payload shape, it adds no new route.
- **Any public-facing display.** `/manage`-only, matching `029`'s own identical Non-goal.
- **A configurable/open-ended format list.** The seven values (T20, T30, T45, T50, 1 Day, 3 Day, 5 Day) are a fixed, closed set (a Java enum, per this codebase's `LeagueSource`/`ClubProfileType` convention) — no club-admin-authored custom format string, unlike `SocialLink.platform`'s deliberately free-text label.
- **Retrofitting `format`/contact fields onto any other entity** (`Team`, `Season`) — scoped to `League` only, per the feature request.

## User Stories

- As a club admin, I can upload a logo for one of my club's `League`s, so it's visually distinguishable from other leagues my club runs.
- As a club admin, I can tag a `League` with a descriptive format (T20, T30, T45, T50, 1 Day, 3 Day, or 5 Day), so I and other admins can tell at a glance what kind of competition it is, without that tag affecting any match-day rule.
- As a club admin, I can set a phone number, website, and email for a `League`, so a committee's contact details live with the league they belong to.
- As a club admin, I can add social media links to a `League`, the same way I already can for my club's own profile and its sponsors.
- As a club admin, I can see a `League`'s format as a chip on its card in the Leagues list, without opening it.
- As a club admin, I can see a `League`'s logo, contact details, and social links on its read-only detail page, laid out the same way `Sponsor`'s detail page already presents the same kind of information.
- As a club admin, leaving any of these five fields unset is fully supported — a `League` created before this spec, or one whose admin simply hasn't filled them in yet, behaves identically to today, just with blank/absent values.

## Data Model Changes

**`League` (`029`) gains five new columns**, every one nullable/optional — none of them participate in any existing enforced rule (`minAge`/`maxAge`/`maxPlayingXiSize` stay exactly as `029` left them):

```
League {
    ... (id, clubId, name, source, maxPlayingXiSize, minAge, maxAge, ageCutoffDate, active,
         createdAt, updatedAt, updatedBy — unchanged, see 029)
    string  logo_url   -- nullable. Plain String column, no upload-history, no separate
                          "banner" — matches Team.logoUrl/PlayerProfile.photoUrl's posture exactly
                          (Sponsor/ClubProfile's logoUrl+bannerUrl pair is NOT mirrored here, see
                          Non-goals). Populated by the existing POST /manage/media upload endpoint
                          MediaUpload already calls — no new upload endpoint.
    string  format     -- nullable enum (LeagueFormat, EnumType.STRING) — T20 | T30 | T45 | T50 |
                          ONE_DAY | THREE_DAY | FIVE_DAY. Purely descriptive — see Non-goals.
    string  phone      -- nullable, same shape as Sponsor.phone
    string  website    -- nullable, same shape as Sponsor.website
    string  email      -- nullable, same shape as Sponsor.email
    List<SocialLink> socialLinks  -- @ElementCollection over the existing SocialLink @Embeddable
                                     (022), new owning table league_social_link, FK league_id —
                                     not a new embeddable type
}
```

**New domain enum — `LeagueFormat`**, following this codebase's established enum convention (`LeagueSource`, `ClubProfileType`):

```java
package com.cricketlegend.domain;

public enum LeagueFormat {
    T20,
    T30,
    T45,
    T50,
    ONE_DAY,
    THREE_DAY,
    FIVE_DAY
}
```

(Java identifiers can't begin with a digit, hence `ONE_DAY`/`THREE_DAY`/`FIVE_DAY` rather than a literal `1_DAY`; the frontend maps these to the display labels "1 Day"/"3 Day"/"5 Day" — see UI Requirements.)

**Migration** (next sequential file after `028`'s `028-move-allow-substitutions-to-playing-conditions.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/029-add-league-profile.sql

ALTER TABLE league ADD COLUMN logo_url VARCHAR(512);
ALTER TABLE league ADD COLUMN format VARCHAR(16);
ALTER TABLE league ADD COLUMN phone VARCHAR(32);
ALTER TABLE league ADD COLUMN website VARCHAR(512);
ALTER TABLE league ADD COLUMN email VARCHAR(255);

CREATE TABLE league_social_link (
    league_id UUID NOT NULL REFERENCES league(id),
    platform  VARCHAR(64) NOT NULL,
    url       VARCHAR(512) NOT NULL,
    PRIMARY KEY (league_id, platform)
);
```

Column sizes/types copied verbatim from `sponsor`/`sponsor_social_link` (`015-add-sponsor.sql`) rather than re-derived, per this codebase's existing precedent for the identical shape. Registered in `db.changelog-master.xml` as `<include file="db/changelog/v1/029-add-league-profile.sql" .../>`, appended after `028`'s entry.

**`LeagueDto`/`CreateLeagueRequest`/`UpdateLeagueRequest`** (`029`) each gain `format`/`logoUrl`/`phone`/`website`/`email`/`socialLinks` (the requests' `socialLinks` as `@Valid List<SocialLinkDto>`, mandatory from the start — reusing `SocialLinkDto` unchanged, per `023`'s own explicit lesson about a missing `@Valid` silently skipping nested-list validation). `LeagueMapper` picks up the five scalar fields by name inference and gains the same element-level `SocialLinkDto toDto(SocialLink)`/`SocialLink toEntity(SocialLinkDto)` pair `SponsorMapper` already declares, so MapStruct auto-generates the `List` mapping both ways. `LeagueServiceImpl.create`/`update` call the existing shared `SocialLinkValidation.requireNoDuplicatePlatform` (already used by `SponsorServiceImpl`/`ClubProfileServiceImpl`) and set the five new fields, mirroring `SponsorServiceImpl.update`'s field-by-field assignment.

**Implementation note, flagged explicitly since it's easy to get wrong silently:** `LeagueServiceImpl.withCurrentSeasonFields` (`050`) reconstructs `LeagueDto` by **positional** record arguments, not a builder. Adding fields to `LeagueDto` means that reconstruction call must be updated in the same PR to include the five new positional slots in the right place — a stale positional call here wouldn't fail to compile (a record's canonical constructor still exists, just with more parameters, so a build that forgets to update this call site simply won't compile) but it's worth calling out so the build agent updates it deliberately rather than fighting a wall of compiler errors with no context for why they appeared.

## API Contract

No new endpoints. `029`'s existing three `League` endpoints carry a wider payload shape:

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues` | `@access.canAdministerClub` | Unchanged (`029`) — `LeagueDto` in the response now also carries `format`/`logoUrl`/`phone`/`website`/`email`/`socialLinks` |
| `POST /api/v1/manage/clubs/{clubId}/leagues` | same | Unchanged endpoint (`029`) — `CreateLeagueRequest` payload gains `format?`/`logoUrl?`/`phone?`/`website?`/`email?`/`socialLinks?`, every one optional; omitting all five behaves identically to pre-`053` behaviour |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}` | same | Same — `UpdateLeagueRequest` payload gains the same five fields; a full-resource replace, matching `029`'s existing semantics (an omitted field on `PUT` clears it, same as every other `League` field today) |

## UI Requirements

Composes entirely from existing shared components — no new shared component, no Claude Design pass needed (contrast `029`'s own `PlayingXiBuilder`, which was genuinely new).

- **`ui/src/components/LeagueForm/LeagueForm.tsx`** gains its own internal `Tabs`, the same pattern `SponsorForm` already established for a single-entity form with more fields than comfortably fit one screen:
  - **Basic Info** (default tab) — the five existing fields (`name`, `maxPlayingXiSize`, `minAge`, `maxAge`, `ageCutoffDate`) plus a new **Format** `Select` (`Input select`, options from `LeagueFormat` mapped through a local `LEAGUE_FORMAT_LABELS` record — `T20`→"T20", `ONE_DAY`→"1 Day", etc., the same "enum value → display label map" pattern `SocialLinksFields.PLATFORM_LABELS` already uses), a **Phone** `Input`, and a **Website** field via the existing `WebsiteInput` component (`ui/src/components/WebsiteInput`, already used by `SponsorForm`) and an **Email** `Input` (`type="email"`).
  - **Branding** — a single `MediaUpload` (`ui/src/components/MediaUpload`, `variant="logo"`, `namespace="manage"`) for `logoUrl`. No second `MediaUpload` for a banner (see Non-goals).
  - **Social Media** — `SocialLinksFields` (`ui/src/components/SocialLinksFields`), reused unchanged, exactly as `SponsorForm` already does.

  This is all still rendered under `LeagueFormPage`'s existing outer **Details** tab (index 0) — the outer Tabs list (Details/Teams/Schedule/Playing Conditions) is unchanged; only `LeagueForm` itself, the component that outer tab renders, grows its own inner tab set.

- **`ui/src/api/leagueApi.ts`** — `League`/`LeaguePayload` gain `format: LeagueFormat | null`/`logoUrl`/`phone`/`website`/`email`/`socialLinks: SocialLink[]` (reusing the existing `SocialLink` type from `ui/src/components/marketing/SocialLinksRow`, the same type `SponsorApi`/`ClubProfileApi` already use). A new `LeagueFormat` union type (`'T20' | 'T30' | 'T45' | 'T50' | 'ONE_DAY' | 'THREE_DAY' | 'FIVE_DAY'`) and the `LEAGUE_FORMAT_LABELS` display-label map (exported so `LeagueList`/`LeagueDetailPage` render the same label `LeagueForm` does, never a second, drifting copy).

- **`ui/src/pages/manage/LeagueList.tsx`** — `LeagueCard`'s `avatar` gains `imageUrl: league.logoUrl` (falling back to the existing `EmojiEventsOutlinedIcon` when unset, MUI `Avatar`'s own built-in behaviour, no new logic needed). `RecordCard`'s existing `chips` prop (a plain `string[]`, distinct from the tone-based `badge`/`badges` `leagueSeasonBadges` already renders) carries `[LEAGUE_FORMAT_LABELS[league.format]]` when `league.format` is set, omitted entirely otherwise. **This is a deliberately different call from `052`'s own removal of `LeagueList`'s prior `leagueChips` helper** — that helper was removed because it rendered *season-scoped* Playing Conditions data (e.g. `allowSubstitutions`) with no season context available on a club-wide summary card, a genuine mismatch. `format` has no such problem: it's League-level, exactly like `name`, so a plain card-level chip is correct here and isn't reintroducing the pattern `052` moved away from — flagged explicitly so a future reader doesn't conflate the two.

- **`ui/src/pages/manage/LeagueDetailPage.tsx`** — the header `avatar` gains `imageUrl: league.logoUrl` (same fallback behaviour as above). The existing **Details** section's content gains, after the existing `maxPlayingXiSize`/age-range `DetailFieldRow`s: `phone`/`email`/`website` rows (`PhoneOutlinedIcon`/`EmailOutlinedIcon`/`LanguageOutlinedIcon`, rendered only when set — the exact pattern `SponsorDetailPage` already uses for the identical three fields) and, when `league.socialLinks.length > 0`, the existing `SocialLinksRow` component anchored bottom-right of the section's field grid, matching `SponsorDetailPage`'s own layout treatment byte-for-byte. `format`, when set, renders as a small `Chip` in the Details section's `note` slot (`RecordDetailScreenSection.note`, the same slot already used elsewhere for a compact per-section stat/action, e.g. the Playing Conditions section's own "Share" button) — a deliberate choice not to extend `RecordDetailScreen`'s single `badge` prop (already carrying Active/Inactive) to a plural `badges` shape just for this one additional value.

- No changes to `App.tsx` routing, `ManagerDashboard.tsx`, or any other screen.

**Mobile-first**, per `docs/standards/frontend.md` — `LeagueForm`'s new inner `Tabs` must scroll (`variant="scrollable"`, `scrollButtons="auto"`) rather than overflow at 375px, matching `SponsorForm`'s own existing `Tabs` props exactly.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `LeagueServiceImplTest` extended — `create`/`update` persist `format`/`logoUrl`/`phone`/`website`/`email`/`socialLinks`; a duplicate `socialLinks` platform within one request is rejected (`400`, via the shared `SocialLinkValidation`, mirroring `SponsorServiceImplTest`'s existing identical case); every new field stays optional (omitting all five on create/update round-trips as `null`/empty, no `ValidationException`); `LeagueMapperTest` (if one exists, else covered via the service test) — the five new fields map both directions, `socialLinks` round-trips via the new element-level mapping methods |
| Integration | `LeagueControllerIntegrationTest` extended — real HTTP round trip for the five new fields on create/update/list, both a `CLUB_ADMIN` of the owning club and a `platform_admin` superset case; a repository/Testcontainers test confirming migration `029-add-league-profile.sql` applies cleanly against every existing seeded `League` row (nullable columns, no data loss) and that `league_social_link`'s composite `(league_id, platform)` primary key and `league_id` FK behave correctly |
| Contract | `LeagueDto`/`CreateLeagueRequest`/`UpdateLeagueRequest`'s expanded shape documented in the checked-in OpenAPI schema, including the new `LeagueFormat` enum's fixed value set |
| Component | `LeagueForm.test.tsx` extended — the new Basic Info fields (`format` `Select`, phone, website, email) submit correctly; the Branding/Social Media inner tabs render and wire `MediaUpload`/`SocialLinksFields` the same way `SponsorForm.test.tsx` already proves for the identical components (not re-testing `MediaUpload`/`WebsiteInput`/`SocialLinksFields` themselves, which already have their own component tests); `LeagueList.test.tsx` extended — a league with `format` set renders exactly one chip with the correct display label, a league with `format` unset renders no chip row at all; `LeagueDetailPage.test.tsx` extended — phone/email/website rows and the social-links row render only when set, mirroring `SponsorDetailPage.test.tsx`'s existing equivalent assertions |
| End-to-end | Extends `029`'s existing golden path rather than adding a second one (this spec enriches an existing entity, it doesn't add a new user flow): after creating a league, set its format, upload a logo, add a phone number and one social link, save, reload, and confirm the format chip renders on the list card and every field persisted on the edit screen. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can upload a logo for a `League`, and that logo renders on both the league's list card and its detail page header, replacing the generic trophy icon fallback.
- A club admin can set a `League`'s format to one of T20/T30/T45/T50/1 Day/3 Day/5 Day, and that value renders as a chip on the league's list card and as a small chip on its detail page — with no effect whatsoever on any `LeaguePlayingConditions` field, validation, or match-day behaviour.
- A club admin can set and later change or clear a `League`'s phone, website, and email, matching `Sponsor`'s existing validation posture (format-checked client-side only, nothing enforced server-side beyond basic type).
- A club admin can add, edit, and remove social links on a `League` using the same editor already used for a club's own profile and its sponsors, and a duplicate platform within one save is rejected with a clear inline error.
- A `League` created before this spec, or one with none of these five fields ever set, displays and edits with no error — every field is optional and defaults to absent.
- None of these five fields, nor the `format` label specifically, are season-scoped — editing any of them from any league/season context changes the same single value for the `League` regardless of which season is currently selected elsewhere on the page.
- A club admin for club X still cannot view or modify club Y's league profile fields, even by guessing an id — unchanged, `029`'s existing cross-club isolation applies to the expanded payload the same as the original one.

## Rollout Notes

- **Ships as one PR extending `029`'s already-built `League` surfaces** — no feature flag, no phased rollout; every new field is optional so existing leagues and existing `League` API consumers (if any beyond this codebase's own frontend) are unaffected until an admin actively sets one.
- **Migration is additive only** (`ALTER TABLE ... ADD COLUMN`, all nullable, plus one new table) — no backfill, no data migration, safe against every existing `league` row.
- **The `LeagueServiceImpl.withCurrentSeasonFields` positional-record-reconstruction gotcha** (Data Model Changes, above) is the one real implementation trap in this spec — flagged there in detail so it isn't rediscovered at build time.
- **No Claude Design pass required** — every piece of UI here is a direct reuse of components `012`/`022`/`023` already built and proved out (`MediaUpload`, `WebsiteInput`, `SocialLinksFields`, `SocialLinksRow`, `RecordCard.chips`, `RecordDetailScreen`/`DetailFieldRow`), composed in the same shape `SponsorForm`/`SponsorDetailPage` already establish. This is explicitly a "wire up existing primitives to a new field set" spec, not a new visual pattern.
- **Does not touch, resolve, or narrow `docs/roadmap.md`'s "Deferred by `052`" item** (`maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` becoming per-season) — that stays exactly as open as `052` left it; a human should confirm the sibling spec `055` is what eventually resolves it, and should add this spec's own entry to `docs/roadmap.md`'s Active table once built, noting it as unrelated to that still-open item rather than a partial answer to it.
- A human should also flag, once this ships, whether a future `LeagueContact` (named contact people for a league, mirroring `024-sponsor-contacts.md`'s structural precedent for `Sponsor`) is worth its own spec — not decided here, just named as the natural next step if a club actually asks for it, matching this Non-goal's own framing.
