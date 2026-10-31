import type { Meta, StoryObj } from '@storybook/react-vite'
import { FakeImportApiProvider } from '../ImportWizard/FakeImportApiProvider'
import { SAMPLE_CLUB_ID, committedBatch, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportHistoryPanel } from './ImportHistoryPanel'

const meta: Meta<typeof ImportHistoryPanel> = {
  title: 'Components/ImportHistoryPanel',
  component: ImportHistoryPanel,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof ImportHistoryPanel>

export const Open: Story = {
  render: () => (
    <FakeImportApiProvider>
      <ImportHistoryPanel clubId={SAMPLE_CLUB_ID} open onClose={() => undefined} onOpenReport={() => undefined} onResume={() => undefined} />
    </FakeImportApiProvider>
  ),
}

export const Empty: Story = {
  render: () => (
    <FakeImportApiProvider options={{ history: [] }}>
      <ImportHistoryPanel clubId={SAMPLE_CLUB_ID} open onClose={() => undefined} onOpenReport={() => undefined} onResume={() => undefined} />
    </FakeImportApiProvider>
  ),
}

// A discarded batch is left out of the list until "Show deleted and discarded" is switched on.
export const EndedBatchHidden: Story = {
  render: () => (
    <FakeImportApiProvider options={{ history: [sampleBatch(), committedBatch({ id: 'batch-0', fileName: 'schedule-2025.xlsx' }), sampleBatch({ id: 'batch-9', fileName: 'abandoned-schedule-with-a-very-long-file-name-2024.xlsx', status: 'DISCARDED' })] }}>
      <ImportHistoryPanel clubId={SAMPLE_CLUB_ID} open onClose={() => undefined} onOpenReport={() => undefined} onResume={() => undefined} />
    </FakeImportApiProvider>
  ),
}
