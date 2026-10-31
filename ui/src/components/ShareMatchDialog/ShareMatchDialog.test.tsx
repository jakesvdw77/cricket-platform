import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shareSettingsKey } from '../../api/shareSettingsApi'
import { baseTheme } from '../../theme'
import { FULL_FIRST_NAMES, fixtureMatch, fixtureSide } from '../../utils/share/matchShareFixture'
import type { MatchContent, MatchSideChoice } from '../../utils/share/matchShareFormats'
import { ShareMatchDialog } from './ShareMatchDialog'
import type { Team } from '../../api/teamApi'

// docs/specs/131-match-sharing.md (ShareMatchDialog): every read is answered from a seeded cache (no server). The match is a junior
// fixture three days ahead; the home side is ours with an XI, the away side an external opposition.
const pad = (value: number) => String(value).padStart(2, '0')
const inDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:15:00`
}

const teamsById = new Map<string, Team>([['t-home', { id: 't-home', clubId: 'club-1', sectionId: 'sec-1', name: 'Irene Villagers U15', logoUrl: null } as Team]])

function seeded(disabledFormats: Record<string, string[]> = {}): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const set = (key: readonly unknown[], value: unknown) => client.setQueryData(key, value)
  set(shareSettingsKey('club-1'), { initialsOnlyDefault: false, disabledFormats })
  set(['managed-club', 'club-1', 'leagues'], [{ id: 'l1', name: 'Diamond League U15 T20', maxAge: 15 }])
  set(['managed-club', 'club-1', 'sections'], [{ id: 'sec-1', parentSectionId: null, name: 'U15', maxAge: 15 }])
  set(['managed-club', 'club-1', 'profile'], { name: 'Irene Villagers CC', logoUrl: null, website: null })
  set(['managed-club', 'club-1', 'sponsors'], [])
  set(['managed-club', 'club-1', 'results', 'match-share', 't-home'], { content: [] })
  return client
}

interface Options {
  selected?: boolean
  days?: number
  initialContent?: MatchContent
  initialScope?: 'home' | 'away'
  disabledFormats?: Record<string, string[]>
  onClose?: () => void
}

function renderDialog({ selected = true, days = 3, initialContent, initialScope, disabledFormats, onClose = () => {} }: Options = {}) {
  const match = fixtureMatch({ matchDate: inDays(days) })
  const sides: [ReturnType<typeof fixtureSide>, ReturnType<typeof fixtureSide>] = [fixtureSide('t-home', 'Irene Villagers U15', 0, selected), fixtureSide('t-away', 'Pretoria A', 5, false)]
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={seeded(disabledFormats)}>
        <ShareMatchDialog open onClose={onClose} clubId="club-1" match={match} teamsById={teamsById} sides={sides} sidesLoading={false} leagueName="Diamond League U15 T20" seasonLabel="2026/2027" initialContent={initialContent} initialScope={initialScope} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })
const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }))
const choose = async (content: string, format?: string) => {
  await userEvent.click(radio(content))
  await next()
  if (format) {
    await userEvent.click(radio(format))
    await next()
  }
}

beforeEach(() => localStorage.clear())

describe('step 1, What to share', () => {
  it('lists the five contents as one choice, none ticked at first', async () => {
    renderDialog()
    expect(await screen.findByRole('radiogroup', { name: 'What to share' })).toBeInTheDocument()
    for (const label of ['Team Selection Poster', 'Countdown', 'Fun Facts', 'Fixture Card', 'Team Sheet']) {
      expect(radio(label)).toBeEnabled()
      expect(radio(label)).not.toBeChecked()
    }
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('is one choice at a time', async () => {
    renderDialog()
    await userEvent.click(radio('Countdown'))
    await userEvent.click(radio('Fixture Card'))
    expect(radio('Fixture Card')).toBeChecked()
    expect(radio('Countdown')).not.toBeChecked()
  })

  it('preselects the entry point content', () => {
    renderDialog({ initialContent: 'TEAM_SHEET' })
    expect(radio('Team Sheet')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('disables the XI contents with the reason before a team is selected, keeping the others on', () => {
    renderDialog({ selected: false })
    expect(radio('Team Selection Poster')).toBeDisabled()
    expect(radio('Team Selection Poster')).toHaveTextContent('Select the team first')
    expect(radio('Team Sheet')).toBeDisabled()
    expect(radio('Team Sheet')).toHaveTextContent('Select the team first')
    for (const label of ['Countdown', 'Fun Facts', 'Fixture Card']) expect(radio(label)).toBeEnabled()
  })

  it('does not offer a Countdown for a past match', () => {
    renderDialog({ days: -2 })
    expect(radio('Countdown')).toBeDisabled()
    expect(radio('Countdown')).toHaveTextContent('The match has been played')
  })

  it('shows Side only for lineup contents, with Opposition and Both disabled and a reason when the opposition has no XI', async () => {
    renderDialog()
    expect(screen.queryByRole('group', { name: 'Side' })).not.toBeInTheDocument()
    await userEvent.click(radio('Team Selection Poster'))
    const side = screen.getByRole('group', { name: 'Side' })
    expect(within(side).getByRole('button', { name: 'Our Side' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(side).getByRole('button', { name: 'Opposition' })).toBeDisabled()
    expect(within(side).getByRole('button', { name: 'Both' })).toBeDisabled()
    expect(screen.getByText(/Needs the opposition's selected XI on the platform/)).toBeInTheDocument()
    await userEvent.click(radio('Fixture Card'))
    expect(screen.queryByRole('group', { name: 'Side' })).not.toBeInTheDocument()
  })

  it('has a Close button', async () => {
    const onClose = vi.fn()
    renderDialog({ onClose })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('step 2, Format', () => {
  it('offers PDF, WhatsApp and Facebook for the team sheet and greys the images with a reason', async () => {
    renderDialog()
    await userEvent.click(radio('Team Sheet'))
    await next()
    for (const label of ['PDF', 'WhatsApp', 'Facebook']) expect(radio(label)).toBeEnabled()
    expect(radio('Image')).toBeDisabled()
    expect(radio('Image')).toHaveTextContent('Team Sheet offers PDF, WhatsApp and Facebook only')
    expect(radio('TV Summary')).toBeDisabled()
  })

  it('offers every format for the team selection poster, including the TV summary', async () => {
    renderDialog()
    await userEvent.click(radio('Team Selection Poster'))
    await next()
    for (const label of ['PDF', 'Image', 'TV Summary', 'WhatsApp', 'Facebook']) expect(radio(label)).toBeEnabled()
  })

  it('does not show a format the club switched off', async () => {
    renderDialog({ disabledFormats: { MATCH: ['FACEBOOK', 'TV'] } })
    await userEvent.click(radio('Fixture Card'))
    await next()
    expect(screen.queryByRole("radio", { name: /^Facebook/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /^TV Summary/ })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /^WhatsApp/ })).toBeInTheDocument()
  })

  it('keeps the choices when going Back', async () => {
    renderDialog()
    await userEvent.click(radio('Fun Facts'))
    await next()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(radio('Fun Facts')).toBeChecked()
  })

  it('remembers the content and format for next time, per club', async () => {
    renderDialog()
    await choose('Fixture Card', 'WhatsApp')
    await screen.findByRole('textbox', { name: 'Message text' })
    const stored = JSON.parse(localStorage.getItem('share:choices:club-1') as string)
    expect(stored.match.content).toBe('FIXTURE')
    expect(stored.match.format).toBe('WHATSAPP')
  })
})

describe('format screens', () => {
  it('WhatsApp: the countdown message, first names locked to initials on a junior match', async () => {
    renderDialog()
    await choose('Countdown', 'WhatsApp')
    const message = (await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement
    expect(message.value).toContain('3 days to go')
    expect(message.value).toContain('Irene Villagers U15 v Pretoria A')
    expect(message.value).not.toContain('Forecast')
    const initials = screen.getByRole('checkbox', { name: 'First names as initials' })
    expect(initials).toBeChecked()
    expect(initials).toBeDisabled()
    expect(screen.getByText('Always on for junior leagues')).toBeInTheDocument()
  })

  it('WhatsApp: the team sheet lists the XI by initials, never a full given name', async () => {
    renderDialog()
    await choose('Team Sheet', 'WhatsApp')
    const message = (await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement
    expect(message.value).toContain('1. A. Botha (C)')
    for (const first of FULL_FIRST_NAMES) expect(message.value).not.toContain(first)
  })

  it('Include Weather is off with its reason when there is no forecast', async () => {
    renderDialog()
    await choose('Fixture Card', 'WhatsApp')
    await screen.findByRole('textbox', { name: 'Message text' })
    const weather = screen.getByRole('checkbox', { name: 'Include Weather' })
    expect(weather).toBeDisabled()
    expect(weather).toHaveAccessibleDescription(/No forecast/)
  })

  it('Facebook: the post carries hashtags of team names only and offers Copy Text', async () => {
    renderDialog()
    await choose('Team Selection Poster', 'Facebook')
    const post = (await screen.findByRole('textbox', { name: /Post text|Message text/ })) as HTMLTextAreaElement
    expect(post.value).toContain('#IreneVillagersU15')
    expect(post.value).not.toMatch(/#Botha|#Naidoo/)
    expect(screen.getByRole('button', { name: 'Copy Text' })).toBeInTheDocument()
  })

  it('Fun Facts: says so when there are not enough published results', async () => {
    renderDialog()
    await choose('Fun Facts', 'WhatsApp')
    await screen.findByRole('textbox', { name: 'Message text' })
    expect(screen.getByText('Not enough published results for any fact yet.')).toBeInTheDocument()
  })

  it('Image: the poster controls (size, picture, filters) are there and no picture means a club colour panel', async () => {
    renderDialog()
    await choose('Team Selection Poster', 'Image')
    expect(await screen.findByRole('group', { name: 'Size' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Picture' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByText(/No picture chosen: a club colour panel is used/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument()
    for (const label of ['Position X', 'Position Y', 'Zoom', 'Opacity']) expect(screen.getByRole('slider', { name: label })).toBeDisabled()
  })

  it('TV summary: no size control', async () => {
    renderDialog()
    await choose('Fixture Card', 'TV Summary')
    await screen.findByRole('group', { name: 'Template' })
    expect(screen.queryByRole('group', { name: 'Size' })).not.toBeInTheDocument()
  })

  it('PDF: the template control and logo group', async () => {
    renderDialog()
    await choose('Team Sheet', 'PDF')
    expect(await screen.findByRole('group', { name: 'Template' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compact' })).toBeInTheDocument()
  })
})

describe('side choice', () => {
  const sideButton = (name: MatchSideChoice) => screen.getByRole('button', { name: name === 'OURS' ? 'Our Side' : name === 'OPPOSITION' ? 'Opposition' : 'Both' })
  it('starts on Our Side from an own-side panel', async () => {
    renderDialog({ initialContent: 'TEAM_SHEET', initialScope: 'home' })
    expect(sideButton('OURS')).toHaveAttribute('aria-pressed', 'true')
  })
})
