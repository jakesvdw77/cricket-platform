import type { ReactNode } from 'react'
import { Autocomplete, InputAdornment, MenuItem } from '@mui/material'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { Input } from '../Input'
import { Button } from '../Button'

export interface ListToolbarSortOption {
  value: string
  label: string
}

// docs/specs/042-match-list-filters-and-search.md: a compact two-state icon toggle, replacing the
// Sort `Select` for a caller that opts in (MatchList — sort by match date, ascending/descending
// only). `ascLabel`/`descLabel` describe what clicking the icon in that state WILL DO (the target
// state), not the current state — standard toggle-button accessibility convention.
export interface ListToolbarSortToggle {
  value: 'asc' | 'desc'
  ascLabel: string
  descLabel: string
  onToggle: () => void
}

export interface ListToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  // docs/specs/042-match-list-filters-and-search.md: when passed, the plain Search Input renders
  // as an MUI `Autocomplete freeSolo` instead — `searchOptions` is a plain, already-loaded,
  // client-side suggestion list (e.g. a club's own team names), filtered/computed by the caller.
  // Typing free text and clicking a suggestion both flow into the same `searchValue`/
  // `onSearchChange` controlled pair, no new state shape. Additive/optional — every other call
  // site (which never passes it) keeps rendering the plain Input exactly as today.
  searchOptions?: string[]
  // Required for the default Select-based Sort rendering path (omitted entirely when the caller
  // passes `sortToggle` instead — see below).
  sortValue?: string
  sortOptions?: ListToolbarSortOption[]
  onSortChange?: (value: string) => void
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
  // docs/specs/042-match-list-filters-and-search.md: when passed, replaces the Sort `Select`
  // entirely with a compact icon toggle — mutually exclusive with `sortValue`/`sortOptions`/
  // `onSortChange`/`sortMinWidth`'s own rendering path, which still renders byte-for-byte
  // unchanged for every call site that omits this prop.
  sortToggle?: ListToolbarSortToggle
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
  sortToggle,
  searchOptions,
}: ListToolbarProps) {
  const searchAdornment = (
    <InputAdornment position="start">
      <SearchIcon fontSize="small" color="action" />
    </InputAdornment>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: { xs: 'nowrap', md: 'wrap' }, gap: 2 }}>
      {searchOptions ? (
        <Autocomplete
          freeSolo
          options={searchOptions}
          inputValue={searchValue}
          onInputChange={(_event, newInputValue) => onSearchChange(newInputValue)}
          sx={{ flex: { xs: 'unset', md: 1 }, minWidth: 0 }}
          renderInput={(params) => (
            <Input
              {...params}
              label="Search"
              placeholder={searchPlaceholder}
              InputProps={{
                ...params.InputProps,
                startAdornment: searchAdornment,
              }}
            />
          )}
        />
      ) : (
        <Input
          label="Search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ flex: { xs: 'unset', md: 1 }, minWidth: 0 }}
          InputProps={{
            startAdornment: searchAdornment,
          }}
        />
      )}

      {filters && (
        <Box sx={{ flex: { xs: 'unset', md: `1 1 ${filtersMinWidth}px` }, minWidth: 0 }}>{filters}</Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 2, flex: { xs: 'unset', md: '0 0 auto' }, alignItems: 'center' }}>
        {sortToggle ? (
          <IconButton
            onClick={sortToggle.onToggle}
            aria-label={sortToggle.value === 'asc' ? sortToggle.descLabel : sortToggle.ascLabel}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
          >
            {sortToggle.value === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
          </IconButton>
        ) : (
          <Input
            select
            label="Sort by"
            value={sortValue}
            onChange={(event) => onSortChange?.(event.target.value)}
            sx={{ flex: { xs: 1, md: `0 0 ${sortMinWidth}px` } }}
          >
            {(sortOptions ?? []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Input>
        )}

        {createLabel && onCreate && (
          <Button onClick={onCreate} sx={{ flex: { xs: 1, md: '0 0 auto' }, whiteSpace: 'nowrap' }}>
            {createLabel}
          </Button>
        )}
      </Box>
    </Box>
  )
}
