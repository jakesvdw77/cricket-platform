import type { ReactNode } from 'react'
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { STATS_TONES, blackAlpha } from '../../../../brandTokens'
import { useFaceTabIndex } from '../../../../components/FlipCard'
import { STATS_TYPE, STATS_UI } from '../../../../components/StatsCards'
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
  minHeight: 40,
  px: '8px',
  py: '6px',
  borderRadius: '6px',
  border: `1px solid ${STATS_UI.lineSoft}`,
  bgcolor: blackAlpha(0.3),
  color: STATS_UI.cream,
  textDecoration: 'none',
} as const

const denseTileSx = { minHeight: 32, py: '3px' } as const

const captionSx = { fontFamily: STATS_UI.display, fontSize: STATS_TYPE.caption, lineHeight: 1.25, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: STATS_UI.muted, m: 0 } as const

// The headline figure: "412" over "runs in 7 innings".
// `compact` is the Summary tile's larger figure (34 px), the normal one is 30 px.
export function Big({ value, caption, compact = false }: { value: string; caption: string; compact?: boolean }) {
  return (
    <Box>
      <Typography data-testid="stats-big" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: compact ? STATS_TYPE.bigCompact : STATS_TYPE.big, lineHeight: 1, color: STATS_UI.gold, m: 0 }}>{value}</Typography>
      <Typography sx={captionSx}>{caption}</Typography>
    </Box>
  )
}

// The front of a Summary tile that has a breakdown: the big figure at the left and, to its right, up to three compact bars (the top items;
// "+N more" under the figure when there are more). The back is then just the full table, so a chart is never shown twice.
export const FRONT_BARS = 3

export function BigBars({ value, caption, rows, alt, total }: { value: string; caption: string; rows: BarRow[]; alt: string; total: number }) {
  const more = total - Math.min(rows.length, FRONT_BARS)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', columnGap: '14px', minWidth: 0 }}>
      <Box sx={{ display: 'grid', gap: '2px', minWidth: 0 }}>
        <Big compact value={value} caption={caption} />
        {more > 0 && <Typography sx={{ ...captionSx, color: STATS_UI.gold }}>+{more} more</Typography>}
      </Box>
      {rows.length > 0 && <HorizontalBars dense alt={alt} rows={rows.slice(0, FRONT_BARS)} />}
    </Box>
  )
}

export interface TileSpec {
  key: string
  label: string
  value: string
  // The drill this tile opens (a real link); omitted, the tile is plain.
  href?: string
  // The link's accessible name ("Scores of 50 or more: 3").
  name?: string
}

// `dense`: a shorter tile (16 px figure, tight padding) for a card with little height to spare.
export function Tiles({ items, min = 64, dense = false }: { items: TileSpec[]; min?: number; dense?: boolean }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box data-testid="stats-tiles" sx={{ display: 'grid', gap: '6px', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {items.map((item) => {
        const content = (
          <>
            <Typography component="span" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: dense ? 16 : STATS_TYPE.tileValue, lineHeight: 1.1, color: STATS_UI.cream }}>{item.value}</Typography>
            <Typography component="span" sx={captionSx}>{item.label}</Typography>
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
            sx={{ ...tileSx, ...(dense ? denseTileSx : {}), borderColor: alpha(STATS_UI.gold, 0.55), '&:hover': { bgcolor: blackAlpha(0.45) }, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}
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
  rows: { key: string; label: string; value: string }[]
}

// Two or three short columns side by side (Home | Away), each a heading and a few label / value pairs on one line. Compact: about 14 px a line.
export function Split({ columns }: { columns: SplitColumn[] }) {
  return (
    <Box data-testid="stats-split" sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: '14px', minWidth: 0 }}>
      {columns.map((column) => (
        <Box key={column.key} component="dl" sx={{ m: 0, display: 'grid', gap: '3px', alignContent: 'start', minWidth: 0 }}>
          <Typography component="dt" sx={{ ...captionSx, color: STATS_UI.gold, pb: '2px', borderBottom: `1px solid ${STATS_UI.lineSoft}` }}>{column.title}</Typography>
          {column.rows.map((row) => (
            <Box key={row.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px', minWidth: 0, fontSize: STATS_TYPE.body, lineHeight: 1.3 }}>
              <Typography component="dt" sx={{ fontSize: 'inherit', lineHeight: 'inherit', color: STATS_UI.muted, m: 0 }}>{row.label}</Typography>
              <Typography component="dd" sx={{ fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 700, color: STATS_UI.cream, m: 0 }}>{row.value}</Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: STATS_TYPE.body, lineHeight: 1.3, color: STATS_UI.muted, m: 0 }}>{children}</Typography>
}

// A small gold heading over a block ("Average of the last 5 innings").
export function Cap({ children }: { children: ReactNode }) {
  return <Typography sx={{ ...captionSx, color: STATS_UI.gold }}>{children}</Typography>
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
        const sx = { display: 'inline-flex', alignItems: 'center', minHeight: large ? 28 : 22, px: large ? '12px' : '8px', borderRadius: '999px', border: `1px solid ${CHIP_TONE[item.tone]}`, color: CHIP_TONE[item.tone], fontFamily: STATS_UI.display, fontSize: large ? 16 : STATS_TYPE.chip, fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'none' } as const
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

const headCell = { color: STATS_UI.muted, borderColor: STATS_UI.lineSoft, px: '6px', py: '3px', fontFamily: STATS_UI.display, fontSize: STATS_TYPE.caption, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' } as const
const bodyCell = { color: STATS_UI.cream, borderColor: STATS_UI.lineSoft, px: '6px', py: '3px', fontSize: STATS_TYPE.table } as const

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
                    <Box component={RouterLink} to={row.href} tabIndex={tabIndex} aria-label={row.linkName} data-testid="stats-row-link" sx={{ color: STATS_UI.cream, textDecorationColor: STATS_UI.gold, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}>
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
