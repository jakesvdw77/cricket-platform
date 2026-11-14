import { useEffect, useMemo, useState } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Radio, RadioGroup, Box, Typography } from '@mui/material'
import { isAxiosError } from 'axios'
import { Button } from '../../../components/Button'
import { useChangeAccessGrantRole } from '../../../api/accessGrantsApi'
import type { AccessGrant, AccessGrantList, AccessRole } from '../../../api/accessGrantsApi'
import { assignableRoles, clubWideFor, fullName, placeLabel, sectionsFor } from './accessGrantFormat'

export interface ChangeRoleDialogProps {
  clubId: string
  grant: AccessGrant | null
  list: AccessGrantList | undefined
  roles: AccessRole[] | undefined
  onClose: () => void
  onChanged: () => void
}

// docs/specs/150: change what a person may do at the same place. Offered only when a second role may be given.
export function ChangeRoleDialog({ clubId, grant, list, roles, onClose, onChanged }: ChangeRoleDialogProps) {
  const change = useChangeAccessGrantRole(clubId)
  const options = useMemo(() => assignableRoles(roles), [roles])
  const [roleId, setRoleId] = useState('')
  useEffect(() => {
    setRoleId(grant?.roleId ?? '')
    change.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grant])

  const allowed = (id: string) =>
    grant?.scopeType === 'CLUB' ? clubWideFor(list, id) : grant?.sectionId ? sectionsFor(list, id).includes(grant.sectionId) : false
  const serverMessage = change.isError && isAxiosError(change.error) ? (change.error.response?.data as { detail?: string } | undefined)?.detail : undefined

  return (
    <Dialog open={Boolean(grant)} onClose={change.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <DialogContentText>{grant ? `${fullName(grant)}, ${placeLabel(grant)}` : ''}</DialogContentText>
        <RadioGroup value={roleId} onChange={(event) => setRoleId(event.target.value)} aria-label="Role">
          {options.map((role) => (
            <FormControlLabel
              key={role.id}
              value={role.id}
              disabled={change.isPending || !allowed(role.id)}
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {role.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {role.description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
        {change.isError && <Alert severity="error">{serverMessage ?? 'We could not change the role. Please try again.'}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="compact" variant="ghost" onClick={onClose} disabled={change.isPending}>
          Cancel
        </Button>
        <Button
          size="compact"
          disabled={!grant || roleId === grant.roleId || change.isPending}
          onClick={() => grant && change.mutate({ id: grant.id, roleId }, { onSuccess: onChanged })}
        >
          {change.isPending ? 'Saving…' : 'Save Role'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
