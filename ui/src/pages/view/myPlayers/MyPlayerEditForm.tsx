import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Alert, Box, Checkbox, FormControlLabel, MenuItem, Typography } from '@mui/material'
import { isAxiosError } from 'axios'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { EmailInput } from '../../../components/EmailInput'
import { PhoneInput } from '../../../components/PhoneInput'
import { MediaUpload } from '../../../components/MediaUpload'
import { BOWLING_TYPE_OPTIONS } from '../../../components/PlayerForm/PlayerForm'
import type { BattingStance, BowlingArm, BowlingType } from '../../../api/playerApi'
import { HUB, darkFieldSx as darkSx, darkMenuProps, hubGoldButton, hubOutlineButton } from './hubStyle'
import { useUpdateMyPlayer } from '../../../api/myPlayersApi'
import type { MyPlayer, UpdateMyPlayerRequest } from '../../../api/myPlayersApi'

// docs/specs/119 3C: the whitelist an agent may change for a player (never name, date of birth, gender, sections,
// jersey number or status). Contact and cricket fields are a full replace, so a blank clears. Medical aid is only
// editable by the main agent and the adult player; for anyone else the stored values are shown and sent back unchanged.
// Email is for the main agent or the player themselves.
const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim())
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface MyPlayerEditFormProps {
  player: MyPlayer
  // Called after a successful save.
  onDone: () => void
  // The hub's dark look (inside the console panel) with its own Back button; the default is the light form.
  dark?: boolean
  onBack?: () => void
}

export function MyPlayerEditForm({ player, onDone, dark = false, onBack }: MyPlayerEditFormProps) {
  const update = useUpdateMyPlayer(player.key)
  const canEditEmail = player.self || player.main
  const [photoUrl, setPhotoUrl] = useState<string | null>(player.photoUrl)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [email, setEmail] = useState(player.email ?? '')
  const [altContactName, setAltContactName] = useState(player.altContactName ?? '')
  const [altContactPhone, setAltContactPhone] = useState(player.altContactPhone ?? '')
  const [battingStance, setBattingStance] = useState<'' | BattingStance>(player.battingStance ?? '')
  const [bowlingArm, setBowlingArm] = useState<'' | BowlingArm>(player.bowlingArm ?? '')
  const [bowlingType, setBowlingType] = useState<'' | BowlingType>(player.bowlingType ?? '')
  const [isWicketKeeper, setIsWicketKeeper] = useState(player.isWicketKeeper)
  const [medicalAidProvider, setMedicalAidProvider] = useState(player.medicalAidProvider ?? '')
  const [medicalAidMemberNumber, setMedicalAidMemberNumber] = useState(player.medicalAidMemberNumber ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(player.dateOfBirth ?? '')
  const [understood, setUnderstood] = useState(false)
  const [dobError, setDobError] = useState<string | undefined>()
  const [emailError, setEmailError] = useState<string | undefined>()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const snapshot = JSON.stringify([dateOfBirth, photoUrl, phone, email, altContactName, altContactPhone, battingStance, bowlingArm, bowlingType, isWicketKeeper, medicalAidProvider, medicalAidMemberNumber])
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot
  const dobChanged = player.canEditDateOfBirth && dateOfBirth !== (player.dateOfBirth ?? '')
  const back = () => {
    if (dirty) setConfirmingDiscard(true)
    else onBack?.()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canEditEmail && email.trim() !== '' && !EMAIL_PATTERN.test(email.trim())) {
      setEmailError('Enter a valid email address')
      return
    }
    if (dobChanged && dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setDobError('The date of birth cannot be in the future')
      return
    }
    setDobError(undefined)
    setEmailError(undefined)
    const body: UpdateMyPlayerRequest = {
      photoUrl,
      dateOfBirth: player.canEditDateOfBirth ? (dateOfBirth || null) : player.dateOfBirth,
      phone: blankToNull(phone),
      // Not editable for another agent: echo the stored value back unchanged.
      email: canEditEmail ? blankToNull(email) : player.email,
      altContactName: blankToNull(altContactName),
      altContactPhone: blankToNull(altContactPhone),
      battingStance: battingStance === '' ? null : battingStance,
      bowlingArm: bowlingArm === '' ? null : bowlingArm,
      bowlingType: bowlingType === '' ? null : bowlingType,
      isWicketKeeper,
      medicalAidProvider: player.canEditMedical ? blankToNull(medicalAidProvider) : player.medicalAidProvider,
      medicalAidMemberNumber: player.canEditMedical ? blankToNull(medicalAidMemberNumber) : player.medicalAidMemberNumber,
    }
    update.mutate(body, { onSuccess: onDone })
  }

  const select = <T extends string>(set: (value: '' | T) => void) => (event: ChangeEvent<HTMLInputElement>) => set(event.target.value as '' | T)
  const errorText = isAxiosError(update.error) && update.error.response?.status === 403 ? 'You cannot change that detail for this player.' : 'We could not save the changes. Please try again.'

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...(dark ? darkSx : {}) }} data-testid="my-player-edit-form">
      {dark && onBack && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Box>
            <Button variant="secondary" size="compact" startIcon={<ArrowBackIcon />} onClick={back} sx={hubOutlineButton}>
              Back to profile
            </Button>
          </Box>
          {confirmingDiscard && (
            <Box role="alert" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, display: 'grid', gap: 1, bgcolor: 'rgba(0,0,0,.3)' }}>
              <Typography fontSize={14}>Discard your changes?</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="compact" onClick={() => onBack()} sx={hubOutlineButton}>
                  Discard
                </Button>
                <Button size="compact" onClick={() => setConfirmingDiscard(false)} sx={hubGoldButton}>
                  Keep editing
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
      <MediaUpload label="Photo" value={photoUrl} onUploaded={setPhotoUrl} variant="logo" namespace="manage" />

      <Typography variant="subtitle2" component="h2" fontWeight={700}>
        Personal
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Input
          label="Date of birth"
          type="date"
          value={player.canEditDateOfBirth ? dateOfBirth : (player.dateOfBirth ?? '')}
          onChange={(e) => setDateOfBirth(e.target.value)}
          disabled={!player.canEditDateOfBirth}
          error={Boolean(dobError)}
          helperText={dobError ?? (player.canEditDateOfBirth ? undefined : 'Only the main agent or the adult player can change this')}
          inputProps={{ max: new Date().toISOString().slice(0, 10) }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      {dobChanged && (
        <Box role="alert" data-testid="dob-warning" sx={dark ? { border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, display: 'grid', gap: 0.5, bgcolor: 'rgba(0,0,0,.3)' } : undefined}>
          <Alert severity="warning" sx={dark ? { bgcolor: 'transparent', color: HUB.cream, p: 0, '& .MuiAlert-icon': { color: HUB.gold } } : undefined}>
            Changing the date of birth can change which age group and sections {player.firstName} is eligible for, and it is used to confirm identity on availability links. It applies at every club {player.firstName} plays for.
          </Alert>
          <FormControlLabel control={<Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />} label="I understand" />
        </Box>
      )}

      <Typography variant="subtitle2" component="h2" fontWeight={700}>
        Contact
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <PhoneInput value={phone} onChange={setPhone} />
        {canEditEmail ? (
          <EmailInput value={email} onChange={setEmail} error={emailError} />
        ) : (
          <Input label="Email" value={player.email ?? ''} disabled helperText="Only the main agent can change this" />
        )}
        <Input label="Alternative contact name" value={altContactName} onChange={(e) => setAltContactName(e.target.value)} />
        <PhoneInput label="Alternative contact phone" value={altContactPhone} onChange={setAltContactPhone} />
      </Box>

      <Typography variant="subtitle2" component="h2" fontWeight={700}>
        Cricket
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Input label="Batting stance" SelectProps={dark ? { MenuProps: darkMenuProps } : undefined} select value={battingStance} onChange={select<BattingStance>(setBattingStance)}>
          <MenuItem value="">Not specified</MenuItem>
          <MenuItem value="RIGHT_HANDED">Right-handed</MenuItem>
          <MenuItem value="LEFT_HANDED">Left-handed</MenuItem>
        </Input>
        <Input label="Bowling arm" SelectProps={dark ? { MenuProps: darkMenuProps } : undefined} select value={bowlingArm} onChange={select<BowlingArm>(setBowlingArm)}>
          <MenuItem value="">Not specified</MenuItem>
          <MenuItem value="RIGHT_ARM">Right-arm</MenuItem>
          <MenuItem value="LEFT_ARM">Left-arm</MenuItem>
        </Input>
        <Input label="Bowling type" SelectProps={dark ? { MenuProps: darkMenuProps } : undefined} select value={bowlingType} onChange={select<BowlingType>(setBowlingType)}>
          <MenuItem value="">Not specified</MenuItem>
          {BOWLING_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Input>
        <FormControlLabel control={<Checkbox checked={isWicketKeeper} onChange={(e) => setIsWicketKeeper(e.target.checked)} />} label="Wicketkeeper" />
      </Box>

      <Typography variant="subtitle2" component="h2" fontWeight={700}>
        Medical aid
      </Typography>
      {!player.canEditMedical && (
        <Typography variant="caption" color="text.secondary">
          Only the main agent or the player can change medical aid details.
        </Typography>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Input
          label="Medical aid provider"
          value={player.canEditMedical ? medicalAidProvider : (player.medicalAidProvider ?? '')}
          onChange={(e) => setMedicalAidProvider(e.target.value)}
          disabled={!player.canEditMedical}
        />
        <Input
          label="Medical aid member number"
          value={player.canEditMedical ? medicalAidMemberNumber : (player.medicalAidMemberNumber ?? '')}
          onChange={(e) => setMedicalAidMemberNumber(e.target.value)}
          disabled={!player.canEditMedical}
        />
      </Box>

      {update.isError && <Alert severity="error">{errorText}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', gap: 1 }}>
        {!dark && (
          <Button variant="secondary" onClick={onDone} disabled={update.isPending} sx={{ minHeight: { xs: 44, sm: 40 } }}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={update.isPending || (dobChanged && !understood)} sx={{ minHeight: { xs: 44, sm: 40 }, ...(dark ? hubGoldButton : {}) }}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>
    </Box>
  )
}
