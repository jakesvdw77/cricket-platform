import { useState } from 'react'
import type { ReactNode } from 'react'
import { Autocomplete, Badge, Box, Button as MuiButton, Chip, InputAdornment, MenuItem, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import FilterListIcon from '@mui/icons-material/FilterList'
import SearchIcon from '@mui/icons-material/Search'
import { BottomSheet } from '../BottomSheet'
import { Button, compactButtonSx } from '../Button'
import { Input } from '../Input'
import { SectionTreeSelect } from '../SectionTreeSelect'
import type { Section } from '../../api/sectionApi'
import { compactFieldsSx, filterPanelSxFor } from '../../utils/filterPanel'
import { toolbarControlSx, toolbarFieldsSx } from '../ToolbarCard/toolbarControlSx'
import type { ToolbarDensity } from '../../utils/filterPanel'
import { sectionPathLabel } from '../../utils/availabilityScope'

// The unset League and Team show their explicit "All ..." value under an always-floated label, the same as
// Section's "All sections", so every field looks alike. The "All" row is the empty value: it is never a chip
// and never counts as an active filter.
const allValueSelectProps = { InputLabelProps: { shrink: true }, SelectProps: { displayEmpty: true } }

// docs/standards/page-anatomy.md section 3: in the flat (bare) desktop bar a floating label sat half on the page wash and half on the
// field's white fill, which read as a patch. The flat bar therefore has no floating label: the field shows its value text only
// ("All teams", "Format: All formats") and keeps its accessible name through aria-label.
function flatSelectProps(label: string, prefixValue: boolean, options: { value: string; text: string }[]) {
  return {
    label: '',
    InputLabelProps: { shrink: false },
    SelectProps: {
      displayEmpty: true,
      SelectDisplayProps: { 'aria-label': label },
      renderValue: (value: unknown) => {
        const text = options.find((option) => option.value === String(value ?? ''))?.text ?? ''
        return prefixValue ? `${label}: ${text}` : text
      },
    },
  }
}

export interface FilterBarOption {
  id: string
  name: string
}

// A view-specific active choice (e.g. "Group polls only") shown as a removable chip on a phone and
// counted in the Filters badge.
export interface FilterBarChip {
  key: string
  label: string
  onRemove: () => void
}

// docs/specs/091: one more select a page owns (Leagues: Format) - shown after the shared filters, with the same always-
// floated "All ..." value, a chip when set and a field in the phone sheet.
export interface FilterBarSelect {
  key: string
  label: string
  // The empty value's row, e.g. "All formats".
  allLabel: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export interface FilterBarProps {
  // A shared filter shows when its options are passed, always in the order League, Season, Section, Team.
  leagues?: FilterBarOption[]
  // docs/specs/087: optional Season (Matches keeps it; the Availability pages never pass it). Map a Season's
  // `label` to `name`.
  seasons?: FilterBarOption[]
  sections?: Section[]
  teams?: FilterBarOption[]
  leagueId?: string | null
  seasonId?: string | null
  sectionId?: string | null
  teamId?: string | null
  onLeagueChange?: (leagueId: string | null) => void
  onSeasonChange?: (seasonId: string | null) => void
  onSectionChange?: (sectionId: string | null) => void
  onTeamChange?: (teamId: string | null) => void
  seasonAllLabel?: string
  teamAllLabel?: string
  // docs/specs/091: page-owned selects (see FilterBarSelect), in order.
  extraSelects?: FilterBarSelect[]
  // Search shows when onSearchChange is passed.
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  // docs/specs/087: when passed, the Search input is an MUI `Autocomplete freeSolo` over this already-loaded,
  // caller-filtered suggestion list (Matches: the club's team names), same as ListToolbar's `searchOptions`.
  // Typing and picking a suggestion both flow through `onSearchChange`. Omitted, a plain input as before.
  searchOptions?: string[]
  // The view's own controls (toggles, sort link): rendered inside the Filters sheet on a phone. On
  // desktop the page shows them on the line above its content (ContentControlsLine), not here, unless
  // `viewControlsInline` puts them at the end of the field row.
  viewControls?: ReactNode
  extraChips?: FilterBarChip[]
  // Clears the filters (the sheet's "Clear all").
  onClearAll: () => void
  // docs/specs/085 (I): 'compact' (the Availability pages) has an 8 px panel padding and gap and 36 px fields on
  // desktop; 'comfortable' (default) is the original look. The phone toolbar keeps its tap heights in both.
  density?: ToolbarDensity
  // docs/specs/126 (calmer league Schedule tab): on desktop, no card chrome (no border, fill, shadow or padding): the fields sit
  // flat on the page wash, each field keeping its own white fill. Omitted, the card is unchanged. A phone keeps its card.
  bare?: boolean
  // docs/specs/126: on desktop, render `viewControls` at the right end of the field row (selects, search, then the controls) instead
  // of leaving them to the page's ContentControlsLine. A phone still shows them in the Filters sheet. Omitted, unchanged.
  viewControlsInline?: boolean
  // docs/standards/page-anatomy.md section 3: the switches (Show inactive, Only our matches ...) that sit left of `viewControls` (Sort and the
  // Cards | List toggle, a pair that stays at the far right). With `viewControlsInline`: inline from lg; at tablet width (sm to lg) they fold
  // into a Filters sheet while the pair stays in the row; on a phone the sheet holds `viewControls` then these. Omitted, unchanged.
  // A function is called with where it renders ('row' or 'sheet') so a page can use toolbar chips in the row and its usual switches in the sheet.
  secondaryControls?: ReactNode | ((placement: 'row' | 'sheet') => ReactNode)
  // The bar sits inside a `ToolbarCard`, which owns the card chrome: the phone bar then has no card of its own.
  inCard?: boolean
}

// docs/specs/083-availability-filters-and-toolbars.md: the one toolbar of the Availability views.
// Desktop: a card with the shared filters and search. Phone (below sm): the card shrinks to search plus
// a "Filters" button with a count badge that opens a bottom sheet (same drawer pattern as MenuSheet) with
// every filter and the view's own controls; active choices also show as removable chips under the card.
export function FilterBar({
  leagues,
  seasons,
  sections,
  teams,
  leagueId = null,
  seasonId = null,
  sectionId = null,
  teamId = null,
  onLeagueChange,
  onSeasonChange,
  onSectionChange,
  onTeamChange,
  seasonAllLabel = 'All seasons',
  teamAllLabel = 'All teams',
  extraSelects = [],
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchOptions,
  viewControls,
  extraChips = [],
  onClearAll,
  density = 'comfortable',
  bare = false,
  viewControlsInline = false,
  secondaryControls,
  inCard = false,
}: FilterBarProps) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [sheetOpen, setSheetOpen] = useState(false)
  const secondaryFor = (placement: 'row' | 'sheet') => (typeof secondaryControls === 'function' ? secondaryControls(placement) : secondaryControls)
  const isNarrow = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true })
  const flatBar = bare && !isPhone
  // Tablet width: the switches leave the row for the Filters sheet (the sheet then holds only them, the fields stay in the row).
  const tabletFold = viewControlsInline && !isPhone && isNarrow && Boolean(secondaryControls)

  const chips: FilterBarChip[] = []
  if (leagueId && onLeagueChange) {
    chips.push({
      key: 'league',
      label: leagues?.find((league) => league.id === leagueId)?.name ?? 'League',
      onRemove: () => onLeagueChange(null),
    })
  }
  if (seasonId && onSeasonChange) {
    chips.push({
      key: 'season',
      label: seasons?.find((season) => season.id === seasonId)?.name ?? 'Season',
      onRemove: () => onSeasonChange(null),
    })
  }
  if (sectionId && onSectionChange) {
    chips.push({
      key: 'section',
      label: sectionPathLabel(sections ?? [], sectionId) ?? 'Section',
      onRemove: () => onSectionChange(null),
    })
  }
  if (teamId && onTeamChange) {
    chips.push({
      key: 'team',
      label: teams?.find((team) => team.id === teamId)?.name ?? 'Team',
      onRemove: () => onTeamChange(null),
    })
  }
  extraSelects.forEach((select) => {
    if (select.value) {
      chips.push({
        key: select.key,
        label: select.options.find((option) => option.value === select.value)?.label ?? select.label,
        onRemove: () => select.onChange(''),
      })
    }
  })
  chips.push(...extraChips)
  const activeCount = chips.length

  // In the desktop row each field shares the width (flex basis); in the sheet's column it is just full width,
  // as a flex basis there would become a height.
  const inlineControls = viewControlsInline && Boolean(viewControls || secondaryControls)
  const fieldsFor = (inSheet: boolean) => {
    const flat = flatBar && !inSheet
    // Inline controls: the selects keep a fixed-ish width and the search takes the rest.
    const fieldSx = inSheet ? { minWidth: 0 } : inlineControls ? { flex: '0 1 260px', minWidth: 0 } : { flex: '1 1 160px', minWidth: 0 }
    return (
    <>
      {leagues && onLeagueChange && (
        <Box sx={fieldSx}>
          <Input
            select
            label="League"
            {...(flat ? flatSelectProps('League', false, [{ value: '', text: 'All leagues' }, ...leagues.map((league) => ({ value: league.id, text: league.name }))]) : allValueSelectProps)}
            value={leagueId ?? ''} onChange={(event) => onLeagueChange(event.target.value || null)}>
            <MenuItem value="">All leagues</MenuItem>
            {leagues.map((league) => (
              <MenuItem key={league.id} value={league.id}>
                {league.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
      )}
      {seasons && onSeasonChange && (
        <Box sx={fieldSx}>
          <Input
            select
            label="Season"
            {...(flat ? flatSelectProps('Season', false, [{ value: '', text: seasonAllLabel }, ...seasons.map((season) => ({ value: season.id, text: season.name }))]) : allValueSelectProps)}
            value={seasonId ?? ''} onChange={(event) => onSeasonChange(event.target.value || null)}>
            <MenuItem value="">{seasonAllLabel}</MenuItem>
            {seasons.map((season) => (
              <MenuItem key={season.id} value={season.id}>
                {season.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
      )}
      {sections && onSectionChange && (
        <Box sx={fieldSx}>
          <SectionTreeSelect label="Section" sections={sections} value={sectionId} onChange={onSectionChange} allowClear floatingLabel={!flat} />
        </Box>
      )}
      {teams && onTeamChange && (
        <Box sx={fieldSx}>
          <Input
            select
            label="Team"
            {...(flat ? flatSelectProps('Team', false, [{ value: '', text: teamAllLabel }, ...teams.map((team) => ({ value: team.id, text: team.name }))]) : allValueSelectProps)}
            value={teamId ?? ''} onChange={(event) => onTeamChange(event.target.value || null)}>
            <MenuItem value="">{teamAllLabel}</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
      )}
      {extraSelects.map((select) => (
        <Box key={select.key} sx={fieldSx}>
          <Input
            select
            label={select.label}
            {...(flat
              ? flatSelectProps(select.label, true, [{ value: '', text: select.allLabel }, ...select.options.map((option) => ({ value: option.value, text: option.label }))])
              : allValueSelectProps)}
            value={select.value}
            onChange={(event) => select.onChange(event.target.value)}
          >
            <MenuItem value="">{select.allLabel}</MenuItem>
            {select.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Input>
        </Box>
      ))}
    </>
    )
  }

  const searchAdornment = (
    <InputAdornment position="start">
      <SearchIcon fontSize="small" color="action" />
    </InputAdornment>
  )
  const search =
    onSearchChange &&
    (searchOptions ? (
      <Autocomplete
        freeSolo
        options={searchOptions}
        inputValue={searchValue}
        onInputChange={(_event, value) => onSearchChange(value)}
        // The compact 36 px fields: the Autocomplete input root and input carry their own padding.
        sx={density === 'compact' ? { '& .MuiOutlinedInput-root': { py: 0 }, '& .MuiOutlinedInput-root .MuiAutocomplete-input': { py: 0 } } : undefined}
        renderInput={(params) => (
          <Input
            {...params}
            label={flatBar ? '' : 'Search'}
            InputLabelProps={{ ...params.InputLabelProps, ...(flatBar && { shrink: false }) }}
            placeholder={searchPlaceholder}
            InputProps={{ ...params.InputProps, startAdornment: searchAdornment }}
            inputProps={{ ...params.inputProps, ...(flatBar && { 'aria-label': 'Search' }) }}
          />
        )}
      />
    ) : (
      <Input
        label={flatBar ? '' : 'Search'}
        InputLabelProps={flatBar ? { shrink: false } : undefined}
        inputProps={flatBar ? { 'aria-label': 'Search' } : undefined}
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        InputProps={{ startAdornment: searchAdornment }}
      />
    ))

  const sheet = (
    <BottomSheet
        open={sheetOpen}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        ariaLabel="Filters"
        title="Filters"
      >
        <Box data-testid="filter-sheet-fields" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
          {!tabletFold && fieldsFor(true)}
          {!tabletFold && viewControls && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 0.5, minHeight: { xs: 44, sm: 28 } }}>
              {viewControls}
            </Box>
          )}
          {secondaryControls && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 0.5, minHeight: { xs: 44, sm: 28 } }}>
              {secondaryFor('sheet')}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <MuiButton variant="text" onClick={onClearAll} sx={{ ...compactButtonSx, fontWeight: 700 }}>
            Clear all
          </MuiButton>
          <Button size="compact" onClick={() => setSheetOpen(false)}>Done</Button>
        </Box>
      </BottomSheet>
  )

  if (!isPhone) {
    return (
      <Box sx={bare ? undefined : filterPanelSxFor(density)} data-testid={bare ? 'filter-bar-bare' : undefined}>
        {tabletFold && sheet}
        <Box
          data-testid="filter-bar-fields"
          sx={[
            { display: 'flex', flexWrap: 'wrap', gap: density === 'compact' ? 1 : 2, ...(inlineControls && { alignItems: 'center' }) },
            ...(density === 'compact' ? [compactFieldsSx] : []),
            ...(bare ? [toolbarFieldsSx] : []),
          ]}
        >
          {fieldsFor(false)}
          {search && <Box sx={{ flex: inlineControls ? '1 1 220px' : '2 1 220px', minWidth: 0 }}>{search}</Box>}
          {inlineControls && (
            <Box data-testid="filter-bar-inline-controls" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.5, flex: 'none', ml: 'auto' }}>
              {tabletFold && (
                <MuiButton
                  variant="outlined"
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  startIcon={<FilterListIcon fontSize="small" />}
                  onClick={() => setSheetOpen(true)}
                  sx={{ ...compactButtonSx, ...toolbarControlSx, flex: '0 0 auto', '&:hover': { bgcolor: 'background.paper', borderColor: 'divider' } }}
                >
                  Filters
                </MuiButton>
              )}
              {!tabletFold && secondaryFor('row')}
              {viewControls}
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={[filterPanelSxFor(density) as object, { flexDirection: 'row', alignItems: 'center', gap: 1, p: 1 }, ...(inCard ? [{ p: 0, border: 0, boxShadow: 0, bgcolor: 'transparent' }] : [])]}>
        {search && <Box sx={{ flex: 1, minWidth: 0 }}>{search}</Box>}
        <MuiButton
          variant="outlined"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
          startIcon={<FilterListIcon fontSize="small" />}
          onClick={() => setSheetOpen(true)}
          sx={{ ...compactButtonSx, flex: '0 0 auto', whiteSpace: 'nowrap', fontWeight: 700 }}
        >
          Filters
          {activeCount > 0 && (
            <Badge
              badgeContent={activeCount}
              color="primary"
              aria-hidden
              sx={{ ml: 1.5, mr: 0.5, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
            />
          )}
        </MuiButton>
      </Box>

      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              variant="outlined"
              label={chip.label}
              onClick={chip.onRemove}
              onDelete={chip.onRemove}
              deleteIcon={<CloseIcon />}
              aria-label={`Remove filter ${chip.label}`}
              sx={{
                bgcolor: 'background.paper',
                borderColor: alpha(theme.palette.primary.main, 0.35),
                color: 'primary.dark',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      )}

      {sheet}
    </Box>
  )
}
