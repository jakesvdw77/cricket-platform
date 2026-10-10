import type { ReactNode } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Card } from '../Card'
import { NOT_ON_FILE } from '../../utils/playerFormat'

export interface InfoCardField {
  label: string
  // empty or null shows the muted dash
  value: string | null | undefined
}

export interface InfoCardChip {
  label: string
  // false = nothing on file / "No": drawn as a dashed muted chip
  on: boolean
}

export interface InfoCardProps {
  title: string
  icon: ReactNode
  fields?: InfoCardField[]
  chips?: InfoCardChip[]
  // a small grey note on the right of the heading
  note?: string
  // a control (e.g. an "Add" button) at the right of the header row, after the note
  headerAction?: ReactNode
  // free content (tiles, a grid) drawn between the fields/chips and the actions
  children?: ReactNode
  actions?: ReactNode
  testId?: string
}

// docs/specs/088 section G (the Player page) and docs/specs/091 (the league Conditions tab): one section card. A solid-green icon tile and an uppercase heading, then
// label-over-bold-value fields, optional chips, optional action buttons pinned to the bottom so the cards in a row
// stay the same height.
export function InfoCard({ title, icon, fields = [], chips, note, headerAction, children, actions, testId }: InfoCardProps) {
  return (
    <Card sx={{ height: '100%' }} contentSx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }} data-testid={testId}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="subtitle2"
            component="h2"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem' }}
          >
            {title}
          </Typography>
        </Box>
        {(note || headerAction) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 'none' }}>
            {note && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={(theme) => ({ bgcolor: alpha(theme.palette.text.secondary, 0.12), borderRadius: 4, px: 1.25, py: 0.375, whiteSpace: 'nowrap' })}
              >
                {note}
              </Typography>
            )}
            {headerAction}
          </Box>
        )}
      </Box>

      {fields.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: { xs: 2, md: 2.5 }, rowGap: { xs: 1.5, md: 1.75 } }}>
          {fields.map((field) => (
            <Box key={field.label} data-testid="player-info-field" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography
                variant="body2"
                color={field.value ? 'text.primary' : 'text.secondary'}
                sx={{ fontWeight: field.value ? 600 : 400, overflowWrap: 'anywhere', fontSize: { md: '0.9375rem' } }}
              >
                {field.value || NOT_ON_FILE}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {chips && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.label}
              data-testid="player-info-chip"
              data-on={chip.on}
              label={chip.label}
              variant="outlined"
              sx={(theme) =>
                chip.on
                  ? { height: 30, fontWeight: 600, color: 'primary.dark', bgcolor: alpha(theme.palette.primary.main, 0.1), borderColor: alpha(theme.palette.primary.main, 0.25) }
                  : { height: 30, fontWeight: 600, color: 'text.secondary', borderStyle: 'dashed', borderColor: 'text.disabled' }
              }
            />
          ))}
        </Box>
      )}

      {children}

      {actions && <Box sx={{ mt: 'auto' }}>{actions}</Box>}
    </Card>
  )
}
