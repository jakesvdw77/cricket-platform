import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ImportColumnOptions } from '../../utils/importDecisions'
import { SAMPLE_EDITABLE_COLUMNS } from '../ImportWizard/importFixtures'
import { editKeyHandler } from './editKeyHandler'
import { RowEditFields } from './ImportRowEdit'
import type { ImportEditLayout } from './ImportRowEdit'

const LAYOUT: ImportEditLayout = { primary: ['date', 'time', 'home', 'away', 'venue'], secondary: ['notes'] }
const OPTIONS = { home: ['Alphas', 'Bravos'], away: ['Alphas', 'Bravos'], venue: ['Main oval'] }

function Harness({ initial, onSave = vi.fn(), onCancel = vi.fn(), layout = LAYOUT, options = OPTIONS }: { initial: Record<string, string>; onSave?: () => void; onCancel?: () => void; layout?: ImportEditLayout | null; options?: ImportColumnOptions }) {
  const [values, setValues] = useState(initial)
  return (
    <div onKeyDown={editKeyHandler(onSave, onCancel)}>
      <RowEditFields columns={SAMPLE_EDITABLE_COLUMNS} values={values} onChange={(key, next) => setValues((current) => ({ ...current, [key]: next }))} rowLabel="7" columnOptions={options} layout={layout ?? undefined} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </div>
  )
}
const current = () => JSON.parse(screen.getByTestId('values').textContent ?? '{}') as Record<string, string>

describe('RowEditFields (spec 125)', () => {
  it('lays the inputs out in the consumer order, notes behind Add note', () => {
    render(<Harness initial={{ date: '2026-10-04', time: '09:00', home: 'A', away: 'B', venue: 'V' }} />)
    expect(screen.getByLabelText('Date, row 7')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Time, row 7')).toHaveValue('09:00')
    expect(screen.getByLabelText('Time, row 7')).toHaveAttribute('inputmode', 'numeric')
    const order = ['Date, row 7', 'Time, row 7', 'Home team, row 7', 'Away team, row 7', 'Venue, row 7'].map((name) => screen.getByLabelText(name))
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByLabelText('Notes, row 7')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByLabelText('Notes, row 7'), { target: { value: 'Bring covers' } })
    expect(current().notes).toBe('Bring covers')
    fireEvent.click(screen.getByRole('button', { name: 'Remove note' }))
    expect(current().notes).toBe('')
    expect(screen.queryByLabelText('Notes, row 7')).not.toBeInTheDocument()
  })

  it('shows notes open when the row already has one', () => {
    render(<Harness initial={{ notes: 'Existing' }} />)
    expect(screen.getByLabelText('Notes, row 7')).toHaveValue('Existing')
    expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument()
  })

  it('suggests names, and keeps a typed name that is not listed', async () => {
    render(<Harness initial={{ home: '' }} />)
    const home = screen.getByLabelText('Home team, row 7')
    fireEvent.focus(home)
    fireEvent.change(home, { target: { value: 'Br' } })
    expect(await screen.findByRole('option', { name: 'Bravos' })).toBeInTheDocument()
    fireEvent.change(home, { target: { value: 'Zebras' } })
    expect(current().home).toBe('Zebras')
  })

  it('falls back to a text input with help for a non-ISO file value, and back to the picker once it matches', () => {
    render(<Harness initial={{ date: '13-Sept-26', time: '8.00' }} />)
    const date = screen.getByLabelText('Date, row 7')
    expect(date).toHaveAttribute('type', 'text')
    expect(date).toHaveValue('13-Sept-26')
    expect(screen.getByText('Pick a date or type yyyy-mm-dd')).toBeInTheDocument()
    expect(screen.getByLabelText('Time, row 7')).toHaveAttribute('type', 'text')
    expect(screen.getByText('Type a time as HH:mm')).toBeInTheDocument()
    expect(current()).toEqual({ date: '13-Sept-26', time: '8.00' })
    fireEvent.change(date, { target: { value: '2026-09-13' } })
    expect(screen.getByLabelText('Date, row 7')).toHaveAttribute('type', 'date')
  })

  it('steps the time with ArrowUp and ArrowDown without saving or cancelling the row', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<Harness initial={{ time: '09:00' }} onSave={onSave} onCancel={onCancel} />)
    const time = screen.getByLabelText('Time, row 7')
    fireEvent.keyDown(time, { key: 'ArrowUp' })
    expect(current().time).toBe('09:15')
    fireEvent.keyDown(time, { key: 'ArrowDown' })
    fireEvent.keyDown(time, { key: 'ArrowDown' })
    expect(current().time).toBe('08:45')
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.keyDown(time, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('keeps a file time that is not HH:mm as text until it is cleared, then offers the stepper', () => {
    render(<Harness initial={{ time: '8.00' }} />)
    const time = screen.getByLabelText('Time, row 7')
    fireEvent.change(time, { target: { value: '8.0' } })
    expect(current().time).toBe('8.0')
    fireEvent.change(screen.getByLabelText('Time, row 7'), { target: { value: '' } })
    expect(screen.getByLabelText('Time, row 7')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.queryByText('Type a time as HH:mm')).not.toBeInTheDocument()
  })

  it('lists the given options for a team, opens with the full list on an existing value, and narrows as the user types', async () => {
    render(<Harness initial={{ away: 'Police 1' }} options={{ home: ['Alphas', 'Bravos'], away: ['Police 1', 'Pol Stars', 'CBC 1', 'Harlequins'] }} />)
    const away = screen.getByLabelText('Away team, row 7')
    fireEvent.focus(away)
    fireEvent.keyDown(away, { key: 'ArrowDown' })
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Police 1', 'Pol Stars', 'CBC 1', 'Harlequins'])
    fireEvent.change(away, { target: { value: 'pol' } })
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Police 1', 'Pol Stars']))
    fireEvent.change(away, { target: { value: ' stars' } })
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Pol Stars']))
  })

  it('leaves the team chosen on the other side out of each list, live, and by identity too', async () => {
    const options = { home: [{ label: 'Irene Villagers 1', kind: 'OWN_TEAM' as const, id: 't-1' }, 'Hilton', 'Pol Stars'], away: [{ label: 'Irene Villagers 1', kind: 'OWN_TEAM' as const, id: 't-1' }, 'Hilton', 'Pol Stars'] }
    render(<Harness initial={{ home: 'irene  villagers 1', away: '' }} options={options} layout={{ ...LAYOUT, differentPair: ['home', 'away'] }} />)
    const away = screen.getByLabelText('Away team, row 7')
    fireEvent.focus(away)
    fireEvent.keyDown(away, { key: 'ArrowDown' })
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Hilton', 'Pol Stars'])
    fireEvent.keyDown(away, { key: 'Escape' })
    fireEvent.change(screen.getByLabelText('Home team, row 7'), { target: { value: 'Hilton' } })
    fireEvent.keyDown(screen.getByLabelText('Home team, row 7'), { key: 'Escape' })
    fireEvent.change(away, { target: { value: '' } })
    fireEvent.keyDown(away, { key: 'ArrowDown' })
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Irene Villagers 1', 'Pol Stars']))
    const home = screen.getByLabelText('Home team, row 7')
    fireEvent.change(away, { target: { value: 'Pol Stars' } })
    fireEvent.keyDown(away, { key: 'Escape' })
    fireEvent.change(home, { target: { value: '' } })
    fireEvent.keyDown(home, { key: 'ArrowDown' })
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Irene Villagers 1', 'Hilton']))
  })

  it('shows the helper under the second box when the same name is typed on both sides', () => {
    render(<Harness initial={{ home: 'Hilton', away: '' }} layout={{ ...LAYOUT, differentPair: ['home', 'away'] }} />)
    expect(screen.queryByText('A team cannot play itself')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Away team, row 7'), { target: { value: ' hilton ' } })
    expect(screen.getByText('A team cannot play itself')).toBeInTheDocument()
  })

  it('saves with Enter and cancels with Escape, but Enter on a highlighted suggestion only picks it', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<Harness initial={{ venue: '' }} onSave={onSave} onCancel={onCancel} />)
    const venue = screen.getByLabelText('Venue, row 7')
    fireEvent.change(venue, { target: { value: 'Side pitch' } })
    fireEvent.keyDown(venue, { key: 'Escape' })
    fireEvent.keyDown(venue, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('Time, row 7'), { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
    fireEvent.change(venue, { target: { value: 'Main' } })
    fireEvent.keyDown(venue, { key: 'ArrowDown' })
    fireEvent.keyDown(venue, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(current().venue).toBe('Main oval')
  })

  it('uses the declared order in one group when no layout is given', () => {
    render(<Harness initial={{}} layout={null} />)
    expect(screen.getByLabelText('Notes, row 7')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument()
  })
})
