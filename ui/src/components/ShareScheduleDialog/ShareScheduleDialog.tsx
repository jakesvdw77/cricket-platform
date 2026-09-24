import { useEffect, useState } from 'react'
import {
  Chip,
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
} from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import { Button } from '../Button'

export type ShareScheduleOption = 'pdf' | 'poster' | 'calendar'

export interface ShareScheduleTeamOption {
  teamId: string
  teamName: string
}

const ALL_TEAMS_SCOPE = 'all'

export interface ShareScheduleDialogProps {
  open: boolean
  onClose: () => void
  leagueName: string
  seasonLabel: string
  // Affiliated teams for the currently-selected season — host-supplied, matching
  // LinkExistingRecordDialog/TeamSheetCommunicationDialog's own "host owns data" convention.
  teams: ShareScheduleTeamOption[]
  // Caller-owned generation + delivery (calls the relevant util in ui/src/utils/, then either
  // window.open or the triggerDownload forced-download pattern) — rethrows on failure so this
  // dialog can surface an inline error and let the admin retry, mirroring
  // TeamSheetCommunicationDialog's onPrint contract exactly. `teamFilter` is null for the
  // "All Teams" scope.
  onSharePdf: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onSharePoster: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onShareCalendar: (team: ShareScheduleTeamOption) => Promise<void>
}

// docs/specs/051-league-schedule-sharing.md — mirrors TeamSheetCommunicationDialog's exact
// structure (a Dialog with a List of selectable ListItemButton option rows, a ToggleButtonGroup
// scope selector beneath, presentational-only — no React Query here, the host owns data and
// callbacks). Reachable from both LeagueDetailPage.tsx's Fixtures section and LeagueFormPage.tsx's
// Schedule tab.
export function ShareScheduleDialog({
  open,
  onClose,
  leagueName,
  seasonLabel,
  teams,
  onSharePdf,
  onSharePoster,
  onShareCalendar,
}: ShareScheduleDialogProps) {
  const [scope, setScope] = useState<string>(ALL_TEAMS_SCOPE)
  const [selectedOption, setSelectedOption] = useState<ShareScheduleOption>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resets local draft state whenever the dialog closes, so reopening it never shows a stale
  // scope selection, option choice, or error left over from the previous time it was used — same
  // pattern TeamSheetCommunicationDialog/LinkExistingRecordDialog already use.
  useEffect(() => {
    if (!open) {
      setScope(ALL_TEAMS_SCOPE)
      setSelectedOption('pdf')
      setIsGenerating(false)
      setError(null)
    }
  }, [open])

  const calendarDisabled = scope === ALL_TEAMS_SCOPE

  // If the admin had "Add to Calendar" selected and then switches scope back to "All Teams",
  // the selection resets to 'pdf' rather than leaving an invalid combination selected.
  useEffect(() => {
    if (calendarDisabled && selectedOption === 'calendar') {
      setSelectedOption('pdf')
    }
  }, [calendarDisabled, selectedOption])

  const selectedTeam = teams.find((team) => team.teamId === scope) ?? null
  const teamFilter = scope === ALL_TEAMS_SCOPE ? null : selectedTeam

  const handleShare = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      if (selectedOption === 'pdf') {
        await onSharePdf(teamFilter)
      } else if (selectedOption === 'poster') {
        await onSharePoster(teamFilter)
      } else if (selectedTeam) {
        await onShareCalendar(selectedTeam)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the schedule. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const actionLabel =
    selectedOption === 'pdf' ? 'Open PDF' : selectedOption === 'poster' ? 'Download Poster' : 'Download Calendar'

  const shareDisabled = isGenerating || (selectedOption === 'calendar' && calendarDisabled)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Share Schedule</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {leagueName} — {seasonLabel}
        </Typography>

        <List disablePadding sx={{ mb: 2 }}>
          <ListItemButton
            selected={selectedOption === 'pdf'}
            onClick={() => setSelectedOption('pdf')}
            sx={{ borderRadius: 1, mb: 1 }}
          >
            <ListItemIcon>
              <PictureAsPdfOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Schedule PDF" secondary="Opens in a new tab, ready to print or save." />
          </ListItemButton>

          <ListItemButton
            selected={selectedOption === 'poster'}
            onClick={() => setSelectedOption('poster')}
            sx={{ borderRadius: 1, mb: 1 }}
          >
            <ListItemIcon>
              <ImageOutlinedIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Poster Image" secondary="Downloads as a square PNG, ready to share." />
          </ListItemButton>

          {calendarDisabled ? (
            <ListItem
              disablePadding
              sx={{ opacity: 0.6 }}
              secondaryAction={<Chip label="Select a single team" size="small" variant="outlined" />}
            >
              <ListItemIcon sx={{ pl: 2 }}>
                <CalendarMonthOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Add to Calendar" secondary="Downloads a .ics file for one team's fixtures." />
            </ListItem>
          ) : (
            <ListItemButton
              selected={selectedOption === 'calendar'}
              onClick={() => setSelectedOption('calendar')}
              sx={{ borderRadius: 1 }}
            >
              <ListItemIcon>
                <CalendarMonthOutlinedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Add to Calendar" secondary="Downloads a .ics file for one team's fixtures." />
            </ListItemButton>
          )}
        </List>

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={600}>
            Team scope
          </Typography>
          <ToggleButtonGroup
            value={scope}
            exclusive
            fullWidth
            orientation="vertical"
            onChange={(_event, next: string | null) => next && setScope(next)}
          >
            <ToggleButton value={ALL_TEAMS_SCOPE}>All Teams (Full Schedule)</ToggleButton>
            {teams.map((team) => (
              <ToggleButton key={team.teamId} value={team.teamId}>
                {team.teamName}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

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
        <Button onClick={handleShare} disabled={shareDisabled}>
          {isGenerating ? 'Generating…' : actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
