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
  })
})
