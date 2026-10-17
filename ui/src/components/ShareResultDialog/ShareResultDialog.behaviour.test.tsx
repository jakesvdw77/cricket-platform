import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scorecard } from '../../api/matchResultApi'
import { ShareResultDialog } from './ShareResultDialog'
import { baseTheme } from '../../theme'
import { shareChoicesKey } from '../../utils/share/shareChoices'
import { privacyMatch, privacyResult, privacyScorecard } from '../../utils/share/sharePrivacyFixture'
import { mockCanvas } from './shareScreenTestUtils'

// docs/specs/114-share-result.md (Test Plan, Component): tiles and Back, remembered choices, Copy text with edits, the
// "Replace your edits?" confirm, the collision note, the Teams control for a derby and a summary-only result, the pinned footer,
// the zoom buttons and the phone layout.
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

const teams = new Map<string, never>([
  ['t1', { id: 't1', sectionId: 'sec-1', name: 'Riverside 1', logoUrl: null } as never],
  ['t2', { id: 't2', sectionId: 'sec-1', name: 'Riverside 2', logoUrl: null } as never],
])

interface Options {
  match?: Record<string, unknown>
  result?: Record<string, unknown>
  onClose?: () => void
}

function renderDialog({ match = {}, result = {}, onClose = () => {} }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ShareResultDialog
          open
          onClose={onClose}
          clubId="club-1"
          match={{ ...privacyMatch, leagueId: null, ...match } as never}
          result={{ ...privacyResult, ...result } as never}
          teamsById={teams}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

const remember = (choices: Record<string, unknown>) => localStorage.setItem(shareChoicesKey('club-1'), JSON.stringify(choices))
const stored = (): Record<string, unknown> => JSON.parse(localStorage.getItem(shareChoicesKey('club-1')) ?? '{}')
const messageBox = () => screen.getByRole('textbox', { name: 'Message text' }) as HTMLTextAreaElement
const postBox = () => screen.getByRole('textbox', { name: 'Post text' }) as HTMLTextAreaElement

// A scorecard in which two different players both shorten to "M. Naidoo".
function twinsScorecard(): Scorecard {
  const base = privacyScorecard('p1') as unknown as {
    players: Record<string, unknown>[]
    batting: Record<string, unknown>[]
  }
  return {
    ...base,
    players: [
      ...base.players,
      { id: 'p5', side: 'HOME', playerProfileId: 'x5', firstName: 'Mandla', lastName: 'Naidoo', opposition: false, displayName: null, substitute: false },
    ],
    batting: [...base.batting, { battingSide: 'HOME', resultPlayerId: 'p5', position: 5, howOut: 'NOT_OUT', runs: 2, balls: 3 }],
  } as unknown as Scorecard
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  mockCanvas()
  getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
  updateShareSettings.mockImplementation((_club: string, settings: unknown) => Promise.resolve(settings))
  listLeagues.mockResolvedValue([])
  listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
  getScorecard.mockResolvedValue(privacyScorecard('p1'))
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ShareResultDialog tiles', () => {
  it('opens every one of the five formats from its tile and Back returns to the tiles', async () => {
    renderDialog()
    const opened: [RegExp, () => unknown][] = [
      [/PDF scorecard/, () => screen.findByRole('img', { name: /PDF scorecard, page 1/ })],
      [/^Image/, () => screen.findByRole('img', { name: /Result card:/ })],
      [/TV summary/, () => screen.findByRole('img', { name: /Match summary:/ })],
      [/WhatsApp/, () => screen.findByRole('textbox', { name: 'Message text' })],
      [/Facebook/, () => screen.findByRole('textbox', { name: 'Post text' })],
    ]
    for (const [tile, shown] of opened) {
      await userEvent.click(screen.getByRole('radio', { name: tile }))
      expect(await shown()).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(screen.getAllByRole('radio')).toHaveLength(5)
    }
  })

  it('describes each tile in its own words', () => {
    renderDialog()

    for (const text of ['Full scorecard, A4, to print or send', 'Result card for feeds and chats', 'Widescreen match summary', 'Message text plus image', 'Post text plus image']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('highlights the last format used and remembers a new choice', async () => {
    remember({ format: 'FACEBOOK' })
    renderDialog()

    expect(screen.getByRole('radio', { name: /Facebook/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(screen.getByRole('radio', { name: /TV summary/ }))
    await waitFor(() => expect(stored().format).toBe('TV'))
  })

  it('moves the highlight with the arrow keys without opening a format, and Enter opens it', async () => {
    renderDialog()
    screen.getByRole('radio', { name: /PDF scorecard/ }).focus()

    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('radio', { name: /^Image/ })).toHaveAttribute('aria-checked', 'true')
    expect(stored().format).toBeUndefined()

    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('img', { name: /Result card:/ })).toBeInTheDocument()
  })

  it('closes on Escape and from the Close button', async () => {
    const onClose = vi.fn()
    renderDialog({ onClose })

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('ShareResultDialog remembered choices', () => {
  it('restores the last template, size, switches, teams and footer line on the screens', async () => {
    remember({
      format: 'IMAGE',
      templates: { image: 'NIGHT', whatsapp: 'SCORECARD', facebook: 'BRIEF' },
      imageSize: 'STORY',
      include: { image: { topPerformers: false, playerOfTheMatch: true, venueAndDate: true }, whatsapp: { emoji: false, attachImage: true } },
      footerLine: false,
      teams: 'ours',
    })
    renderDialog()

    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    expect(await screen.findByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Story 9:16' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('checkbox', { name: 'Top performers' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Footer line' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    expect(await screen.findByRole('button', { name: 'Scorecard text' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Our team only' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('checkbox', { name: 'Emoji' })).not.toBeChecked()
    expect(messageBox().value).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('writes a changed template and switch back to the club\'s key', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Daylight' }))
    await userEvent.click(screen.getByRole('button', { name: 'Portrait 4:5' }))

    await waitFor(() => expect((stored().templates as Record<string, string>).image).toBe('DAYLIGHT'))
    expect(stored().imageSize).toBe('PORTRAIT')
    expect(localStorage.getItem(shareChoicesKey('another-club'))).toBeNull()
  })

  it('falls back to the defaults with no error when the stored value is corrupt', async () => {
    localStorage.setItem(shareChoicesKey('club-1'), '{broken')
    renderDialog()

    expect(screen.getAllByRole('radio').every((tile) => tile.getAttribute('aria-checked') === 'false')).toBe(true)
    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    expect(await screen.findByRole('button', { name: 'Club green' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ShareResultDialog Copy text and edits', () => {
  it('copies the text as built on WhatsApp, and the edited text once the manager has typed', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('textbox', { name: 'Message text' })
    const built = messageBox().value

    await userEvent.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(built)

    await userEvent.type(messageBox(), ' See you Saturday!')
    await userEvent.click(screen.getByRole('button', { name: /Copy text|Copied/ }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(`${built} See you Saturday!`)
  })

  it('copies the edited text on Facebook', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    await screen.findByRole('textbox', { name: 'Post text' })

    await userEvent.type(postBox(), ' EDITED')
    await userEvent.click(screen.getByRole('button', { name: 'Copy text' }))

    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string
    expect(copied).toBe(postBox().value)
    expect(copied.endsWith(' EDITED')).toBe(true)
    expect(await screen.findByText('Text copied.')).toBeInTheDocument()
  })

  it('does not ask when nothing has been typed, and changes the style straight away', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    await screen.findByRole('textbox', { name: 'Post text' })
    const report = postBox().value

    await userEvent.click(screen.getByRole('button', { name: 'Brief' }))

    expect(screen.queryByText('Replace your edits?')).not.toBeInTheDocument()
    await waitFor(() => expect(postBox().value).not.toBe(report))
  })

  it('asks before replacing typed edits, keeps them on Cancel and replaces them on Replace', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    await screen.findByRole('textbox', { name: 'Post text' })
    await userEvent.type(postBox(), ' EDITED')

    await userEvent.click(screen.getByRole('button', { name: 'Celebration' }))
    const confirm = await screen.findByRole('dialog', { name: 'Replace your edits?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Replace your edits?')).not.toBeInTheDocument())
    expect(postBox().value).toContain('EDITED')
    expect(screen.getByRole('button', { name: 'Match report' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Celebration' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Replace your edits?' })).getByRole('button', { name: 'Replace' }))
    await waitFor(() => expect(postBox().value).not.toContain('EDITED'))
    expect(postBox().value).toContain('Congratulations')
    expect(screen.getByRole('button', { name: 'Celebration' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('also asks when the First names as initials switch would rebuild edited text', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('textbox', { name: 'Message text' })
    await userEvent.type(messageBox(), ' EDITED')

    await userEvent.click(screen.getByRole('checkbox', { name: 'First names as initials' }))

    expect(await screen.findByText('Replace your edits?')).toBeInTheDocument()
    // The change is held back until confirmed (the page behind the confirm is hidden from the accessibility tree).
    expect(screen.getByRole('checkbox', { name: 'First names as initials', hidden: true })).not.toBeChecked()
  })

  it('says that names the manager types are not changed', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByText('Names you type yourself are not changed.')).toBeInTheDocument()
  })

  it('never remembers edited text', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('textbox', { name: 'Message text' })
    await userEvent.type(messageBox(), ' SECRET EDIT')
    await userEvent.click(screen.getByRole('button', { name: 'Scorecard text' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }))

    await waitFor(() => expect(stored().templates).toBeDefined())
    expect(localStorage.getItem(shareChoicesKey('club-1'))).not.toContain('SECRET EDIT')
  })
})

describe('ShareResultDialog collision note', () => {
  it('names the shared shortened name with First names as initials on, and shows nothing with it off', async () => {
    remember({ initialsOnly: true })
    getScorecard.mockResolvedValue(twinsScorecard())
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByText('Two or more players show as M. Naidoo.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'First names as initials' }))
    await waitFor(() => expect(screen.queryByText(/Two or more players show as/)).not.toBeInTheDocument())
  })

  it('shows no note when no two players share a shortened name', async () => {
    remember({ initialsOnly: true })
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('checkbox', { name: 'First names as initials' })

    expect(screen.queryByText(/Two or more players show as/)).not.toBeInTheDocument()
  })

  it('does not invent a disambiguator: both players are shown as written', async () => {
    remember({ initialsOnly: true, templates: { whatsapp: 'SCORECARD' } })
    getScorecard.mockResolvedValue(twinsScorecard())
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('textbox', { name: 'Message text' })

    // Both rows read "M. Naidoo", told apart only by their figures: no numeral, initial or other suffix is invented.
    expect(messageBox().value).toContain('\nM. Naidoo 60 (40) c P. Botha b T. Mokoena')
    expect(messageBox().value).toContain('\nM. Naidoo 2* (3)')
    expect(messageBox().value).not.toMatch(/M\. Naidoo( \(\d| #|-\d)/)
  })
})

describe('ShareResultDialog Teams control', () => {
  const derbyCard = (): Scorecard => {
    const card = privacyScorecard('p1') as unknown as { players: { opposition: boolean }[] }
    return { ...card, players: card.players.map((player) => ({ ...player, opposition: false })) } as unknown as Scorecard
  }

  it('is disabled with "Both teams are ours" for a derby, on WhatsApp and Facebook, and the choice changes nothing', async () => {
    getScorecard.mockResolvedValue(derbyCard())
    remember({ teams: 'ours' })
    renderDialog({ match: { awayTeamId: 't2', awayTeamName: null } })
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByText('Both teams are ours')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Both teams' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Our team only' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Both teams' })).toHaveAccessibleDescription('Both teams are ours')
    await userEvent.click(screen.getByRole('button', { name: 'Scorecard text' }))
    expect(messageBox().value).toContain('Riverside 1')
    expect(messageBox().value).toContain('Riverside 2')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    expect(await screen.findByText('Both teams are ours')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Our team only' })).toBeDisabled()
  })

  it('is disabled with "No scorecard recorded" for a summary-only result, which still gets its text', async () => {
    renderDialog({ result: { hasScorecard: false } })
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByText('No scorecard recorded')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Our team only' })).toBeDisabled()
    expect(getScorecard).not.toHaveBeenCalled()
    expect(messageBox().value).toContain('Riverside 1 won by 24 runs')
    expect(messageBox().value).toContain('Pretoria CC: 126/10')
  })

  it('is enabled for a normal result and Our team only drops the opposition names but keeps both scores', async () => {
    remember({ templates: { whatsapp: 'SCORECARD' } })
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await screen.findByRole('textbox', { name: 'Message text' })
    expect(screen.getByRole('button', { name: 'Our team only' })).toBeEnabled()
    expect(messageBox().value).toContain('Pieter Botha')

    await userEvent.click(screen.getByRole('button', { name: 'Our team only' }))

    await waitFor(() => expect(messageBox().value).not.toContain('Pieter Botha'))
    expect(messageBox().value).not.toContain('Thabo Mokoena')
    expect(messageBox().value).toContain('Riverside 1: 150/6')
    expect(messageBox().value).toContain('Pretoria CC: 126/10')
    expect(messageBox().value).toContain('Riverside 1 won by 24 runs')
    await waitFor(() => expect(stored().teams).toBe('ours'))
  })

  it('has no Teams control on the Image and TV screens, which always show both teams', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    await screen.findByRole('img', { name: /Result card:/ })
    expect(screen.queryByRole('button', { name: 'Our team only' })).not.toBeInTheDocument()
  })
})

describe('ShareResultDialog layout', () => {
  it('pins the actions in the footer region, outside the scrolling content, and the tiles have none', async () => {
    renderDialog()
    expect(screen.queryByTestId('share-footer')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    const footer = await screen.findByTestId('share-footer')

    await waitFor(() => expect(within(footer).getByRole('button', { name: 'Copy text' })).toBeInTheDocument())
    expect(within(footer).getByRole('button', { name: 'Download image' })).toBeInTheDocument()
    const content = footer.closest('[role="dialog"]')?.querySelector('.MuiDialogContent-root') as HTMLElement
    expect(within(content).queryByRole('button', { name: 'Copy text' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByTestId('share-footer')).not.toBeInTheDocument()
  })

  it('shows the zoom buttons on the Image preview and zooms in, out and back to Fit', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /^Image/ }))
    const zoom = await screen.findByRole('toolbar', { name: 'Zoom' })

    expect(within(zoom).getByRole('status')).toHaveTextContent('Fit')
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }))
    expect(within(zoom).getByRole('status')).toHaveTextContent('125%')
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom out' }))
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom out' }))
    expect(within(zoom).getByRole('status')).toHaveTextContent('75%')
    await userEvent.click(within(zoom).getByRole('button', { name: 'Fit to width' }))
    expect(within(zoom).getByRole('status')).toHaveTextContent('Fit')
  })

  it('is a full-screen dialog on a phone and a modal dialog on a desktop', async () => {
    const first = renderDialog()
    expect(screen.getByRole('dialog', { name: 'Share result' }).className).not.toMatch(/paperFullScreen/)
    first.unmount()

    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Share result' }).className).toMatch(/paperFullScreen/)
  })
})
