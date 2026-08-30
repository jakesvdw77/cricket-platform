import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LinkExistingRecordDialog } from './LinkExistingRecordDialog'

interface Candidate {
  id: string
  name: string
}

const CANDIDATES: Candidate[] = [
  { id: 'bob', name: 'Bob Jones' },
  { id: 'jane', name: 'Jane Smith' },
]

describe('LinkExistingRecordDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <LinkExistingRecordDialog<Candidate>
        open={false}
        onClose={vi.fn()}
        title="Link an existing thing"
        candidates={CANDIDATES}
        getOptionLabel={(option) => option.name}
        onLink={vi.fn()}
      />,
    )

    expect(screen.queryByText('Link an existing thing')).not.toBeInTheDocument()
  })

  it('lists every candidate in the search dropdown', async () => {
    const user = userEvent.setup()
    render(
      <LinkExistingRecordDialog<Candidate>
        open
        onClose={vi.fn()}
        title="Link an existing thing"
        candidates={CANDIDATES}
        getOptionLabel={(option) => option.name}
        searchLabel="Search candidates"
        onLink={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Search candidates' }))

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('Bob Jones')).toBeInTheDocument()
    expect(within(listbox).getByText('Jane Smith')).toBeInTheDocument()
  })

  describe('without an extraField (auto-link-on-select mode)', () => {
    it('calls onLink immediately once an option is selected, with no confirm button', async () => {
      const user = userEvent.setup()
      const onLink = vi.fn()
      render(
        <LinkExistingRecordDialog<Candidate>
          open
          onClose={vi.fn()}
          title="Link an existing thing"
          candidates={CANDIDATES}
          getOptionLabel={(option) => option.name}
          searchLabel="Search candidates"
          onLink={onLink}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Link' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('combobox', { name: 'Search candidates' }))
      await user.click(await screen.findByText('Bob Jones'))

      expect(onLink).toHaveBeenCalledWith(CANDIDATES[0])
      expect(onLink).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <LinkExistingRecordDialog<Candidate>
          open
          onClose={onClose}
          title="Link an existing thing"
          candidates={CANDIDATES}
          getOptionLabel={(option) => option.name}
          onLink={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('with an extraField (select-then-confirm mode)', () => {
    it('does not call onLink on selection alone, and disables Link until an extra value is present', async () => {
      const user = userEvent.setup()
      const onLink = vi.fn()
      render(
        <LinkExistingRecordDialog<Candidate>
          open
          onClose={vi.fn()}
          title="Link an existing thing"
          candidates={CANDIDATES}
          getOptionLabel={(option) => option.name}
          searchLabel="Search candidates"
          onLink={onLink}
          extraField={{ label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] }}
        />,
      )

      expect(screen.getByRole('button', { name: 'Link' })).toBeDisabled()

      await user.click(screen.getByRole('combobox', { name: 'Search candidates' }))
      await user.click(await screen.findByText('Bob Jones'))

      expect(onLink).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Link' })).toBeDisabled()
    })

    it('a quick-fill option populates the extra field without submitting, and can still be edited', async () => {
      const user = userEvent.setup()
      render(
        <LinkExistingRecordDialog<Candidate>
          open
          onClose={vi.fn()}
          title="Link an existing thing"
          candidates={CANDIDATES}
          getOptionLabel={(option) => option.name}
          searchLabel="Search candidates"
          onLink={vi.fn()}
          extraField={{ label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] }}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Coach' }))

      expect(screen.getByLabelText('Role')).toHaveValue('Coach')
      expect(screen.getByRole('button', { name: 'Link' })).toBeDisabled()

      await user.type(screen.getByLabelText('Role'), ' (interim)')
      expect(screen.getByLabelText('Role')).toHaveValue('Coach (interim)')
    })

    it('clicking Link calls onLink with the selected candidate and the trimmed extra value', async () => {
      const user = userEvent.setup()
      const onLink = vi.fn()
      render(
        <LinkExistingRecordDialog<Candidate>
          open
          onClose={vi.fn()}
          title="Link an existing thing"
          candidates={CANDIDATES}
          getOptionLabel={(option) => option.name}
          searchLabel="Search candidates"
          onLink={onLink}
          extraField={{ label: 'Role' }}
        />,
      )

      await user.click(screen.getByRole('combobox', { name: 'Search candidates' }))
      await user.click(await screen.findByText('Jane Smith'))
      await user.type(screen.getByLabelText('Role'), '  Manager  ')
      await user.click(screen.getByRole('button', { name: 'Link' }))

      expect(onLink).toHaveBeenCalledWith(CANDIDATES[1], 'Manager')
    })
  })
})
