import { Box, Typography } from '@mui/material'
import type { MyClubDirectory } from '../../../../api/meClubInfoApi'
import { HUB } from '../hubStyle'

// docs/specs/148 (Contacts): a stub until the directory slice. Read only, never exported.
export function HubClubDirectory({ directory }: { playerKey?: string; directory: MyClubDirectory | null }) {
  void directory
  return (
    <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2 }}>
      <Typography sx={{ color: HUB.muted }}>Contacts are coming soon</Typography>
    </Box>
  )
}
