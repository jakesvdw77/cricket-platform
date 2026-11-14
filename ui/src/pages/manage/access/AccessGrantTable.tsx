import type { ReactNode } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { badgeSx } from '../../../components/RecordCard'
import { ToolbarCard } from '../../../components/ToolbarCard'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { zebraTint } from '../../../utils/zebraTint'
import { AccessGrantRowMenu } from './AccessGrantRowMenu'
import type { AccessGrantRowMenuProps } from './AccessGrantRowMenu'
import { fullName, placeLabel, statusLabel } from './accessGrantFormat'

export interface AccessGrantTableProps extends Omit<AccessGrantRowMenuProps, 'grant' | 'testId'> {
  grants: AccessGrant[]
  // page-anatomy section 3: the page's filter bar. Given, ONE card: this toolbar row, a hairline, then the header and rows.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
}

const NOT_ON_FILE = '–'

// Desktop: Person, Role, Place, Status, Added by, actions. A phone keeps Person, Role and the actions button.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 96px 44px',
  sm: 'minmax(220px, 2fr) 120px minmax(140px, 1fr) minmax(130px, 0.8fr) minmax(140px, 1fr) 44px',
}
const gridSx = { display: 'grid', gridTemplateColumns: COLUMNS, alignItems: 'center', columnGap: { xs: 0.75, sm: 1.5 }, px: 1.5 } as const
const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const
const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function Row({ grant, ...menu }: { grant: AccessGrant } & Omit<AccessGrantRowMenuProps, 'grant' | 'testId'>) {
  return (
    <Box
      role="row"
      data-testid="access-row"
      sx={{ ...gridSx, minHeight: { xs: 60, sm: 56 }, '&:nth-of-type(even)': { bgcolor: zebraTint }, '&:hover': { bgcolor: hoverTint } }}
    >
      <Box role="cell" sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap component="div">
          {fullName(grant)}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {grant.email ?? NOT_ON_FILE}
        </Typography>
      </Box>
      <Box role="cell">
        <Chip size="small" label={grant.roleName} sx={{ ...badgeSx('active'), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY}>
        <Chip size="small" variant="outlined" label={placeLabel(grant)} sx={{ height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY}>
        <Chip size="small" label={statusLabel(grant)} sx={{ ...badgeSx(grant.status === 'INVITED' ? 'warning' : 'positive'), height: 22, fontSize: '0.75rem' }} />
      </Box>
      <Typography role="cell" variant="body2" color={grant.addedByName ? 'text.primary' : 'text.secondary'} noWrap sx={desktopOnly} {...DESKTOP_ONLY}>
        {grant.addedByName ?? NOT_ON_FILE}
      </Typography>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'flex-end', color: 'primary.main' }}>
        <AccessGrantRowMenu grant={grant} {...menu} testId="access-row-actions" />
      </Box>
    </Box>
  )
}

// docs/specs/150 and page-anatomy section 6: the List view, built like LeagueTable and PlayerTable: one bordered panel with a
// header row that sticks, zebra rows (first row white) and ONE kebab at the right end of each row. No chevron.
export function AccessGrantTable({ grants, toolbar, empty, ...menu }: AccessGrantTableProps) {
  const table = (
    <Box role="table" aria-label="People with access" sx={toolbar ? undefined : cardSx}>
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: { xs: 36, sm: 40 },
          bgcolor: zebraTint,
          borderBottom: 1,
          borderColor: 'divider',
          fontSize: { xs: '0.6875rem', sm: '0.75rem' },
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        <Box role="columnheader">Person</Box>
        <Box role="columnheader">Role</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Place</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Added By</Box>
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {grants.map((grant) => (
          <Row key={grant.id} grant={grant} {...menu} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="access-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {grants.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
