import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Button as MuiButton, FormHelperText, Typography } from '@mui/material'
import { Button } from '../../Button'
import { Input } from '../../Input'
import { parseDateOfBirth } from '../../../utils/dateOfBirth'
import { formatRetryIn } from '../../../utils/publicAvailabilityFormat'

export interface IdentifyValues {
  firstName: string
  lastName: string
  // yyyy-MM-dd
  dateOfBirth: string
}

export interface IdentifyFormProps {
  onSubmit: (values: IdentifyValues) => void
  submitting?: boolean
  initialFirstName?: string
  initialLastName?: string
  // Date-only mode for a remembered player: the name is shown, not asked.
  nameLocked?: boolean
  onNotYou?: () => void
  // The details did not match (403). triesLeft is shown when known and above zero.
  failed?: boolean
  triesLeft?: number | null
  // Any other error (network, server).
  errorMessage?: string | null
  // An informational line, e.g. the 30 minute window ran out.
  notice?: string | null
  // Rate limited or locked: replaces the form with a friendly try-again-later screen.
  locked?: { retryAfterSeconds?: number | null } | null
  // The player is known but has no date of birth on record yet.
  noDateOfBirth?: boolean
  onTryAgain?: () => void
}

const NOT_FOUND =
  'We could not find a player with those details in this poll. Check them and try again.'

// docs/specs/077: the first public screen. First name, surname and date of birth together; one
// generic failure message so it never says which part was wrong; locked and no-date-of-birth
// states replace the form.
export function IdentifyForm({
  onSubmit,
  submitting = false,
  initialFirstName = '',
  initialLastName = '',
  nameLocked = false,
  onNotYou,
  failed = false,
  triesLeft,
  errorMessage,
  notice,
  locked,
  noDateOfBirth = false,
  onTryAgain,
}: IdentifyFormProps) {
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (locked) {
    const retry = formatRetryIn(locked.retryAfterSeconds)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1, py: 3 }}>
        <Typography aria-hidden sx={{ fontSize: '2rem', color: 'text.secondary' }}>
          ⏸
        </Typography>
        <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Please try again later
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {retry
            ? `Too many attempts. You can try again ${retry}, or ask your manager to update your answer.`
            : 'Too many attempts. Please try again later, or ask your manager to update your answer.'}
        </Typography>
        {onTryAgain && (
          <Button variant="ghost" size="sm" onClick={onTryAgain}>
            Try different details
          </Button>
        )}
      </Box>
    )
  }

  if (noDateOfBirth) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Alert severity="info">
          We could not check your date of birth because it is not on record yet. Please ask your manager to add it, then
          try again.
        </Alert>
        {onTryAgain && (
          <Button variant="secondary" onClick={onTryAgain}>
            Try different details
          </Button>
        )}
      </Box>
    )
  }

  const trimmedFirst = firstName.trim()
  const trimmedLast = lastName.trim()
  const dob = parseDateOfBirth(day, month, year)
  const firstError = submitted && !nameLocked && !trimmedFirst ? 'Enter your first name.' : undefined
  const lastError = submitted && !nameLocked && !trimmedLast ? 'Enter your surname.' : undefined
  const dobError = submitted && dob.error ? dob.error : undefined

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!trimmedFirst || !trimmedLast || dob.error) return
    onSubmit({ firstName: trimmedFirst, lastName: trimmedLast, dateOfBirth: dob.iso })
  }

  const failureText = `${NOT_FOUND}${triesLeft != null && triesLeft > 0 ? ` ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.` : ''}`

  return (
    <Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
        {nameLocked ? `Hi ${trimmedFirst}, confirm it is you` : 'Who are you?'}
      </Typography>

      {notice && <Alert severity="info">{notice}</Alert>}

      {nameLocked ? (
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1,
            px: 1.5,
            py: 1.25,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {trimmedFirst} {trimmedLast}
          </Typography>
          {onNotYou && (
            <MuiButton size="small" onClick={onNotYou} sx={{ textTransform: 'none', minWidth: 0 }}>
              Not you?
            </MuiButton>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Input
            label="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={Boolean(firstError)}
            helperText={firstError}
            autoComplete="given-name"
          />
          <Input
            label="Surname"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            error={Boolean(lastError)}
            helperText={lastError}
            autoComplete="family-name"
          />
        </Box>
      )}

      <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }} aria-describedby="dob-help">
        <Typography component="legend" variant="caption" color="text.secondary" sx={{ mb: 0.5, p: 0 }}>
          Date of birth
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 1 }}>
          <Input
            label="Day"
            placeholder="DD"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            error={Boolean(dobError)}
            inputProps={{ inputMode: 'numeric', maxLength: 2, autoComplete: 'bday-day' }}
          />
          <Input
            label="Month"
            placeholder="MM"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            error={Boolean(dobError)}
            inputProps={{ inputMode: 'numeric', maxLength: 2, autoComplete: 'bday-month' }}
          />
          <Input
            label="Year"
            placeholder="YYYY"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            error={Boolean(dobError)}
            inputProps={{ inputMode: 'numeric', maxLength: 4, autoComplete: 'bday-year' }}
          />
        </Box>
        <FormHelperText id="dob-help" error={Boolean(dobError)} role={dobError ? 'alert' : undefined}>
          {dobError}
        </FormHelperText>
      </Box>

      {failed && <Alert severity="error">{failureText}</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Checking…' : 'Continue'}
      </Button>
      <Typography variant="caption" color="text.secondary">
        Only players in this poll can continue. Your date of birth is only used to check it is you.
      </Typography>
    </Box>
  )
}
