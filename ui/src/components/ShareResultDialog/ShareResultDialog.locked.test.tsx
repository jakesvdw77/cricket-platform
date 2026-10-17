import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareResultDialog } from './ShareResultDialog'
import { baseTheme } from '../../theme'
import { shareChoicesKey } from '../../utils/share/shareChoices'
import { fold, leakedGivenNames, privacyMatch, privacyResult, privacyScorecard } from '../../utils/share/sharePrivacyFixture'
import { mockCanvas } from './shareScreenTestUtils'

// docs/specs/114-share-result.md (Test Plan, "Locked-state test"): a junior-league match shows First names as initials checked
// and disabled with the visible reason, clicking changes nothing, and the output has no full given name even when the
// remembered choice and the club default are off; a non-junior match honours the remembered choice, then the club default,
// then off; a league that cannot be checked fails safe to locked.
const getShareSettings = vi.fn()
const updateShareSettings = vi.fn()
const listLeagues = vi.fn()
const listSections = vi.fn()
const getScorecard = vi.fn()

vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: (clubId: string, settings: unknown) => updateShareSettings(clubId, settings),
}))
vi.mock('../../api/matchResultApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/matchResultApi')>()),
  getScorecard: (clubId: string, matchId: string) => getScorecard(clubId, matchId),
}))
vi.mock('../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/clubApi', () => ({ getManagedClubProfile: () => Promise.resolve({ name: 'Riverside CC', logoUrl: null, website: null }) }))
vi.mock('../../api/sponsorApi', () => ({ listSponsors: () => Promise.resolve([]) }))
vi.mock('../../api/teamSponsorApi', () => ({ listTeamSponsors: () => Promise.resolve([]) }))

const team = { id: 't1', sectionId: 'sec-1', name: 'Riverside 1', logoUrl: null }
const ADULT_SECTIONS = [{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }]
const JUNIOR_REASON = 'Always on for junior leagues'
const UNAVAILABLE_REASON = 'Could not check the league, so first names as initials is on'

function renderDialog(matchOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ShareResultDialog
          open
          onClose={() => {}}
          clubId="club-1"
          match={{ ...privacyMatch, leagueId: null, ...matchOverrides } as never}
          result={privacyResult}
          teamsById={new Map([['t1', team as never]])}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

const remember = (choices: Record<string, unknown>) => localStorage.setItem(shareChoicesKey('club-1'), JSON.stringify(choices))
const stored = (): Record<string, unknown> => JSON.parse(localStorage.getItem(shareChoicesKey('club-1')) ?? '{}')

async function openWhatsApp() {
  await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
  const toggle = await screen.findByRole('checkbox', { name: 'First names as initials' })
  const box = (await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement
  return { toggle, box: () => screen.getByRole('textbox', { name: 'Message text' }) as HTMLTextAreaElement, first: box }
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  mockCanvas()
  getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
  updateShareSettings.mockImplementation((_club: string, settings: unknown) => Promise.resolve(settings))
  listLeagues.mockResolvedValue([{ id: 'league-1', name: 'Premier League', maxAge: 13 }])
  listSections.mockResolvedValue(ADULT_SECTIONS)
  getScorecard.mockResolvedValue(privacyScorecard('p1'))
})

const originalMatchMedia = window.matchMedia

// A touch device: the dialog's own useMediaQuery keeps working, only (pointer: coarse) answers yes.
function touchDevice() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('pointer: coarse'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

describe('ShareResultDialog junior lock', () => {
  it('shows the switch checked and disabled with the visible reason, and clicking it changes nothing', async () => {
    remember({ initialsOnly: false, templates: { whatsapp: 'SCORECARD' } })
    getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
    renderDialog({ leagueId: 'league-1' })

    const { toggle, box } = await openWhatsApp()
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText(JUNIOR_REASON)).toBeVisible()
    expect(toggle).toHaveAccessibleDescription(JUNIOR_REASON)
    const before = box().value

    await userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never }).click(toggle)

    expect(toggle).toBeChecked()
    expect(box().value).toBe(before)
    expect(stored().initialsOnly).toBe(false)
  })

  it('keeps every full given name out of the WhatsApp text even though the remembered choice and the club default are off', async () => {
    remember({ initialsOnly: false })
    renderDialog({ leagueId: 'league-1' })
    const { box } = await openWhatsApp()

    for (const style of ['Short', 'With top performers', 'Scorecard text']) {
      await userEvent.click(screen.getByRole('button', { name: style }))
      await waitFor(() => expect(box().value.length).toBeGreaterThan(20))
      expect(leakedGivenNames(box().value), style).toEqual([])
    }
    expect(fold(box().value)).toContain('m. naidoo')
  })

  it('keeps every full given name out of the Facebook text in all three tones', async () => {
    remember({ initialsOnly: false })
    renderDialog({ leagueId: 'league-1' })
    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    await screen.findByRole('textbox', { name: 'Post text' })

    for (const tone of ['Match report', 'Celebration', 'Brief']) {
      await userEvent.click(screen.getByRole('button', { name: tone }))
      const text = (screen.getByRole('textbox', { name: 'Post text' }) as HTMLTextAreaElement).value
      expect(text.length).toBeGreaterThan(20)
      expect(leakedGivenNames(text), tone).toEqual([])
    }
  })

  it('hands the share sheet a title, file name and text with no full given name', async () => {
    remember({ initialsOnly: false, templates: { whatsapp: 'SCORECARD' } })
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    touchDevice()
    renderDialog({ leagueId: 'league-1' })
    await openWhatsApp()

    const button = await screen.findByRole('button', { name: 'Share' })
    await userEvent.click(button)

    const arg = share.mock.calls[0][0] as { title: string; text: string; files: File[] }
    expect(arg.title).toBe('Riverside 1 v Pretoria CC')
    expect(arg.files[0].name).toBe('Riverside 1 v Pretoria CC 2026-10-17.png')
    for (const part of [arg.title, arg.text, arg.files[0].name]) expect(leakedGivenNames(part)).toEqual([])
    expect(fold(arg.text)).toContain('m. naidoo')
  })

  it('draws no full given name on the Image and TV cards, and names the share file after the teams', async () => {
    remember({ initialsOnly: false })
    const context = mockCanvas()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    renderDialog({ leagueId: 'league-1' })

    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    const button = await screen.findByRole('button', { name: 'Share' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    const arg = share.mock.calls[0][0] as { title: string; files: File[] }
    expect(arg.title).toBe('Riverside 1 v Pretoria CC')
    expect(arg.files[0].name).toBe('Riverside 1 v Pretoria CC 2026-10-17.png')

    const drawn = () => context.fillText.mock.calls.map((call) => String(call[0])).join('\n')
    expect(drawn()).toMatch(/M\. Naidoo/)
    expect(leakedGivenNames(drawn())).toEqual([])

    context.fillText.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('radio', { name: /TV summary/ }))
    await screen.findByRole('img', { name: /Match summary:/ })
    await waitFor(() => expect(context.fillText).toHaveBeenCalled())
    expect(leakedGivenNames(drawn())).toEqual([])
  })

  it('keeps the club default switch usable, with its own helper line', async () => {
    renderDialog({ leagueId: 'league-1' })
    await openWhatsApp()

    expect(screen.getByText('Does not apply to junior leagues')).toBeVisible()
    const clubDefault = screen.getByRole('checkbox', { name: 'Make first names as initials the club default' })
    expect(clubDefault).toBeEnabled()
    await userEvent.click(clubDefault)
    await waitFor(() => expect(updateShareSettings).toHaveBeenCalledWith('club-1', { initialsOnlyDefault: true }))
    // The lock does not change: still on, still disabled.
    expect(screen.getByRole('checkbox', { name: 'First names as initials' })).toBeDisabled()
  })

  it('locks a league with maxAge 18 and not one with 19', async () => {
    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'U19 League', maxAge: 18 }])
    const first = renderDialog({ leagueId: 'league-1' })
    expect((await openWhatsApp()).toggle).toBeDisabled()
    first.unmount()

    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'U20 League', maxAge: 19 }])
    renderDialog({ leagueId: 'league-1' })
    const second = await openWhatsApp()
    expect(second.toggle).toBeEnabled()
    expect(screen.queryByText(JUNIOR_REASON)).not.toBeInTheDocument()
  })

  it('locks a friendly whose team sits under a section with a junior maxAge, and one under a section named Juniors', async () => {
    listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'U15', maxAge: 15 }])
    const first = renderDialog()
    expect((await openWhatsApp()).toggle).toBeDisabled()
    expect(screen.getByText(JUNIOR_REASON)).toBeVisible()
    first.unmount()

    listSections.mockResolvedValue([
      { id: 'sec-0', parentSectionId: null, name: 'Juniors', maxAge: null },
      { id: 'sec-1', parentSectionId: 'sec-0', name: 'Boys', maxAge: null },
    ])
    renderDialog()
    expect((await openWhatsApp()).toggle).toBeDisabled()
  })

  it('does not lock an adult league even when the team sits under Juniors', async () => {
    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'Open League', maxAge: 40 }])
    listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'Juniors', maxAge: null }])
    renderDialog({ leagueId: 'league-1' })

    expect((await openWhatsApp()).toggle).toBeEnabled()
  })
})

describe('ShareResultDialog when the league cannot be checked', () => {
  it('fails safe: locked on, with the "could not check" reason, and no full given name', async () => {
    listLeagues.mockResolvedValue([])
    remember({ initialsOnly: false, templates: { whatsapp: 'SCORECARD' } })
    renderDialog({ leagueId: 'league-1' })

    const { toggle, box } = await openWhatsApp()
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText(UNAVAILABLE_REASON)).toBeVisible()
    expect(screen.queryByText(JUNIOR_REASON)).not.toBeInTheDocument()
    expect(leakedGivenNames(box().value)).toEqual([])
  })

  it('fails safe when the leagues read is refused (a section-scoped manager)', async () => {
    listLeagues.mockRejectedValue(new Error('403'))
    renderDialog({ leagueId: 'league-1' })

    const { toggle } = await openWhatsApp()
    expect(toggle).toBeDisabled()
    expect(screen.getByText(UNAVAILABLE_REASON)).toBeVisible()
  })

  it('fails safe when the sections read is refused', async () => {
    listSections.mockRejectedValue(new Error('403'))
    renderDialog()

    const { toggle } = await openWhatsApp()
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText(UNAVAILABLE_REASON)).toBeVisible()
  })
})

describe('ShareResultDialog for a match that is not junior', () => {
  beforeEach(() => {
    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'Open League', maxAge: null }])
  })

  // [remembered choice, club default, expected switch]
  const cases: [boolean | null, boolean, boolean][] = [
    [null, false, false],
    [null, true, true],
    [true, false, true],
    [false, true, false],
    [true, true, true],
    [false, false, false],
  ]
  for (const [remembered, clubDefault, expected] of cases) {
    it(`remembered ${remembered === null ? 'none' : remembered}, club default ${clubDefault}: the switch is ${expected ? 'on' : 'off'} and enabled`, async () => {
      remember({ initialsOnly: remembered, templates: { whatsapp: 'SCORECARD' } })
      getShareSettings.mockResolvedValue({ initialsOnlyDefault: clubDefault })
      renderDialog({ leagueId: 'league-1' })

      const { box } = await openWhatsApp()
      const toggle = screen.getByRole('checkbox', { name: 'First names as initials' })
      await waitFor(() => (expected ? expect(toggle).toBeChecked() : expect(toggle).not.toBeChecked()))
      expect(toggle).toBeEnabled()
      expect(screen.queryByText(JUNIOR_REASON)).not.toBeInTheDocument()
      expect(screen.queryByText('Does not apply to junior leagues')).not.toBeInTheDocument()
      // The output follows the switch: the full name when off, the shortened form when on.
      await waitFor(() => expect(fold(box().value).includes('mpho naidoo')).toBe(!expected))
      expect(fold(box().value).includes('m. naidoo')).toBe(expected)
    })
  }

  it('turns the output over and remembers the manager\'s own choice when the switch is used', async () => {
    renderDialog({ leagueId: 'league-1' })
    const { toggle, box } = await openWhatsApp()
    await userEvent.click(screen.getByRole('button', { name: 'Scorecard text' }))
    expect(toggle).not.toBeChecked()
    expect(leakedGivenNames(box().value).length).toBeGreaterThan(0)

    await userEvent.click(toggle)

    expect(toggle).toBeChecked()
    await waitFor(() => expect(leakedGivenNames(box().value)).toEqual([]))
    await waitFor(() => expect(stored().initialsOnly).toBe(true))
  })

  it('shows the switch as one value across formats within a visit', async () => {
    renderDialog({ leagueId: 'league-1' })
    const { toggle } = await openWhatsApp()
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    expect(await screen.findByRole('checkbox', { name: 'First names as initials' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    expect(await screen.findByRole('checkbox', { name: 'First names as initials' })).toBeChecked()
  })
})
