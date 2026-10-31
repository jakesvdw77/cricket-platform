import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyImportDecisions } from '../../api/importApi'
import type { ImportBatch, ImportDecisions } from '../../api/importApi'
import { confirmableBatch, sampleBatch } from '../ImportWizard/importFixtures'
import { ImportConfirmPanel } from './ImportConfirmPanel'

function Harness({ batch, onConfirm = vi.fn() }: { batch: ImportBatch; onConfirm?: () => void }) {
  const [decisions, setDecisions] = useState<ImportDecisions>(emptyImportDecisions())
  return <ImportConfirmPanel batch={batch} decisions={decisions} onDecisionsChange={setDecisions} onBack={() => undefined} onConfirm={onConfirm} />
}

describe('ImportConfirmPanel', () => {
  it('says nothing has been saved and lists what will be created', () => {
    render(<Harness batch={confirmableBatch()} />)
    expect(screen.getByText(/nothing has been saved yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Match that will be created|Match.*created \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText(/rows do not involve your records/i)).toBeInTheDocument()
  })

  it('keeps Confirm disabled with the reason while errors remain', () => {
    render(<Harness batch={sampleBatch()} />)
    expect(screen.getByRole('button', { name: 'Confirm and import' })).toBeDisabled()
    expect(screen.getByText('Fix or exclude 2 errors to continue.')).toBeInTheDocument()
  })

  it('needs every warning ticked before Confirm is allowed', () => {
    const onConfirm = vi.fn()
    render(<Harness batch={confirmableBatch()} onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Confirm and import' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText('Acknowledge 2 warnings to continue.')).toBeInTheDocument()
    for (const tick of screen.getAllByRole('checkbox')) fireEvent.click(tick)
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('waits for the token even when everything is ticked', () => {
    render(<Harness batch={confirmableBatch({ confirmationToken: null })} />)
    for (const tick of screen.getAllByRole('checkbox')) fireEvent.click(tick)
    expect(screen.getByRole('button', { name: 'Confirm and import' })).toBeDisabled()
  })

  it('shows the quiet teams line and a Change teams action only when given', () => {
    const onChangeTeams = vi.fn()
    const { rerender } = render(<ImportConfirmPanel batch={confirmableBatch()} decisions={emptyImportDecisions()} onDecisionsChange={() => undefined} onBack={() => undefined} onConfirm={() => undefined} teamSummary={{ matched: 10, created: 2 }} teamsLabel="Teams" onChangeTeams={onChangeTeams} />)
    expect(screen.getByTestId('team-summary')).toHaveTextContent('Teams: 10 matched, 2 new')
    fireEvent.click(screen.getByRole('button', { name: 'Change teams' }))
    expect(onChangeTeams).toHaveBeenCalledTimes(1)
    rerender(<ImportConfirmPanel batch={confirmableBatch()} decisions={emptyImportDecisions()} onDecisionsChange={() => undefined} onBack={() => undefined} onConfirm={() => undefined} />)
    expect(screen.queryByTestId('team-summary')).not.toBeInTheDocument()
  })
})
