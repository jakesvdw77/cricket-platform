import { useEffect, useState } from 'react'
import { Alert, MenuItem, Stack, TextField } from '@mui/material'
import { BrandIcon } from '../../../components/BrandIcon'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import type { AnnounceRoleChoices } from './announceWithRoles'

export interface AnnounceCandidate {
  playerId: string
  name: string
}

export interface AnnounceTeamDialogProps {
  open: boolean
  // The picked players who can take a role (the 12th man is left out by the caller).
  candidates: AnnounceCandidate[]
  captainMissing: boolean
  keeperMissing: boolean
  pending: boolean
  errorMessage?: string | null
  onConfirm: (choices: AnnounceRoleChoices) => void
  onClose: () => void
}

// docs/specs/076-team-selection.md section 8, extended: the one announce confirmation of every Team selection page. It is
// non-blocking: a side with no captain or no wicketkeeper can still be announced, but the dialog says so and offers a
// select for each missing one. The caller saves a chosen role (keeping the others) and then announces.
export function AnnounceTeamDialog({ open, candidates, captainMissing, keeperMissing, pending, errorMessage, onConfirm, onClose }: AnnounceTeamDialogProps) {
  const [captainId, setCaptainId] = useState('')
  const [keeperId, setKeeperId] = useState('')

  useEffect(() => {
    if (open) {
      setCaptainId('')
      setKeeperId('')
    }
  }, [open])

  const unchosen = (captainMissing && !captainId) || (keeperMissing && !keeperId)
  const choices: AnnounceRoleChoices = {
    ...(captainMissing && captainId ? { captainPlayerId: captainId } : {}),
    ...(keeperMissing && keeperId ? { wicketKeeperPlayerId: keeperId } : {}),
  }

  const roleSelect = (label: string, value: string, onChange: (next: string) => void) => (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={pending}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }}
    >
      <MenuItem value="">
        <em>None</em>
      </MenuItem>
      {candidates.map((candidate) => (
        <MenuItem key={candidate.playerId} value={candidate.playerId}>
          {candidate.name}
        </MenuItem>
      ))}
    </TextField>
  )

  return (
    <ConfirmDialog
      open={open}
      title="Announce this team?"
      icon={<BrandIcon name="actions/announce-team" size={40} />}
      description={
        <Stack spacing={2}>
          <span>
            Announcing marks this team as final: it shows as announced on the match and team sheet, and the team sheet can be
            shared. Nobody is notified automatically. If you change the selection afterwards, you will need to announce it again.
          </span>
          {captainMissing && (
            <Alert severity="warning" icon={false} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Stack spacing={1.5}>
                <span>No captain selected.</span>
                {roleSelect('Captain', captainId, setCaptainId)}
              </Stack>
            </Alert>
          )}
          {keeperMissing && (
            <Alert severity="warning" icon={false} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Stack spacing={1.5}>
                <span>No wicketkeeper selected.</span>
                {roleSelect('Wicketkeeper', keeperId, setKeeperId)}
              </Stack>
            </Alert>
          )}
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Stack>
      }
      confirmLabel={unchosen ? 'Announce anyway' : 'Announce team'}
      pendingLabel="Announcing…"
      pending={pending}
      onConfirm={() => onConfirm(choices)}
      onClose={onClose}
    />
  )
}
