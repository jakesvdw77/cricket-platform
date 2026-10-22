import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, ButtonBase, Button as MuiButton, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { useNavigate } from 'react-router-dom'
import { zebraTint } from '../../../utils/zebraTint'
import { hoverTint } from '../leagueEdit/leagueEditRowStyles'
import { gridSx, pinnedFirst, pinnedRank, sortedTint, tableMinWidth } from './standingsGrid'
import type { LayoutColumn, WidthOf } from './standingsGrid'
import { compactButtonSx } from '../../../components/Button'

// The layout pieces shared by the standings tables (docs/specs/103 player standings, docs/specs/116 team standings): the grid
// with a pinned rank and first column, the sortable header, the unranked divider, the notices and the footer. Row content stays
// in each table's own component.

export function Notice({ title, description, action, tone = 'info' }: { title: string; description: string; action?: ReactNode; tone?: 'info' | 'error' }) {
  return (
    <Box
      role={tone === 'error' ? 'alert' : undefined}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center', px: 2, py: 3.5, borderTop: 1, borderColor: tone === 'error' ? 'error.main' : 'divider' }}
    >
      <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: tone === 'error' ? 'error.main' : 'text.primary' }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', maxWidth: 460 }}>{description}</Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}

export function LoadingRows() {
  return (
    <Box aria-busy="true" aria-label="Loading table" sx={{ px: 1.5, pb: 1.5 }}>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} variant="rounded" height={52} sx={{ mb: 0.75 }} />
      ))}
    </Box>
  )
}

export function HeaderRow({
  columns,
  widthOf,
  firstColumnLabel,
  sortCode,
  direction,
  onSortChange,
}: {
  columns: LayoutColumn[]
  widthOf: WidthOf
  firstColumnLabel: string
  sortCode: string
  direction: 'HIGHEST' | 'LOWEST'
  onSortChange: (code: string) => void
}) {
  return (
    <Box
      role="row"
      data-testid="standings-header-row"
      sx={[
        gridSx(columns, widthOf),
        { minHeight: { xs: 44, sm: 36 }, bgcolor: 'background.paper', borderTop: 1, borderBottom: 1, borderColor: 'divider', color: 'text.secondary' },
      ]}
    >
      <Box role="columnheader" sx={{ ...pinnedRank, fontSize: '0.75rem', fontWeight: 700 }}>#</Box>
      <Box role="columnheader" sx={{ ...pinnedFirst, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{firstColumnLabel}</Box>
      {columns.map((column) => {
        const sorted = column.code === sortCode
        const Arrow = direction === 'LOWEST' ? ArrowUpwardIcon : ArrowDownwardIcon
        const base = !column.sortable
          ? column.label
          : sorted
            ? `${column.longLabel ?? column.label}, sorted ${direction === 'LOWEST' ? 'ascending' : 'descending'}; click to reverse`
            : `Sort by ${column.longLabel ?? column.label}`
        const label = column.help ? `${base}. ${column.help}` : base
        return (
          <Box key={column.code} role="columnheader" aria-sort={sorted ? (direction === 'LOWEST' ? 'ascending' : 'descending') : undefined} sx={{ alignSelf: 'stretch', display: 'flex', bgcolor: sorted ? sortedTint : 'transparent' }}>
            <ButtonBase
              disabled={!column.sortable}
              onClick={() => onSortChange(column.code)}
              aria-label={label}
              title={column.help ?? undefined}
              data-sorted={sorted ? 'true' : undefined}
              sx={{
                flex: 1,
                minHeight: { xs: 44, sm: 36 },
                justifyContent: 'flex-end',
                gap: 0.25,
                px: 0.75,
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: sorted ? 'primary.dark' : 'text.secondary',
                '&:hover': { color: 'primary.dark' },
                '&.Mui-disabled': { color: 'text.secondary' },
              }}
            >
              {sorted && <Arrow aria-hidden sx={{ fontSize: 14 }} />}
              {column.label}
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
  )
}

// The grid row. The whole row opens `to`; the link inside the first column is the real link (keyboard, screen readers, open in a
// new tab) and a click elsewhere on the row follows it. (A stretched ::after link cannot span the row: the pinned cells are
// position: sticky.)
export function RowShell({
  columns,
  widthOf,
  to,
  state,
  rank,
  children,
}: {
  columns: LayoutColumn[]
  widthOf: WidthOf
  to: string
  // router state carried with the row link (docs/specs/116: the team page's Back returns to this table)
  state?: unknown
  rank: number | null | undefined
  children: ReactNode
}) {
  const leader = rank === 1
  const unranked = rank === null || rank === undefined
  const navigate = useNavigate()
  return (
    <Box
      role="row"
      onClick={(event) => {
        if (event.defaultPrevented || (event.target as HTMLElement).closest('a')) return
        navigate(to, { state })
      }}
      data-testid="standings-row"
      data-rank={unranked ? 'none' : rank}
      sx={[
        gridSx(columns, widthOf),
        {
          minHeight: { xs: 48, sm: 40 },
          cursor: 'pointer',
          color: 'text.primary',
          bgcolor: 'background.paper',
          '&:nth-of-type(odd)': { bgcolor: zebraTint },
          '&:hover': { bgcolor: hoverTint },
          '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        },
        leader && { boxShadow: (theme: Theme) => `inset 3px 0 0 ${theme.palette.primary.main}` },
      ]}
    >
      {children}
    </Box>
  )
}

export function RankCell({ text, unranked }: { text: string; unranked: boolean }) {
  return (
    <Box role="cell" sx={{ ...pinnedRank, fontSize: '0.875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unranked ? 'text.secondary' : 'primary.dark' }}>
      {text}
    </Box>
  )
}

export function FirstCell({ children }: { children: ReactNode }) {
  return (
    <Box role="rowheader" sx={pinnedFirst}>
      <Box sx={{ minWidth: 0, py: { xs: 0.75, sm: 0.5 } }}>{children}</Box>
    </Box>
  )
}

export function FigureCell({ code, sorted, muted, label, children }: { code: string; sorted: boolean; muted: boolean; label?: string; children: ReactNode }) {
  return (
    <Box
      role="cell"
      data-testid={`cell-${code}`}
      aria-label={label}
      title={label}
      sx={{
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: 0.75,
        fontSize: '0.875rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: sorted ? 700 : 400,
        color: muted ? 'text.secondary' : 'text.primary',
        bgcolor: sorted ? sortedTint : 'transparent',
      }}
    >
      {children}
    </Box>
  )
}

export function UnrankedDivider({ label, columns, widthOf }: { label: string; columns: LayoutColumn[]; widthOf: WidthOf }) {
  return (
    <Box
      role="row"
      data-testid="unranked-divider"
      sx={{ width: '100%', minWidth: tableMinWidth(columns, widthOf), bgcolor: 'action.hover', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box
        role="cell"
        aria-colspan={columns.length + 2}
        sx={{
          position: 'sticky',
          left: 0,
          width: 'fit-content',
          px: 1.5,
          py: 1,
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Box>
    </Box>
  )
}

// The sideways-scrolling table frame with the fade at the right edge on a phone.
export function ScrollableTable({ ariaLabel, columnCount, children }: { ariaLabel: string; columnCount: number; children: ReactNode }) {
  const [atEnd, setAtEnd] = useState(false)
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        data-testid="standings-scroll"
        role="table"
        aria-label={ariaLabel}
        aria-colcount={columnCount + 2}
        onScroll={(event) => {
          const el = event.currentTarget
          setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
        }}
        sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </Box>
      <Box
        aria-hidden
        sx={{
          display: { xs: atEnd ? 'none' : 'block', sm: 'none' },
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 36,
          pointerEvents: 'none',
          background: (theme) => `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0)}, ${theme.palette.background.paper})`,
        }}
      />
    </Box>
  )
}

// The text lines under the table and the Show more button (backend paging; nothing is sliced here).
export function TableFooter({ lines, hasNextPage, fetchingNext, onShowMore }: { lines: string[]; hasNextPage: boolean; fetchingNext: boolean; onShowMore: () => void }) {
  if (lines.length === 0 && !hasNextPage) return null
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, borderTop: 1, borderColor: 'divider' }}>
      {lines.length > 0 && (
        <Typography data-testid="board-footer" sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.45 }}>
          {lines.join(' ')}
        </Typography>
      )}
      {hasNextPage && (
        <MuiButton variant="outlined" onClick={onShowMore} disabled={fetchingNext} size="small" sx={{ ...compactButtonSx, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
          {fetchingNext ? 'Loading...' : 'Show more'}
        </MuiButton>
      )}
    </Box>
  )
}
