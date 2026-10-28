import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import FacebookIcon from '@mui/icons-material/Facebook'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { TileChoiceGroup } from '../TileChoiceGroup'
import { LEAGUE_CONTENT_LABELS, LEAGUE_SHARE_FORMAT_LABELS } from '../../utils/share/leagueShareFormats'
import type { LeagueContent, LeagueFormatAvailability, LeagueShareFormat } from '../../utils/share/leagueShareFormats'

const ICONS: Record<LeagueShareFormat, ReactNode> = {
  PDF: <PictureAsPdfOutlinedIcon />,
  POSTER: <ImageOutlinedIcon />,
  CALENDAR: <CalendarMonthOutlinedIcon />,
  WHATSAPP: <WhatsAppIcon />,
  FACEBOOK: <FacebookIcon />,
}

const SUBTITLES: Record<LeagueShareFormat, string> = {
  PDF: 'A4 document to print or send',
  POSTER: 'Square image for feeds and chats',
  CALENDAR: 'An .ics file for a phone calendar',
  WHATSAPP: 'Message text to edit and send',
  FACEBOOK: 'Post text to copy',
}

export interface LeagueFormatStepProps {
  contents: LeagueContent[]
  availability: LeagueFormatAvailability
  value: LeagueShareFormat | null
  onChange: (format: LeagueShareFormat) => void
}

// docs/specs/122-league-sharing.md (Step 2, Output format): a tile for each format every ticked content supports and the
// club has on; a format a tick blocks stays as a greyed tile with its reason; a format the club switched off is not shown.
export function LeagueFormatStep({ contents, availability, value, onChange }: LeagueFormatStepProps) {
  const tiles = [
    ...availability.offered.map((format) => ({ format, reason: null as string | null })),
    ...availability.greyed.map(({ format, reason }) => ({ format, reason })),
  ]
  if (tiles.length === 0) {
    return (
      <Typography role="status" color="text.secondary">
        No share format is switched on for leagues. A club administrator can turn one on in the club profile share settings.
      </Typography>
    )
  }
  return (
    <Box>
      <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
        Sharing: {contents.map((content) => LEAGUE_CONTENT_LABELS[content]).join(', ')}
      </Typography>
      <TileChoiceGroup<LeagueShareFormat>
        label="Share format"
        value={value && availability.offered.includes(value) ? value : null}
        onChange={onChange}
        columns={{ xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }}
        tileSx={{ minHeight: 96, py: 1.5, alignItems: 'center', justifyContent: 'center' }}
        options={tiles.map(({ format, reason }) => ({
          value: format,
          disabled: reason !== null,
          content: (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center', opacity: reason ? 0.8 : 1 }}>
              <Box sx={{ color: reason ? 'text.disabled' : 'primary.main', display: 'flex', '& svg': { fontSize: 32 } }}>{ICONS[format]}</Box>
              <Typography sx={{ fontWeight: 700 }}>{LEAGUE_SHARE_FORMAT_LABELS[format]}</Typography>
              <Typography variant="caption" sx={{ color: reason ? 'warning.dark' : 'text.secondary', lineHeight: 1.25 }}>
                {reason ?? SUBTITLES[format]}
              </Typography>
            </Box>
          ),
        }))}
      />
      {availability.greyed.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          A greyed format needs one of the contents it names ticked. Go back to tick it.
        </Typography>
      )}
    </Box>
  )
}
