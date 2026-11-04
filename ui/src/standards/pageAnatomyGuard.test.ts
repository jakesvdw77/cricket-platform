import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/standards/page-anatomy.md section 5 (owner, 2026-11-04): every button on a manager page is the shared compact `Button`, and a
// segmented switch is never `fullWidth` on a desktop. A raw MUI `<Button>` is 40 px and UPPERCASE unless it carries `compactButtonSx`.
// This guard is a ratchet: the files listed in BASELINE were already non-compliant when it was written and may only be fixed, never joined.
// A new file that trips it fails the build; fix the file, do not add it to the list.

const ROOT = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx$/.test(name) && !/\.(test|stories)\.tsx$/.test(name) ? [path] : []
  })
}

// `<MuiButton ...>` tags (the alias the pages use for MUI's Button) that carry neither `compactButtonSx` nor the 'text' look of a link.
function rawButtonTags(source: string): number {
  const tags: string[] = source.match(/<MuiButton\b(?:=>|[^>])*>/g) ?? []
  // a quiet text button (a Back link) is the standard's own look, so only the filled and outlined ones count
  return tags.filter((tag) => !tag.includes('compactButtonSx') && !tag.includes('variant="text"')).length
}

const fullWidthSwitch = /<CompactToggleGroup[^>]*\sfullWidth[\s>]/

// Backlog to clean up one page at a time as each is reviewed (docs/roadmap.md); never add to it.
const BASELINE_RAW_BUTTONS: string[] = [
  "components/FilterBar/FilterBar.tsx",
  "components/MatchForm/MatchSideFields.tsx",
  "components/PlayingConditionsSummary/PlayingConditionsSummary.tsx",
  "components/PublicAvailability/AnswerForm/AnswerForm.tsx",
  "components/PublicAvailability/IdentifyForm/IdentifyForm.tsx",
  "components/PublicAvailability/RememberedPlayers/RememberedPlayers.tsx",
  "components/RecordDetailScreen/RecordDetailScreen.tsx",
  "components/SelectPlayersDialog/SelectPlayersDialog.tsx",
  "pages/manage/ClubOverviewPage.tsx",
  "pages/manage/MatchFormPage.tsx",
  "pages/manage/TeamDetailPage.tsx",
  "pages/manage/matchDetail/MatchTeamCard.tsx",
  "pages/manage/playerDetail/PlayerStatsCard.tsx",
  "pages/manage/results/ResultDetailPage.tsx",
  "pages/manage/results/steps/TeamsStep.tsx",
  "pages/manage/teamSelection/BattingOrderView.tsx",
  "pages/view/LandingPage/LandingPage.tsx",
  "pages/view/myPlayers/HubLiveScore.tsx",
]

describe('page anatomy guard: compact buttons', () => {
  const files = sourceFiles(ROOT)
  const rel = (path: string) => path.slice(ROOT.length + 1)

  it('no new file uses a raw MUI Button without compactButtonSx', () => {
    const offenders = files.filter((file) => rawButtonTags(readFileSync(file, 'utf8')) > 0).map(rel).sort()
    const fresh = offenders.filter((file) => !BASELINE_RAW_BUTTONS.includes(file))
    expect(fresh, 'use components/Button (size="compact") instead of a raw MUI Button').toEqual([])
  })

  it('every baseline file still offends, so a fixed file leaves the list', () => {
    const offenders = new Set(files.filter((file) => rawButtonTags(readFileSync(file, 'utf8')) > 0).map(rel))
    expect(BASELINE_RAW_BUTTONS.filter((file) => !offenders.has(file))).toEqual([])
  })

  it('no segmented switch is fullWidth outside the phone sheet (use fullWidthOnPhone)', () => {
    const allowed = ['components/ListViewToggle/ListViewToggle.tsx', 'components/PlayerSlotPicker/PlayerSlotPicker.tsx']
    const offenders = files.filter((file) => fullWidthSwitch.test(readFileSync(file, 'utf8'))).map(rel).filter((file) => !allowed.includes(file))
    expect(offenders).toEqual([])
  })
})
