# 154: Team affiliation and league host (for the Poster team sheet)

**Depends on:** `153-printable-team-sheet.md` (the Poster style that shows them), `026-teams.md` and `057-team-extended-profile.md` (Team profile fields), `029-league-management.md` and `095-league-edit-gold-standard.md` (League profile), `docs/standards/page-anatomy.md`.
**Status:** draft 2026-11-15. Requested by the owner while designing the Poster team sheet (mockup `docs/mockups/team-sheet-poster-mockup.html`). Decided by the owner 2026-11-15 are marked **Decided**.

## Problem & Goals
The Poster team sheet carries two pieces of identity the system does not hold: the body a team is **affiliated** to (top left of the sheet, for example Titans Veterans Cricket), and the **host** of the tournament (bottom right, for example Boland Veterans). Both are data of their own, set once and reused on every sheet, so they are fields, not typed on each print.

**Goals**
- A Team has an optional **Affiliation name** and **Affiliation logo**. **Decided.**
- A League has an optional **Host name** and **Host logo** (the tournament host; it changes from one tournament to the next, so it belongs to the League, not the club). **Decided.**
- A League also has an optional **Affiliation name** and **Affiliation logo**: the body the league belongs to (for example VCASA). The Poster prints it top right; with no affiliation logo it falls back to the league's own logo. **Decided 2026-11-15.**
- Both are editable where the other profile fields are, shown nowhere else yet, and carried to the Poster team sheet by spec 153.

## Non-goals
- Showing the affiliation or host on the Hub, the public pages, WhatsApp or other share formats (later, if wanted).
- A shared list of affiliations or hosts to pick from. Each is plain text plus a logo on the record that owns it.
- Copying the host when a league is copied for a new season (the host is per tournament; the copy leaves it empty).

## Data and API
Migration `069-affiliation-and-host.sql` (the next number; never edit an applied migration):
- `team.affiliation_name VARCHAR(120)`, `team.affiliation_logo_url VARCHAR(512)`, both nullable.
- `league.host_name VARCHAR(120)`, `league.host_logo_url VARCHAR(512)`, `league.affiliation_name VARCHAR(120)`, `league.affiliation_logo_url VARCHAR(512)`, all nullable.

Backend, added at the END of each record so existing positional constructors only gain trailing nulls:
- `Team` entity, `TeamDto`, `CreateTeamRequest`, `UpdateTeamRequest`: `affiliationName` (max 120), `affiliationLogoUrl`. `TeamServiceImpl.create` and `update` set them (a full replace: an omitted field clears it, like the other profile fields).
- `League` entity, `LeagueDto`, `CreateLeagueRequest`, `UpdateLeagueRequest`: `hostName` (max 120), `hostLogoUrl`, `affiliationName` (max 120), `affiliationLogoUrl`. `LeagueServiceImpl` create, update and `withCurrentSeasonFields` carry them; `LeagueCopyRules` does not.
- `backend/openapi/openapi.yaml` updated by hand for the four schemas.
- No new endpoint, no new permission: they are part of the existing Team and League edits (`TEAMS_EDIT`, `LEAGUES_EDIT` as those forms already require).

## UI Requirements
- **Team form** (`TeamForm`, used by `TeamFormPage`): an **Affiliation** group below the logo: a text field **Affiliation name** and a **MediaUpload** (`variant="logo"`, label "Affiliation logo (optional)"), the same control and posture as the team logo.
- **League form** (`LeagueForm`): an **Affiliation** group (name and logo) and a **Host** group (name and logo) beside the league logo.
- Types: `ui/src/api/teamApi.ts` and `ui/src/api/leagueApi.ts` gain the four optional fields.
- Follows `page-anatomy.md`; shared compact `Button`, one filled button per form, Title Case labels, no em dashes.

## Test Plan
Backend: `TeamServiceImplTest` (create and update carry both fields, an omitted field clears them), `LeagueServiceImplTest` (create and update carry the host, a copy does not), the controller integration tests still pass with the extra fields, `openapi.yaml` contract check unchanged otherwise. Frontend: `TeamForm.test.tsx` and the League form test (the fields render, a typed name and an uploaded logo are submitted, empty sends null). The Poster sheet's use of them is tested in spec 153.

## Acceptance Criteria
On a team's edit page I can set an affiliation name and logo and see them again after saving. On a league's edit page I can set a host name and logo. Clearing a field clears it. Nothing else on the site changes.

## Rollout Notes
One migration (nullable columns, no backfill), backend then UI image, then deploy. The Poster sheet (spec 153) reads these fields; with none set its affiliation and host blocks are left out.
