import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { ShareResultDialog } from './ShareResultDialog'
import { resultKeys } from '../../api/matchResultApi'
import { shareSettingsKey } from '../../api/shareSettingsApi'
import { makeMatch, makeResult } from '../../test/resultFixtures'
import { privacyMatch, privacyResult, privacyScorecard } from '../../utils/share/sharePrivacyFixture'

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof ShareResultDialog> = {
  title: 'Components/ShareResultDialog',
  component: ShareResultDialog,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    clubId: 'club-1',
    match: makeMatch({ id: 'match-1', homeTeamId: 'team-1' }),
    result: makeResult(),
    teamsById: new Map(),
  },
}
export default meta

type Story = StoryObj<typeof ShareResultDialog>

export const Default: Story = {}
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }

// A published result WITH a scorecard (the only kind that can be shared: a draft has no Share button, so the dialog is never
// opened on one), with every read it makes answered from a seeded cache so the stories need no server. The WhatsApp screen is
// opened by the play function so the format screen, its controls and the pinned footer are what the story shows.
const team = { id: 't1', clubId: 'club-1', sectionId: 'sec-1', name: 'Riverside 1', logoUrl: null, active: true }
const seededClients = new Map<number | null, QueryClient>()
const seeded = (maxAge: number | null): QueryClient => {
  const existing = seededClients.get(maxAge)
  if (existing) return existing
  const seededClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  seededClient.setQueryData(shareSettingsKey('club-1'), { initialsOnlyDefault: false })
  seededClient.setQueryData(resultKeys.scorecard('club-1', 'm1'), privacyScorecard('p1'))
  seededClient.setQueryData(['managed-club', 'club-1', 'leagues'], [{ id: 'league-1', name: 'Premier League', maxAge, logoUrl: null }])
  seededClient.setQueryData(['managed-club', 'club-1', 'sections'], [{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
  seededClient.setQueryData(['managed-club', 'club-1', 'profile'], { name: 'Riverside CC', logoUrl: null, website: 'https://riverside-cc.example' })
  seededClient.setQueryData(['managed-club', 'club-1', 'sponsors'], [])
  seededClient.setQueryData(['managed-club', 'club-1', 'sections', 'sec-1', 'teams', 't1', 'sponsors'], [])
  seededClients.set(maxAge, seededClient)
  return seededClient
}

const publishedArgs: Story['args'] = {
  match: { ...privacyMatch, leagueId: 'league-1' } as never,
  result: { ...privacyResult, status: 'PUBLISHED' } as never,
  teamsById: new Map([['t1', team as never]]),
}

const openWhatsApp: Story['play'] = async () => {
  const body = within(document.body)
  await userEvent.click(await body.findByRole('radio', { name: /WhatsApp/ }))
  await body.findByRole('textbox', { name: 'Message text' })
}

const withSeed = (maxAge: number | null): NonNullable<Story['decorators']> => [
  (Story) => (
    <QueryClientProvider client={seeded(maxAge)}>
      <Story />
    </QueryClientProvider>
  ),
]

// An adult league: the First names as initials switch is free (remembered choice, then the club default, then off).
export const PublishedResult: Story = { args: publishedArgs, decorators: withSeed(null), play: openWhatsApp }
export const PublishedResultMobile: Story = { ...PublishedResult, parameters: { viewport: { defaultViewport: 'mobile' } } }
export const PublishedResultTablet: Story = { ...PublishedResult, parameters: { viewport: { defaultViewport: 'tablet' } } }
export const PublishedResultDesktop: Story = { ...PublishedResult, parameters: { viewport: { defaultViewport: 'desktop' } } }

// A junior league (maxAge 13): the switch is on and disabled with the visible reason "Always on for junior leagues".
export const JuniorLocked: Story = { args: publishedArgs, decorators: withSeed(13), play: openWhatsApp }
export const JuniorLockedMobile: Story = { ...JuniorLocked, parameters: { viewport: { defaultViewport: 'mobile' } } }
export const JuniorLockedTablet: Story = { ...JuniorLocked, parameters: { viewport: { defaultViewport: 'tablet' } } }
export const JuniorLockedDesktop: Story = { ...JuniorLocked, parameters: { viewport: { defaultViewport: 'desktop' } } }
