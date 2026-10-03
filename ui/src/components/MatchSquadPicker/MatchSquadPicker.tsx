import { useState } from 'react'
import { Alert, Box, Button as MuiButton, IconButton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import { Input } from '../Input'
import { EmptyState } from '../EmptyState'
import type { MatchSquadCandidate, MatchSquadMember } from '../../api/matchSquadApi'
import { numberToInput, inputToNumber } from '../../utils/numberInput'

function candidateDisplayName(candidate: { firstName: string; lastName: string; jerseyNumber: number | null }): string {
  const name = `${candidate.firstName} ${candidate.lastName}`
  return candidate.jerseyNumber != null ? `#${candidate.jerseyNumber} ${name}` : name
}

function selectedDisplayName(member: MatchSquadMember): string {
  const name = `${member.firstName} ${member.lastName}`
  return member.squadJerseyNumber != null ? `#${member.squadJerseyNumber} ${name}` : name
}

export interface MatchSquadPickerProps {
  // Everyone with an AVAILABLE SectionAvailabilityResponse for this side's resolved bracket — see
  // docs/specs/063-section-availability-and-flexible-squads.md's Part B/C API Contract.
  candidates: MatchSquadCandidate[]
  // Current MatchSquadMember rows for this exact match+team.
  selected: MatchSquadMember[]
  // null when no SectionAvailabilityWindow has been opened yet for this side's resolved bracket.
  windowId: string | null
  windowOpen: boolean
  // The side's label used in copy, e.g. "the home side" — mirrors the other match-side tabs' own
  // `label` prop shape.
  label: string
  // Pre-filled "open a group poll" shortcut — /manage/availability/new?type=group with
  // sectionId/matchId query params already resolved by the caller (docs/specs/064).
  createWindowHref: string
  onAdd: (playerProfileId: string) => void
  onRemove: (playerProfileId: string) => void
  onUpdateJerseyNumber: (playerProfileId: string, jerseyNumber: number | null) => void
  isAddPending?: boolean
  isRemovePending?: boolean
  errorMessage?: string | null
}

// docs/specs/063-section-availability-and-flexible-squads.md's genuinely new shared component —
// a live "available pool vs. selected" two-pane picker with a cross-match contested-pick
// indicator. Props are data-and-callback only, no direct API calls, matching PlayingXiBuilder's
// own established convention (docs/standards/frontend.md's "server state in the page" rule).
// Mobile-first: two stacked panes at `xs`, side-by-side from `md`.
export function MatchSquadPicker({
  candidates,
  selected,
  windowId,
  windowOpen,
  label,
  createWindowHref,
  onAdd,
  onRemove,
  onUpdateJerseyNumber,
  isAddPending = false,
  isRemovePending = false,
  errorMessage,
}: MatchSquadPickerProps) {
  if (!windowId) {
    return (
      <EmptyState
        title="No section availability window yet"
        description={`Open a section availability window for ${label}'s own bracket first, so players can say whether they're available before you build this squad.`}
        action={
          <MuiButton component={RouterLink} to={createWindowHref} variant="contained">
            Open a window for this bracket
          </MuiButton>
        }
      />
    )
  }

  const selectedIds = new Set(selected.map((member) => member.playerProfileId))
  const availableCandidates = candidates.filter((candidate) => !selectedIds.has(candidate.playerProfileId))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {!windowOpen && (
        <Alert severity="warning">
          This bracket's availability window is closed — responses are read-only, but you can
          still build this match's squad.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Available ({availableCandidates.length})
          </Typography>
          <Stack spacing={1}>
            {availableCandidates.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nobody's said they're available for this bracket yet.
              </Typography>
            )}

            {availableCandidates.map((candidate) => {
              const disabled = Boolean(candidate.pickedElsewhere)
              return (
                <Stack
                  key={candidate.playerProfileId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: disabled ? (theme) => alpha(theme.palette.text.secondary, 0.06) : undefined,
                  }}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {candidateDisplayName(candidate)}
                    </Typography>
                    {candidate.pickedElsewhere && (
                      <Typography variant="caption" color="text.secondary">
                        Already picked for {candidate.pickedElsewhere.teamName}
                      </Typography>
                    )}
                  </Stack>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label={`Add ${candidateDisplayName(candidate)} to the squad`}
                    disabled={disabled || isAddPending}
                    onClick={() => onAdd(candidate.playerProfileId)}
                  >
                    <AddCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )
            })}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Selected ({selected.length})
          </Typography>
          <Stack spacing={1}>
            {selected.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No players picked for this match's squad yet.
              </Typography>
            )}

            {selected.map((member) => (
              <SelectedRow
                key={member.playerProfileId}
                member={member}
                onRemove={() => onRemove(member.playerProfileId)}
                onUpdateJerseyNumber={(jerseyNumber) => onUpdateJerseyNumber(member.playerProfileId, jerseyNumber)}
                removePending={isRemovePending}
              />
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}

// A "Selected" pane row — mirrors 031-jersey-numbers.md's SquadPlayerCard inline-editable "Squad #"
// field pattern (blur-to-commit, own isolated local draft state) plus a one-click move-back action.
function SelectedRow({
  member,
  onRemove,
  onUpdateJerseyNumber,
  removePending,
}: {
  member: MatchSquadMember
  onRemove: () => void
  onUpdateJerseyNumber: (jerseyNumber: number | null) => void
  removePending: boolean
}) {
  const [jerseyNumberInput, setJerseyNumberInput] = useState(numberToInput(member.squadJerseyNumber))

  const commitJerseyNumber = () => {
    const parsed = inputToNumber(jerseyNumberInput)
    if (parsed !== member.squadJerseyNumber) {
      onUpdateJerseyNumber(parsed)
    }
  }

  const name = `${member.firstName} ${member.lastName}`

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1.5}
      sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: '1 1 auto', minWidth: 0 }}>
        {selectedDisplayName(member)}
      </Typography>
      <Input
        label=""
        type="number"
        size="small"
        inputProps={{ 'aria-label': `${name} squad number` }}
        value={jerseyNumberInput}
        onChange={(event) => setJerseyNumberInput(event.target.value)}
        onBlur={commitJerseyNumber}
        sx={{ width: 80, flex: 'none' }}
      />
      <IconButton
        size="small"
        aria-label={`Remove ${name} from the squad`}
        disabled={removePending}
        onClick={onRemove}
      >
        <RemoveCircleOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
