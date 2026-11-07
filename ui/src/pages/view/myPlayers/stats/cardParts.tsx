import type { MouseEvent, ReactNode } from 'react'
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { STATS_TONES, blackAlpha } from '../../../../brandTokens'
import { useFaceTabIndex } from '../../../../components/FlipCard'
import { STATS_TYPE, STATS_UI, fluid, useExpanded } from '../../../../components/StatsCards'
import { HorizontalBars } from '../../../../components/StatsDrawings'
import type { BarRow } from '../../../../components/StatsDrawings'

// docs/specs/147: the small pieces the card faces are drawn from, so a card file holds only its content: the big figure, tiles (a tile
// with a drill is a real link), a real table, chips, a note. Shared by every My stats card; none of them knows a payload. A link here sits
// above the stretched flip button and leaves the tab order while its face is hidden (useFaceTabIndex).

const tileSx = {
  display: 'grid',
  alignContent: 'center',
  gap: '1px',
  minWidth: 0,
  minHeight: fluid(40, 64),
  px: '8px',
  py: '6px',
  borderRadius: '6px',
  border: `1px solid ${STATS_UI.lineSoft}`,
  bgcolor: blackAlpha(0.3),
  color: STATS_UI.cream,
  textDecoration: 'none',
} as const

const denseTileSx = { minHeight: 0, py: '3px', gap: 0 } as const

const captionSx = { fontFamily: STATS_UI.display, fontSize: fluid(STATS_TYPE.caption, STATS_TYPE.captionExpanded), lineHeight: 1.25, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: STATS_UI.muted, m: 0 } as const

// The headline figure: "412" with its caption beside it on the baseline (top-left, never centred); the caption wraps under the number when
// the room is short. `compact` is the Summary tile's larger figure (52 px, normal 44 px; both 84 px expanded).
export function Big({ value, caption, compact = false }: { value: string; caption: string; compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '8px', minWidth: 0 }}>
      <Typography data-testid="stats-big" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: fluid(compact ? STATS_TYPE.bigCompact : STATS_TYPE.big, STATS_TYPE.bigExpanded), lineHeight: 0.95, color: STATS_UI.gold, m: 0 }}>{value}</Typography>
      <Typography sx={captionSx}>{caption}</Typography>
    </Box>
  )
}

// The front of a Summary tile that has a breakdown: the big figure top-left and the top bars UNDER it at the full card width (up to three;
// "+N more" beside the figure when there are more). Expanded and wide, the figure block (about 240 px) sits at the left and the bars fill
// the right. The back is then just the full table, so a chart is never shown twice.
export const FRONT_BARS = 3

export function BigBars({ value, caption, rows, alt, total, hint, clear, legend, unit }: { value: string; caption: string; rows: BarRow[]; alt: string; total: number; hint?: string; clear?: { label: string; onClear: () => void }; legend?: [string, string]; unit?: [string, string] }) {
  const expanded = useExpanded()
  const shown = expanded ? rows : rows.slice(0, FRONT_BARS)
  const more = total - shown.length
  const tabIndex = useFaceTabIndex()
  // One item draws no bar (a full-width bar says nothing): its label and value are one quiet line, and there is nothing to choose to filter.
  const single = rows.length === 1 ? rows[0] : null
  const selectable = !single && rows.some((row) => row.onSelect)
  const asideLine = { fontSize: fluid(STATS_TYPE.hint, STATS_TYPE.footerExpanded), lineHeight: 1.2, color: STATS_UI.muted, m: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const
  // The small notes beside the figure: "+N more", the filter hint, and the clear control.
  const aside = (more > 0 || (selectable && hint) || clear) && (
    <Box sx={{ display: 'grid', justifyItems: expanded ? 'start' : 'end', gap: '2px', minWidth: 0 }}>
      {more > 0 && <Typography sx={{ ...captionSx, whiteSpace: 'nowrap' }}>+{more} more</Typography>}
      {!clear && selectable && hint && <Typography sx={asideLine}>{hint}</Typography>}
      {clear && (
        <Box
          component="button"
          type="button"
          tabIndex={tabIndex}
          data-flip-interactive
          onClick={(event: MouseEvent) => {
            event.stopPropagation()
            clear.onClear()
          }}
          sx={{ appearance: 'none', border: 0, bgcolor: 'transparent', p: 0, minHeight: 20, font: 'inherit', fontSize: fluid(12, 15), color: STATS_UI.gold, textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { color: STATS_UI.cream }, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}
        >
          {clear.label}
        </Box>
      )}
    </Box>
  )
  const singleLine = single && (
    <Typography data-testid="stats-single-item" title={single.label} sx={{ fontSize: fluid(STATS_TYPE.label, STATS_TYPE.labelExpanded), lineHeight: 1.3, color: STATS_UI.muted, m: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflowWrap: 'anywhere' }}>
      {single.label} · {single.valueLabel}{unit ? ` ${single.value === 1 ? unit[0] : unit[1]}` : ''}
    </Typography>
  )
  const bars = shown.length > 1 && <HorizontalBars dense alt={alt} rows={shown} legend={legend} />
  if (expanded) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: '40px', rowGap: '16px', minWidth: 0 }}>
        <Box sx={{ flex: '0 0 240px', display: 'grid', gap: '8px', minWidth: 0 }}>
          <Big compact value={value} caption={caption} />
          {aside}
        </Box>
        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          {singleLine}
          {bars}
        </Box>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'grid', gap: '4px', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
        <Big compact value={value} caption={caption} />
        {aside}
      </Box>
      {singleLine}
      {bars}
    </Box>
  )
}

export interface TileSpec {
  key: string
  label: string
  value: string
  // A comparison tone (STATS_COLOUR.compareFirst / compareSecond): a small swatch before the label and the figure in that colour.
  swatch?: string
  // The drill this tile opens (a real link); omitted, the tile is plain.
  href?: string
  // The link's accessible name ("Scores of 50 or more: 3").
  name?: string
}

// `dense`: a shorter tile (about 40 px: 17 px figure, 9.5 px label, tight padding) for a card with little height to spare.
export function Tiles({ items, min = 64, dense = false }: { items: TileSpec[]; min?: number; dense?: boolean }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box data-testid="stats-tiles" sx={{ display: 'grid', gap: '6px', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {items.map((item) => {
        const content = (
          <>
            <Typography component="span" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: fluid(dense ? 18 : STATS_TYPE.tileValue, dense ? 26 : 30), lineHeight: 1.1, color: item.swatch ?? STATS_UI.cream }}>{item.value}</Typography>
            <Typography component="span" sx={{ ...captionSx, fontSize: fluid(STATS_TYPE.tileLabel, 14), letterSpacing: '0.08em' }}>{item.swatch && <Box aria-hidden component="span" sx={{ display: 'inline-block', width: 9, height: 9, borderRadius: '2px', bgcolor: item.swatch, mr: '5px' }} />}{item.label}</Typography>
          </>
        )
        return item.href ? (
          <Box
            key={item.key}
            component={RouterLink}
            to={item.href}
            tabIndex={tabIndex}
            aria-label={item.name ?? `${item.label}: ${item.value}`}
            data-testid="stats-tile-link"
            sx={{ ...tileSx, ...(dense ? denseTileSx : {}), borderColor: STATS_UI.line, '&:hover': { bgcolor: blackAlpha(0.45) }, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}
          >
            {content}
          </Box>
        ) : (
          <Box key={item.key} data-testid="stats-tile" sx={dense ? { ...tileSx, ...denseTileSx } : tileSx}>
            {content}
          </Box>
        )
      })}
    </Box>
  )
}

export interface SplitColumn {
  key: string
  title: string
  rows: { key: string; label: string; value: string; swatch?: string }[]
  // A small swatch before the title: the column's tone in a two-category comparison (STATS_COLOUR.compareFirst / compareSecond).
  swatch?: string
}

// Two or three short columns side by side (Home | Away), each a heading and a few label / value pairs on one line. Compact: about 14 px a line.
export function Split({ columns }: { columns: SplitColumn[] }) {
  return (
    <Box data-testid="stats-split" sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: fluid(14, 32), minWidth: 0 }}>
      {columns.map((column) => (
        <Box key={column.key} component="dl" sx={{ m: 0, display: 'grid', gap: fluid(3, 8), alignContent: 'start', minWidth: 0 }}>
          <Typography component="dt" sx={{ ...captionSx, pb: '2px', borderBottom: `1px solid ${STATS_UI.lineSoft}` }}>{column.swatch && <Box aria-hidden component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', bgcolor: column.swatch, mr: '5px' }} />}{column.title}</Typography>
          {column.rows.map((row) => (
            <Box key={row.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px', minWidth: 0, fontSize: fluid(STATS_TYPE.body, STATS_TYPE.bodyExpanded), lineHeight: 1.3 }}>
              <Typography component="dt" sx={{ fontSize: 'inherit', lineHeight: 'inherit', color: STATS_UI.muted, m: 0 }}>{row.swatch && <Box aria-hidden component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', bgcolor: row.swatch, mr: '5px' }} />}{row.label}</Typography>
              <Typography component="dd" sx={{ fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 700, color: row.swatch ?? column.swatch ?? STATS_UI.cream, m: 0 }}>{row.value}</Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: fluid(STATS_TYPE.body, STATS_TYPE.bodyExpanded), lineHeight: 1.3, color: STATS_UI.muted, m: 0 }}>{children}</Typography>
}

// A small muted heading over a block ("Average of the last 5 innings").
export function Cap({ children }: { children: ReactNode }) {
  return <Typography sx={captionSx}>{children}</Typography>
}

export type ChipTone = 'win' | 'loss' | 'neutral'

export interface ChipSpec {
  key: string
  text: string
  tone: ChipTone
  href?: string
  name?: string
}

const CHIP_TONE: Record<ChipTone, string> = { win: STATS_TONES.win, loss: STATS_TONES.loss, neutral: STATS_UI.cream }

// Small figure chips (the last five scores); a chip with a match is a link to its Hub Result page.
// `large`: bigger chips for a card where the scores are the content; `lead`: a small caption before the first chip ("Last 5").
export function Chips({ items, large = false, lead }: { items: ChipSpec[]; large?: boolean; lead?: string }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box data-testid="stats-chips" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
      {lead && <Typography component="span" sx={{ ...captionSx, mr: '4px' }}>{lead}</Typography>}
      {items.map((item) => {
        const sx = { display: 'inline-flex', alignItems: 'center', minHeight: large ? fluid(26, 36) : fluid(22, 30), px: large ? '10px' : '8px', borderRadius: '999px', border: `1px solid ${CHIP_TONE[item.tone]}`, color: CHIP_TONE[item.tone], fontFamily: STATS_UI.display, fontSize: large ? fluid(14, 18) : fluid(STATS_TYPE.chip, 16), fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'none' } as const
        return item.href ? (
          <Box key={item.key} component={RouterLink} to={item.href} tabIndex={tabIndex} aria-label={item.name ?? item.text} sx={{ ...sx, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}>
            {item.text}
          </Box>
        ) : (
          <Box key={item.key} component="span" sx={sx}>
            {item.text}
          </Box>
        )
      })}
    </Box>
  )
}

export interface TableRowSpec {
  key: string
  cells: ReactNode[]
  // A row that opens the Hub Result page: its first cell becomes the link.
  href?: string
  linkName?: string
}

const headCell = { color: STATS_UI.muted, borderColor: STATS_UI.lineSoft, px: fluid(6, 12), py: fluid(3, 10), fontFamily: STATS_UI.display, fontSize: fluid(STATS_TYPE.tileLabel, 14), fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' } as const
const bodyCell = { color: STATS_UI.cream, borderColor: STATS_UI.lineSoft, px: fluid(6, 12), py: fluid(3, 10), fontSize: fluid(STATS_TYPE.table, STATS_TYPE.tableExpanded) } as const

// A real table (column headings with scope="col"): the text alternative of a drawing, and the story on the back of a card. The first
// column is the row's name; every other column is right aligned.
export function FaceTable({ label, heads, rows }: { label: string; heads: string[]; rows: TableRowSpec[] }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
      <Table size="small" aria-label={label} data-testid="stats-table" sx={{ width: '100%' }}>
        <TableHead>
          <TableRow>
            {heads.map((head, index) => (
              <TableCell key={`${head}-${index}`} component="th" scope="col" align={index === 0 ? 'left' : 'right'} sx={headCell}>
                {head}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, index) => (
                <TableCell key={index} align={index === 0 ? 'left' : 'right'} sx={{ ...bodyCell, ...(index === 0 ? { fontWeight: 600 } : {}) }}>
                  {index === 0 && row.href ? (
                    <Box component={RouterLink} to={row.href} tabIndex={tabIndex} aria-label={row.linkName} data-testid="stats-row-link" sx={{ color: STATS_UI.cream, textDecorationColor: STATS_UI.muted, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}>
                      {cell}
                    </Box>
                  ) : (
                    cell
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}
