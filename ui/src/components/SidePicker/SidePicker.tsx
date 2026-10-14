import { Avatar, Box, ButtonBase, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
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
// 44 px high tap targets; stacked on the narrowest phones, side by side from 400 px.
export function SidePicker({ label, options, value, onChange, disabled = false }: SidePickerProps) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}
    >
      {options.map((option) => {
        const selected = value === option.side
        return (
          <ButtonBase
            key={option.side}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.side)}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1.25,
              minHeight: 44,
              px: 1.5,
              borderRadius: 1,
              border: 2,
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
              '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            })}
          >
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
          </ButtonBase>
        )
      })}
    </Box>
  )
}
