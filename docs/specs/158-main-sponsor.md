# 158: Main sponsor of a team

**Depends on:** `027-team-profile.md` (a team's linked sponsors), `114-share-result.md` and `131-match-sharing.md` (the sponsor logos on the picture templates), `docs/standards/page-anatomy.md`.
**Status:** built 2026-11-17, awaiting the owner's review. Requested by the owner: the main sponsor of a team should always be shown first, on the team's pages and on every picture template. Option A (a main flag, not a full order) was chosen on 2026-11-17.

## Problem & Goals
A team's sponsors have no order. The team page lists them as the database returns them, and a poster draws the sponsors in the order they were ticked. The main sponsor (Porsche on the Titans Veterans) is not always first.

**Goals:** a team can mark one of its linked sponsors as its **main sponsor**. It is listed first on the team's pages and is the first logo on the posters, ahead of the club's sponsors.

## Non-goals
- A full order for the 2nd, 3rd and 4th sponsor (option B: Move Up and Move Down). Added later if needed.
- Making the main sponsor larger on a poster. Only its position changes.
- A main sponsor for the club or a league.

## Rules
1. **One main sponsor per team**, at most. Making another sponsor main clears the previous one. A sponsor can be the main sponsor of one team and an ordinary sponsor of another.
2. Only a sponsor **linked** to the team can be main. Unlinking the main sponsor leaves the team with none.
3. **Team lists:** the main sponsor first (its `main` flag is true), then the rest by name, ignoring case.
4. **Share dialogs** (result, match and squad): the sponsors offered are the teams' main sponsors, then the club's sponsors, then the teams' other sponsors, each once. Whatever is ticked is drawn **in that list's order**, never in tick order. With nothing remembered, the default is the first of the team's sponsors, so the main one. A match of two club teams offers both teams' main sponsors first. The league share keeps offering the club's sponsors (it is not about one team).

## Data and API
- Migration `072-team-sponsor-main.sql`: `team_sponsor.is_main boolean not null default false` and a partial unique index `ux_team_sponsor_main on team_sponsor (team_id) where is_main`.
- `SponsorDto` gains `main` (true only in a team's sponsor list).
- `PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/main` makes the sponsor main (204); `DELETE` on the same path clears it (204). Both need `TEAMS_EDIT` on the section; 404 when the sponsor is not linked to the team.
- `GET .../teams/{teamId}/sponsors` returns the sponsors with the main one first.

## UI
- **Edit Team, Sponsors tab:** a linked sponsor's card shows a **Main Sponsor** badge when it is the main one and has an action **Set As Main** (or **Remove As Main** on the main one), beside Unlink and Edit.
- Share dialogs list and draw sponsors in the order of rule 4. No template changes: every picture template already draws its sponsor logos in the order it is given.

## Test plan
Backend unit (order and the set and clear rules) and repository (the one-main-per-team index); UI tests for the card actions, the offered order and the list-order helper.

## Acceptance
- Marking Porsche main puts it first on the team's Sponsors tab, the team page and the first sponsor tile of a result, match and squad poster, ahead of any club sponsor, however the sponsors were ticked.
- Marking Surphics main afterwards moves Porsche down; only one card shows the badge.
