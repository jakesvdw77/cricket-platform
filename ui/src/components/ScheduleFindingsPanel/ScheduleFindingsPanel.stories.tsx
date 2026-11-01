import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { ScheduleFindingsPanel } from './ScheduleFindingsPanel'

const meta: Meta<typeof ScheduleFindingsPanel> = {
  title: 'Components/ScheduleFindingsPanel',
  component: ScheduleFindingsPanel,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
}
export default meta
type Story = StoryObj<typeof ScheduleFindingsPanel>

export const Blocking: Story = {
  args: {
    result: {
      needsConfirmation: false,
      findings: [{ code: 'DUPLICATE_MATCH', severity: 'ERROR', message: 'These teams already play on this date.', otherMatchId: 'm1' }],
    },
  },
}

export const WarningWithConfirm: Story = {
  args: {
    result: {
      needsConfirmation: true,
      findings: [{ code: 'DUPLICATE_SAME_DAY', severity: 'WARNING', message: 'A match between these teams is already on the same day.', otherMatchId: 'm1' }],
    },
  },
}
