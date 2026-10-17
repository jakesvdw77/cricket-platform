import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareResultDialog } from './ShareResultDialog'
import { baseTheme } from '../../theme'
import { makeMatch, makeResult } from '../../pages/manage/results/resultTestUtils'
import { mockCanvas } from './shareScreenTestUtils'

const getShareSettings = vi.fn()
const updateShareSettings = vi.fn()
const listLeagues = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: (clubId: string, settings: unknown) => updateShareSettings(clubId, settings),
}))
vi.mock('../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/clubApi', () => ({ getManagedClubProfile: () => Promise.resolve({ name: 'Riverside', logoUrl: null, website: null }) }))
vi.mock('../../api/sponsorApi', () => ({ listSponsors: () => Promise.resolve([]) }))
vi.mock('../../api/teamSponsorApi', () => ({ listTeamSponsors: () => Promise.resolve([]) }))

const team = { id: 'team-1', sectionId: 'sec-1', name: '1st XI', logoUrl: null }

function renderDialog(matchOverrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ShareResultDialog
          open
          onClose={() => {}}
          clubId="club-1"
          match={makeMatch({ id: 'match-1', homeTeamId: 'team-1', leagueId: null, ...matchOverrides })}
          result={makeResult()}
          teamsById={new Map([['team-1', team as never]])}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  mockCanvas()
  getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
  updateShareSettings.mockImplementation((_club: string, settings: unknown) => Promise.resolve(settings))
  listLeagues.mockResolvedValue([])
  listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const key of ['share', 'canShare', 'clipboard']) Reflect.deleteProperty(navigator, key)
})

describe('ShareResultDialog', () => {
  it('shows the five tiles, every one choosable', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Share result' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByText('Coming next')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /PDF scorecard/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /Image/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /TV summary/ })).toBeEnabled()
  })

  it('opens the WhatsApp screen and Back returns to the tiles', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    expect(((await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement).value).toContain('Riverside Occasionals')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('locks First names as initials on, with the visible reason, for a junior league match', async () => {
    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'U13 League', maxAge: 13 }])
    renderDialog({ leagueId: 'league-1' })

    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    const toggle = await screen.findByRole('checkbox', { name: 'First names as initials' })

    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText('Always on for junior leagues')).toBeInTheDocument()
  })

  it('asks before replacing typed edits when the style changes', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    const box = await screen.findByRole('textbox', { name: 'Message text' })

    await userEvent.type(box, ' hello')
    await userEvent.click(screen.getByRole('button', { name: 'Scorecard text' }))
    expect(screen.getByText('Replace your edits?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Message text' }) as HTMLTextAreaElement).value).not.toContain('hello'))
  })

  it('writes the club default through the share-settings endpoint', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Make this the club default' }))

    await waitFor(() => expect(updateShareSettings).toHaveBeenCalledWith('club-1', { initialsOnlyDefault: true }))
  })

  it('opens the Image and TV screens from their tiles', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('radio', { name: /Image/ }))
    expect(await screen.findByRole('img', { name: /Result card:/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await userEvent.click(screen.getByRole('radio', { name: /TV summary/ }))
    expect(await screen.findByRole('img', { name: /Match summary:/ })).toBeInTheDocument()
  })

  it('on a computer shows no Attach switch, no image in the bubble, and a separate image card with Copy and Download image', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem { constructor(public items: Record<string, Blob>) {} })
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByRole('heading', { name: 'Result image' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Attach the result image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Result image attached to the message' })).not.toBeInTheDocument()
    expect(screen.getByText('Paste or attach this image in the chat. WhatsApp links carry text only.')).toBeInTheDocument()
    expect(screen.getByText(/On a computer, paste the copied image into the chat/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send in WhatsApp' })).toBeInTheDocument()

    const copy = screen.getByRole('button', { name: 'Copy image' })
    await waitFor(() => expect(copy).toBeEnabled())
    await userEvent.click(copy)
    const item = write.mock.calls[0][0][0] as { items: Record<string, File> }
    expect(item.items['image/png']).toBeInstanceOf(File)
    expect(item.items['image/png'].type).toBe('image/png')
    expect(await screen.findByText('Image copied.')).toBeInTheDocument()
  })

  it('where the share sheet can send the file offers the Attach switch and shows the image in the bubble while on', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() }))
    // A touch device: only there is the image promised together with the text.
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('pointer: coarse'),
        media: query,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    expect(await screen.findByRole('checkbox', { name: 'Attach the result image' })).toBeChecked()
    expect(await screen.findByRole('img', { name: 'Result image attached to the message' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Result image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy image' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Attach the result image' }))
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Result image attached to the message' })).not.toBeInTheDocument())
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('offers Download image beside Copy text on Facebook', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))

    expect(await screen.findByRole('button', { name: 'Download image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Image to upload' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Result image attached to the post' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Attach the result image' })).not.toBeInTheDocument()
  })
})
