import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import FacebookIcon from '@mui/icons-material/Facebook'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { TileChoiceGroup } from '../TileChoiceGroup'
import { MATCH_CONTENT_LABELS, MATCH_FORMAT_LABELS } from '../../utils/share/matchShareFormats'
import type { MatchContent, MatchFormatAvailability } from '../../utils/share/matchShareFormats'
import type { ShareFormat } from '../../utils/share/shareChoices'

const ICONS: Record<ShareFormat, ReactNode> = {
  PDF: <PictureAsPdfOutlinedIcon />,
  IMAGE: <ImageOutlinedIcon />,
  TV: <LiveTvOutlinedIcon />,
  WHATSAPP: <WhatsAppIcon />,
  FACEBOOK: <FacebookIcon />,
}

const SUBTITLES: Record<ShareFormat, string> = {
  PDF: 'A4 document to print or send',
  IMAGE: 'Poster for feeds and chats',
  TV: 'Widescreen 1920 x 1080',
  WHATSAPP: 'Message text to edit and send',
  FACEBOOK: 'Post text to copy',
}

export interface MatchFormatStepProps {
  content: MatchContent
  availability: MatchFormatAvailability
  value: ShareFormat | null
  onChange: (format: ShareFormat) => void
}

// docs/specs/131 (Step 2, Format): a tile for each format the content supports and the club has on; an unsupported one stays as
// a greyed tile with its reason; a format the club switched off is not shown.
export function MatchFormatStep({ content, availability, value, onChange }: MatchFormatStepProps) {
  const tiles = [
    ...availability.offered.map((format) => ({ format, reason: null as string | null })),
    ...availability.greyed.map(({ format, reason }) => ({ format, reason })),
  ]
  if (tiles.length === 0) {
    return (
      <Typography role="status" color="text.secondary">
        No share format is switched on for matches. A club administrator can turn one on in the club profile share settings.
      </Typography>
    )
  }
  return (
    <Box>
      <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
        Format for {MATCH_CONTENT_LABELS[content]}
      </Typography>
      <TileChoiceGroup<ShareFormat>
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
              <Box sx={{ color: reason ? 'text.disabled' : 'primary.main', display: 'flex', '& svg': { fontSize: 28 } }}>{ICONS[format]}</Box>
              <Typography sx={{ fontWeight: 700 }}>{MATCH_FORMAT_LABELS[format]}</Typography>
              <Typography variant="caption" sx={{ color: reason ? 'warning.dark' : 'text.secondary', lineHeight: 1.25 }}>
                {reason ?? SUBTITLES[format]}
              </Typography>
            </Box>
          ),
        }))}
      />
    </Box>
  )
}
