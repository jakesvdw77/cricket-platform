import { Avatar, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { TileChoiceGroup } from '../TileChoiceGroup'
import type { ResultSide } from '../../api/matchResultApi'

export interface SidePickerOption {
  side: ResultSide
  name: string
  logoSrc?: string | null
  initials: string
}

export interface SidePickerProps {
  // Accessible name of the group ("Who won?").
  label: string
  options: SidePickerOption[]
  value: ResultSide | null
  onChange: (side: ResultSide) => void
  disabled?: boolean
}

// docs/specs/100-match-results-core.md: two large team buttons (logo, name) used for "Who won?" and "Who won the toss?".
// 44 px high tap targets; stacked on a phone, side by side from sm.
export function SidePicker({ label, options, value, onChange, disabled = false }: SidePickerProps) {
  return (
    <TileChoiceGroup
      label={label}
      options={options.map((option) => ({
        value: option.side,
        content: (
          <>
            <Avatar
              src={option.logoSrc ?? undefined}
              alt=""
              aria-hidden
              sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 600, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14), color: 'primary.dark' }}
            >
              {option.initials}
            </Avatar>
            <Typography variant="body2" fontWeight={600} noWrap component="span" sx={{ minWidth: 0 }}>
              {option.name}
            </Typography>
          </>
        ),
      }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
      columns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }}
      tileSx={{ alignItems: 'center', justifyContent: 'flex-start', gap: 1.25, minHeight: 44 }}
    />
  )
}
