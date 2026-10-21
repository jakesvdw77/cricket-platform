import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import type { NotCapturedItem } from '../../../api/playerStatsApi'

// docs/specs/103-player-stats.md: small presentational pieces shared by the three tabs of the breakdown page.

// The headline strip: 2-up on a phone, 4-up from md.
export function StatTileStrip({ children }: { children: ReactNode }) {
  return (
    <Box data-testid="stat-tiles" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
      {children}
    </Box>
  )
}

export interface StatTileProps {
  icon: ReactNode
  label: string
  value: string
  // a quiet coverage line under the label ("from 9 of 14 innings that recorded balls")
  caption?: string
  testId: string
  // the figure's meaning: wins and wickets success, losses error, anything else primary
  tone?: 'primary' | 'success' | 'error'
}

export function StatTile({ icon, label, value, caption, testId, tone = 'primary' }: StatTileProps) {
  return (
    <KeyFigureTile
      compact
      emphasis={tone}
      testId={testId}
      icon={icon}
      value={value}
      label={
        <Box component="span" sx={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>
          {label}
          {caption && (
            <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.3 }}>
              {caption}
            </Box>
          )}
        </Box>
      }
    />
  )
}

// Two equal-height columns from md, one on a phone.
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
      {children}
    </Box>
  )
}

export interface CountRow {
  key: string
  label: string
  value: string
}

// Label left, bold value right, a hairline between rows (How dismissed, Wickets by type, Innings by batting position).
export function CountRows({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    )
  }
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {rows.map((row) => (
        <Box
          component="li"
          key={row.key}
          sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{row.label}</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
            {row.value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// The single "Not captured yet" panel at the foot of a tab: names the statistics the scorecard cannot support, with the
// reason in one line. Driven by the response's notCaptured list, so it shrinks by itself as capture arrives.
// (spec 116: the team page passes its own list, which has no `tab`, so only the three fields drawn are required)
export function NotCapturedPanel({ items }: { items: Pick<NotCapturedItem, 'code' | 'label' | 'reason'>[] }) {
  if (items.length === 0) return null
  return (
    <InfoCard fieldSize="large" title="Not captured yet" icon={<ReportGmailerrorredOutlinedIcon />} tone="warning" testId="not-captured-panel">
      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        {items.map((item) => (
          <Typography component="li" variant="body2" key={item.code} sx={{ mb: 0.5, fontSize: '0.875rem', lineHeight: 1.4 }}>
            <b>{item.label}</b>: {item.reason}
          </Typography>
        ))}
      </Box>
    </InfoCard>
  )
}
