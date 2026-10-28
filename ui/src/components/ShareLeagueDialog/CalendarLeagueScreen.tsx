import { useMemo } from 'react'
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../Button'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { downloadFile } from '../../utils/share/downloadFile'
import { generateLeagueIcsFile, leagueIcsEvents } from '../../utils/share/leagueIcs'
import { useShareCapability } from '../../utils/share/useShareCapability'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'

// docs/specs/122-league-sharing.md (Format screens, Calendar): there is no preview image; the screen lists the events the
// .ics will add, then Download (and the native share sheet where the browser can send the file).
export function CalendarLeagueScreen({ model, shareTitle, ticked }: LeagueScreenProps) {
  const capability = useShareCapability()
  const events = useMemo(() => leagueIcsEvents(model), [model])
  const file = useMemo(() => generateLeagueIcsFile(model), [model])
  const canShare = capability.canShareFiles(file)

  const share = async () => {
    try {
      await navigator.share({ files: [file], title: shareTitle })
    } catch {
      // Cancelling the share sheet is not an error, and Download is always there.
    }
  }

  return (
    <ShareFormatScreen
      title="Calendar"
      controls={
        <>
        <LeagueLeftOutNote format="CALENDAR" ticked={ticked} />
        <Typography variant="body2" color="text.secondary">
          The file adds {events.length} {events.length === 1 ? 'event' : 'events'} to a phone or computer calendar. Fixtures keep their start time and last three hours. Key dates are all-day events.
        </Typography>
        </>
      }
      preview={
        <SharePreviewStage ariaLabel="Calendar events" caption="These events will be added to the calendar.">
          {events.length === 0 ? (
            <Typography role="status" color="text.secondary">
              Nothing to add to a calendar for this season yet.
            </Typography>
          ) : (
            <Box sx={{ width: '100%', maxHeight: 420, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <List dense disablePadding aria-label="Events to add">
                {events.map((event) => (
                  <ListItem key={event.uid} divider>
                    <ListItemText primary={event.summary} secondary={[event.dateLabel, event.location].filter(Boolean).join(' · ')} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </SharePreviewStage>
      }
      actions={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {canShare && (
            <Button size="compact" startIcon={<ShareOutlinedIcon />} disabled={events.length === 0} onClick={() => void share()}>
              Share
            </Button>
          )}
          <Button
            size="compact"
            variant={canShare ? 'secondary' : 'primary'}
            startIcon={<FileDownloadOutlinedIcon />}
            disabled={events.length === 0}
            onClick={() => downloadFile(file)}
          >
            Download calendar file
          </Button>
        </Box>
      }
    />
  )
}
