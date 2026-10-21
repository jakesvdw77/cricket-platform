import type { ReactNode } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Card } from '../Card'
import { NOT_ON_FILE } from '../../utils/playerFormat'

export interface InfoCardField {
  label: string
  // empty or null shows the muted dash
  value: string | null | undefined
  // docs/specs/103: a quiet line under the value (a coverage caption such as "from 9 of 14 innings")
  caption?: string
  // The key figure of a card: its value is drawn larger (18px) in this tone's dark colour, on a faint tint. Omitted, a plain bold value.
  emphasis?: 'primary' | 'success' | 'error'
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
  // docs/specs/103: columns of the fields grid (the Player page Stats card shows its six figures in three); default 2
  columns?: number
  chips?: InfoCardChip[]
  // docs/specs/103 decision 24: draw the chips above the fields (the merged Player page Cricket card); default is below them
  chipsFirst?: boolean
  // a small grey note on the right of the heading
  note?: string
  // a control (e.g. an "Add" button) at the right of the header row, after the note
  headerAction?: ReactNode
  // free content (tiles, a grid) drawn between the fields/chips and the actions
  children?: ReactNode
  actions?: ReactNode
  testId?: string
  // docs/specs/104: 'warning' is the amber "look at this" card (an amber icon tile, tinted fill and border) for a notice that
  // is not an error, such as the import's "Check these names". Omitted, the card is unchanged.
  tone?: 'default' | 'warning'
  // docs/specs/103: 'large' is the roomier field text of the statistics cards (13px labels, 16px values, 12px captions; responsive 2/3/4 columns).
  // Omitted ('default'), every card is unchanged.
  fieldSize?: 'default' | 'large'
}

// docs/specs/088 section G (the Player page) and docs/specs/091 (the league Conditions tab): one section card. A solid-green icon tile and an uppercase heading, then
// label-over-bold-value fields, optional chips, optional action buttons pinned to the bottom so the cards in a row
// stay the same height.
export function InfoCard({ title, icon, fields = [], columns, chips, chipsFirst = false, note, headerAction, children, actions, testId, tone = 'default', fieldSize = 'default' }: InfoCardProps) {
  const large = fieldSize === 'large'
  // 'large' defaults to 2 columns on a phone, 3 from sm, and 4 from md when there are 6 or more fields; `columns` overrides it
  const gridColumns = columns
    ? `repeat(${columns}, minmax(0, 1fr))`
    : large
      ? { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: `repeat(${fields.length >= 6 ? 4 : 3}, minmax(0, 1fr))` }
      : 'repeat(2, minmax(0, 1fr))'
  const chipsRow = chips && (
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
    )

  return (
    <Card
      sx={[
        { height: '100%' },
        tone === 'warning' && ((theme) => ({ borderColor: alpha(theme.palette.warning.main, 0.5), bgcolor: alpha(theme.palette.warning.main, 0.06) })),
      ]}
      contentSx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: large ? 1.5 : 2, p: large ? 1.5 : { xs: 2, md: 2.5 }, '&:last-child': { pb: large ? 1.5 : { xs: 2, md: 2.5 } } }} data-testid={testId}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 1,
              bgcolor: tone === 'warning' ? 'warning.main' : 'primary.main',
              color: tone === 'warning' ? 'warning.contrastText' : 'primary.contrastText',
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

      {chipsFirst && chipsRow}

      {fields.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns, columnGap: large ? 2 : { xs: 2, md: 2.5 }, rowGap: large ? 1.25 : { xs: 1.5, md: 1.75 } }}>
          {fields.map((field) => (
            <Box
              key={field.label}
              data-testid="player-info-field"
              sx={[
                { display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 },
                large && field.emphasis && ((theme) => ({ bgcolor: alpha(theme.palette[field.emphasis!].main, 0.06), borderRadius: 1, px: 1, py: 0.5, mx: -1, my: -0.5 })),
              ]}
            >
              <Typography variant="caption" color="text.secondary" sx={large ? { fontSize: '0.8125rem', lineHeight: 1.3, fontWeight: 400 } : undefined}>
                {field.label}
              </Typography>
              <Typography
                variant="body2"
                color={field.value ? (large && field.emphasis ? `${field.emphasis}.dark` : 'text.primary') : 'text.secondary'}
                sx={{ fontWeight: field.value ? (large ? 700 : 600) : 400, overflowWrap: 'anywhere', fontSize: large ? (field.emphasis ? '1.125rem' : '1rem') : { md: '0.9375rem' }, lineHeight: large ? 1.3 : undefined }}
              >
                {field.value || NOT_ON_FILE}
              </Typography>
              {field.caption && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: large ? '0.75rem' : '0.6875rem', lineHeight: 1.3 }}>
                  {field.caption}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {!chipsFirst && chipsRow}

      {children}

      {actions && <Box sx={{ mt: 'auto' }}>{actions}</Box>}
    </Card>
  )
}
