import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ListToolbar } from './ListToolbar'
import type { ListToolbarSortOption } from './ListToolbar'

const SORT_OPTIONS: ListToolbarSortOption[] = [
  { value: 'name,asc', label: 'Name' },
  { value: 'price,asc', label: 'Price' },
  { value: 'displayOrder,asc', label: 'Display order' },
]

const meta: Meta<typeof ListToolbar> = {
  title: 'Components/ListToolbar',
  component: ListToolbar,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ListToolbar>

function Controlled() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  return (
    <ListToolbar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search products"
      sortValue={sort}
      sortOptions={SORT_OPTIONS}
      onSortChange={setSort}
      createLabel="Add Product"
      onCreate={() => undefined}
    />
  )
}

export const Default: Story = {
  render: () => <Controlled />,
}

export const WithSearchValue: Story = {
  args: {
    searchValue: 'club',
    onSearchChange: () => undefined,
    sortValue: 'name,asc',
    sortOptions: SORT_OPTIONS,
    onSortChange: () => undefined,
    createLabel: 'Add Product',
    onCreate: () => undefined,
  },
}

// docs/specs/008-product-catalog.md's Test Plan requires a story at each of 375/768/1280 —
// mobile stacks search full-width above sort + create sharing a row, desktop is a single row.
export const MobileViewport: Story = {
  render: () => <Controlled />,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  render: () => <Controlled />,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  render: () => <Controlled />,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
