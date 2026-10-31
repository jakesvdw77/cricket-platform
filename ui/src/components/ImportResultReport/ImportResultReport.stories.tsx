import type { Meta, StoryObj } from '@storybook/react-vite'
import { FakeImportApiProvider } from '../ImportWizard/FakeImportApiProvider'
import { BLOCKED, SAMPLE_CLUB_ID, committedBatch } from '../ImportWizard/importFixtures'
import { ImportResultReport } from './ImportResultReport'

const meta: Meta<typeof ImportResultReport> = {
  title: 'Components/ImportResultReport',
  component: ImportResultReport,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ImportResultReport>

const links = [{ label: 'View the schedule', to: '/manage/fixtures/matches' }]

export const Committed: Story = {
  render: () => (
    <FakeImportApiProvider>
      <ImportResultReport clubId={SAMPLE_CLUB_ID} batch={committedBatch()} resultLinks={links} />
    </FakeImportApiProvider>
  ),
}

export const DeleteBlocked: Story = {
  render: () => (
    <FakeImportApiProvider options={{ deletion: BLOCKED }}>
      <ImportResultReport clubId={SAMPLE_CLUB_ID} batch={committedBatch()} resultLinks={links} />
    </FakeImportApiProvider>
  ),
}

export const Deleted: Story = {
  render: () => (
    <FakeImportApiProvider>
      <ImportResultReport clubId={SAMPLE_CLUB_ID} batch={committedBatch({ status: 'DELETED', deletedAt: '2026-10-28T09:00:00Z', counts: { rows: 10, created: 3, deleted: { Matches: 3 }, kept: { 'Updated matches': 1 } } })} resultLinks={links} />
    </FakeImportApiProvider>
  ),
}

export const TypedInTheWizard: Story = {
  render: () => (
    <FakeImportApiProvider>
      <ImportResultReport clubId={SAMPLE_CLUB_ID} batch={committedBatch({ source: 'MANUAL', fileName: 'Typed in the wizard', counts: { rows: 6, created: 6, added: 6, edited: 0, committedEntities: 6 } })} resultLinks={links} />
    </FakeImportApiProvider>
  ),
}
