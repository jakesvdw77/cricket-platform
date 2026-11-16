# 157: Photo gallery (first, simple version)

**Depends on:** `012-club-profile.md` and `021-club-contacts.md` (the media upload and the `/media` files), `148-player-hub-club-info.md` (the held-player `/me/players/{playerKey}` authorisation), `150-managers-and-access-grants.md` (permissions), `docs/standards/page-anatomy.md`, `docs/standards/backend.md` (pagination).
**Status:** approved by the owner 2026-11-16 (the defaults of the four questions below were accepted); built 2026-11-16, awaiting the owner's review. Requested by the owner for the VCASA tournament (about 19–21 Nov 2026): this is a first quick version and must stay very simple; approval rules for uploads come later. Mockup: `docs/mockups/photo-gallery-mockup.html`. Decisions are marked **Decided**.

## Problem & Goals
Parents, players and managers take photos at matches and have nowhere in the system to share them. This version gives the club one gallery.

**Goals**
- **Anybody with a held player** (a parent, a player, an agent, in the Player Hub) can upload photos, and tag them to a **league**, a **team** and/or **players**.
- A **club manager** can upload too, and can **delete** any photo that is not up to standard.
- The **Player Hub** shows a **looping carousel** of the latest photos, a **search box and filters**, and **small thumbnails** of the results.
- **Every list is paginated on the server, always**: the page never loads more than one page of thumbnails, and the carousel is capped.

## Non-goals (later)
- Approval before a photo shows, reporting, flagging, or rules about who may upload (a `status` column is added now so this needs no migration later).
- Video, albums, comments, likes, download-all, sharing a photo to WhatsApp or Facebook.
- Editing a photo's caption or tags after upload (delete and upload again), cropping or rotating in the app.
- A public (signed-out) gallery. Photos are for signed-in members of the club only.

## Rules
1. **Who may upload.** Any signed-in account that holds a player of the club (the same authorisation as the rest of the Hub, `404` for another key), and any manager of the club. **Decided:** an account with no held player cannot upload.
2. **Who may delete.** A manager (permission `CLUB_SETUP_EDIT` for now; a gallery permission can be split out later) can delete any photo of the club. An uploader can delete **their own** photo. **Decided:** yes, an uploader can delete their own photo.
3. **Photos only.** JPEG and PNG. The browser makes the sizes (rule 4), so the server needs no image library, and a phone's rotation (EXIF) is applied correctly.
4. **Sizes.** The browser resizes before sending (which also keeps uploads small on tournament signal): a **medium** copy (longest side 1280 px, JPEG) and a **thumbnail** (320 px, JPEG). The original is not kept. The server accepts a pair only when both decode as images, the medium is at most 2 MB and the thumbnail at most 200 KB.
5. **Per upload:** up to **10 photos**, one caption and one set of tags for the whole batch. The browser sends them **one request per photo** (so each shows its own progress, a failed one can be resent, and a request stays inside the 5 MB upload limit). A person can add at most **60 photos a day** (a simple guard against abuse).
6. **Tags:** optional, any mix of one **league**, one **team**, and players, all of the club. **A manager** picks up to 5 players of the club. **In the Player Hub** the choices are the league and teams of the held player (from the Hub's own leagues list) and a **Tag {first name}** switch for the held player (the Hub never lists the club's other players). The photos of a tag are found by filtering on it. An untagged photo shows under All. **Decided:** no tag is required.
7. **Visible at once.** No approval in this version.
8. **Juniors.** A tagged player's name shows on the photo and junior photos are not treated differently. The owner will set junior rules after the tournament, when junior rollouts start (**Decided** 2026-11-16). The gallery is for signed-in club members only.
9. **Pagination.** Lists return a page of 24 (maximum 48); the carousel returns at most 12. The client never asks for everything. Thumbnails load lazily and carry `Cache-Control` (the files are immutable, UUID names).

## Data Model Changes
Migration `071-photo-gallery.sql` (never edit an applied migration):
- `gallery_image`: `id uuid PK`, `club_id uuid NOT NULL`, `uploaded_by_person_id uuid NOT NULL`, `uploaded_at timestamptz NOT NULL`, `caption varchar(200)` null, `medium_url varchar(255) NOT NULL`, `thumb_url varchar(255) NOT NULL`, `status varchar(20) NOT NULL DEFAULT 'PUBLISHED'`. Index `(club_id, status, uploaded_at DESC)`.
- `gallery_image_tag`: `image_id uuid NOT NULL` (FK, `ON DELETE CASCADE`), `tag_type varchar(10) NOT NULL` (`LEAGUE`, `TEAM`, `PLAYER`), `tag_id uuid NOT NULL`. a surrogate `id uuid` primary key with a unique constraint on `(image_id, tag_type, tag_id)`; index `(tag_type, tag_id)`.
No change to existing tables. Deleting a photo deletes its two files from the media folder (`MediaService` gains `delete(url)`).

## API Contract
| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/me/players/{playerKey}/gallery?page&size&q&leagueId&teamId&playerId` | held player | A page of thumbnails, newest first. `q` matches the caption or the name of a tagged league, team or player (case-insensitive). |
| `GET /api/v1/me/players/{playerKey}/gallery/latest?limit=12` | held player | The carousel: the latest photos (medium URLs), at most 12. |
| `GET /api/v1/me/players/{playerKey}/gallery/filters` | held player | The leagues, teams and players at least one photo is tagged to, for the filter selects. |
| `POST /api/v1/me/players/{playerKey}/gallery` | held player | Add one photo (multipart: `medium`, `thumb`, `caption`, `leagueId`, `teamId`, `tagMyPlayer`). `201` with the new photo. |
| `DELETE /api/v1/me/players/{playerKey}/gallery/{imageId}` | held player | Delete your own photo. `404` for another person's. |
| `GET /api/v1/manage/clubs/{clubId}/gallery?page&size&q&leagueId&teamId&playerId` | manager | The same page for the Gallery manager page, with the uploader's name. |
| `GET /api/v1/manage/clubs/{clubId}/gallery/filters` | manager | The tagged leagues, teams and players. |
| `POST /api/v1/manage/clubs/{clubId}/gallery` | manager (`CLUB_SETUP_EDIT`) | Add one photo (multipart as above, with `playerId` repeated for up to 5 players). |
| `DELETE /api/v1/manage/clubs/{clubId}/gallery/{imageId}` | manager (`CLUB_SETUP_EDIT`) | Delete any photo of the club. |

Responses are `Cache-Control: private, no-store` for lists (they change) and the image files are served from `/media` as today. Problems follow the existing error shape (`400` bad image or too many files, `404` not found or another club's tag, `429` over the daily limit, its own `GalleryDailyLimitException`). Add the paths and schemas to `backend/openapi/openapi.yaml` by hand.

## UI Requirements
Mockup: `docs/mockups/photo-gallery-mockup.html`.
- **Player Hub, Gallery** (the existing Gallery item (menu group Media, renamed from Updates), no longer Soon; page `.../media/gallery`): the **carousel** (big photo, arrows, dots, loops, swipe on a phone, caption and tags under it); the **search box** and filters **League, Team, Player** (remembered per club with `useRememberedState`); a grid of **small thumbnails** (24 a page, **Load More**); a thumbnail opens the photo large with Previous and Next across the loaded page. An **Add Photos** button opens the upload dialog.
- **Upload dialog:** pick up to 10 photos (camera or library), a small preview strip, Caption, League, Team and Players pickers, **Upload**. Progress per photo; a failed photo can be retried.
- **Manager page Gallery** (`/manage/gallery`, under the Club group in the side menu): filter toolbar (search, League, Team, Player), thumbnail cards with the uploader and date, a **Delete** icon on each card with a confirm ("Delete this photo? It is removed for everyone."), **Add Photos**.
- Shared components only (`ListToolbar`, `Button`, `ConfirmDialog`, `EmptyState`); no raw MUI `Button`; Title Case; no em dashes. The carousel and thumbnail grid are new, hub-local components.

## Test Plan
- **Backend unit:** rules 1 to 7 (tag belongs to the club, daily limit, file checks, own-photo delete versus manager delete), search matching, files removed on delete.
- **Backend integration (Testcontainers):** upload, list with filters and paging, latest cap, delete, another club's data never returned.
- **Frontend (Vitest):** carousel loops and respects the cap, search and filters send the right params, Load More asks for the next page only, upload dialog resizes and limits to 10, manager delete confirms.
- **Manual (owner):** upload from a phone, check rotation, delete as manager.

## Acceptance Criteria
- A parent can upload up to 10 photos, tag them to a league, a team and players, and see them in the carousel and the grid at once.
- A manager can upload and delete any photo; an uploader can delete only their own.
- The grid never requests more than one page; the carousel shows at most 12, newest first, and loops.
- Searching "Delta" finds photos tagged to the team Delta CC; filtering by player shows only that player's photos.
- A photo of another club never appears; a signed-out visitor cannot see or fetch the list.

## Rollout Notes
One migration (071), no new permission (the manager adds and deletes with `CLUB_SETUP_EDIT`); the Hub's Media > Gallery item and the manager's Club > Gallery item already existed as placeholders and are now real pages. Ship before the tournament; the approval rules and tag editing come after. The `status` column is the hook for approval later.
