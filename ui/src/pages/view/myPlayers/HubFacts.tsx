import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'

// The Hub's label and value pieces, shared by the league page and the Club info page (docs/specs/148, extracted from HubLeagueTabs).
export function FactTile({ label, value, gold = false }: { label: string; value: ReactNode; gold?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: HUB.line, bgcolor: creamAlpha(0.07), borderRadius: '4px', p: 1.5, minWidth: 0 }}>
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 600, color: gold ? HUB.gold : HUB.cream, overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  )
}

// Owner, 2026-11-12: one facts card (label and value pairs, all cream, no gaps). `action` is an optional trailing control (an icon button row).
export function Fact({ label, value, last, action, single }: { label: string; value: ReactNode; last?: boolean; action?: ReactNode; single?: boolean }) {
  return (
    <Box sx={{ p: '12px 16px', minWidth: 0, borderBottom: last ? 0 : `1px solid ${HUB.lineSoft}`, ...(single ? {} : { '&:nth-of-type(odd)': { borderRight: { sm: `1px solid ${HUB.lineSoft}` } } }), ...(action ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 } : {}) }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: HUB.muted }}>{label}</Typography>
        <Typography component="div" sx={{ fontSize: 19, fontWeight: 600, color: HUB.cream, overflowWrap: 'anywhere' }}>{value}</Typography>
      </Box>
      {action && <Box sx={{ display: 'flex', gap: 1, flex: 'none' }}>{action}</Box>}
    </Box>
  )
}

// The card the facts sit in: a small display-face heading over a grid of Fact rows (two columns from sm unless `single`).
export function FactsCard({ title, children, testId, single }: { title: string; children: ReactNode; testId?: string; single?: boolean }) {
  return (
    <Box data-testid={testId} sx={{ border: 1, borderColor: HUB.lineSoft, bgcolor: creamAlpha(0.04), borderRadius: '8px', overflow: 'hidden', minWidth: 0 }}>
      <Typography component="h3" sx={{ p: '10px 16px', borderBottom: `1px solid ${HUB.lineSoft}`, fontFamily: HUB.display, fontWeight: 600, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: HUB.muted }}>{title}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: single ? 'minmax(0, 1fr)' : { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>{children}</Box>
    </Box>
  )
}
