import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareAnalysisDialog } from './ShareAnalysisDialog'
import type { AnalysisPlayer } from '../../utils/squadAnalysis'

const listSections = vi.fn()
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/shareSettingsApi', () => ({
  getShareSettings: vi.fn(async () => ({ initialsOnlyDefault: false, disabledFormats: {} })),
  updateShareSettings: vi.fn(),
  shareSettingsKey: (clubId: string) => ['managed-club', clubId, 'share-settings'],
}))

const players: AnalysisPlayer[] = [
  { id: '1', firstName: 'Sipho', lastName: 'Ndlovu', dateOfBirth: '2012-05-01', battingStance: 'RIGHT_HANDED', bowlingArm: 'RIGHT_ARM', bowlingType: 'FAST', isWicketKeeper: false, battingPosition: 'OPENER', isPartTimeBowler: false },
  { id: '2', firstName: 'Mpho', lastName: 'Naidoo', dateOfBirth: '2012-06-01', battingStance: 'LEFT_HANDED', bowlingArm: null, bowlingType: null, isWicketKeeper: true, battingPosition: 'TOP_ORDER', isPartTimeBowler: false },
]

const adultSection = { id: 'men', clubId: 'club-1', parentSectionId: null, name: 'Men', minAge: 18, maxAge: null, gender: null, active: true }
const juniorSection = { id: 'u13', clubId: 'club-1', parentSectionId: null, name: 'U13', minAge: null, maxAge: 13, gender: null, active: true }

function renderDialog(sectionId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ShareAnalysisDialog
          open
          onClose={vi.fn()}
          clubId="club-1"
          teamName="Irene Villagers 1"
          sectionId={sectionId}
          seasonLabel="2026/2027"
          clubName="Irene Villagers"
          players={players}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function pick(format: string) {
  await userEvent.click(await screen.findByRole('radio', { name: new RegExp(format) }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listSections.mockResolvedValue([adultSection, juniorSection])
})

describe('ShareAnalysisDialog', () => {
  it('offers WhatsApp, Facebook and PDF, and Next waits for a choice', async () => {
    renderDialog('men')

    expect(await screen.findByRole('radio', { name: /WhatsApp/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Facebook/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /PDF/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByText('Choose a format')).toBeInTheDocument()
  })

  it('shows the WhatsApp message with the full names of an adult side, and lets the manager turn initials on', async () => {
    renderDialog('men')
    await pick('WhatsApp')

    const message = await screen.findByRole('textbox')
    expect((message as HTMLTextAreaElement).value).toContain('Opener: Sipho Ndlovu')
    await userEvent.click(screen.getByRole('checkbox', { name: 'First names as initials' }))
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toContain('Opener: S. Ndlovu')
  })

  it('always shows a junior side as initials and locks the switch with its reason', async () => {
    renderDialog('u13')
    await pick('WhatsApp')

    const message = await screen.findByRole('textbox')
    expect((message as HTMLTextAreaElement).value).toContain('S. Ndlovu')
    expect((message as HTMLTextAreaElement).value).not.toContain('Sipho')
    expect(screen.getByRole('checkbox', { name: 'First names as initials' })).toBeDisabled()
    expect(screen.getByText('Always on for junior leagues')).toBeInTheDocument()
  })

  it('shows initials for a team whose section cannot be found (the safe answer)', async () => {
    renderDialog('missing-section')
    await pick('Facebook')

    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toContain('S. Ndlovu')
  })

  it('offers Copy Text for Facebook and says a page cannot post for you', async () => {
    renderDialog('men')
    await pick('Facebook')

    expect(await screen.findByRole('button', { name: 'Copy Text' })).toBeInTheDocument()
    expect(screen.getByText(/cannot post to Facebook for you/)).toBeInTheDocument()
  })

  it('previews the PDF page with its content and names the file', async () => {
    renderDialog('men')
    await pick('PDF')

    const paper = await screen.findByTestId('analysis-paper')
    expect(within(paper).getByText('Irene Villagers 1')).toBeInTheDocument()
    expect(within(paper).getByText('Batting order')).toBeInTheDocument()
    expect(within(paper).getByText('Things to check')).toBeInTheDocument()
    expect(within(paper).getByText('Sipho Ndlovu')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-pdf-ready')).toHaveTextContent('Irene Villagers 1 2026-2027 squad analysis.pdf')
  })

  it('goes back to the formats from a format screen', async () => {
    renderDialog('men')
    await pick('PDF')
    await screen.findByTestId('analysis-paper')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('radio', { name: /WhatsApp/ })).toBeInTheDocument()
  })
})
