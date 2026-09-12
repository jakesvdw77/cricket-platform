import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import FacebookIcon from '@mui/icons-material/Facebook'
import { Button } from '../Button'
import type { Match } from '../../api/matchApi'
import type { TeamSheetSide } from '../../utils/teamSheetPdf'

export type TeamSheetPrintScope = 'both' | 'home' | 'away'

export interface TeamSheetCommunicationDialogProps {
  open: boolean
  onClose: () => void
  match: Match
  // Both resolved sides, always passed in full regardless of the eventually-chosen scope — index
  // 0 is always the home side, index 1 the away side (MatchList/MatchCard's own assembly order).
  // Typed as a fixed 2-tuple, not TeamSheetSide[], so a future caller that breaks this ordering
  // (or passes the wrong number of sides) fails to compile rather than silently mis-rendering.
  // This component computes per-side "is this printable" itself, from `match`'s own
  // homeTeamId/awayTeamId plus each side's resolved MatchSide.
  sides: [TeamSheetSide, TeamSheetSide]
  // True while the caller's listMatchSides/listSquad queries are in flight.
  sidesLoading: boolean
  // Caller-owned: runs generateTeamSheetPdf + window.open, rethrows on failure so this dialog can
  // surface an inline error and let the admin retry without losing their scope selection.
  onPrint: (scope: TeamSheetPrintScope) => Promise<void>
}

function isSidePrintable(hasRealTeam: boolean, side: TeamSheetSide | undefined): boolean {
  return hasRealTeam && Boolean(side?.side) && (side?.side?.players.length ?? 0) > 0
}

// docs/specs/030-team-sheet-communication.md — presentational only (no React Query here, see the
// approved plan's Flag #1: the host page owns data-fetching, this dialog is props-in/callbacks-
// out, matching LinkExistingRecordDialog/CreateAndLinkRecordDialog's existing convention). Its
// option list is built to hold more than "Print as PDF" over time — WhatsApp/Facebook rows are
// visibly present but disabled, previewing the dialog's planned growth rather than only living in
// a spec's Non-goals section.
export function TeamSheetCommunicationDialog({
  open,
  onClose,
  match,
  sides,
  sidesLoading,
  onPrint,
}: TeamSheetCommunicationDialogProps) {
  const [manualScope, setManualScope] = useState<TeamSheetPrintScope | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resets local draft state whenever the dialog closes, so reopening it never shows a stale
  // scope selection or error left over from the previous time it was used — same pattern
  // LinkExistingRecordDialog/CreateAndLinkRecordDialog already use.
  useEffect(() => {
    if (!open) {
      setManualScope(null)
      setIsGenerating(false)
      setError(null)
    }
  }, [open])

  const homeSide = sides[0]
  const awaySide = sides[1]

  const homePrintable = isSidePrintable(Boolean(match.homeTeamId), homeSide)
  const awayPrintable = isSidePrintable(Boolean(match.awayTeamId), awaySide)
  const bothPrintable = homePrintable || awayPrintable

  const defaultScope: TeamSheetPrintScope | null = useMemo(() => {
    if (bothPrintable) {
      return 'both'
    }
    if (homePrintable) {
      return 'home'
    }
    if (awayPrintable) {
      return 'away'
    }
    return null
  }, [bothPrintable, homePrintable, awayPrintable])

  const selectedScope = manualScope ?? defaultScope

  const scopeLabel = (scope: TeamSheetPrintScope): string => {
    if (scope === 'both') {
      return 'Print Both Teams'
    }
    if (scope === 'home') {
      return `Print ${homeSide?.teamName ?? 'Home'}`
    }
    return `Print ${awaySide?.teamName ?? 'Away'}`
  }

  const handlePrint = async () => {
    if (!selectedScope) {
      return
    }
    setIsGenerating(true)
    setError(null)
    try {
      await onPrint(selectedScope)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the team sheet. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const printDisabled = sidesLoading || isGenerating || !selectedScope

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Communicate Team Sheet</DialogTitle>
      <DialogContent>
        <List disablePadding sx={{ mb: 2 }}>
          {/* Not a ListItemButton: with only one option ever enabled, there's nothing to toggle by
              activating it — a focusable control that no-ops on Enter/Space would be a real
              keyboard/screen-reader dead end, not a genuine choice. */}
          <ListItem
            disablePadding
            sx={{
              borderRadius: 1,
              mb: 1,
              px: 2,
              py: 1,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <ListItemIcon>
              <PictureAsPdfOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Print as PDF" secondary="Generate an A4 team sheet, ready to print or save." />
          </ListItem>

          <ListItem disablePadding sx={{ opacity: 0.6 }} secondaryAction={<Chip label="Coming soon" size="small" variant="outlined" />}>
            <ListItemIcon sx={{ pl: 2 }}>
              <WhatsAppIcon />
            </ListItemIcon>
            <ListItemText primary="WhatsApp" secondary="Share a text summary to a group chat." />
          </ListItem>

          <ListItem disablePadding sx={{ opacity: 0.6 }} secondaryAction={<Chip label="Coming soon" size="small" variant="outlined" />}>
            <ListItemIcon sx={{ pl: 2 }}>
              <FacebookIcon />
            </ListItemIcon>
            <ListItemText primary="Facebook" secondary="Post a shareable summary to the club's page." />
          </ListItem>
        </List>

        {sidesLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading team sheets…
            </Typography>
          </Stack>
        ) : bothPrintable || homePrintable || awayPrintable ? (
          <Stack spacing={1}>
            <Typography variant="subtitle2" fontWeight={600}>
              Team scope
            </Typography>
            <ToggleButtonGroup
              value={selectedScope}
              exclusive
              fullWidth
              orientation="vertical"
              onChange={(_event, next: TeamSheetPrintScope | null) => next && setManualScope(next)}
            >
              <ToggleButton value="both" disabled={!bothPrintable}>
                Both Teams
              </ToggleButton>
              <ToggleButton value="home" disabled={!homePrintable}>
                {homeSide?.teamName ?? 'Home'}
              </ToggleButton>
              <ToggleButton value="away" disabled={!awayPrintable}>
                {awaySide?.teamName ?? 'Away'}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        ) : (
          <Alert severity="info">Add players to at least one side's Playing XI before printing a team sheet.</Alert>
        )}

        {error && (
          <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handlePrint} disabled={printDisabled}>
          {isGenerating ? 'Generating…' : selectedScope ? scopeLabel(selectedScope) : 'Print'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
