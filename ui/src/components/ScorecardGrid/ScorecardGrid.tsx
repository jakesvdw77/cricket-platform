import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  Box,
  Button,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined'
import type { ReorderableRows } from '../../hooks/useReorderableRows'
import { zebraTint } from '../../utils/zebraTint'

export interface ScorecardGridColumn<R> {
  id: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  // Fixed column width in px (the number columns); omitted, the column takes what it needs.
  width?: number
  // The cell. Put GridNumberInput / HowOutSelect here: they carry the attributes the keyboard handling looks for.
  render: (row: R, index: number) => ReactNode
}

export interface ScorecardGridProps<R> {
  // Names the table and its keyboard help.
  ariaLabel: string
  rows: R[]
  getRowId: (row: R) => string
  columns: ScorecardGridColumn<R>[]
  // The sticky first column: the player (name button, Guest chip, "planned 3").
  renderPlayer: (row: R, index: number) => ReactNode
  playerHeader?: string
  // The number shown before the name; defaults to the row's place.
  renderPosition?: (row: R, index: number) => ReactNode
  // The cells after the columns (the star toggle, a row menu button).
  renderTrailing?: (row: R, index: number) => ReactNode
  // The row as a phone card (below sm). Required: the grid is a table from sm and a stack of these below it.
  renderCard: (row: R, index: number) => ReactNode
  // Drag and drop with a handle (desktop): pass the useReorderableRows result for the listed rows. Omitted, no handle.
  reorder?: ReorderableRows
  reorderDisabled?: boolean
  // A row drawn quiet (Did not bat).
  isRowMuted?: (row: R) => boolean
  // `/` on a cell: open the player picker for that row.
  onPickPlayer?: (rowId: string) => void
  emptyMessage?: ReactNode
}

// docs/specs/101-match-results-our-side-scorecard.md: the keyboard-first row and column engine behind Our batting and
// Our bowling and fielding (generic, so 102 reuses it for the opposition's entries). Real inputs in a real table; the
// keyboard contract:
//  - Enter / Shift+Enter move to the next / previous cell and wrap to the next row's first cell;
//  - ArrowDown / ArrowUp move within a column;
//  - number cells select their content on focus (GridNumberInput) and show the numeric keypad;
//  - `/` opens the player picker for the row, `?` lists the shortcuts;
//  - Tab keeps the browser's order so the name button, the star and the row menu stay reachable;
//  - there is no Alt+Arrow shortcut: reordering is the drag handle and the name popup (components/PlayerRowMenu).
// Cells are found in the DOM by `data-grid-cell` / `data-grid-col`, so the same handling serves the table and the phone
// cards.

// The sticky first column look of pages/manage/playerAvailability/gridStyles.ts (stickyFirstColSx), repeated here
// because components may not import from pages.
const STICKY_FIRST_COL = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  minWidth: { xs: 150, sm: 220 },
  boxShadow: (theme: Theme) => `inset -1px 0 0 ${theme.palette.divider}, 2px 0 4px ${alpha(theme.palette.text.primary, 0.06)}`,
} as const

const HEAD_CELL: SxProps<Theme> = {
  bgcolor: 'background.paper',
  color: 'text.secondary',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  px: 1,
  py: 0.75,
}

const CELL_PX = 1

const SHORTCUTS: Array<[string, string]> = [
  ['Enter / Shift+Enter', 'next / previous cell, wrapping to the next row'],
  ['Arrow Up / Down', 'same column, previous / next row'],
  ['/', 'choose a different player for this row'],
  ['How out: c b l r s n d', 'Caught, Bowled, LBW, Run out, Stumped, Not out, Did not bat'],
  ['How out: cb ro rn', 'Caught and bowled, Retired out, Retired not out'],
  ['?', 'show or hide these shortcuts'],
]

function cellsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-grid-cell]')).filter(
    (cell) => !(cell as HTMLInputElement).disabled,
  )
}

export function ScorecardGrid<R>({
  ariaLabel,
  rows,
  getRowId,
  columns,
  renderPlayer,
  playerHeader = 'Player',
  renderPosition,
  renderTrailing,
  renderCard,
  reorder,
  reorderDisabled = false,
  isRowMuted,
  onPickPlayer,
  emptyMessage,
}: ScorecardGridProps<R>) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [helpOpen, setHelpOpen] = useState(false)
  // The row whose handle is held: only then is its row draggable, so text in the row's inputs stays selectable.
  const [armedId, setArmedId] = useState<string | null>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (!target.matches('[data-grid-cell]')) return
    // No Alt+Arrow (or any modified) shortcut: leave the browser's and assistive technology's own keys alone.
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const container = event.currentTarget
    const cells = cellsOf(container)
    const index = cells.indexOf(target)

    if (event.key === 'Enter') {
      event.preventDefault()
      cells[index + (event.shiftKey ? -1 : 1)]?.focus()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const column = target.getAttribute('data-grid-col')
      const sameColumn = cells.filter((cell) => cell.getAttribute('data-grid-col') === column)
      const next = sameColumn[sameColumn.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)]
      if (next) {
        event.preventDefault()
        next.focus()
      }
      return
    }
    if (event.key === '/' && onPickPlayer) {
      const rowId = target.closest('[data-grid-row]')?.getAttribute('data-grid-row')
      if (rowId) {
        event.preventDefault()
        onPickPlayer(rowId)
      }
      return
    }
    if (event.key === '?') {
      event.preventDefault()
      setHelpOpen((open) => !open)
    }
  }

  const help = (
    <>
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'flex-end', pb: 0.5 }}>
        <Button
          size="small"
          startIcon={<KeyboardOutlinedIcon />}
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((open) => !open)}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          Keyboard shortcuts (?)
        </Button>
      </Box>
      <Collapse in={helpOpen} unmountOnExit>
        <Box
          role="note"
          aria-label={`${ariaLabel}: keyboard shortcuts`}
          sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1, mb: 1, fontSize: 12.5, lineHeight: 1.7 }}
        >
          {SHORTCUTS.map(([keys, does]) => (
            <Box key={keys}>
              <Box component="kbd" sx={{ font: 'inherit', fontWeight: 700, mr: 1 }}>
                {keys}
              </Box>
              {does}
            </Box>
          ))}
        </Box>
      </Collapse>
    </>
  )

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {emptyMessage ?? 'No players yet.'}
      </Typography>
    )
  }

  if (phone) {
    return (
      <Box role="list" aria-label={ariaLabel} onKeyDown={onKeyDown} sx={{ display: 'grid', gap: 1 }}>
        {rows.map((row, index) => (
          <Box
            key={getRowId(row)}
            role="listitem"
            data-grid-row={getRowId(row)}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: isRowMuted?.(row) ? 'action.hover' : 'background.paper',
              p: 1.5,
              minWidth: 0,
            }}
          >
            {renderCard(row, index)}
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box onKeyDown={onKeyDown}>
      {help}
      <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Table size="small" aria-label={ariaLabel} sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content', width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell component="th" scope="col" sx={{ ...HEAD_CELL, ...STICKY_FIRST_COL, borderBottom: 1, borderColor: 'divider' }}>
                {playerHeader}
              </TableCell>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  component="th"
                  scope="col"
                  align={column.align ?? 'left'}
                  sx={{ ...HEAD_CELL, width: column.width, borderBottom: 1, borderColor: 'divider' }}
                >
                  {column.header}
                </TableCell>
              ))}
              {renderTrailing && <TableCell sx={{ ...HEAD_CELL, borderBottom: 1, borderColor: 'divider' }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              const id = getRowId(row)
              const background = index % 2 === 1 ? zebraTint : 'background.paper'
              const dropBefore = reorder?.dragId != null && reorder.dropIndex === index
              const dropAfter = reorder?.dragId != null && reorder.dropIndex === rows.length && index === rows.length - 1
              const drag = reorder?.rowDragProps(id, { index, accepts: true }, reorderDisabled || armedId !== id)
              const dropLine = (theme: Theme) =>
                dropBefore
                  ? `inset 0 2px 0 0 ${theme.palette.primary.main}`
                  : dropAfter
                    ? `inset 0 -2px 0 0 ${theme.palette.primary.main}`
                    : undefined
              return (
                <TableRow
                  key={id}
                  data-grid-row={id}
                  {...(drag
                    ? {
                        ...drag,
                        onDragEnd: () => {
                          setArmedId(null)
                          drag.onDragEnd()
                        },
                      }
                    : {})}
                  sx={{
                    opacity: reorder?.dragId === id ? 0.5 : 1,
                    '& > td': { bgcolor: background, borderBottom: 1, borderColor: 'divider', px: CELL_PX, py: 0.5, boxShadow: dropLine },
                    '& > td:first-of-type': { ...STICKY_FIRST_COL, boxShadow: (theme: Theme) => dropLine(theme) ?? (STICKY_FIRST_COL.boxShadow as (theme: Theme) => string)(theme) },
                    '&:focus-within > td': { bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.07) },
                    color: isRowMuted?.(row) ? 'text.disabled' : 'text.primary',
                    minHeight: 48,
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                      {reorder && (
                        <Box
                          aria-hidden
                          data-testid="drag-handle"
                          onPointerDown={() => !reorderDisabled && setArmedId(id)}
                          onPointerUp={() => setArmedId(null)}
                          sx={{
                            width: 24,
                            height: 36,
                            flex: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            color: reorderDisabled ? 'action.disabled' : 'text.secondary',
                            cursor: reorderDisabled ? 'default' : 'grab',
                          }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                      )}
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ width: 22, flex: 'none', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {renderPosition ? renderPosition(row, index) : index + 1}
                      </Typography>
                      <Box sx={{ minWidth: 0, flex: 1 }}>{renderPlayer(row, index)}</Box>
                    </Box>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align ?? 'left'}>
                      {column.render(row, index)}
                    </TableCell>
                  ))}
                  {renderTrailing && <TableCell align="right">{renderTrailing(row, index)}</TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}
