import { Box, Typography } from '@mui/material'
import { AttachedImagePreview } from './AttachedImagePreview'

export interface ResultImageCardProps {
  file: File | null
  title: string
  caption: string
  alt: string
}

// A small card beside a text preview for the image that cannot travel inside the message: a link carries text only, so the
// image is pasted or attached by hand.
export function ResultImageCard({ file, title, caption, alt }: ResultImageCardProps) {
  return (
    <Box sx={{ width: 180, maxWidth: '100%', boxSizing: 'border-box', mx: 'auto', p: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 0.75 }}>
        {title}
      </Typography>
      <AttachedImagePreview file={file} alt={alt} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {caption}
      </Typography>
    </Box>
  )
}
