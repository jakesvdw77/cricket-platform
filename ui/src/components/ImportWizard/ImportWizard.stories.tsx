import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { FakeImportApiProvider } from './FakeImportApiProvider'
import type { FakeImportOptions } from './importFakes'
import { SAMPLE_BATCH_ID, SAMPLE_CLUB_ID, SAMPLE_TYPE, committedBatch, confirmableBatch, sampleBatch, SCHEDULE_PROPOSALS } from './importFixtures'
import { ImportWizard } from './ImportWizard'
import type { ImportWizardProps } from './ImportWizard'

const meta: Meta<typeof ImportWizard> = {
  title: 'Components/ImportWizard',
  component: ImportWizard,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ImportWizard>

const columns: ImportWizardProps['columns'] = [
  { id: 'date', header: 'Date' },
  { id: 'home', header: 'Home' },
  { id: 'away', header: 'Away' },
  { id: 'time', header: 'Time' },
]

function Wizard({ options, batchId = SAMPLE_BATCH_ID, schedule = false }: { options?: FakeImportOptions; batchId?: string | null; schedule?: boolean }) {
  return (
    <FakeImportApiProvider options={options}>
      <ImportWizard
        clubId={SAMPLE_CLUB_ID}
        type={SAMPLE_TYPE.type}
        scope={{ params: { leagueId: 'league-1', seasonId: 'season-1' }, scopeMode: 'OURS_ONLY' }}
        title="Import league schedule"
        scopeLabel="Northern Premier League, 2026/27"
        backTo="/manage"
        batchId={batchId}
        columns={columns}
        resultLinks={[{ label: 'View the schedule', to: '/manage/fixtures/matches' }]}
        labels={
          schedule
            ? { rowsStep: 'Check', identifyStep: 'Our teams', resolveStep: 'Teams', reportStep: 'Done', createLabel: 'Create as league team', noun: 'teams', entityLabels: { MATCH: 'Matches', LEAGUE_TEAM: 'League teams' } }
            : { resolveStep: 'Match teams', createLabel: 'Create new league team', entityLabels: { MATCH: 'Matches', LEAGUE_TEAM: 'League teams' } }
        }
        checkSettings={schedule ? ({ decisions, setOptions }) => <Button size="compact" variant="secondary" onClick={() => setOptions({ setting: Number(decisions.options.setting ?? 14) + 1 })}>{`A setting: ${String(decisions.options.setting ?? 14)}`}</Button> : undefined}
        createOptions={schedule ? { withAbbreviation: true } : undefined}
        collapseLowCandidates={schedule}
      />
    </FakeImportApiProvider>
  )
}

export const UploadStep: Story = { render: () => <Wizard batchId={null} /> }
export const UploadFileError: Story = { render: () => <Wizard batchId={null} options={{ previewError: 'This is not the league schedule template.' }} /> }
export const CheckRows: Story = { render: () => <Wizard /> }
export const ReadyToConfirm: Story = { render: () => <Wizard options={{ batch: confirmableBatch() }} /> }
export const NotOursMode: Story = { render: () => <Wizard options={{ batch: sampleBatch({ scopeMode: 'ALL' }) }} /> }
export const Report: Story = { render: () => <Wizard options={{ batch: committedBatch() }} /> }
export const ExpiredBatch: Story = { render: () => <Wizard options={{ batch: sampleBatch({ status: 'EXPIRED' }) }} /> }
export const CheckRowsWithSettings: Story = { render: () => <Wizard schedule /> }
export const ScheduleTeams: Story = { render: () => <Wizard schedule options={{ batch: sampleBatch({ scopeMode: 'ALL', proposals: SCHEDULE_PROPOSALS }) }} /> }
