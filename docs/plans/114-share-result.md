# Plan 114: Share a published result

Implements `docs/specs/114-share-result.md` (draft, mockups approved 2026-10-17). Plan only; the spec is not redefined.

## Context

Managers cannot tell anyone about a published result except by retyping it. The spec adds one Share dialog (PDF, Image, TV, WhatsApp, Facebook), generated in the browser, a First names as initials privacy option (code name Initials only) (locked on for junior leagues), logo and footer options, and a shared "Send in WhatsApp" action that also upgrades the four existing WhatsApp dialogs. Only backend change: a per-club `share_initials_only` setting. Branch `feature/114-share-result` (spec already pushed); rebase onto master after PR #127 merges.

## Things the spec says that the code does not support (human decision needed)

1. **Results card has no Delete and `RecordCard` has no icon-only footer button.** `ResultCard` footer buttons are labelled View, Edit, Publish (`RecordCardFooterButton`: label, icon, onClick, disabled, title). Proposal: add a **Share** footer button in that same style (disabled on a draft with the reason as its title, the pattern a disabled footer button already uses), instead of an icon beside Delete. This changes the spec's wording "icon button beside Delete".
2. **A section-scoped manager (035) cannot read club profile, leagues, sections or club sponsors** (all `canAdministerClub`; only team sponsors for their own section are readable). This is wider than Open question 5 (club logo only): the **junior rule** and the **league logo** also depend on those reads. Proposal, within the spec: no new backend read; for such a manager the junior check fails safe (the switch locked on, reason "Could not check the league, so first names as initials is on"), the club and league logos are simply omitted, sponsors come from the team sponsor read. If you would rather give them a small read-only share-context endpoint, say so and I add it as a backend step.
3. **`ShellHeader` does not call `withClubBranding`** (it reads `palette.primary` through `sx`). Templates will read `useTheme().palette.primary` (main, dark, contrastText), which is what the spec's data check already says; only the sentence about "the same derivation ShellHeader uses" is inaccurate.
4. **Result page actions grid** is 3 columns (`repeat(3, auto)`); Share makes it 4 on `sm` and up.
5. **`openapi.yaml`** has no contract-diff test or generation step; it is hand-edited (as in 113).

## Order of work (slices; each is checked by you in the browser before the next)

Per your working rule, builders build first; tests, standards review and docs run after you check the function.

### Slice 0: prerequisites
- Merge PR #127 (CI was still running), rebase `feature/114-share-result` on master.
- No new libraries (jsPDF, Canvas2D already approved).

### Slice 1: Send in WhatsApp everywhere (frontend-builder)
Quick win, independent of results. 
- Create `components/WhatsAppSendActions/` (tsx, test, stories, index): props `text`, optional `file`/`filename`, `copyLabel`; renders **Send in WhatsApp** (`window.open('https://wa.me/?text=' + encodeURIComponent(text))`), **Share** (only when `navigator.share`, and `canShare({files})` when a file is given), **Copy message** (via `hooks/useCopyToClipboard`). Constant `WHATSAPP_LINK_MAX_CHARS = 1800`; above it Send is replaced by Copy with a stated reason. Link stays inside the text (no separate `url`).
- Pure `utils/whatsappLink.ts` (build and length guard).
- Prerequisite refactor: `TeamSheetCommunicationDialog` and `PlayingConditionsShareDialog` call `navigator.clipboard` directly; move them onto `useCopyToClipboard` while slotting the component in. `PollShareDialog` and `SectionAvailabilityShareDialog` already use the hook: replace their `Copy message` button, keeping the button name and the status region so their tests stay valid (update the two dialogs' tests where button sets change). Confirm the exact JSX of the poll and availability dialogs when editing (not fully read yet).
- Use `@mui/icons-material` WhatsApp icon (no brand icon exists; a 32 px+ brand icon is optional later).

### Slice 2: backend setting (backend-builder, parallel with Slice 1)
- `db/changelog/v1/051-club-share-initials-only.sql`: `ALTER TABLE club_profile ADD COLUMN share_initials_only BOOLEAN NOT NULL DEFAULT false;` with the `-- docs/specs/114...` comment; add the include to `db.changelog-master.xml`. (051 confirmed next.)
- `domain/ClubProfile` gains the field (not added to `UpdateClubProfileRequest`; the profile PUT stays a full replace and must not reset it: `ClubProfileServiceImpl.upsert` must leave it untouched).
- New `dto/ShareSettingsDto` (record `initialsOnlyDefault`) and request DTO; `ClubShareSettingsController` (`GET`/`PUT /api/v1/manage/clubs/{clubId}/share-settings`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")` so any club manager incl. section-scoped can change it, as the spec says); `ClubShareSettingsService` + `Impl` (get defaults to false when no profile row; put creates the row lazily; `@Transactional(readOnly = true)` on get, `@Transactional` on put); MapStruct mapper if needed.
- Hand-edit `backend/openapi/openapi.yaml` (additions only). Verify in a scratch rsync copy, never in `backend/` (live app).
- Tests (test-writer after approval): migration applies, get default, put round trip, other club's manager 403, profile PUT does not reset the value, service unit test.

### Slice 3: pure helpers (frontend-builder), `ui/src/utils/share/`
- `shareName.ts`: full name (off) and first initial plus surname (on), particles kept in the surname (the "M. N." form was dropped); built on `scorecardPersonName` and `splitGuestName` (particle aware); not `initialsFromName` or `usePlayerNameMode`.
- `isJuniorMatch.ts` with `JUNIOR_MAX_AGE = 18`: inputs `League` (`maxAge`), flat `Section[]` and `Team.sectionId`; ancestors via `utils/sectionPath`; rules in the spec's order; unavailable data returns junior.
- `shareResultData.ts`: assembles one `ShareResultModel` from `MatchResult`, `Scorecard`, match, teams, our-team filter and name form (`resultLine`, `inningsScoreText`, `inningsFor` reused; "ours" = `ResultPlayer.opposition === false`; player of the match resolved via `awards.resultPlayerId` against `players`).
- `resultTextWhatsApp.ts`, `resultTextFacebook.ts` (threshold table for Celebration in one place), `shareChoices.ts` (on `hooks/usePersistedListFilters`, key `share:choices:<clubId>`), `useShareCapability.ts`, `logoLayout.ts` (fixed-slot arithmetic for club, league, team, sponsor logos; `MAX_SHARE_SPONSORS = 4`).

### Slice 4: dialog shell, entry points, WhatsApp and Facebook screens (frontend-builder)
- `api/shareSettingsApi.ts`, `hooks/useShareSettings.ts` (React Query), `hooks/useShareResultData.ts` (queries on dialog open only: `getScorecard` (the page has none; `ResultBody` loads its own), leagues, sections, sponsors, team sponsors, club profile logo/website, each tolerant of 403).
- `components/ShareResultDialog`, `ShareFormatScreen`, `SharePreviewStage` (four-file anatomy each). Dialog: `Dialog fullScreen={phone}` per `useMediaQuery(theme.breakpoints.down('sm'))`; tiles via `TileChoiceGroup`; control strip via `CompactToggleGroup` and `CompactSwitch`; sticky bottom actions on phone; First names as initials switch (code name Initials only) with lock, collision note, club default switch ("Make first names as initials the club default"), edit-replace confirm.
- WhatsApp and Facebook screens (text, editable text areas, Attach image, Emoji, Hashtags, sponsor mention), using `WhatsAppSendActions` from Slice 1.
- Entry points: `ResultDetailPage` Share button in the actions grid (draft: disabled plus visible reason line like `#unpublish-to-edit-reason`); `ResultCard` footer Share button (see decision 1).

### Slice 5: Image and TV (frontend-builder)
- `utils/share/resultImage.ts`: one Canvas2D drawing function with size and template parameters (Square 1080, Portrait 4:5, Story 9:16, TV 1920x1080), copying the helper pattern of `leagueSchedulePoster.ts` (`loadImageElement`, `FONT_STACK`, gradients, `drawAvatar` initial tile). Templates: Club green / Night / Daylight; Broadcast / Club colour / Light; colours from `theme.palette.primary`, fixed template colours declared once at the top of the file. Logos and footer per `logoLayout.ts`; web address line only when the club has a website.
- Image and TV screens; Share vs Download by `canShare({files})`; Copy image where `ClipboardItem` exists.

### Slice 6: PDF (frontend-builder)
- `utils/share/resultPdf.ts` mirroring `teamSheetPdf.ts` (jsPDF, A4, `loadImageBase64`, page breaks, "Page n of m" kept, footer credit under the Footer line switch). Templates Club colours / Classic / Compact. File names and PDF metadata contain team names only in every case. Preview by rendering page 1 to an image from the same generator.

### Slice 7: tests, review, docs, PR (test-writer, standards-reviewer, then me)
- After you check Slices 1 to 6: test-writer fills the spec's Test Plan (shareName, isJuniorMatch, shareResultData, text builders, shareChoices, logoLayout, whatsappLink, `WhatsAppSendActions`, privacy test across all formats using mocked jsPDF and Canvas2D patterns from `teamSheetPdf.test.ts` and `leagueSchedulePoster.test.ts`, locked-state test, dialog component tests, Storybook stories at 375/768/1280, updated tests of the four dialogs, one Playwright golden path plus a junior test written but unrunnable without Keycloak).
- standards-reviewer pass; docs: `docs/roadmap.md` row 114, `docs/standards/frontend.md` (share names only through `shareName`, juniors only through `isJuniorMatch`), `design-system.md` (new components), backend.md (share-settings note).
- Commit per slice (Conventional Commits), push, open PR; you confirm merge.

## Critical files
Backend: `domain/ClubProfile.java`, `service/impl/ClubProfileServiceImpl.java` (do not reset the flag), new `ClubShareSettingsController/Service/Impl/Dto`, `db/changelog/v1/051-*.sql`, `db.changelog-master.xml`, `backend/openapi/openapi.yaml`.
Frontend: `components/{TeamSheetCommunicationDialog,PlayingConditionsShareDialog,PollShareDialog,SectionAvailabilityShareDialog}`, `pages/manage/results/{ResultDetailPage,ResultCard}.tsx`, new `components/{WhatsAppSendActions,ShareResultDialog,ShareFormatScreen,SharePreviewStage}`, new `utils/share/*`, `api/shareSettingsApi.ts`, hooks `useShareSettings`, `useShareResultData`.

## Reuse
`TileChoiceGroup`, `CompactToggleGroup`, `CompactSwitch`, `BottomSheet`, `usePersistedListFilters`, `useCopyToClipboard`, `scorecardPersonName`, `splitGuestName`, `sectionPath`, `resultLine`/`inningsScoreText`, `teamSheetPdf.ts` and `leagueSchedulePoster.ts` helper patterns, `getScorecard`, `listLeagues`, `listSections`, `listSponsors`, `listTeamSponsors`.

## Verification
- Backend: full suite in a scratch rsync copy (never under the live backend).
- UI: `tsc -b`, lint, vitest folder by folder with `--no-file-parallelism`; storybook cannot run from a worktree, so run it from the main checkout.
- Manual by you after each slice: Slice 1 (Send in WhatsApp in all four dialogs on phone and desktop), Slice 4 onward on a published result (each format, First names as initials, junior lock, logos, footer line), draft result shows Share disabled with reason.
- Playwright is not runnable here (needs Keycloak); written but marked untested in the PR.
