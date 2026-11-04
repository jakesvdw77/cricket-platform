import { useState } from 'react'
import { Alert, Box, ButtonBase, Chip, Collapse, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Button } from '../../../components/Button'
import type { SelectionPoolEntry } from '../../../api/matchSelectionApi'

export interface AvailablePlayersSectionProps {
  // The pool's entries (the squad with every player's answer). The section lists those who are available and eligible but not selected.
  entries: SelectionPoolEntry[]
  // The team is full when this many are selected: the section then starts closed, otherwise open.
  selectedCount: number
  maxSelected: number
  // Opens the same Select Players dialog as the Manage Team menu.
  onSelectOtherPlayer: () => void
  // Opens the Create New Player dialog (the same flow as the Select Players dialog's button).
  onCreatePlayer: () => void
  // Clicking a block adds that player to the team (the same apply as the dialog). While one is being added the others wait.
  onAddPlayer: (playerId: string) => void
  addingId?: string | null
  // The server's reason when the add was refused (the same wording as the dialog).
  addError?: string | null
  disabled?: boolean
}

// docs/specs/137 (owner, 2026-11-05): a collapsible section under the team listing the players who said Available and are eligible but are
// NOT selected, so the manager sees who else could play. They are drawn faded with dashed edges (the opposite of the solid, numbered rows
// of the team) so it is clear they are available but not in the team. Closed on arrival when the team is full, open otherwise; the manager's
// own toggle wins. Clicking a block adds that player to the team; "Select Other Player" opens the Select Players dialog.
export function AvailablePlayersSection({ entries, selectedCount, maxSelected, onSelectOtherPlayer, onCreatePlayer, onAddPlayer, addingId = null, addError = null, disabled = false }: AvailablePlayersSectionProps) {
  const [override, setOverride] = useState<boolean | null>(null)
  const full = selectedCount >= maxSelected
  const open = override ?? !full
  const candidates = entries.filter((entry) => entry.availability === 'AVAILABLE' && entry.selectable && !entry.selected)

  return (
    <Box component="section" aria-label="Available Players" data-testid="available-players" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 1.5, py: 1 }}>
        <Typography variant="subtitle2" component="h3" fontWeight={700}>
          Available Players
        </Typography>
        <Chip size="small" variant="outlined" label={`${candidates.length} not selected`} />
        {/* ONE message for the whole section when the team is full (not one per block); the blocks are disabled then. */}
        {full && (
          <Typography variant="caption" color="text.secondary" data-testid="available-full-message">
            Team is full. Remove a player to add another.
          </Typography>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="compact" variant="secondary" onClick={onCreatePlayer} disabled={disabled}>
            Create New Player
          </Button>
          <Button size="compact" variant="secondary" onClick={onSelectOtherPlayer} disabled={disabled}>
            Select Other Player
          </Button>
          <IconButton
            size="small"
            aria-label={open ? 'Hide available players' : 'Show available players'}
            aria-expanded={open}
            aria-controls="available-players-list"
            onClick={() => setOverride(!open)}
            data-testid="toggle-available"
          >
            <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </IconButton>
        </Box>
      </Box>
      <Collapse in={open} unmountOnExit>
        {/* A hairline under the header breaks the white (owner, 2026-11-05). */}
        <Box id="available-players-list" sx={{ px: 1.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
          {addError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {addError}
            </Alert>
          )}
          {candidates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No other available players.
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {candidates.map((entry) => {
                const name = `${entry.firstName} ${entry.lastName}`.trim()
                const busy = addingId === entry.playerProfileId
                return (
                  <Box component="li" key={entry.playerProfileId} sx={{ display: 'flex' }}>
                    <ButtonBase
                      data-testid="available-player"
                      aria-label={`Add ${name} to the team`}
                      disabled={disabled || full || addingId !== null}
                      onClick={() => onAddPlayer(entry.playerProfileId)}
                      sx={(theme) => ({
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        minHeight: 40,
                        px: 1.25,
                        textAlign: 'left',
                        border: '1px dashed',
                        borderColor: alpha(theme.palette.text.primary, 0.35),
                        borderRadius: 1,
                        // Faded: available, but not in the team. Full strength on hover and focus, so the click target is clear.
                        opacity: busy ? 0.5 : 0.72,
                        color: 'text.secondary',
                        '&:hover:not(:disabled), &.Mui-focusVisible': { opacity: 1, borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
                        '&.Mui-disabled': { opacity: busy ? 0.5 : 0.55 },
                      })}
                    >
                      <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18, color: 'success.main', flex: 'none' }} />
                      <Typography variant="body2" component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {name}
                      </Typography>
                      <Box component="span" sx={{ ml: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: 12, fontWeight: 600 }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                        {busy ? 'Adding' : 'Add'}
                      </Box>
                    </ButtonBase>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
