import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SponsorQuickViewDialog } from './SponsorQuickViewDialog'
import type { Sponsor } from '../../api/sponsorApi'

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'club-1',
    name: 'Acme Bank',
    website: 'https://acme.example.com',
    email: 'hello@acme.example.com',
    phone: null,
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const meta: Meta<typeof SponsorQuickViewDialog> = {
  title: 'Components/SponsorQuickViewDialog',
  component: SponsorQuickViewDialog,
  parameters: { layout: 'centered' },
  // Backed by React Query (fetches the sponsor's own contacts while open) — same
  // QueryClientProvider-per-story pattern ClubPicker.stories.tsx/TeamCard.stories.tsx already use.
  // No local MemoryRouter decorator — .storybook/preview.tsx already wraps every story in one
  // globally (the dialog's own Edit action is a RouterLink).
  decorators: [
    (Story) => {
      const queryClient = new QueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof SponsorQuickViewDialog>

export const Open: Story = {
  args: {
    clubId: 'club-1',
    sponsor: makeSponsor(),
    onClose: () => undefined,
  },
}

export const Closed: Story = {
  args: {
    clubId: 'club-1',
    sponsor: null,
    onClose: () => undefined,
  },
}

export const MobileViewport: Story = {
  args: Open.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Open.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Open.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
