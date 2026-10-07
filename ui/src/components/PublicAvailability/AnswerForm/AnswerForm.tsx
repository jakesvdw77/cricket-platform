import { Alert, Box, Button as MuiButton, Chip, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Button } from '../../Button'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { STATUS_COLOR, STATUS_LABEL } from '../../../utils/availabilityStatus'

// One thing to answer: the single question of a squad poll, or one window of a group poll.
export interface AnswerSlot {
  // Stable key: the windowId, or 'squad'.
  key: string
  windowId: string | null
  // "Thu 15 Oct · Morning"; null for the squad poll's single question.
  label: string | null
  // "Villagers 1 v POHBS" lines under the label.
  matches: string[]
  // False for a window that has already closed: shown, not editable.
  open: boolean
}

export type AnswerMap = Record<string, AvailabilityStatus | undefined>

export interface AnswerFormProps {
  playerName: string
  slots: AnswerSlot[]
  answers: AnswerMap
  onChange: (answers: AnswerMap) => void
  onSave: () => void
  onNotYou?: () => void
  saving?: boolean
  errorMessage?: string | null
  // True when answers were loaded from an earlier save: shows the "you can change it" hint.
  hasExisting?: boolean
}

const OPTIONS: AvailabilityStatus[] = ['AVAILABLE', 'UNSURE', 'UNAVAILABLE']

function selectedSx(status: AvailabilityStatus) {
  const tone = STATUS_COLOR[status]
  return {
    '&.Mui-selected, &.Mui-selected:hover': {
      bgcolor: `${tone}.main`,
      color: `${tone}.contrastText`,
    },
    '&.Mui-selected.Mui-disabled': {
      bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.6),
      color: `${tone}.contrastText`,
    },
  }
}

function StatusToggle({
  label,
  value,
  onChange,
  disabled,
  big,
}: {
  label: string
  value: AvailabilityStatus | undefined
  onChange: (next: AvailabilityStatus) => void
  disabled: boolean
  big: boolean
}) {
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      value={value ?? null}
      disabled={disabled}
      aria-label={label}
      onChange={(_event, next: AvailabilityStatus | null) => {
        if (next) onChange(next)
      }}
    >
      {OPTIONS.map((status) => (
        <ToggleButton
          key={status}
          value={status}
          aria-label={`${label}: ${STATUS_LABEL[status]}`}
          sx={{ textTransform: 'none', fontWeight: 600, py: big ? 1.5 : 1, minHeight: 44, ...selectedSx(status) }}
        >
          {STATUS_LABEL[status]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

// docs/specs/077: the answer step after verifying. Controlled (the flow keeps the chosen answers
// so they survive an expired token). Squad: one big question. Group: one row per window, with the
// matches under it; answering only some windows is allowed.
export function AnswerForm({
  playerName,
  slots,
  answers,
  onChange,
  onSave,
  onNotYou,
  saving = false,
  errorMessage,
  hasExisting = false,
}: AnswerFormProps) {
  const editable = slots.filter((slot) => slot.open)
  const anyAnswer = editable.some((slot) => answers[slot.key])
  const squad = slots.length === 1 && slots[0].label === null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1,
          px: 1.5,
          py: 1.25,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '2px 8px',
        }}
      >
        <Typography variant="body2" fontWeight={700}>
          {playerName}
        </Typography>
        <Typography variant="caption" fontWeight={700} sx={{ color: 'success.main' }}>
          ✓ Confirmed
        </Typography>
        {onNotYou && (
          <MuiButton size="small" onClick={onNotYou} sx={{ textTransform: 'none', minWidth: 0, ml: 'auto', py: 0 }}>
            Not you?
          </MuiButton>
        )}
      </Box>

      {hasExisting && (
        <Typography variant="caption" color="text.secondary">
          You already answered. You can change it until the poll closes.
        </Typography>
      )}

      <Typography variant="h6" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
        Are you available?
      </Typography>

      {slots.map((slot) => (
        <Box
          key={slot.key}
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: squad ? 0 : 1,
            p: squad ? 0 : 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          {slot.label && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" fontWeight={700}>
                {slot.label}
              </Typography>
              {!slot.open && <Chip size="small" label="Closed" variant="outlined" />}
            </Box>
          )}
          {slot.matches.map((match) => (
            <Typography key={match} variant="caption" color="text.secondary">
              {match}
            </Typography>
          ))}
          <StatusToggle
            label={slot.label ?? 'Availability'}
            value={answers[slot.key]}
            disabled={!slot.open || saving}
            big={squad}
            onChange={(next) => onChange({ ...answers, [slot.key]: next })}
          />
        </Box>
      ))}

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Button onClick={onSave} disabled={saving || !anyAnswer}>
        {saving ? 'Saving…' : 'Save my answer'}
      </Button>
    </Box>
  )
}
