import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { MediaUpload } from '../../../components/MediaUpload'
import type { LeagueTeam, LeagueTeamPayload } from '../../../api/leagueTeamApi'

export interface LeagueTeamFormDialogProps {
  open: boolean
  // Undefined = add; a league team = edit.
  leagueTeam?: LeagueTeam
  // "TVL Division 1 · 2026/27" - shown under the title.
  contextLabel: string
  pending: boolean
  // A 409 duplicate-name message: read against the Name field.
  nameError?: string | null
  // Any other failed-save message (network, other 400): a dialog-level Alert.
  errorMessage?: string | null
  // `another` (Save And Add Another, add mode only): the dialog stays open and starts a fresh form after the save.
  onSubmit: (payload: LeagueTeamPayload, options?: { another?: boolean }) => void
  onClose: () => void
}

// docs/specs/070-league-teams.md: a small form (name, abbreviation, logo, and notes from spec 151) in a dialog.
// Mounted only while open (the parent keys it), so each opening starts from the record's values.
export function LeagueTeamFormDialog({
  open,
  leagueTeam,
  contextLabel,
  pending,
  nameError: serverNameError,
  errorMessage,
  onSubmit,
  onClose,
}: LeagueTeamFormDialogProps) {
  const [name, setName] = useState(leagueTeam?.name ?? '')
  const [abbreviation, setAbbreviation] = useState(leagueTeam?.abbreviation ?? '')
  const [logoUrl, setLogoUrl] = useState(leagueTeam?.logoUrl ?? '')
  const [notes, setNotes] = useState(leagueTeam?.notes ?? '')
  const [nameError, setNameError] = useState<string | null>(null)

  const save = (another: boolean) => {
    if (!name.trim()) {
      setNameError('Enter the team name')
      return
    }
    setNameError(null)
    onSubmit(
      { name: name.trim(), abbreviation: abbreviation.trim() || null, logoUrl: logoUrl || null, notes: notes.trim() || null },
      another ? { another: true } : undefined,
    )
  }
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save(false)
  }

  const shownNameError = nameError ?? serverNameError ?? undefined
  const used = leagueTeam?.referencedByMatchCount ?? 0

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ pb: 0.5 }}>{leagueTeam ? 'Edit league team' : 'Add league team'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {contextLabel}
          </Typography>
          <Stack spacing={2}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            {leagueTeam && used > 0 && (
              <Alert severity="info">
                Changes also update {used} {used === 1 ? 'match' : 'matches'} that use this team.
              </Alert>
            )}
            <Input
              label="Team name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={Boolean(shownNameError)}
              helperText={shownNameError}
              inputProps={{ maxLength: 255 }}
              sx={{ mt: 1 }}
            />
            <Input
              label="Abbreviation"
              value={abbreviation}
              onChange={(event) => setAbbreviation(event.target.value)}
              inputProps={{ maxLength: 16 }}
              helperText="Optional"
            />
            <MediaUpload label="Logo" value={logoUrl || null} onUploaded={setLogoUrl} variant="logo" namespace="manage" />
            <Input
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              multiline
              minRows={3}
              inputProps={{ maxLength: 2000 }}
              helperText="Optional. Anything worth keeping about this team: a contact, their ground, travel."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="compact" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {!leagueTeam && (
            <Button size="compact" variant="secondary" onClick={() => save(true)} disabled={pending}>
              Save And Add Another
            </Button>
          )}
          <Button size="compact" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
