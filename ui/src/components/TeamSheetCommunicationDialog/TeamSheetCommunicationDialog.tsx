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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
} from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import FacebookIcon from '@mui/icons-material/Facebook'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import type { Match } from '../../api/matchApi'
import type { TeamSheetSide } from '../../utils/teamSheetPdf'
import { generateTeamSheetWhatsAppText } from '../../utils/teamSheetWhatsAppText'

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
  // docs/specs/039-team-sheet-whatsapp-text.md: the same already-assembled date/venue/league-season
  // line the caller (MatchCard) already computes via matchFields() for the PDF path — shared as-is
  // with the WhatsApp text builder rather than recomputed a second, drifting way in here.
  subtitle: string
}

function isSidePrintable(hasRealTeam: boolean, side: TeamSheetSide | undefined): boolean {
  return hasRealTeam && Boolean(side?.side) && (side?.side?.players.length ?? 0) > 0
}

// docs/specs/030-team-sheet-communication.md — presentational only (no React Query here, see the
// approved plan's Flag #1: the host page owns data-fetching, this dialog is props-in/callbacks-
// out, matching LinkExistingRecordDialog/CreateAndLinkRecordDialog's existing convention).
// docs/specs/039-team-sheet-whatsapp-text.md wired up "WhatsApp" as a second real, selectable
// option alongside "Print as PDF" — "Facebook" remains a visibly-present, disabled "Coming soon"
// row, previewing the dialog's remaining planned growth.
export function TeamSheetCommunicationDialog({
  open,
  onClose,
  match,
  sides,
  sidesLoading,
  onPrint,
  subtitle,
}: TeamSheetCommunicationDialogProps) {
  const [manualScope, setManualScope] = useState<TeamSheetPrintScope | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<'pdf' | 'whatsapp'>('pdf')
  const [whatsappText, setWhatsappText] = useState('')

  // Resets local draft state whenever the dialog closes, so reopening it never shows a stale
  // scope selection, option choice, or error left over from the previous time it was used — same
  // pattern LinkExistingRecordDialog/CreateAndLinkRecordDialog already use.
  useEffect(() => {
    if (!open) {
      setManualScope(null)
      setIsGenerating(false)
      setError(null)
      setSelectedOption('pdf')
      setWhatsappText('')
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

  const sidesInScope: TeamSheetSide[] = useMemo(() => {
    if (selectedScope === 'both') {
      return [homeSide, awaySide]
    }
    if (selectedScope === 'home') {
      return [homeSide]
    }
    if (selectedScope === 'away') {
      return [awaySide]
    }
    return []
  }, [selectedScope, homeSide, awaySide])

  // Recomputes the WhatsApp text whenever the dialog opens, the admin switches to the WhatsApp
  // option, or the scope changes — same reset-on-open-or-input-change shape PollShareDialog
  // already uses (docs/specs/032-match-availability-polls.md), narrowed to these three inputs
  // (not `match`/`sides`/`subtitle` themselves) so an unrelated re-render of the host page never
  // silently discards a manual edit.
  useEffect(() => {
    if (open && selectedOption === 'whatsapp') {
      setWhatsappText(generateTeamSheetWhatsAppText(match, sidesInScope, subtitle))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedOption, selectedScope])

  const handleRegenerateWhatsApp = () => {
    setWhatsappText(generateTeamSheetWhatsAppText(match, sidesInScope, subtitle))
  }

  // Mirrors handlePrint's own shape (clear any previous error, attempt the action, close on
  // success, surface a retryable inline error on failure) so the two primary actions behave
  // symmetrically even though one opens a PDF and the other writes to the clipboard.
  const handleCopyWhatsApp = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(whatsappText)
      onClose()
    } catch {
      setError("Couldn't copy to clipboard. Please try again.")
    }
  }

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
  const copyDisabled = sidesLoading || !(bothPrintable || homePrintable || awayPrintable)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Communicate Team Sheet</DialogTitle>
      <DialogContent>
        <List disablePadding sx={{ mb: 2 }}>
          <ListItemButton
            selected={selectedOption === 'pdf'}
            onClick={() => setSelectedOption('pdf')}
            sx={{ borderRadius: 1, mb: 1 }}
          >
            <ListItemIcon>
              <PictureAsPdfOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Print as PDF" secondary="Generate an A4 team sheet, ready to print or save." />
          </ListItemButton>

          <ListItemButton
            selected={selectedOption === 'whatsapp'}
            onClick={() => setSelectedOption('whatsapp')}
            sx={{ borderRadius: 1, mb: 1 }}
          >
            <ListItemIcon sx={{ pl: 2 }}>
              <WhatsAppIcon />
            </ListItemIcon>
            <ListItemText primary="WhatsApp" secondary="Share a text summary to a group chat." />
          </ListItemButton>

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

            {selectedOption === 'whatsapp' && (
              <Stack spacing={1} sx={{ pt: 1 }}>
                <Input
                  label="WhatsApp message"
                  value={whatsappText}
                  onChange={(event) => setWhatsappText(event.target.value)}
                  multiline
                  minRows={10}
                />
                <Button
                  variant="ghost"
                  startIcon={<RefreshOutlinedIcon />}
                  onClick={handleRegenerateWhatsApp}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Regenerate
                </Button>
              </Stack>
            )}
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
        {selectedOption === 'pdf' ? (
          <Button onClick={handlePrint} disabled={printDisabled}>
            {isGenerating ? 'Generating…' : selectedScope ? scopeLabel(selectedScope) : 'Print'}
          </Button>
        ) : (
          <Button onClick={handleCopyWhatsApp} startIcon={<ContentCopyOutlinedIcon />} disabled={copyDisabled}>
            Copy to Clipboard
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
