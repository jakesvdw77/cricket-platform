import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { ToggleButton } from '@mui/material'
import { isAxiosError } from 'axios'
import { Button } from '../../../components/Button'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import { Input } from '../../../components/Input'
import { SectionTreeSelect } from '../../../components/SectionTreeSelect'
import { useAddAccessGrant } from '../../../api/accessGrantsApi'
import type { AccessGrantList, AccessRole, AddAccessGrantResult } from '../../../api/accessGrantsApi'
import type { Section } from '../../../api/sectionApi'
import { assignableRoles, clubWideFor, placeHelper, sectionsFor } from './accessGrantFormat'

export interface AddPersonDialogProps {
  clubId: string
  open: boolean
  list: AccessGrantList | undefined
  roles: AccessRole[] | undefined
  sections: Section[]
  onClose: () => void
  onAdded: (result: AddAccessGrantResult) => void
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// docs/specs/150: Add Person. Place first (Whole Club only when the server says the caller may), then the role; only roles the
// caller may give at that place are enabled, the others show why. The server enforces every rule again.
export function AddPersonDialog({ clubId, open, list, roles, sections, onClose, onAdded }: AddPersonDialogProps) {
  const add = useAddAccessGrant(clubId)
  const options = useMemo(() => assignableRoles(roles), [roles])
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [scope, setScope] = useState<'CLUB' | 'SECTION'>('SECTION')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string>('')

  const canClubWide = Boolean(list?.canGrantClubWide)
  useEffect(() => {
    if (!open) return
    setEmail('')
    setFirstName('')
    setLastName('')
    setSectionId(null)
    setScope(canClubWide ? 'CLUB' : 'SECTION')
    setRoleId(options[0]?.id ?? '')
    add.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const grantableIds = useMemo(() => new Set(list?.grantableSectionIds ?? []), [list])
  // The tree shows only sections the caller may grant on; a section whose parent is left out becomes a root.
  const pickable = useMemo(
    () => sections.filter((section) => grantableIds.has(section.id)).map((section) => ({ ...section, parentSectionId: section.parentSectionId && grantableIds.has(section.parentSectionId) ? section.parentSectionId : null })),
    [sections, grantableIds],
  )
  const selected = sections.find((section) => section.id === sectionId) ?? null

  const roleAllowed = (id: string) => (scope === 'CLUB' ? clubWideFor(list, id) : sectionId !== null && sectionsFor(list, id).includes(sectionId))
  const valid =
    EMAIL.test(email.trim()) && firstName.trim() !== '' && lastName.trim() !== '' && roleId !== '' && (scope === 'CLUB' || sectionId !== null) && roleAllowed(roleId)

  const submit = () =>
    add.mutate(
      { email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), roleId, scope, sectionId: scope === 'SECTION' ? sectionId ?? undefined : undefined },
      { onSuccess: (result) => onAdded(result) },
    )

  const serverMessage = add.isError && isAxiosError(add.error) ? (add.error.response?.data as { detail?: string } | undefined)?.detail : undefined

  return (
    <Dialog open={open} onClose={add.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Person</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={add.isPending} inputProps={{ maxLength: 254 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Input label="First Name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={add.isPending} inputProps={{ maxLength: 100 }} />
          <Input label="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={add.isPending} inputProps={{ maxLength: 100 }} />
        </Box>

        {canClubWide && (
          <CompactToggleGroup<'CLUB' | 'SECTION'> value={scope} onChange={setScope} ariaLabel="Place" fullWidthOnPhone>
            <ToggleButton value="CLUB">Whole Club</ToggleButton>
            <ToggleButton value="SECTION">One Section</ToggleButton>
          </CompactToggleGroup>
        )}
        {scope === 'SECTION' && (
          <SectionTreeSelect label="Section" sections={pickable} value={sectionId} onChange={setSectionId} />
        )}

        <Box role="radiogroup" aria-label="Role">
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Role
          </Typography>
          <RadioGroup value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            {options.map((role) => {
              const allowed = roleAllowed(role.id)
              return (
                <FormControlLabel
                  key={role.id}
                  value={role.id}
                  disabled={add.isPending || !allowed}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {role.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {allowed || (scope === 'SECTION' && sectionId === null) ? role.description : 'You do not hold some of this role\'s permissions here'}
                      </Typography>
                    </Box>
                  }
                />
              )
            })}
          </RadioGroup>
        </Box>

        <Typography variant="body2" color="success.dark" role="note">
          {placeHelper(scope === 'CLUB' ? null : selected?.name ?? null, scope === 'CLUB')}
        </Typography>
        {add.isError && <Alert severity="error">{serverMessage ?? 'We could not add this person. Please try again.'}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="compact" variant="ghost" onClick={onClose} disabled={add.isPending}>
          Cancel
        </Button>
        <Button size="compact" disabled={!valid || add.isPending} onClick={submit}>
          {add.isPending ? 'Adding…' : 'Add Person'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
