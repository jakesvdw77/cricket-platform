import { useState } from 'react'
import { Alert, Box, ButtonBase, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import type { PublicAnswer } from '../../../api/publicAvailabilityShared'
import type { MyPoll } from '../../../api/myPlayersApi'
import { formatBracketLabel } from '../../../utils/dayPart'
import { formatDateTime } from '../../../utils/publicAvailabilityFormat'
import { HUB, hubGoldButton } from './hubStyle'

// docs/specs/119 3C: one open availability poll in the player hub. Same content as the public form (specs 064 to 066 and 077):
// a squad poll is one question, a group poll one per window. Hub look: dark panel, gold selected answer, 44 px targets.
const SQUAD_KEY = 'squad'
const OPTIONS: Array<{ status: AvailabilityStatus; label: string }> = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'UNSURE', label: 'Maybe' },
  { status: 'UNAVAILABLE', label: 'Not available' },
]

export interface LinkedPollCardProps {
  poll: MyPoll
  playerName: string
  saving: boolean
  // 'closed' is the server's 409.
  error: 'closed' | 'failed' | null
  onSave: (answers: PublicAnswer[], onSaved: () => void) => void
}

type Answers = Record<string, AvailabilityStatus | undefined>

function initialAnswers(poll: MyPoll): Answers {
  const map: Answers = {}
  poll.answers.forEach((answer) => {
    map[answer.windowId ?? SQUAD_KEY] = answer.status
  })
  return map
}

function Options({ label, value, disabled, onChange }: { label: string; value: AvailabilityStatus | undefined; disabled: boolean; onChange: (s: AvailabilityStatus) => void }) {
  return (
    <Box role="group" aria-label={label} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
      {OPTIONS.map((option) => {
        const on = value === option.status
        return (
          <ButtonBase
            key={option.status}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(option.status)}
            sx={{
              minHeight: 44,
              px: 0.5,
              border: 1,
              borderColor: on ? HUB.gold : HUB.line,
              bgcolor: on ? HUB.gold : 'transparent',
              color: on ? HUB.ink : HUB.cream,
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: 14,
              '&.Mui-disabled': { opacity: 0.55 },
              '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            {option.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

export function LinkedPollCard({ poll, playerName, saving, error, onSave }: LinkedPollCardProps) {
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(poll))
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const squad = poll.kind === 'SQUAD'
  const slots = squad
    ? [{ key: SQUAD_KEY, windowId: null as string | null, label: null as string | null, matches: [] as string[], open: true }]
    : poll.windows.map((window) => ({
        key: window.windowId,
        windowId: window.windowId as string | null,
        label: formatBracketLabel(window.windowDate, window.dayPart, ' · '),
        matches: window.matches.map((match) => `${match.homeTeamName ?? 'TBC'} v ${match.awayTeamName ?? 'TBC'}`),
        open: window.open,
      }))

  const meta = [
    squad ? (poll.matchDate ? formatDateTime(poll.matchDate) : null) : poll.sectionName,
    squad ? poll.venue : null,
    squad && poll.teamName ? poll.teamName : null,
    poll.scheduledCloseAt ? `Closes ${formatDateTime(poll.scheduledCloseAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const anyOpenAnswer = slots.some((slot) => slot.open && answers[slot.key])

  const save = () => {
    const body: PublicAnswer[] = slots.filter((slot) => slot.open && answers[slot.key]).map((slot) => ({ windowId: slot.windowId, status: answers[slot.key]! }))
    setSaved(false)
    onSave(body, () => {
      setDirty(false)
      setSaved(true)
    })
  }

  return (
    <Box
      data-testid="linked-poll-card"
      sx={{ border: 1, borderColor: HUB.line, bgcolor: HUB.panelDark, borderRadius: '4px', p: { xs: 1.5, sm: 2 }, display: 'grid', gap: 1.25, color: HUB.cream }}
    >
      <Box>
        <Typography component="h3" fontWeight={600} fontSize={16} sx={{ overflowWrap: 'anywhere' }}>
          {poll.title}
        </Typography>
        {meta && (
          <Typography fontSize={13} sx={{ color: HUB.muted }}>
            {meta}
          </Typography>
        )}
      </Box>

      {slots.map((slot) => (
        <Box key={slot.key} sx={{ display: 'grid', gap: 0.75 }}>
          {slot.label && (
            <Typography fontSize={14} fontWeight={600}>
              {slot.label}
              {!slot.open && <Box component="span" sx={{ ml: 1, color: HUB.muted, fontWeight: 400 }}>Closed</Box>}
            </Typography>
          )}
          {slot.matches.map((match) => (
            <Typography key={match} fontSize={13} sx={{ color: HUB.muted }}>
              {match}
            </Typography>
          ))}
          <Options
            label={slot.label ?? `Availability for ${playerName}`}
            value={answers[slot.key]}
            disabled={!slot.open || saving}
            onChange={(next) => {
              setAnswers((prev) => ({ ...prev, [slot.key]: next }))
              setDirty(true)
              setSaved(false)
            }}
          />
        </Box>
      ))}

      {error === 'closed' && <Alert severity="warning">This poll has closed, so the answer was not saved.</Alert>}
      {error === 'failed' && <Alert severity="error">We could not save the answer. Please try again.</Alert>}
      {!error && saved && !saving && !dirty && (
        <Typography fontSize={13} fontWeight={600} sx={{ color: HUB.gold }}>
          Saved. You can change it until the poll closes.
        </Typography>
      )}

      <Box>
        <Button size="compact" onClick={save} disabled={saving || !dirty || !anyOpenAnswer} sx={hubGoldButton}>
          {saving ? 'Saving…' : 'Save answer'}
        </Button>
      </Box>
    </Box>
  )
}
