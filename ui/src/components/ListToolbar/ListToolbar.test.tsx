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
})
