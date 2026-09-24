import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { ShareScheduleDialog } from './ShareScheduleDialog'
import type { ShareScheduleTeamOption } from './ShareScheduleDialog'

const teams: ShareScheduleTeamOption[] = [
  { teamId: 'team-home', teamName: 'Riverside 1st XI' },
  { teamId: 'team-away', teamName: 'Coastal CC' },
]

const meta: Meta<typeof ShareScheduleDialog> = {
  title: 'Components/ShareScheduleDialog',
  component: ShareScheduleDialog,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof ShareScheduleDialog>

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    leagueName: 'Premier League',
    seasonLabel: '2026',
    teams,
    onSharePdf: async () => undefined,
    onSharePoster: async () => undefined,
    onShareCalendar: async () => undefined,
  },
}

// Selecting a specific team enables "Add to Calendar" — the play function picks a team so this
// story exercises the disabled → enabled transition, only reachable via interaction.
export const TeamSelected: Story = {
  args: Default.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /riverside 1st xi/i }))
  },
}

export const NoTeams: Story = {
  args: {
    ...Default.args,
    teams: [],
  },
}

// A rejected onSharePdf surfaces an inline error and keeps the dialog open for retry.
export const ErrorState: Story = {
  args: {
    ...Default.args,
    onSharePdf: async () => {
      throw new Error("Couldn't generate the schedule. Please try again.")
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /open pdf/i }))
    await canvas.findByText("Couldn't generate the schedule. Please try again.")
  },
}

export const MobileViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
