import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionAvailabilityShareDialog } from './SectionAvailabilityShareDialog'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'

const ROUND: SectionAvailabilityRound = {
  id: 'round-1',
  sectionId: 'section-1',
  sectionName: 'U13 Boys',
  description: 'Sat 3 - Sun 4 Oct - U13 Boys fixtures',
  firstMatchDate: '2026-10-03',
  firstMatchKickoff: '2026-10-03T09:00:00Z',
  lastMatchDate: '2026-10-04',
  autoClose: true,
  scheduledCloseAt: '2026-10-02T09:00:00Z',
  canReopen: true,
  open: true,
  brackets: [
    {
      dayPart: 'MORNING',
      windowDate: '2026-10-03',
      windowId: 'window-1',
      availableCount: 8,
      unavailableCount: 2,
      unsureCount: 1,
      noResponseCount: 3,
      coveredMatchCount: 1,
    },
    {
      dayPart: 'MORNING',
      windowDate: '2026-10-04',
      windowId: 'window-2',
      availableCount: 5,
      unavailableCount: 1,
      unsureCount: 0,
      noResponseCount: 8,
      coveredMatchCount: 1,
    },
  ],
}

const meta: Meta<typeof SectionAvailabilityShareDialog> = {
  title: 'Components/SectionAvailabilityShareDialog',
  component: SectionAvailabilityShareDialog,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SectionAvailabilityShareDialog>

const noop = () => undefined

export const Open: Story = {
  args: {
    open: true,
    onClose: noop,
    round: ROUND,
  },
}

export const MobileViewport: Story = {
  args: Open.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
