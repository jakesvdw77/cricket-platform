import { useId, useState } from 'react'
import { Button, Menu, MenuItem } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import CheckIcon from '@mui/icons-material/Check'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

export interface HeaderSeasonOption {
  id: string
  name: string
}

export interface HeaderSeasonSelectProps {
  seasons: HeaderSeasonOption[]
  // The chosen season, or null for all seasons.
  value: string | null
  onChange: (seasonId: string | null) => void
  allLabel?: string
  // docs/specs/091: false drops the "All seasons" row (Leagues: a league card is always for one season).
  showAll?: boolean
}

// docs/specs/089: the season of a list page, a small pill beside the page title instead of a toolbar field - it rarely
// changes. Opens a short menu: "All seasons", then each season, the current one ticked.
export function HeaderSeasonSelect({ seasons, value, onChange, allLabel = 'All seasons', showAll = true }: HeaderSeasonSelectProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()
  const open = Boolean(anchor)
  const label = value ? (seasons.find((season) => season.id === value)?.name ?? 'Season') : allLabel

  const pick = (next: string | null) => {
    setAnchor(null)
    onChange(next)
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        aria-label="Season"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={`Season: ${label}`}
        onClick={(event) => setAnchor(event.currentTarget)}
        startIcon={<CalendarTodayOutlinedIcon sx={{ fontSize: 16 }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
        sx={(theme) => ({
          height: 30,
          flex: 'none',
          borderRadius: 4,
          px: 1.25,
          fontSize: '0.8125rem',
          fontWeight: 700,
          textTransform: 'none',
          color: 'primary.dark',
          borderColor: alpha(theme.palette.primary.main, 0.5),
          ...(open ? { bgcolor: alpha(theme.palette.primary.main, 0.12) } : {}),
        })}
      >
        {label}
      </Button>
      <Menu id={menuId} anchorEl={anchor} open={open} onClose={() => setAnchor(null)} MenuListProps={{ role: 'listbox', dense: true }}>
        {showAll && (
          <MenuItem role="option" selected={value === null} aria-selected={value === null} onClick={() => pick(null)} sx={{ minHeight: 40, minWidth: 180, justifyContent: 'space-between' }}>
            {allLabel}
            {value === null && <CheckIcon fontSize="small" />}
          </MenuItem>
        )}
        {seasons.map((season) => (
          <MenuItem
            key={season.id}
            role="option"
            selected={value === season.id}
            aria-selected={value === season.id}
            onClick={() => pick(season.id)}
            sx={{ minHeight: 40, minWidth: 180, justifyContent: 'space-between' }}
          >
            {season.name}
            {value === season.id && <CheckIcon fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
