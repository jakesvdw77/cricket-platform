import { useEffect, useState } from 'react'
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'
import { generatePlayingConditionsWhatsAppText } from '../../utils/playingConditionsWhatsAppText'

export interface PlayingConditionsShareDialogProps {
  open: boolean
  onClose: () => void
  hasStructuredFields: boolean
  leagueName: string
  seasonLabel: string
  // Structured fields only; null when hasStructuredFields is false.
  conditions: PlayingConditionsPayload | null
  // Caller-owned: calls generatePlayingConditionsSummaryPdf + window.open, rethrows on failure so
  // this dialog can surface an inline error and let the admin retry — same contract
  // ShareScheduleDialog's own onSharePdf/onSharePoster already establish. This component never
  // imports the PDF generator itself.
  onSharePdf: () => Promise<void>
}

// docs/specs/052-league-playing-conditions.md UI Requirements item 7 — mirrors
// TeamSheetCommunicationDialog's exact structure (Dialog -> option List -> WhatsApp textarea +
// Regenerate -> asymmetric footer action), but with exactly two real options and no third
// placeholder row (see this spec's own Non-goals), and an info Alert replacing the whole
// interactive body — both footer actions disabled — when nothing has been saved to summarize yet.
export function PlayingConditionsShareDialog({
  open,
  onClose,
  hasStructuredFields,
  leagueName,
  seasonLabel,
  conditions,
  onSharePdf,
}: PlayingConditionsShareDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'pdf' | 'whatsapp'>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [whatsappText, setWhatsappText] = useState('')

  // Resets local draft state whenever the dialog closes, so reopening it never shows a stale
  // option choice or error left over from the previous time it was used — same pattern
  // TeamSheetCommunicationDialog/ShareScheduleDialog already use.
  useEffect(() => {
    if (!open) {
      setSelectedOption('pdf')
      setIsGenerating(false)
      setError(null)
      setWhatsappText('')
    }
  }, [open])

  // Recomputes the WhatsApp text whenever the dialog opens or the admin switches to the WhatsApp
  // option — mirrors TeamSheetCommunicationDialog's own recompute-on-open-or-option-change effect.
  useEffect(() => {
    if (open && selectedOption === 'whatsapp' && conditions) {
      setWhatsappText(generatePlayingConditionsWhatsAppText(leagueName, seasonLabel, conditions))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedOption])

  const handleRegenerateWhatsApp = () => {
    if (conditions) {
      setWhatsappText(generatePlayingConditionsWhatsAppText(leagueName, seasonLabel, conditions))
    }
  }

  // Mirrors TeamSheetCommunicationDialog's own handleCopyWhatsApp shape exactly.
  const handleCopyWhatsApp = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(whatsappText)
      onClose()
    } catch {
      setError("Couldn't copy to clipboard. Please try again.")
    }
  }

  const handleSharePdf = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      await onSharePdf()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the summary. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Share Playing Conditions</DialogTitle>
      <DialogContent>
        {!hasStructuredFields ? (
          <Alert severity="info">
            Save the league&apos;s match format, points, and bonus-point rules before sharing a summary.
          </Alert>
        ) : (
          <>
            <List disablePadding sx={{ mb: 2 }}>
              <ListItemButton
                selected={selectedOption === 'pdf'}
                onClick={() => setSelectedOption('pdf')}
                sx={{ borderRadius: 1, mb: 1 }}
              >
                <ListItemIcon>
                  <PictureAsPdfOutlinedIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="PDF Summary" secondary="Generate a one-page summary, ready to print or save." />
              </ListItemButton>

              <ListItemButton
                selected={selectedOption === 'whatsapp'}
                onClick={() => setSelectedOption('whatsapp')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon sx={{ pl: 2 }}>
                  <WhatsAppIcon />
                </ListItemIcon>
                <ListItemText primary="WhatsApp" secondary="Share a text summary to a group chat." />
              </ListItemButton>
            </List>

            {selectedOption === 'whatsapp' && (
              <Stack spacing={1}>
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
          </>
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
          <Button onClick={handleSharePdf} disabled={!hasStructuredFields || isGenerating}>
            {isGenerating ? 'Generating…' : 'Open PDF'}
          </Button>
        ) : (
          <Button onClick={handleCopyWhatsApp} startIcon={<ContentCopyOutlinedIcon />} disabled={!hasStructuredFields}>
            Copy to Clipboard
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
