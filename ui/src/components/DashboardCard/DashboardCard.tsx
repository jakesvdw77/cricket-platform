import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Skeleton, Typography } from '@mui/material'

export interface DashboardTableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface DashboardTableRow {
  key: string
  // one cell per column, already formatted (a dash or "Not recorded" for a missing value, never 0)
  cells: ReactNode[]
  // a Total row: bold, after the others
  total?: boolean
}

export interface DashboardCardTable {
  caption: string
  columns: DashboardTableColumn[]
  rows: DashboardTableRow[]
}

export interface DashboardCardProps {
  // used in data-testid values: the card is `dashboard-card-<testId>`, its table `<testId>-table`, rows `<testId>-row`
  testId: string
  title: string
  // "Batting" / "Bowling" on the player cards
  subtitle?: string
  // one sentence summarising the chart, assembled by the page from response fields; the chart's aria-describedby
  description?: string
  // the chart itself (a wrapper from components/charts), drawn in a 150 px (180 px from md) area
  children?: ReactNode
  // a short direction label above the chart ("Lower is better")
  note?: string
  legend?: ReactNode
  // text under the chart (the server's trend sentence)
  footer?: ReactNode
  // the coverage caption ("Economy shown for 7 of 8 matches"); omitted or null shows nothing
  coverage?: string | null
  table?: DashboardCardTable
  loading?: boolean
  // a card with nothing to draw: one line, and no table toggle
  empty?: { title: string; description?: string } | null
  // a failed read: the message and Try again
  error?: { onRetry: () => void } | null
  // the previous figures kept visible while a filter change loads
  dimmed?: boolean
  // a card spanning every column from md; the default is one column
  fullWidth?: boolean
  // from lg (three columns) the card spans two columns; ignored when fullWidth
  wide?: boolean
  // 'auto' lets the content (a donut and its legend) set its own height
  chartArea?: 'fixed' | 'auto'
}

const headingSx = { fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.3 } as const
const captionSx = { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 } as const
const CHART_HEIGHT = { xs: 150, md: 180 }

// The grid every Overview card sits in: one column on a phone, two from md, three from lg; gaps of 8 px (12 px from md).
export function DashboardGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
      {children}
    </Box>
  )
}

// docs/specs/117-stats-dashboard.md ("The shared component: DashboardCard"): the card every Dashboard chart sits in. Library-free: the
// chart is `children`. A title with an optional Batting / Bowling subtitle, a 44 px View as table toggle that swaps the chart for a
// real table of the same values, the chart area, a summary sentence, legend, trend footer and coverage caption, and loading, empty and
// error states. Presentational; the page supplies every string from the response, nothing is computed here.
export function DashboardCard({
  testId,
  title,
  subtitle,
  description,
  children,
  note,
  legend,
  footer,
  coverage,
  table,
  loading = false,
  empty = null,
  error = null,
  dimmed = false,
  fullWidth = false,
  wide = false,
  chartArea = 'fixed',
}: DashboardCardProps) {
  const [showTable, setShowTable] = useState(false)
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const tableId = `${id}-table`
  const name = subtitle ? `${title}, ${subtitle}` : title
  const hasData = !loading && !empty && !error

  let body: ReactNode
  if (loading) {
    body = <Skeleton variant="rounded" data-testid={`${testId}-loading`} sx={{ height: CHART_HEIGHT }} />
  } else if (error) {
    body = (
      <Box role="alert" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 1, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Couldn't load the overview</Typography>
        <Typography sx={captionSx}>The rest of the page still works.</Typography>
        <MuiButton variant="outlined" onClick={error.onRetry} sx={{ minHeight: 44 }}>
          Try again
        </MuiButton>
      </Box>
    )
  } else if (empty) {
    body = (
      <Box data-testid={`${testId}-empty`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{empty.title}</Typography>
        {empty.description && <Typography sx={captionSx}>{empty.description}</Typography>}
      </Box>
    )
  } else if (showTable && table) {
    body = (
      <Box sx={{ overflowX: 'auto' }} id={tableId}>
        <Box component="table" data-testid={`${testId}-table`} sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
          <Box component="caption" sx={{ ...captionSx, textAlign: 'left', pb: 0.5 }}>
            {table.caption}
          </Box>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <Box
                  component="th"
                  scope="col"
                  key={column.key}
                  sx={{ textAlign: column.align ?? 'left', py: 0.75, px: 0.75, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', borderBottom: 1, borderColor: 'divider', whiteSpace: 'nowrap' }}
                >
                  {column.label}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <Box component="tr" key={row.key} data-testid={row.total ? `${testId}-total` : `${testId}-row`} sx={{ fontWeight: row.total ? 700 : 400, '& td': row.total ? { borderTop: 1, borderColor: 'divider' } : undefined }}>
                {row.cells.map((cell, index) => (
                  <Box component="td" key={table.columns[index]?.key ?? index} sx={{ textAlign: table.columns[index]?.align ?? 'left', py: 0.75, px: 0.75, borderBottom: 1, borderColor: 'divider', verticalAlign: 'top' }}>
                    {cell}
                  </Box>
                ))}
              </Box>
            ))}
          </tbody>
        </Box>
      </Box>
    )
  } else {
    body = (
      <>
        {note && (
          <Typography data-testid={`${testId}-note`} sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
            {note}
          </Typography>
        )}
        <Box
          role="img"
          aria-label={name}
          aria-describedby={description ? descriptionId : undefined}
          data-testid={`${testId}-chart`}
          sx={chartArea === 'fixed' ? { height: CHART_HEIGHT, width: '100%', maxWidth: '100%', overflow: 'hidden' } : { width: '100%', maxWidth: '100%' }}
        >
          {children}
        </Box>
        {legend}
      </>
    )
  }

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      aria-busy={loading || undefined}
      data-testid={`dashboard-card-${testId}`}
      data-width={fullWidth ? 'full' : 'half'}
      sx={{
        gridColumn: fullWidth ? { xs: 'auto', md: '1 / -1' } : wide ? { xs: 'auto', lg: 'span 2' } : 'auto',
        minWidth: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        opacity: dimmed ? 0.6 : 1,
        transition: 'opacity 150ms',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" id={titleId} sx={headingSx}>
            {title}
          </Typography>
          {subtitle && (
            <Typography data-testid={`${testId}-subtitle`} sx={{ ...captionSx, fontSize: '0.75rem', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {hasData && table && (
          <MuiButton
            variant={showTable ? 'contained' : 'outlined'}
            size="small"
            aria-pressed={showTable}
            aria-controls={showTable ? tableId : undefined}
            onClick={() => setShowTable((value) => !value)}
            data-testid={`${testId}-view-table`}
            sx={{ minHeight: 44, flex: 'none', fontSize: '0.75rem', letterSpacing: '0.04em' }}
          >
            View as table
          </MuiButton>
        )}
      </Box>
      {body}
      {hasData && description && (
        <Typography id={descriptionId} data-testid={`${testId}-description`} sx={captionSx}>
          {description}
        </Typography>
      )}
      {hasData && footer && (
        <Typography component="div" data-testid={`${testId}-footer`} sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4 }}>
          {footer}
        </Typography>
      )}
      {hasData && coverage && (
        <Typography data-testid={`${testId}-coverage`} sx={captionSx}>
          {coverage}
        </Typography>
      )}
    </Box>
  )
}
