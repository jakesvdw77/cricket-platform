import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import { Button } from '../Button'

export interface RecordStatusToggleProps {
  // The record's current .active value — every one of the eight "disable, never delete" entities
  // (Club Contact, League, Season, Sponsor, Sponsor Contact, Team, Player, Match) already carries
  // this once loaded.
  active: boolean
  // The in-flight deactivate/reactivate mutation's isPending — drives both the pending label and
  // disabled state, same as every RecordCard.secondaryAction this replaces used to.
  pending: boolean
  onClick: () => void
}

// docs/specs/038-move-deactivate-to-edit-screen.md: relocates the Deactivate/Reactivate toggle off
// each entity's list RecordCard and onto that entity's own edit *FormPage.tsx actions bar, as a
// button alongside Save. Extracted as a shared component because all eight existing call sites
// rendered byte-for-byte identical label/icon/pending text — one shape, not eight near-copies.
export function RecordStatusToggle({ active, pending, onClick }: RecordStatusToggleProps) {
  if (active) {
    return (
      <Button variant="danger" startIcon={<ToggleOffOutlinedIcon fontSize="small" />} disabled={pending} onClick={onClick}>
        {pending ? 'Deactivating…' : 'Deactivate'}
      </Button>
    )
  }

  return (
    <Button variant="secondary" startIcon={<ToggleOnOutlinedIcon fontSize="small" />} disabled={pending} onClick={onClick}>
      {pending ? 'Reactivating…' : 'Reactivate'}
    </Button>
  )
}
