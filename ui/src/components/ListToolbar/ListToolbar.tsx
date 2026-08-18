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
  createLabel: string
  onCreate: () => void
}

// Sits above any record list (ProductList today, Subscriptions/Discounts/Invoicing/System
// Settings later — see docs/specs/008-product-catalog.md's UI Requirements). Desktop (>= md):
// one row, search flexes to fill, sort + create stay fixed-width. Mobile (< md): search is
// full-width on its own row, sort and create share the row below it.
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  sortValue,
  sortOptions,
  onSortChange,
  createLabel,
  onCreate,
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

      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 2, flex: { xs: 'unset', md: '1 1 auto' }, minWidth: { xs: 'unset', md: 320 } }}>
        <Input
          select
          label="Sort by"
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
          sx={{ flex: { xs: 1, md: '0 0 200px' } }}
        >
          {sortOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Input>

        <Button onClick={onCreate} sx={{ flex: { xs: 1, md: '0 0 auto' }, whiteSpace: 'nowrap' }}>
          {createLabel}
        </Button>
      </Box>
    </Box>
  )
}
