import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ListToolbar } from './ListToolbar'
import type { ListToolbarSortOption } from './ListToolbar'

const SORT_OPTIONS: ListToolbarSortOption[] = [
  { value: 'name,asc', label: 'Name' },
  { value: 'price,asc', label: 'Price' },
]

// A stateful wrapper — ListToolbar is fully controlled (searchValue/onSearchChange), so
// exercising real typing needs something that actually stores the value between keystrokes.
function ControlledToolbar({
  onCreate = vi.fn(),
  onSortChange,
}: {
  onCreate?: () => void
  onSortChange?: (value: string) => void
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  return (
    <ListToolbar
      searchValue={search}
      onSearchChange={setSearch}
      sortValue={sort}
      sortOptions={SORT_OPTIONS}
      onSortChange={(value) => {
        setSort(value)
        onSortChange?.(value)
      }}
      createLabel="Add Product"
      onCreate={onCreate}
    />
  )
}

describe('ListToolbar', () => {
  it('renders a labeled search field, sort control, and create action', () => {
    render(<ControlledToolbar />)

    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Product' })).toBeInTheDocument()
  })

  it('reflects typed search input', async () => {
    const user = userEvent.setup()
    render(<ControlledToolbar />)

    await user.type(screen.getByLabelText('Search'), 'club')

    expect(screen.getByLabelText('Search')).toHaveValue('club')
  })

  it('fires onSortChange when a sort option is selected', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<ControlledToolbar onSortChange={onSortChange} />)

    await user.click(screen.getByLabelText('Sort by'))
    await user.click(await screen.findByRole('option', { name: 'Price' }))

    expect(onSortChange).toHaveBeenCalledWith('price,asc')
  })

  it('fires onCreate when the create action is clicked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<ControlledToolbar onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: 'Add Product' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  // docs/specs/037-match-improvements.md items 3/4: an additive, optional prop so MatchList's own
  // longer sort-option labels ("Match date (newest first)") stop clipping inside the default
  // 200px-wide Sort-by column, without touching any other list's default width.
  it('applies a custom sortMinWidth to the Sort-by control\'s md-breakpoint width, defaulting to 200px', () => {
    const { rerender } = render(
      <ListToolbar
        searchValue=""
        onSearchChange={() => undefined}
        sortValue={SORT_OPTIONS[0].value}
        sortOptions={SORT_OPTIONS}
        onSortChange={() => undefined}
        createLabel="Add Product"
        onCreate={() => undefined}
      />,
    )
    expect(document.head.innerHTML).toContain('0 0 200px')

    rerender(
      <ListToolbar
        searchValue=""
        onSearchChange={() => undefined}
        sortValue={SORT_OPTIONS[0].value}
        sortOptions={SORT_OPTIONS}
        onSortChange={() => undefined}
        sortMinWidth={260}
        createLabel="Add Product"
        onCreate={() => undefined}
      />,
    )
    expect(document.head.innerHTML).toContain('0 0 260px')
  })

  // docs/specs/041-list-screen-header-actions.md: an additive, optional single-control slot (e.g.
  // a SectionTreeSelect) rendered inline with Search/Sort — absent entirely when the caller
  // doesn't pass one, so every existing call site is unaffected.
  it('renders a passed filters control, and renders nothing extra when filters is omitted', () => {
    const { rerender } = render(
      <ListToolbar
        searchValue=""
        onSearchChange={() => undefined}
        sortValue={SORT_OPTIONS[0].value}
        sortOptions={SORT_OPTIONS}
        onSortChange={() => undefined}
        filters={<label htmlFor="section-filter">Section filter</label>}
      />,
    )
    expect(screen.getByText('Section filter')).toBeInTheDocument()

    rerender(
      <ListToolbar
        searchValue=""
        onSearchChange={() => undefined}
        sortValue={SORT_OPTIONS[0].value}
        sortOptions={SORT_OPTIONS}
        onSortChange={() => undefined}
      />,
    )
    expect(screen.queryByText('Section filter')).not.toBeInTheDocument()
  })

  // docs/specs/041-list-screen-header-actions.md: createLabel/onCreate are now optional — a
  // caller placing its primary create action in ManageScreenHeader's own action slot instead
  // renders no Create button here at all, rather than a broken/no-op one.
  // docs/specs/073-availability-hub.md: the Select path has no caption.
  it('renders no caption on the Select sort path', () => {
    render(<ControlledToolbar />)

    expect(document.querySelector('.MuiTypography-caption')).not.toBeInTheDocument()
  })

  it('renders no create button when createLabel/onCreate are both omitted', () => {
    render(
      <ListToolbar
        searchValue=""
        onSearchChange={() => undefined}
        sortValue={SORT_OPTIONS[0].value}
        sortOptions={SORT_OPTIONS}
        onSortChange={() => undefined}
      />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // docs/specs/042-match-list-filters-and-search.md: an additive, optional prop — when passed, the
  // Sort `Select` is replaced entirely by a compact icon toggle; every other call site (which
  // never passes it) keeps rendering the Select exactly as before, per the tests above.
  // docs/specs/068: the Player Availability grid has nothing to sort - no Sort control renders.
  it('renders no Sort control when neither sortToggle nor sortOptions is passed', () => {
    render(<ListToolbar searchValue="" onSearchChange={() => undefined} />)

    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('sortToggle', () => {
    it('renders an icon button instead of the Sort Select when passed, with an aria-label describing the target state', () => {
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{
            value: 'asc',
            ascLabel: 'Sort ascending',
            descLabel: 'Sort descending',
            onToggle: () => undefined,
          }}
        />,
      )

      expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()
    })

    it('calls onToggle when clicked, and flips the aria-label to the other target state', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      const { rerender } = render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'asc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle }}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Sort descending' }))
      expect(onToggle).toHaveBeenCalledTimes(1)

      rerender(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'desc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle }}
        />,
      )
      expect(screen.getByRole('button', { name: 'Sort ascending' })).toBeInTheDocument()
    })

    // docs/specs/073-availability-hub.md
    it('shows an aria-hidden caption with the current sort label, per sort state', () => {
      const toggle = { ascLabel: 'Match date, soonest first', descLabel: 'Match date, latest first', onToggle: () => undefined }
      const { rerender } = render(<ListToolbar searchValue="" onSearchChange={() => undefined} sortToggle={{ value: 'asc', ...toggle }} />)

      const caption = screen.getByText('Match date, soonest first')
      expect(caption).toHaveAttribute('aria-hidden', 'true')
      expect(screen.queryByText('Match date, latest first')).not.toBeInTheDocument()

      rerender(<ListToolbar searchValue="" onSearchChange={() => undefined} sortToggle={{ value: 'desc', ...toggle }} />)
      expect(screen.getByText('Match date, latest first')).toHaveAttribute('aria-hidden', 'true')
      expect(screen.queryByText('Match date, soonest first')).not.toBeInTheDocument()
    })

    it('renders the sort icon button at 40 x 40', () => {
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'asc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle: () => undefined }}
        />,
      )

      expect(screen.getByRole('button', { name: 'Sort descending' })).toHaveStyle({ width: '40px', height: '40px' })
    })

    it('puts the sort group (sort and create) first on xs via CSS order while the DOM order stays search, sort', () => {
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'asc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle: () => undefined }}
          createLabel="Add"
          onCreate={() => undefined}
        />,
      )

      const search = screen.getByLabelText('Search')
      const sortButton = screen.getByRole('button', { name: 'Sort descending' })
      const create = screen.getByRole('button', { name: 'Add' })
      expect(search.compareDocumentPosition(sortButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The create button sits in the same group as the sort control.
      expect(sortButton.parentElement).toBe(create.parentElement)
      expect(sortButton.parentElement).toHaveStyle({ display: 'flex' })
      // jsdom applies no media queries, so read the xs order rule from the emitted stylesheet.
      const groupClass = Array.from(sortButton.parentElement?.classList ?? []).find((name) => name.startsWith('css-'))
      // The xs (min-width:0px) rule carries order:-1; the md media rule resets it to 0.
      const css = document.head.innerHTML
      expect(css).toMatch(new RegExp(`@media[^{]*min-width:0px\\)\\{\\.${groupClass}\\{[^}]*order:-1`))
      expect(css).toMatch(new RegExp(`@media[^{]*min-width:900px\\)\\{\\.${groupClass}\\{[^}]*order:0`))
    })

    it('shows a tooltip stating the current sort and what a click does, keeping the aria-label', async () => {
      const user = userEvent.setup()
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{
            value: 'asc',
            ascLabel: 'Match date, soonest first',
            descLabel: 'Match date, latest first',
            onToggle: () => undefined,
          }}
        />,
      )

      const button = screen.getByRole('button', { name: 'Match date, latest first' })
      await user.hover(button)
      expect(
        await screen.findByRole('tooltip', {
          name: 'Sorted by Match date, soonest first. Click for Match date, latest first.',
        }),
      ).toBeInTheDocument()
    })
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the new compact field picker, additive on top
  // of sortToggle — only ClubContactList (two sortable fields) passes this today.
  describe('sortFieldOptions', () => {
    const FIELD_OPTIONS = [
      { value: 'name', label: 'Name' },
      { value: 'role', label: 'Role' },
    ]

    it('does not render the field picker when sortToggle is omitted, even with more than one sortFieldOptions entry', () => {
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortValue={SORT_OPTIONS[0].value}
          sortOptions={SORT_OPTIONS}
          onSortChange={() => undefined}
          sortFieldOptions={FIELD_OPTIONS}
          sortField="name"
          onSortFieldChange={() => undefined}
        />,
      )

      expect(screen.queryByRole('button', { name: /Sort field/ })).not.toBeInTheDocument()
    })

    it('does not render the field picker when sortFieldOptions is omitted, has zero entries, or has exactly one entry', () => {
      const baseProps = {
        searchValue: '',
        onSearchChange: () => undefined,
        sortToggle: { value: 'asc' as const, ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle: () => undefined },
      }

      const { rerender } = render(<ListToolbar {...baseProps} />)
      expect(screen.queryByRole('button', { name: /Sort field/ })).not.toBeInTheDocument()

      rerender(<ListToolbar {...baseProps} sortFieldOptions={[]} />)
      expect(screen.queryByRole('button', { name: /Sort field/ })).not.toBeInTheDocument()

      rerender(<ListToolbar {...baseProps} sortFieldOptions={[FIELD_OPTIONS[0]]} sortField="name" onSortFieldChange={() => undefined} />)
      expect(screen.queryByRole('button', { name: /Sort field/ })).not.toBeInTheDocument()
      // The plain sortToggle-only button must still render exactly as every other single-field
      // caller's does — the field picker's absence doesn't affect it.
      expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()
    })

    it('renders the field picker showing the active field, and every existing sortToggle-only rendering stays unaffected', () => {
      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'asc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle: () => undefined }}
          sortFieldOptions={FIELD_OPTIONS}
          sortField="name"
          onSortFieldChange={() => undefined}
        />,
      )

      expect(screen.getByRole('button', { name: 'Sort field: Name' })).toBeInTheDocument()
      // Direction toggle keeps rendering exactly as the plain sortToggle-only case does.
      expect(screen.getByRole('button', { name: 'Sort descending' })).toBeInTheDocument()
    })

    it('selecting a field from the menu calls onSortFieldChange with that field\'s value, leaving direction untouched', async () => {
      const user = userEvent.setup()
      const onSortFieldChange = vi.fn()
      const onToggle = vi.fn()

      render(
        <ListToolbar
          searchValue=""
          onSearchChange={() => undefined}
          sortToggle={{ value: 'asc', ascLabel: 'Sort ascending', descLabel: 'Sort descending', onToggle }}
          sortFieldOptions={FIELD_OPTIONS}
          sortField="name"
          onSortFieldChange={onSortFieldChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Sort field: Name' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Role' }))

      expect(onSortFieldChange).toHaveBeenCalledWith('role')
      expect(onToggle).not.toHaveBeenCalled()
    })
  })
})
