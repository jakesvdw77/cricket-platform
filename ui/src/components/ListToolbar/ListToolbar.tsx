import type { ReactNode } from 'react'
import { InputAdornment, MenuItem } from '@mui/material'
import Box from '@mui/material/Box'
import SearchIcon from '@mui/icons-material/Search'
import { Input } from '../Input'
import { Button } from '../Button'

export interface ListToolbarSortOption {
  value: string
  label: string
}

export interface ListToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  sortValue: string
  sortOptions: ListToolbarSortOption[]
  onSortChange: (value: string) => void
  // docs/specs/037-match-improvements.md items 3/4: the Sort-by Select's fixed `md`-breakpoint
  // width — 200px comfortably fits every other list's short option labels ("Name", "Price") but
  // clips MatchList's own longer ones ("Match date (newest first)"). Additive and optional so
  // every other list's Sort-by width stays byte-for-byte unchanged unless a caller opts in.
  sortMinWidth?: number
  // Optional — omit both when the caller places its primary "create" action elsewhere (e.g.
  // ManageScreenHeader's own action slot) rather than in this toolbar row.
  createLabel?: string
  onCreate?: () => void
  // A single extra filter control (e.g. a section picker), rendered inline between Search and
  // Sort — additive/optional so every other list's toolbar stays byte-for-byte unchanged unless a
  // caller opts in.
  filters?: ReactNode
  // Fixed `md`-breakpoint width for the `filters` slot — same "flex 1 on mobile, fixed on desktop"
  // shape as `sortMinWidth`.
  filtersMinWidth?: number
}

// Sits above any record list (ProductList today, Subscriptions/Discounts/Invoicing/System
// Settings later — see docs/specs/008-product-catalog.md's UI Requirements). Desktop (>= md):
// one row, search flexes to fill, filters (if passed) + sort + create stay fixed-width. Mobile
// (< md): search, filters, and the sort+create pair each get their own full-width row — filters
// gets its own row rather than sharing sort+create's, since three flex-1 controls squeezed into
// one mobile row would truncate every label at once.
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  sortValue,
  sortOptions,
  onSortChange,
  sortMinWidth = 200,
  createLabel,
  onCreate,
  filters,
  filtersMinWidth = 200,
}: ListToolbarProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: { xs: 'nowrap', md: 'wrap' }, gap: 2 }}>
      <Input
        label="Search"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ flex: { xs: 'unset', md: 1 }, minWidth: 0 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />

      {filters && (
        <Box sx={{ flex: { xs: 'unset', md: `1 1 ${filtersMinWidth}px` }, minWidth: 0 }}>{filters}</Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 2, flex: { xs: 'unset', md: '0 0 auto' } }}>
        <Input
          select
          label="Sort by"
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
          sx={{ flex: { xs: 1, md: `0 0 ${sortMinWidth}px` } }}
        >
          {sortOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Input>

        {createLabel && onCreate && (
          <Button onClick={onCreate} sx={{ flex: { xs: 1, md: '0 0 auto' }, whiteSpace: 'nowrap' }}>
            {createLabel}
          </Button>
        )}
      </Box>
    </Box>
  )
}
