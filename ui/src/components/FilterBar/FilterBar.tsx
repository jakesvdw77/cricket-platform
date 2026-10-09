import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Box, Button as MuiButton, Chip, InputAdornment, MenuItem, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import FilterListIcon from '@mui/icons-material/FilterList'
import SearchIcon from '@mui/icons-material/Search'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'
import { Input } from '../Input'
import { SectionTreeSelect } from '../SectionTreeSelect'
import type { Section } from '../../api/sectionApi'
import { compactFieldsSx, filterPanelSxFor } from '../../utils/filterPanel'
import type { ToolbarDensity } from '../../utils/filterPanel'
import { sectionPathLabel } from '../../utils/availabilityScope'

// The unset League and Team show their explicit "All ..." value under an always-floated label, the same as
// Section's "All sections", so every field looks alike. The "All" row is the empty value: it is never a chip
// and never counts as an active filter.
const allValueSelectProps = { InputLabelProps: { shrink: true }, SelectProps: { displayEmpty: true } }

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
  // Search shows when onSearchChange is passed.
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  // The view's own controls (toggles, sort link): rendered inside the Filters sheet on a phone. On
  // desktop the page shows them on the line above its content (ContentControlsLine), not here.
  viewControls?: ReactNode
  extraChips?: FilterBarChip[]
  // Clears the filters (the sheet's "Clear all").
  onClearAll: () => void
  // docs/specs/085 (I): 'compact' (the Availability pages) has an 8 px panel padding and gap and 36 px fields on
  // desktop; 'comfortable' (default) is the original look. The phone toolbar keeps its tap heights in both.
  density?: ToolbarDensity
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
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  viewControls,
  extraChips = [],
  onClearAll,
  density = 'comfortable',
}: FilterBarProps) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [sheetOpen, setSheetOpen] = useState(false)

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
  chips.push(...extraChips)
  const activeCount = chips.length

  // In the desktop row each field shares the width (flex basis); in the sheet's column it is just full width,
  // as a flex basis there would become a height.
  const fieldsFor = (inSheet: boolean) => {
    const fieldSx = inSheet ? { minWidth: 0 } : { flex: '1 1 160px', minWidth: 0 }
    return (
    <>
      {leagues && onLeagueChange && (
        <Box sx={fieldSx}>
          <Input select label="League" {...allValueSelectProps} value={leagueId ?? ''} onChange={(event) => onLeagueChange(event.target.value || null)}>
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
          <Input select label="Season" {...allValueSelectProps} value={seasonId ?? ''} onChange={(event) => onSeasonChange(event.target.value || null)}>
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
          <SectionTreeSelect label="Section" sections={sections} value={sectionId} onChange={onSectionChange} allowClear />
        </Box>
      )}
      {teams && onTeamChange && (
        <Box sx={fieldSx}>
          <Input select label="Team" {...allValueSelectProps} value={teamId ?? ''} onChange={(event) => onTeamChange(event.target.value || null)}>
            <MenuItem value="">{teamAllLabel}</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
      )}
    </>
    )
  }

  const search = onSearchChange && (
    <Input
      label="Search"
      placeholder={searchPlaceholder}
      value={searchValue}
      onChange={(event) => onSearchChange(event.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        ),
      }}
    />
  )

  if (!isPhone) {
    return (
      <Box sx={filterPanelSxFor(density)}>
        <Box
          data-testid="filter-bar-fields"
          sx={[{ display: 'flex', flexWrap: 'wrap', gap: density === 'compact' ? 1 : 2 }, ...(density === 'compact' ? [compactFieldsSx] : [])]}
        >
          {fieldsFor(false)}
          {search && <Box sx={{ flex: '2 1 220px', minWidth: 0 }}>{search}</Box>}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={[filterPanelSxFor(density) as object, { flexDirection: 'row', alignItems: 'center', gap: 1, p: 1 }]}>
        {search && <Box sx={{ flex: 1, minWidth: 0 }}>{search}</Box>}
        <MuiButton
          variant="outlined"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
          startIcon={<FilterListIcon fontSize="small" />}
          onClick={() => setSheetOpen(true)}
          sx={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontWeight: 700 }}
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

      <BottomSheet
        open={sheetOpen}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        ariaLabel="Filters"
        title="Filters"
      >
        <Box data-testid="filter-sheet-fields" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
          {fieldsFor(true)}
          {viewControls && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 0.5, minHeight: { xs: 44, sm: 28 } }}>
              {viewControls}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <MuiButton variant="text" onClick={onClearAll} sx={{ fontWeight: 700 }}>
            Clear all
          </MuiButton>
          <Button onClick={() => setSheetOpen(false)}>Done</Button>
        </Box>
      </BottomSheet>
    </Box>
  )
}
