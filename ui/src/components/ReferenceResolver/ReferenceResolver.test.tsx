import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportDecisions } from '../../api/importApi'
import { SAMPLE_PROPOSALS, SCHEDULE_PROPOSALS } from '../ImportWizard/importFixtures'
import { seedDecisions } from '../../utils/importDecisions'
import { ReferenceResolver } from './ReferenceResolver'

const resolveProposals = SAMPLE_PROPOSALS.filter((proposal) => proposal.step === 'RESOLVE')
const identifyProposals = SAMPLE_PROPOSALS.filter((proposal) => proposal.step === 'IDENTIFY_OURS')

function Harness({ mode = 'resolve', initial }: { mode?: 'resolve' | 'identify'; initial?: ImportDecisions }) {
  const [decisions, setDecisions] = useState(initial ?? emptyImportDecisions())
  const [notOurs, setNotOurs] = useState<string[]>([])
  return <ReferenceResolver mode={mode} proposals={mode === 'resolve' ? resolveProposals : identifyProposals} decisions={decisions} onDecisionsChange={setDecisions} notOurs={notOurs} onNotOursChange={setNotOurs} />
}

describe('ReferenceResolver', () => {
  it('ranks proposals by confidence and preselects nothing', () => {
    render(<Harness />)
    expect(screen.getByTestId('proposal-VETERANS-0')).toHaveTextContent('Vets')
    expect(screen.getByTestId('proposal-VETERANS-0')).toHaveTextContent('92%')
    expect(screen.getByTestId('proposal-VETERANS-1')).toHaveTextContent('Veterans XI')
    expect(screen.getByTestId('resolver-progress')).toHaveTextContent('0 of 2 names resolved')
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('links, creates and skips, and counts progress', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Link: Vets' }))
    expect(screen.getByTestId('resolver-progress')).toHaveTextContent('1 of 2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Create' })[1])
    expect(screen.getByTestId('resolver-progress')).toHaveTextContent('2 of 2')
    expect(screen.getByTestId('resolver-card-Zebras')).toHaveTextContent('Will create new')
  })

  it('shows a seeded exact match as already resolved', () => {
    render(<Harness mode="identify" initial={seedDecisions(identifyProposals)} />)
    expect(screen.getByTestId('resolver-card-CBCOB')).toHaveAttribute('data-resolved', 'true')
    expect(screen.getByTestId('resolver-card-OLD BOYS')).toHaveAttribute('data-resolved', 'false')
    expect(screen.getByTestId('resolver-progress')).toHaveTextContent('1 of 2 names identified')
  })

  it('marks a value as not ours', () => {
    render(<Harness mode="identify" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Not ours' })[1])
    expect(screen.getByTestId('resolver-card-OLD BOYS')).toHaveAttribute('data-resolved', 'true')
  })
})

function ScheduleHarness() {
  const [decisions, setDecisions] = useState(emptyImportDecisions())
  return (
    <ReferenceResolver
      mode="resolve"
      proposals={SCHEDULE_PROPOSALS}
      decisions={decisions}
      onDecisionsChange={setDecisions}
      collapseLow
      create={{ tidyName: (value) => value.charAt(0) + value.slice(1).toLowerCase(), withAbbreviation: true, existingNames: ['Phsob'] }}
    />
  )
}

describe('ReferenceResolver, schedule candidates', () => {
  it('shows a sister team as a hint with no Link action and collapses weak matches', () => {
    render(<ScheduleHarness />)
    expect(screen.getByTestId('proposal-POLICE 2-0')).toHaveTextContent('Sister team')
    expect(screen.queryByRole('button', { name: /Link: Police 1/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Veterans XI')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 weaker match' }))
    expect(screen.getByText('Veterans XI')).toBeInTheDocument()
  })

  it('copies a team from an earlier season and says so', () => {
    render(<ScheduleHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy: Vets' }))
    expect(screen.getByTestId('resolver-card-VETERANS')).toHaveTextContent('Will copy: Vets')
  })

  it('offers a tidied name and abbreviation for a new team and hints at a duplicate', () => {
    render(<ScheduleHarness />)
    const card = screen.getByTestId('resolver-card-PHSOB')
    fireEvent.click(within(card).getByRole('button', { name: 'Create' }))
    const name = within(card).getByLabelText('Name of the new team')
    expect(name).toHaveValue('Phsob')
    expect(within(card).getByText(/This name already exists/)).toBeInTheDocument()
    fireEvent.change(name, { target: { value: 'PHSOB Old Boys' } })
    expect(within(card).queryByText(/This name already exists/)).not.toBeInTheDocument()
    expect(within(card).getByLabelText('Abbreviation (optional)')).toBeInTheDocument()
  })

  it('explains Link and Create in tooltips (MUI also opens them on keyboard focus)', async () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Link: Vets' })).toHaveTextContent(/^Link$/)
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Link: Vets' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Use this existing team for the name in your file')
    fireEvent.mouseOver(screen.getAllByRole('button', { name: 'Create' })[0])
    expect(await screen.findByText('Add it as a new league team')).toBeInTheDocument()
  })
})
