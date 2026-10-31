import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportBatch } from '../../api/importApi'
import { confirmableBatch, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportConfirmPanel } from './ImportConfirmPanel'

const meta: Meta<typeof ImportConfirmPanel> = {
  title: 'Components/ImportConfirmPanel',
  component: ImportConfirmPanel,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ImportConfirmPanel>

function Harness({ batch, saving = false, confirming = false, errorMessage }: { batch: ImportBatch; saving?: boolean; confirming?: boolean; errorMessage?: string }) {
  const [decisions, setDecisions] = useState(emptyImportDecisions())
  return <ImportConfirmPanel batch={batch} decisions={decisions} onDecisionsChange={setDecisions} entityLabels={{ MATCH: 'Matches', LEAGUE_TEAM: 'League teams' }} onBack={() => undefined} onConfirm={() => undefined} saving={saving} confirming={confirming} errorMessage={errorMessage} />
}

export const WarningsToAcknowledge: Story = { render: () => <Harness batch={confirmableBatch()} /> }
export const ErrorsRemain: Story = { render: () => <Harness batch={sampleBatch()} /> }
export const Saving: Story = { render: () => <Harness batch={confirmableBatch({ confirmationToken: null })} saving /> }
export const Importing: Story = { render: () => <Harness batch={confirmableBatch()} confirming /> }
export const CommitRefused: Story = { render: () => <Harness batch={confirmableBatch()} errorMessage="A new match appeared that clashes with row 44. Check the rows again." /> }
