import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Alert, Box, MenuItem, Skeleton, Typography } from '@mui/material'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useCreateLinkRequest, useMyClubs } from '../../api/meApi'
import { HUB, darkFieldSx, darkMenuProps, hubGoldButton } from './myPlayers/hubStyle'

export interface LinkRequestPrefill {
  firstName?: string
  // Only the first letter is known for a player found by the match; shown as a hint, never pre-filled.
  surnameInitial?: string
  clubId?: string
  clubName?: string
  // The opaque ref of the matched player (sent as targetPlayerRef).
  targetPlayerRef?: string
}

export interface LinkRequestFormProps {
  prefill?: LinkRequestPrefill
  onSent: () => void
  // Shown (as a filled Back button) when the form was opened from somewhere to return to.
  onBack?: () => void
  // The hub's dark field look (inside the console panel).
  dark?: boolean
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// docs/specs/119 Part 3: "No player found" and "Ask the club to help". It always ends in the same confirmation whether
// or not the club has such a player (the server answers identically), so the form never reveals who is on file.
export function LinkRequestForm({ prefill, onSent, onBack, dark = false }: LinkRequestFormProps) {
  const clubs = useMyClubs()
  const create = useCreateLinkRequest()
  const [firstName, setFirstName] = useState(prefill?.firstName ?? '')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [clubId, setClubId] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState(false)

  // Preselect the only club, or the club of the player we are asking about.
  useEffect(() => {
    if (clubId || !clubs.data) return
    const byId = prefill?.clubId ? clubs.data.find((club) => club.id === prefill.clubId) : undefined
    const byName = prefill?.clubName ? clubs.data.find((club) => club.name === prefill.clubName) : undefined
    const only = clubs.data.length === 1 ? clubs.data[0] : undefined
    const chosen = byId ?? byName ?? only
    if (chosen) setClubId(chosen.id)
  }, [clubs.data, clubId, prefill?.clubName, prefill?.clubId])

  const missing = !firstName.trim() || !lastName.trim() || !dateOfBirth || !contactNumber.trim() || !clubId
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (missing) return
    create.mutate(
      {
        clubId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        contactNumber: contactNumber.trim(),
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(prefill?.targetPlayerRef ? { targetPlayerRef: prefill.targetPlayerRef } : {}),
      },
      { onSuccess: onSent },
    )
  }

  const tooMany = isAxiosError(create.error) && create.error.response?.status === 429
  return (
    <Box component="form" noValidate onSubmit={submit} aria-label="Ask the club to link a player" data-testid="link-request-form" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, ...(dark ? darkFieldSx : {}) }}>
      <Input
        label="First name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        error={touched && !firstName.trim()}
        helperText={touched && !firstName.trim() ? 'Enter the player\'s first name' : undefined}
        autoComplete="off"
      />
      <Input
        label="Surname"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        error={touched && !lastName.trim()}
        helperText={touched && !lastName.trim() ? 'Enter the player\'s surname' : prefill?.surnameInitial ? `Starts with ${prefill.surnameInitial.toUpperCase()}` : undefined}
        autoComplete="off"
      />
      <Input
        label="Date of birth"
        type="date"
        value={dateOfBirth}
        onChange={(event) => setDateOfBirth(event.target.value)}
        error={touched && !dateOfBirth}
        helperText={touched && !dateOfBirth ? 'Enter the full date of birth' : undefined}
        inputProps={{ max: todayIso() }}
        InputLabelProps={{ shrink: true }}
      />
      <Input
        label="Contact number"
        type="tel"
        value={contactNumber}
        onChange={(event) => setContactNumber(event.target.value)}
        error={touched && !contactNumber.trim()}
        helperText={touched && !contactNumber.trim() ? 'Enter a contact number' : 'So the club can follow up with you'}
        inputProps={{ maxLength: 30 }}
        autoComplete="tel"
      />
      {clubs.isPending ? (
        <Skeleton variant="rounded" height={40} />
      ) : (
        <Input
          select
          SelectProps={dark ? { MenuProps: darkMenuProps } : undefined}
          label="Club"
          value={clubId}
          onChange={(event) => setClubId(event.target.value)}
          error={touched && !clubId}
          helperText={touched && !clubId ? 'Choose the club' : clubs.isError ? 'We could not load the clubs. Please try again later.' : undefined}
        >
          {(clubs.data ?? []).map((club) => (
            <MenuItem key={club.id} value={club.id}>
              {club.name}
            </MenuItem>
          ))}
        </Input>
      )}
      <Input
        label="Message (optional)"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        multiline
        minRows={2}
        inputProps={{ maxLength: 500 }}
        placeholder="Anything that helps the club, for example the team or coach"
      />
      <Typography variant="caption" color={dark ? undefined : 'text.secondary'} sx={dark ? { color: HUB.muted } : undefined}>
        The club checks every request before anyone is linked.
      </Typography>
      {create.isError && (
        <Alert severity="error">{tooMany ? 'You have sent too many requests. Please try again later.' : 'We could not send your request. Please try again.'}</Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', gap: 1 }}>
        {onBack && (
          <Button onClick={onBack} disabled={create.isPending} sx={{ minHeight: { xs: 44, sm: 40 } }}>
            Back
          </Button>
        )}
        <Button type="submit" disabled={create.isPending} sx={{ minHeight: { xs: 44, sm: 40 }, ...(dark ? hubGoldButton : {}) }}>
          {create.isPending ? 'Sending…' : 'Send request'}
        </Button>
      </Box>
    </Box>
  )
}
