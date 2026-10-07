import { Chip } from '@mui/material'
import { badgeSx } from '../../../../components/RecordCard'

// docs/specs/077: a small, subtle marker beside an answer that the player gave through the public
// link rather than a manager entering it. Always carries its text, never colour alone.
export function ViaLinkMarker() {
  return (
    <Chip
      component="span"
      size="small"
      label="via link"
      variant="outlined"
      sx={{ ...badgeSx('side'), height: 20, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.75 } }}
    />
  )
}
