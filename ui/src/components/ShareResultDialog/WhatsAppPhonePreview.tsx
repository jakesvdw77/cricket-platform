import { Box, InputBase } from '@mui/material'
import { AttachedImagePreview } from './AttachedImagePreview'

// WhatsApp look-alike colours (the approved mockup, docs/specs/114-share-result.md). Not theme colours: they imitate the app.
const BEZEL = '#222'
const CHAT_BACKGROUND = '#e8e2d8'
const BUBBLE = '#dcf8c6'
const HEADER_GREY = '#555'
const INK = '#111'

export interface WhatsAppPhonePreviewProps {
  clubName: string | null
  text: string
  onTextChange: (text: string) => void
  // The attached image file, shown when attachImage is on.
  attachImage: boolean
  image: File | null
}

// The WhatsApp preview as a phone chat: a dark-bezel frame, a grey header and one green outgoing bubble holding the attached
// image above the editable message text. The text is a real labelled textarea styled as the bubble text.
export function WhatsAppPhonePreview({ clubName, text, onTextChange, attachImage, image }: WhatsAppPhonePreviewProps) {
  return (
    <Box
      sx={{
        width: 330,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        mx: 'auto',
        border: `8px solid ${BEZEL}`,
        borderRadius: '30px',
        bgcolor: CHAT_BACKGROUND,
        p: 1.5,
        minHeight: 420,
        color: INK,
      }}
    >
      <Box sx={{ fontSize: 12, textAlign: 'center', color: HEADER_GREY, mb: 1 }}>{`${clubName ?? 'Share preview'} · Everyone`}</Box>
      <Box
        sx={{
          bgcolor: BUBBLE,
          borderRadius: '10px 10px 2px 10px',
          p: '8px 10px',
          ml: 'auto',
          maxWidth: '94%',
          boxShadow: '0 1px 1px rgba(0,0,0,.15)',
          color: INK,
        }}
      >
        {attachImage && (
          <Box sx={{ mb: 0.75 }}>
            <AttachedImagePreview file={image} alt="Result image attached to the message" />
          </Box>
        )}
        <InputBase
          multiline
          fullWidth
          minRows={6}
          maxRows={20}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          inputProps={{ 'aria-label': 'Message text' }}
          sx={{ p: 0, fontSize: 13.5, lineHeight: 1.4, color: INK, alignItems: 'flex-start' }}
        />
      </Box>
    </Box>
  )
}
