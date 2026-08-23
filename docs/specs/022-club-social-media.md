# 022 — Club Social Media

**Depends on:** `012-club-profile.md` (`ClubProfile`, `ClubForm`, and its own explicit deferral of social media links — "not decided here"), `020-club-manager-access.md` (the existing `PUT /api/v1/manage/clubs/{id}/profile` endpoint and `ClubForm`'s `mode` prop this spec amends, not replaces).
**Status:** draft.

## Problem & Goals

`012` explicitly punted on social media links for a club's own profile. This is the first of three specs that build that capability (the other two — Sponsors and Sponsor Contacts — reuse what this one builds; see Rollout Notes). Scoped deliberately small: this spec touches only `ClubProfile` and `ClubForm`, nothing else.

**Goals**
- A club admin can add, edit, and remove their club's social media links — picking from a list of popular platforms or adding a fully custom one — from a new "Social Media" tab on the existing Club Profile screen (`020`'s `/manage/club-profile`).
- Builds one new, genuinely reusable editing component — the next two specs in this mini-epic (Sponsors, Sponsor Contacts) reuse it rather than rebuilding the same capability.
- Amends `020`'s existing `PUT /api/v1/manage/clubs/{id}/profile` endpoint with one new field — no new endpoint.

## Non-goals

- **Sponsors, or anything sponsor-related.** A separate, subsequent spec — not built here, even though it will reuse this spec's editor component directly.
- **More than one link per platform.** Enforced by a DB-level unique constraint (`club_id`, `platform`) — a club needing two Instagram links is unusual enough not to support this pass.
- **URL validation beyond basic format.** Mirrors `WebsiteInput`'s existing "basic format check, not a link-verification service" posture (`012`).
- **Any public-facing display of a club's social links** (e.g. the public landing/club page). This spec is the `/manage`-side editor only.
- **A new `@ElementCollection` becomes a `SponsorSocialLink` right now.** That's the next spec's job, once `Sponsor` itself exists — this spec only wires the pattern up for `ClubProfile`.
- **Auto-detecting a platform from a pasted URL, fetching a favicon for a custom entry, or validating that a URL actually matches its selected platform** (e.g. a "facebook" entry pointing at a non-Facebook URL). The platform/URL pairing is taken on trust, same posture as every other free-text field in this codebase.

## User Stories

- As a club admin, I can add my club's Facebook/Instagram/X/LinkedIn/YouTube links from a new tab on the Club Profile screen I already use for contact/address/branding.
- As a club admin, I can remove a link I added by mistake, or update one that changed.
- As a club admin, I cannot accidentally add two links for the same platform — the second one replaces the first, not duplicates it.
- As a platform admin, the same tab is available when I edit a club's profile via `/admin/onboarding` — one component, both audiences, same precedent `012` already established for the rest of `ClubForm`.
- As a club admin, I can pick from a list of popular platforms (Facebook, Instagram, X, TikTok, YouTube, LinkedIn, WhatsApp, Threads, Pinterest, Snapchat) when adding a link, so I don't have to type a platform name for the common case.
- As a club admin, if my club uses a platform that isn't in that list (or just a plain website link I want grouped with the others), I can add it as a custom entry with my own label and URL.

## Data Model Changes

**New `@Embeddable SocialLink`**:

```
SocialLink {
    string platform   -- free text, not an enum (see note below), e.g. "facebook" or a
                       -- club-typed custom label like "Discord"
    string url
}
```

**`platform` is a free-text string, not a fixed enum — a deliberate change from this spec's first draft.** The original design used a strict `FACEBOOK | INSTAGRAM | X | LINKEDIN | YOUTUBE` enum, matching the existing (unused-until-now) `SocialPlatform` union in `ui/src/components/marketing/SocialLinksRow/SocialLinksRow.tsx`. That's too narrow: a club may use a platform outside that list (TikTok, WhatsApp, Threads, Discord, a plain extra website) and must be able to add it. The backend stays deliberately dumb about this — it stores whatever platform string + URL pair it's given, with no enum, no fixed vocabulary, and no validation beyond non-blank. All the "known popular platform, with a nice icon" logic lives entirely client-side (see UI Requirements) — a `SocialPlatform` union still exists there as the list of platforms with a recognized icon, but it's a display/UX convenience, not a data-model constraint. Storing an unrecognized platform string is always valid.

**Architecture note — `@ElementCollection`, not a new list/CRUD entity.** A `SocialLink` has no independent identity or lifecycle — no `active` flag, no "primary," nothing to deactivate; it's a pure value, added or removed as a set. JPA's `@ElementCollection`/`@CollectionTable` is the right tool for exactly this shape — no repository, no service, no controller of its own, just a field on `ClubProfile` mapped to its own small table. This is a new pattern for this codebase (confirmed: no existing `@ElementCollection` usage anywhere) — flagged explicitly since every other list-shaped thing this project has built so far has been a full entity, because it's had real lifecycle (`ClubContact`'s `active`/`isPrimary`). A plain value list like this doesn't need that weight.

**`ClubProfile`** (`012`) gains one field:

```
ClubProfile {
    ...existing fields unchanged...
    List<SocialLink> socialLinks   -- @ElementCollection, new club_profile_social_link table
}
```

**Migration** (next sequential file after `021`'s `013-add-club-contact.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/014-add-club-profile-social-links.sql
CREATE TABLE club_profile_social_link (
    club_id  UUID NOT NULL REFERENCES club_profile(club_id),
    platform VARCHAR(64) NOT NULL,
    url      VARCHAR(512) NOT NULL,
    PRIMARY KEY (club_id, platform)
);
```

`platform` is `VARCHAR(64)`, not the smaller width a fixed enum would need — it has to hold an arbitrary club-typed custom label, not just a short known-platform code. The composite primary key (`club_id`, `platform`) is what enforces "at most one link per platform string per club" at the DB level, not just in the UI — this applies equally to a known platform (`"facebook"`) and a custom one (`"Discord"`); two custom entries only collide if the club typed the exact same label twice.

## API Contract

No new endpoint. `020`'s existing `GET`/`PUT /api/v1/manage/clubs/{id}/profile` (and the platform-admin-facing `GET`/`PUT /api/v1/platform/clubs/{id}/profile` from `012`) both carry the same `ClubProfileDto`/`UpdateClubProfileRequest` — both gain one new field automatically, no separate change per endpoint:

| Field | Type | Notes |
|---|---|---|
| `socialLinks` | `[{platform, url}]` | Full-resource replace semantics, same as every other `ClubProfile` field — omitting it clears all links, matching the existing "blank clears the field" posture (`020`'s Flag #4 precedent) |

## UI Requirements

- **`ui/src/components/marketing/SocialLinksRow/SocialLinksRow.tsx`** (existing, small amendment) — its `SocialPlatform` union grows from 5 to a fuller "popular platforms" set: `facebook | instagram | x | tiktok | youtube | linkedin | whatsapp | threads | pinterest | snapchat`, each with an icon/label in the existing `ICONS`/`LABELS` maps (new MUI icons per platform — check availability in `@mui/icons-material`, fall back to a generic icon for any platform without a dedicated one, e.g. TikTok/Threads/Snapchat may not have official MUI icons). Also gains a fallback path for a platform string *outside* even that expanded set (a custom, club-typed label) — renders a generic link icon (e.g. `LinkIcon`) instead of erroring or omitting the entry, since `SocialLinksFields` (below) can produce exactly that.
- **`ui/src/components/SocialLinksFields/`** (new, four-file anatomy per `docs/standards/frontend.md`) — the editable counterpart to `SocialLinksRow`, reusing its expanded `SocialPlatform`/icon/label maps for the known-platform case. Per row: a `Select` offering every `SocialPlatform` not already added, plus a trailing **"Custom…"** option; choosing "Custom…" swaps the `Select` for a free-text `Input` (the club types their own platform label, e.g. "Discord" or "Club WhatsApp Group") — either way the row also has a URL `Input` and a remove button. An "Add link" button below adds a new row (defaulting to the first unused known platform). Props: `value: SocialLink[]`, `onChange: (links: SocialLink[]) => void` — a controlled component, no internal fetching, matching `AddressFields`'/`ClubNameSlugFields`'s existing "props in, callbacks out" shape. Client-side guard against a blank or duplicate `platform` string within the same submission (mirrors the DB's composite-key constraint, surfaced as an inline error rather than a failed save).
- **`ui/src/components/ClubForm/ClubForm.tsx`** — gains a fifth tab, "Social Media," holding one `SocialLinksFields`. Applies in both `'full'` and `'profileOnly'` mode (`020`) — a club admin should be able to manage their own club's social links via `/manage/club-profile`, same as every other profile field; a platform admin gets it too via `/admin/onboarding`, same "one component, both audiences" precedent as the rest of the form.
- **`ui/src/api/clubApi.ts`** — `ClubProfile`/`ClubProfilePayload` types gain `socialLinks: SocialLink[]`.

**Claude Design pass precedes implementation** for `SocialLinksFields` (per `docs/workflow.md` Step 2) — the one genuinely new component.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `ClubProfileServiceImplTest` extended — `socialLinks` round-trips through create/update, a duplicate platform on the same request is rejected or de-duplicated (decide and document which during implementation planning) |
| Integration | `ClubProfileRepositoryTest` extended — migration applies cleanly, the composite PK actually rejects two rows for the same (`club_id`, `platform`) |
| Contract | `ClubProfileDto`/`UpdateClubProfileRequest`'s new `socialLinks` field documented in the checked-in OpenAPI schema |
| Component | `SocialLinksFields.test.tsx` + Storybook story — add/remove a row, platform selection excludes already-added platforms, choosing "Custom…" swaps in a free-text label input and round-trips it correctly, a blank or duplicate platform string is rejected inline, URL format validation; `SocialLinksRow.test.tsx` extended for its expanded platform set and the generic-icon fallback for an unrecognized (custom) platform string; `ClubForm.test.tsx` extended for the new Social Media tab in both `'full'` and `'profileOnly'` mode |
| E2E | Extends `020`'s existing club-profile e2e coverage: add a social link, save, reload, confirm it persisted; remove it, save, reload, confirm it's gone |

## Acceptance Criteria

- A club admin can add, edit, and remove social media links for their own club from the Club Profile screen's new Social Media tab, in both `/admin/onboarding` (platform admin) and `/manage/club-profile` (club admin).
- At most one link per platform string is ever stored per club — enforced at the DB level via the composite primary key, not just the UI.
- A club admin can add a link for a popular platform via the preset dropdown, or a fully custom platform label via "Custom…" — both save and redisplay correctly.
- Reopening the Club Profile screen after saving shows every previously-added social link, correctly repopulated, including any custom-labelled ones.
- `SocialLinksFields` has no knowledge of `ClubProfile` specifically — it's a generic `SocialLink[]` editor, ready for the next spec's `Sponsor` to reuse unchanged.

## Rollout Notes

- Ships as its own PR, on top of `020`'s already-built `/manage/club-profile` screen — no changes to that screen's access model required.
- **Resolves `012`'s deferred social-media-links item.**
- **First of a three-spec mini-epic.** Originally scoped as one combined "Sponsors & Social Media" spec, then split for the same reason `020`/`021` stayed small and independently reviewable — each piece is easier to review, test, and catch bugs in alone (`021`'s `saveAndFlush` fix was found precisely because that spec's scope was small enough to review thoroughly). The next two:
  - **`023` — Sponsors**: the `Sponsor` entity itself (name, contact info, branding, social links — reusing this spec's `SocialLinksFields` directly), no contact-person tracking yet.
  - **`024` — Sponsor Contacts**: mirrors `021`'s `ClubContact` structurally, now scoped to a sponsor — including applying `021`'s `saveAndFlush` primary-auto-unset fix from day one, not rediscovering it.
- **`@ElementCollection` is a new pattern for this codebase** — any future "small repeatable value list with no independent lifecycle" need should default to this shape rather than a full list/CRUD entity, which stays reserved for things with real identity/lifecycle the way `ClubContact` has and a plain `SocialLink` does not.
