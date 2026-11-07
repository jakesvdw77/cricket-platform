import type { ReactNode } from 'react'
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { STATS_TONES, blackAlpha } from '../../../../brandTokens'
import { useFaceTabIndex } from '../../../../components/FlipCard'
import { STATS_UI } from '../../../../components/StatsCards'

// docs/specs/147: the small pieces the card faces are drawn from, so a card file holds only its content: the big figure, tiles (a tile
// with a drill is a real link), a real table, chips, a note. Shared by every My stats card; none of them knows a payload. A link here sits
// above the stretched flip button and leaves the tab order while its face is hidden (useFaceTabIndex).

const tileSx = {
  display: 'grid',
  alignContent: 'center',
  gap: '2px',
  minWidth: 0,
  minHeight: 56,
  px: 1.25,
  py: 0.75,
  borderRadius: '8px',
  border: `1px solid ${STATS_UI.lineSoft}`,
  bgcolor: blackAlpha(0.3),
  color: STATS_UI.cream,
  textDecoration: 'none',
} as const

const captionSx = { fontFamily: STATS_UI.display, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: STATS_UI.muted, m: 0 } as const

// The headline figure: "412" over "runs in 7 innings".
export function Big({ value, caption }: { value: string; caption: string }) {
  return (
    <Box>
      <Typography data-testid="stats-big" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: 54, lineHeight: 1, color: STATS_UI.gold, m: 0 }}>{value}</Typography>
      <Typography sx={captionSx}>{caption}</Typography>
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

export function Tiles({ items, min = 84 }: { items: TileSpec[]; min?: number }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box data-testid="stats-tiles" sx={{ display: 'grid', gap: 1, gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {items.map((item) => {
        const content = (
          <>
            <Typography component="span" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: 22, lineHeight: 1.1, color: STATS_UI.cream }}>{item.value}</Typography>
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
            sx={{ ...tileSx, borderColor: alpha(STATS_UI.gold, 0.55), '&:hover': { bgcolor: blackAlpha(0.45) }, '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: 2 } }}
          >
            {content}
          </Box>
        ) : (
          <Box key={item.key} data-testid="stats-tile" sx={tileSx}>
            {content}
          </Box>
        )
      })}
    </Box>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 14, lineHeight: 1.4, color: STATS_UI.muted, m: 0 }}>{children}</Typography>
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
export function Chips({ items }: { items: ChipSpec[] }) {
  const tabIndex = useFaceTabIndex()
  return (
    <Box data-testid="stats-chips" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {items.map((item) => {
        const sx = { display: 'inline-flex', alignItems: 'center', minHeight: 28, px: 1.25, borderRadius: '999px', border: `1px solid ${CHIP_TONE[item.tone]}`, color: CHIP_TONE[item.tone], fontFamily: STATS_UI.display, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none' } as const
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

const headCell = { color: STATS_UI.muted, borderColor: STATS_UI.lineSoft, px: 0.75, py: 0.5, fontFamily: STATS_UI.display, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' } as const
const bodyCell = { color: STATS_UI.cream, borderColor: STATS_UI.lineSoft, px: 0.75, py: 0.625, fontSize: 14 } as const

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
