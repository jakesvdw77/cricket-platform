import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ImportNote } from '../../../../api/resultImportApi'
import { ImportNotesList, nonNameNotes } from './ImportNotesList'

const note = (message: string, severity: 'INFO' | 'WARNING', fileText?: string): ImportNote => ({ code: 'X', severity, section: 's', message, fileText })

describe('nonNameNotes', () => {
  it('drops the notes about a name and puts warnings before info, each group in order', () => {
    const notes = [note('info one', 'INFO'), note('about Hari', 'WARNING', 'Hari K'), note('warning one', 'WARNING'), note('info two', 'INFO'), note('warning two', 'WARNING')]
    expect(nonNameNotes(notes).map((n) => n.message)).toEqual(['warning one', 'warning two', 'info one', 'info two'])
  })
})

describe('ImportNotesList', () => {
  it('renders nothing when there are none', () => {
    const { container } = render(<ImportNotesList notes={[note('about Hari', 'INFO', 'Hari K')]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each note with an icon and its words, warnings first', () => {
    render(<ImportNotesList notes={[note('Fall of wickets was ignored.', 'INFO'), note('Super-over rows were dropped.', 'WARNING')]} />)
    const items = within(screen.getByTestId('import-notes')).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Super-over rows were dropped.')
    expect(within(items[0]).getByLabelText('Warning')).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('Fall of wickets was ignored.')
    expect(within(items[1]).getByLabelText('Note')).toBeInTheDocument()
  })
})
