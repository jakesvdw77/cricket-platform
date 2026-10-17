import { Box, InputBase } from '@mui/material'
import { AttachedImagePreview } from './AttachedImagePreview'

// Facebook look-alike colours (the approved mockup, docs/specs/114-share-result.md). Not theme colours: they imitate the app.
const CARD = '#fff'
const INK = '#1c1e21'
const BORDER = '#dadde1'
const MUTED = '#65676b'

export interface FacebookPostPreviewProps {
  clubName: string | null
  text: string
  onTextChange: (text: string) => void
  attachImage: boolean
  image: File | null
}

// The Facebook preview as a post card: club avatar, name and "Just now", the editable post text (a real labelled textarea),
// the attached image, and a Like / Comment / Share row.
export function FacebookPostPreview({ clubName, text, onTextChange, attachImage, image }: FacebookPostPreviewProps) {
  const name = clubName ?? 'Your club'
  return (
    <Box sx={{ width: 440, maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', mx: 'auto', bgcolor: CARD, color: INK, borderRadius: '10px', border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: '10px 12px' }}>
        <Box
          aria-hidden
          sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{name}</Box>
          <Box sx={{ fontSize: 12, color: MUTED }}>Just now</Box>
        </Box>
      </Box>
      <Box sx={{ p: '0 12px 10px' }}>
        <InputBase
          multiline
          fullWidth
          minRows={6}
          maxRows={20}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          inputProps={{ 'aria-label': 'Post text' }}
          sx={{ p: 0, fontSize: 14.5, lineHeight: 1.4, color: INK, alignItems: 'flex-start' }}
        />
      </Box>
      {attachImage && <AttachedImagePreview file={image} alt="Result image attached to the post" radius={0} />}
      <Box
        aria-hidden
        sx={{ display: 'flex', justifyContent: 'space-around', borderTop: `1px solid ${BORDER}`, p: 1, color: MUTED, fontSize: 13, fontWeight: 600 }}
      >
        <span>Like</span>
        <span>Comment</span>
        <span>Share</span>
      </Box>
    </Box>
  )
}
