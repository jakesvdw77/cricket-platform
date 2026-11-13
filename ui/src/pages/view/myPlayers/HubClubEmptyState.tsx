import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { BrandIcon } from '../../../components/BrandIcon'
import type { BrandIconName } from '../../../components/BrandIcon'
import { HUB } from './hubStyle'

// The dashed empty panel shared by the Club info page and its Contacts directory (docs/specs/148): brand icon, title, one line and an
// optional action.
export function HubClubEmptyState({ icon, title, line, testId, children }: { icon: BrandIconName; title: string; line: string; testId: string; children?: ReactNode }) {
  return (
    <Box data-testid={testId} sx={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 1, border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 3 }}>
      <BrandIcon name={icon} size={56} onDark />
      <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.sand }}>{title}</Typography>
      <Typography sx={{ color: HUB.muted }}>{line}</Typography>
      {children}
    </Box>
  )
}
