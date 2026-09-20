# 039 — Team Sheet WhatsApp Text

**Depends on:** `030-team-sheet-communication.md` (`TeamSheetCommunicationDialog`, `TeamSheetSide`, the "Communicate Team Sheet" action this spec's option lives inside — none redefined here), `031-jersey-numbers.md` (`TeamSquadMember.jerseyNumber`/`SquadMember.squadJerseyNumber` — reused for the same "#N" prefix the PDF already prints), `029-league-management.md` (`Match`, `MatchSide`, `MatchSidePlayer.role`, `TeamSquadMember` — every entity this spec reads from, none redefined here), `032-match-availability-polls.md` (`PollShareDialog` — the editable-text-plus-Regenerate shape this spec's WhatsApp option reuses, not a new pattern).
**Status:** draft.

## Problem & Goals

`030` shipped "Print as PDF" as the first, and only wired, option in the "Communicate Team Sheet" dialog and deliberately left "WhatsApp" and "Facebook" as visible-but-disabled "Coming soon" rows — real future work, explicitly deferred rather than forgotten (`030`'s Non-goals: *"Legacy's `buildWhatsAppText` (`TeamsheetTemplatesDialog.tsx`) is real prior art but not built here — deferred, tracked against this spec (`030`) for `docs/roadmap.md` to index."*). The legacy Cricket Legend app (`/Users/jaco/Development/cricketlegend`) solved this already: `TeamsheetTemplatesDialog.tsx`'s `buildWhatsAppText`/`buildTeamWhatsAppLines`/`getRoleText` produce a WhatsApp-formatted (`*bold*`/`_italic_`) plain-text team sheet with emoji role indicators per player (🏏 bat, 🔴 bowl, 🏏🔴 all-rounder, 🧤 wicketkeeper, combined per player) plus a captain callout, twelfth-man line, and a legend explaining the emoji key.

This spec wires up that second option — a club admin can now generate that same style of text from this codebase's own real match data and copy it into WhatsApp (or anywhere else) themselves.

**A material simplification over legacy, not a straight port:** legacy has no persisted per-side player role, so `getEffectiveRole`/`deriveRoleFromProfile` *infer* BATSMAN/BOWLER/ALL_ROUNDER from a player's standing bowling/batting-position profile fields, with a per-`MatchSide` override map layered on top. This codebase doesn't need any of that — `029` already gives every `MatchSidePlayer` a real, persisted `role: PlayingRole` (`BATSMAN | BOWLER | ALL_ROUNDER`, `com.cricketlegend.domain.PlayingRole` backend-side, `MatchSidePlayer.role` on the frontend, set directly in the Playing XI builder) with no derivation and no override layer to reimplement. Unlike `030`'s own shirt-number gap, there is no data gap here to work around.

**Goals**
- The "WhatsApp" row in `TeamSheetCommunicationDialog` becomes a real, selectable option alongside "Print as PDF" — no longer a disabled "Coming soon" placeholder.
- Selecting it generates a WhatsApp-formatted team-sheet text for the chosen team scope (Home / Away / Both Teams — the same scope concept `030` already built), using each player's real, persisted `MatchSidePlayer.role` and `MatchSide.wicketKeeperPlayerId`/`captainPlayerId`/`twelfthManPlayerId` for the emoji/callout logic, and each squad member's `squadJerseyNumber` for the same "#N" prefix the PDF already prints (`031`).
- The generated text is shown in an editable, regenerable text area — the same `PollShareDialog` (`032`) shape this spec started from — plus a one-click "Copy to Clipboard" action so the admin doesn't have to select the text by hand before pasting into WhatsApp. **This is a deliberate, explicit departure from `032`'s own "no copy automation" precedent** (see the Non-goals note below for why), not an oversight.
- "Facebook" stays exactly as `030` left it — a visibly-present, disabled "Coming soon" row. Not built here.

## Non-goals

- **Facebook text template.** Legacy's `buildFacebookText` is the same kind of real prior art `030` already flagged — still deferred, still tracked against `030`/this spec for `docs/roadmap.md` to index. This spec touches nothing about the Facebook row beyond leaving it exactly as `030` built it.
- **Image export.** Unchanged from `030`'s own Non-goals — still deferred, not a natural extension of this spec's text-only work.
- **Any actual WhatsApp send/share integration** (e.g. a `https://wa.me/...` deep link, the Web Share API, or posting via a WhatsApp Business API). Matching `032`'s own established posture for exactly this kind of dialog, this spec produces plain text the admin copies and pastes themselves — nothing here opens WhatsApp, picks a contact, or sends anything on the admin's behalf. A `wa.me` deep link is real, easy future scope if a future spec wants it, not decided here.
- **Match logistics fields legacy's template includes but this codebase's `Match` doesn't have.** Legacy's `buildWhatsAppText` prints arrival time, toss time, scheduled start time, umpire name, tournament name, and a Google Maps link — none of which exist on this codebase's `Match` (`ui/src/api/matchApi.ts`: only `matchDate`, `venue`, `leagueId`, `seasonId`). This is a genuine, checked-for data gap, not a silent omission: this spec's text uses exactly the same logistics fields `030`'s own PDF subtitle already surfaces (date, venue, league/season name, via `matchFields()`) and nothing more. Adding arrival time/toss time/umpire/maps-link fields to `Match` is real future scope for whichever spec actually wants richer matchday logistics — not decided or half-built here.
- **A per-side role override independent of `MatchSidePlayer.role`.** Legacy's override map (`side.playerRoles`) existed only because legacy had no persisted per-side role to begin with — it was the override *and* the only source of truth once set. This codebase's `MatchSidePlayer.role` already is that source of truth, set once per side during XI selection (`029`) and editable there (`PUT .../players/{playerProfileId}`) — this spec adds no second place to set or override it.
- ~~**Copy-to-clipboard automation (`navigator.clipboard.writeText`).**~~ **Reversed during build, before this spec shipped — no longer a Non-goal.** The draft originally matched `032`'s `PollShareDialog` precedent ("no send/copy automation beyond a selectable/editable text field") and left this out. Real product feedback during implementation was explicit: a one-click "Copy to Clipboard" button is a genuinely useful piece of this specific template (a multi-line, emoji-formatted message is far more tedious to select by hand than `PollShareDialog`'s short invite link), so it's now in scope — see UI Requirements' "Copy to Clipboard" button. This is a decision scoped to *this* dialog's WhatsApp option only; it doesn't retroactively change `PollShareDialog`'s own behaviour or establish a new blanket rule for every text-sharing dialog in this codebase — a future spec that wants the same for `PollShareDialog` makes that call separately, on its own merits.
- **Any change to `Match`/`MatchSide`/`MatchSidePlayer`/`TeamSquadMember`'s schema, or any new/changed backend endpoint.** Same posture as `030` — this is a UI-plus-client-side-utility spec, reading data already served by existing endpoints.
- **Changing how "Print as PDF" behaves or looks.** `teamSheetPdf.ts` and the Print flow are untouched — this spec is additive to the dialog's option list, not a rework of the option already wired.

## User Stories

- As a club admin, from a match's "Communicate Team Sheet" dialog, I can select "WhatsApp" (alongside "Print as PDF") and a team scope, and get a ready-to-copy, WhatsApp-formatted team sheet with emoji role indicators for each player.
- As a club admin, the generated text calls out the captain (`⭐`/`(C)`) and wicketkeeper (`🧤`) inline per player, shows a distinct twelfth-man line, and ends with a short legend explaining what each emoji means — so a teammate reading the pasted message doesn't need to guess.
- As a club admin, I can't select a single side's WhatsApp text ("Home" or "Away" specifically) when that side has nothing printable — the same disabled-scope rule `030` already built for PDF applies identically here, since it's the same underlying "is this side printable" check, not a second one.
- As a club admin, if I select "Both Teams" and one side isn't ready yet, that side's section reads "Team not yet announced" rather than being silently skipped — matching the PDF's own graceful-degradation behaviour.
- As a club admin, I can edit the generated text before copying it (e.g. to add a personal note) and regenerate it back to the original if I change my mind — the same `PollShareDialog` shape already used elsewhere in this codebase.
- As a club admin, I can click "Copy to Clipboard" to copy the (possibly edited) text in one action, ready to paste straight into WhatsApp, instead of manually selecting the text area's contents.
- As a club admin using a screen reader or a 375px viewport, the WhatsApp option, its scope toggle, its text area, its Regenerate control, and its Copy to Clipboard action are all keyboard-reachable and usable without hover-only or drag interaction.

## Data Model Changes

None. This spec adds no entity, field, or migration — it reads exactly the same already-persisted data `030`'s PDF util reads (`MatchSide.players[].role`, `.captainPlayerId`, `.wicketKeeperPlayerId`, `.twelfthManPlayerId`, and `TeamSquadMember`/`SquadMember.squadJerseyNumber` per `031`) and renders it as plain text instead of a PDF.

## API Contract

**No new or changed endpoint.** Every data need is already met by the same endpoints `030` lists in its own API Contract table (`GET .../matches/{matchId}/sides`, `GET .../teams/{teamId}/seasons/{seasonId}/squad`, `GET .../teams`) — this spec's dialog reuses `MatchCard`'s already-fetched `teamSheetSides`/`subtitle`, exactly as the existing "Print as PDF" flow does, with no new query added anywhere.

## UI Requirements

**`ui/src/utils/teamSheetWhatsAppText.ts`** (new util module — plain TypeScript, no Storybook story, own Vitest unit test per the Test Plan, mirroring `teamSheetPdf.ts`'s own module shape) — ported from legacy's `buildWhatsAppText`/`buildTeamWhatsAppLines`/`getRoleText`, adapted to this repo's real `Match`/`TeamSheetSide`/`PlayingRole` shapes and reusing `resolveRoster`-equivalent logic rather than a second, drifting copy of it:

- `getRoleEmoji(role: PlayingRole, isWicketKeeper: boolean): string` — the direct, no-derivation port of legacy's `getRoleText` table, minus the `getEffectiveRole` inference step this codebase doesn't need:

  | Role | Not WK | WK |
  |---|---|---|
  | `BATSMAN` | 🏏 | 🏏🧤 |
  | `BOWLER` | 🔴 | 🔴🧤 |
  | `ALL_ROUNDER` | 🏏🔴 | 🏏🔴🧤 |

- `generateTeamSheetWhatsAppText(match: Match, sides: TeamSheetSide[], subtitle: string): string` — plain, synchronous (no image loading, unlike the PDF util — nothing here needs `fetch`/`FileReader`), builds:
  - A header line: `🏏 *<home vs away>*` (joined `teamName`s, in the order given by `sides` — same convention `generateTeamSheetPdf`'s own title line already uses).
  - A logistics line built from `subtitle` (the same already-joined date/venue/league-season string `MatchCard` computes via `matchFields()` and already passes to `generateTeamSheetPdf` today) — reused as-is, not re-derived a second way from `Match`'s raw fields.
  - One section per side in scope, blank-line separated:
    - `*<TeamName> — Playing XI*`
    - `⭐ Captain: <name>` when a captain is set.
    - One line per roster entry (batting order, per `resolveRoster`'s existing sort — this spec's util takes the same `TeamSheetSide` shape and applies the same battingOrder sort `teamSheetPdf.ts` already does, so both utils agree on ordering without importing from each other): `<roleEmoji> <position>. #<squadJerseyNumber> <name>` (jersey number prefix omitted when unset, matching the PDF's own "#N" convention) with a bolded `*(C)*` suffix for the captain.
    - `_12th Man: <name>_` when set.
    - `_Team not yet announced_` in place of the roster when the side has zero players (mirrors `resolveRoster` returning an empty array — same "team not yet announced" copy the PDF already uses, in italics rather than the PDF's own styled placeholder row).
  - A trailing legend line: `🏏 = Bat  |  🔴 = Bowl  |  🏏🔴 = All-Rounder  |  🧤 = WK`.
  - Returns the assembled string (not a Promise, not an object-URL — this is plain text the dialog puts straight into a controlled `Input`).

**`ui/src/components/TeamSheetCommunicationDialog/`** (existing, edited) — becomes a real two-option choice instead of a single wired option with disabled placeholders below it:

- The option list's "Print as PDF" and "WhatsApp" rows both become real, selectable controls (`ListItemButton`, replacing the current plain `ListItem` — the existing code comment explaining why a `ListItemButton` was skipped no longer holds once a second option is genuinely selectable) driving a new `selectedOption: 'pdf' | 'whatsapp'` local state, defaulting to `'pdf'` so today's existing single-option behaviour is the unchanged default on open. "Facebook" stays exactly as-is: a disabled row with its `Chip label="Coming soon"`, not selectable.
- The **team scope** `ToggleButtonGroup` (`both`/`home`/`away`) is shared, unchanged logic, between both options — `isSidePrintable`/`bothPrintable`/`homePrintable`/`awayPrintable`/`defaultScope` are exactly `030`'s own computation, reused as-is regardless of which option is selected, since "is this side printable" is a property of the match's data, not of the output format.
- When `selectedOption === 'whatsapp'`, the area below the scope toggle that currently shows nothing extra (PDF has no preview) instead shows an `Input` (multiline, `minRows={10}`, same component `PollShareDialog` already uses) pre-filled by calling `generateTeamSheetWhatsAppText(match, sides-in-scope, subtitle)` whenever the dialog opens, the selected option changes to `'whatsapp'`, or the scope changes — plus a small "Regenerate" `Button` (ghost, `RefreshOutlinedIcon`, identical to `PollShareDialog`'s own) that discards any manual edits and rebuilds from current data. Editing the text is a local, uncontrolled-from-props edit exactly like `PollShareDialog.text` — this spec adds no "has this been edited" tracking beyond what `PollShareDialog` already doesn't have either.
- The dialog's primary action button is option-aware: `selectedOption === 'pdf'` keeps today's exact "Print `<scope>`" button calling `onPrint`; `selectedOption === 'whatsapp'` becomes a **"Copy to Clipboard"** button (`ContentCopyOutlinedIcon`), mirroring `handlePrint`'s own shape rather than inventing a new one — `navigator.clipboard.writeText(whatsappText)`, and on success `onClose()` (matching the Print flow's own "succeed → close" behaviour); on failure (e.g. an insecure context or a denied clipboard permission), a retryable inline error ("Couldn't copy to clipboard. Please try again.") is shown and the dialog stays open, exactly like a rejected `onPrint` already does. Disabled under the same condition the scope toggle itself is replaced by the "neither side printable" message (`!(bothPrintable || homePrintable || awayPrintable)`), so there's never a live Copy button with nothing meaningful to copy. See the Non-goals section for why this departs from `032`'s `PollShareDialog` precedent.
- `props.onPrint` is unchanged. No new prop is needed for the WhatsApp path since text generation is synchronous and local to the dialog (unlike PDF generation, which needs the caller-owned `onPrint` because it's async and can throw) — the dialog itself calls `generateTeamSheetWhatsAppText` directly, given the same `match`/`sides` props it already receives.
- The "Add players to at least one side's Playing XI..." inline message (neither side printable) and its accompanying "Print action disabled" behaviour apply identically when `selectedOption === 'whatsapp'` — same underlying `bothPrintable`/`homePrintable`/`awayPrintable` computation, one inline message regardless of which option is selected.
- Mobile-first: the added `Input`/Regenerate row stacks full-width at 375px, matching the rest of the dialog's existing layout — no new horizontal-scroll risk from a wide text area.

**`ui/src/pages/manage/MatchList.tsx`** — no prop changes to `TeamSheetCommunicationDialog`'s usage (`match`/`sides`/`sidesLoading`/`onPrint` stay exactly as `030` wired them); the dialog computes WhatsApp text itself from the props it already receives.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `teamSheetWhatsAppText.test.ts` — given a fabricated `Match`/`TeamSheetSide` fixture set (mirroring `teamSheetPdf.test.ts`'s own fixtures so both tests agree on what "the same data" looks like): correct emoji per `getRoleEmoji`'s table (all six role/WK combinations), header/logistics line content, one section per side in scope (`both`/`home`/`away`), batting-order line ordering, captain/twelfth-man lines, jersey-number prefix present/absent, the "Team not yet announced" line for a side with zero players, and the trailing legend line always present. |
| Component | `TeamSheetCommunicationDialog.test.tsx` (extended) — selecting "WhatsApp" reveals the `Input` pre-filled with `generateTeamSheetWhatsAppText`'s output for the current scope; changing scope regenerates the text; "Regenerate" discards a manual edit and rebuilds from current data; the scope-disable rules (no real `Team`/no players) apply identically under the WhatsApp option; selecting "Facebook" remains impossible (still disabled); "Copy to Clipboard" writes the textbox's current value via `navigator.clipboard.writeText` and closes the dialog without calling `onPrint`; a rejected clipboard write surfaces a retryable inline error and keeps the dialog open. |
| Contract | None — no endpoint changed. |
| End-to-end | Extends `030`'s own existing golden-path coverage rather than adding a new, separate flow: after building a side's Playing XI, open "Communicate Team Sheet," select "WhatsApp" with `both` scope, and assert the text area contains the expected role emoji and team names. Not wired into CI, same precedent as every prior `/manage` spec's own e2e coverage. |

## Acceptance Criteria

- A club admin can select "WhatsApp" in the "Communicate Team Sheet" dialog and see a generated, WhatsApp-formatted team sheet for the chosen scope, with per-player role emoji, captain/wicketkeeper/twelfth-man callouts, and a legend explaining the emoji.
- The WhatsApp option's team-scope disable rules (a free-text-opponent or zero-player side can't be the sole scope) are identical to the PDF option's own rules — no second, drifting implementation of "is this side printable."
- The admin can edit the generated text and regenerate it back to the freshly-computed version at any time before closing the dialog.
- The admin can click "Copy to Clipboard" to copy the current text in one action and close the dialog; a failed copy leaves the dialog open with a retryable inline error rather than failing silently.
- "Print as PDF" continues to behave exactly as `030` shipped it — unaffected by this spec's addition.
- "Facebook" remains a visibly-present, disabled "Coming soon" row — untouched by this spec.
- No new backend endpoint exists for this feature — the text is generated entirely client-side from data already served by `029`'s and `031`'s existing endpoints.

## Rollout Notes

- **This spec ships as its own small PR on top of `030` and `031`** (both already merged) — a frontend-only addition, no backend changes, no new dependency (no `jspdf`-equivalent needed; this is plain string building).
- **The match-logistics data gap (toss time, arrival time, umpire, tournament name, maps link) is a known, deliberate limitation, not an oversight** — flagged in this spec's own Non-goals specifically so `docs/roadmap.md` can pick it up as a concrete, scoped future item if a future spec wants to add those fields to `Match` for richer matchday communications (this would benefit the PDF's subtitle too, not just this spec's text).
- **Facebook text and image export remain the two still-deferred communication channels from `030`** — this spec resolves exactly one of `030`'s three deferred items (WhatsApp), not all three. Track the remaining two individually against `030`/this spec in `docs/roadmap.md`, not folded into one vague "more sharing options" bullet.
- **A human should confirm `docs/roadmap.md` is updated** once this ships: mark the WhatsApp item resolved (cross-referenced to this spec's number) and keep Facebook/image-export listed as still-open, per this repo's existing "each spec indexes its own deferred items" convention.
