import { Avatar, Box, Typography } from '@mui/material'
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
  // docs/specs/101 (the side toggle on the scorecard steps): two tiles side by side even on a phone, with a smaller logo
  // and name, instead of stacked.
  dense?: boolean
  // A side with unsaved or incomplete entries: a small dot on its tile.
  marked?: Partial<Record<ResultSide, boolean>>
}

// docs/specs/100-match-results-core.md: two large team buttons (logo, name) used for "Who won?" and "Who won the toss?".
// 44 px high tap targets; stacked on a phone, side by side from sm.
export function SidePicker({ label, options, value, onChange, disabled = false, dense = false, marked = {} }: SidePickerProps) {
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
              sx={{ width: dense ? { xs: 24, sm: 28 } : 28, height: dense ? { xs: 24, sm: 28 } : 28, flex: 'none', fontSize: '0.7rem', fontWeight: 600, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14), color: 'primary.dark' }}
            >
              {option.initials}
            </Avatar>
            <Typography variant="body2" fontWeight={600} noWrap component="span" sx={{ minWidth: 0, fontSize: dense ? { xs: '0.8125rem', sm: undefined } : undefined }}>
              {option.name}
            </Typography>
            {marked[option.side] && (
              <>
                <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flex: 'none', ml: 'auto' }} />
                <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  incomplete
                </Box>
              </>
            )}
          </>
        ),
      }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
      columns={dense ? 'repeat(2, minmax(0, 1fr))' : { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }}
      tileSx={{ alignItems: 'center', justifyContent: 'flex-start', gap: dense ? { xs: 0.75, sm: 1.25 } : 1.25, minHeight: 44, position: 'relative', ...(dense ? { px: { xs: 1, sm: 1.5 } } : {}) }}
    />
  )
}
