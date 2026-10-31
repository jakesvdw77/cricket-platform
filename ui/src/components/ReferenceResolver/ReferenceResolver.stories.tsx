import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { emptyImportDecisions } from '../../api/importApi'
import { seedDecisions } from '../../utils/importDecisions'
import { SAMPLE_PROPOSALS, SCHEDULE_PROPOSALS } from '../ImportWizard/importFixtures'
import { ReferenceResolver } from './ReferenceResolver'
import type { ReferenceResolverProps } from './ReferenceResolver'

const meta: Meta<typeof ReferenceResolver> = {
  title: 'Components/ReferenceResolver',
  component: ReferenceResolver,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ReferenceResolver>

const resolve = SAMPLE_PROPOSALS.filter((proposal) => proposal.step === 'RESOLVE')
const identify = SAMPLE_PROPOSALS.filter((proposal) => proposal.step === 'IDENTIFY_OURS')

function Harness({ mode, proposals, seed = false, ...rest }: Pick<ReferenceResolverProps, 'mode' | 'proposals'> & Partial<ReferenceResolverProps> & { seed?: boolean }) {
  const [decisions, setDecisions] = useState(seed ? seedDecisions(proposals) : emptyImportDecisions())
  const [notOurs, setNotOurs] = useState<string[]>([])
  return <ReferenceResolver {...rest} mode={mode} proposals={proposals} decisions={decisions} onDecisionsChange={setDecisions} notOurs={notOurs} onNotOursChange={setNotOurs} />
}

export const MatchTeams: Story = { render: () => <Harness mode="resolve" proposals={resolve} createLabel="Create new league team" noun="names" /> }
export const IdentifyWhatIsOurs: Story = { render: () => <Harness mode="identify" proposals={identify} seed noun="names" /> }
export const WithExtras: Story = {
  render: () => <Harness mode="resolve" proposals={resolve} renderProposalExtras={(_proposal, candidate) => <span>{`Played ${candidate.confidence > 80 ? 12 : 3} matches`}</span>} />,
}
export const NothingToResolve: Story = { render: () => <Harness mode="resolve" proposals={[]} /> }

export const ScheduleTeams: Story = {
  render: () => (
    <Harness
      mode="resolve"
      proposals={SCHEDULE_PROPOSALS}
      seed
      createLabel="Create as league team"
      noun="teams"
      collapseLow
      create={{ tidyName: (value) => value.charAt(0) + value.slice(1).toLowerCase(), withAbbreviation: true, existingNames: ['Vets'] }}
      renderProposalExtras={(_proposal, candidate) => (candidate.targetKind === 'COPY_LEAGUE_TEAM' ? <span>{`Will be copied from ${candidate.seasonLabel ?? 'an earlier season'}`}</span> : null)}
    />
  ),
}
