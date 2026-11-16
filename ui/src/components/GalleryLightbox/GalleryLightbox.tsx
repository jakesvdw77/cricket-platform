import { useEffect } from 'react'
import { Box, Chip, Dialog, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import type { GalleryImage } from '../../api/galleryApi'
import { formatInstantDateTime } from '../../utils/formatInstantDate'
import { Button } from '../Button'

// docs/specs/157-photo-gallery.md: one photo large (the medium copy) over a dark ground, with Previous and Next across the photos
// already loaded (never more than the pages the grid asked for), the caption, the tags, and Delete when the caller may.
export interface GalleryLightboxProps {
  images: GalleryImage[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  // Shown for a photo the caller may delete.
  canDelete?: (image: GalleryImage) => boolean
  onDelete?: (image: GalleryImage) => void
}

export function GalleryLightbox({ images, index, onIndexChange, onClose, canDelete, onDelete }: GalleryLightboxProps) {
  const open = index !== null && images[index] !== undefined
  const image = open ? images[index as number] : null
  const previous = () => index !== null && index > 0 && onIndexChange(index - 1)
  const next = () => index !== null && index < images.length - 1 && onIndexChange(index + 1)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, images.length])

  if (!image) return null
  return (
    <Dialog open fullScreen onClose={onClose} aria-label="Photo" PaperProps={{ sx: { bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.96), color: 'common.white' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>{(index as number) + 1} of {images.length}</Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ color: 'inherit', width: 44, height: 44 }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', px: { xs: 0, sm: 7 } }}>
        <IconButton aria-label="Previous photo" onClick={previous} disabled={index === 0} sx={{ position: 'absolute', left: 4, color: 'inherit', bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.45), display: { xs: 'none', sm: 'inline-flex' } }}><ChevronLeftIcon /></IconButton>
        <Box component="img" src={image.mediumUrl} alt={image.caption ?? 'Gallery photo'} data-testid="gallery-lightbox-image" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        <IconButton aria-label="Next photo" onClick={next} disabled={index === images.length - 1} sx={{ position: 'absolute', right: 4, color: 'inherit', bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.45), display: { xs: 'none', sm: 'inline-flex' } }}><ChevronRightIcon /></IconButton>
      </Box>
      <Box sx={{ px: 2, py: 1.5, display: 'grid', gap: 0.75 }}>
        {image.caption && <Typography>{image.caption}</Typography>}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          {image.tags.map((tag) => <Chip key={`${tag.type}:${tag.id}`} size="small" label={tag.name} sx={{ color: 'inherit', bgcolor: (theme: Theme) => alpha(theme.palette.common.white, 0.14) }} />)}
          <Typography variant="caption" sx={{ opacity: 0.7 }}>{formatInstantDateTime(image.uploadedAt)}{image.uploadedByName ? ` · ${image.uploadedByName}` : ''}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ gap: 1, display: { xs: 'flex', sm: 'none' } }}>
            <Button variant="secondary" onClick={previous} disabled={index === 0}>Previous</Button>
            <Button variant="secondary" onClick={next} disabled={index === images.length - 1}>Next</Button>
          </Box>
          {canDelete?.(image) && onDelete && <Button variant="danger" onClick={() => onDelete(image)} sx={{ ml: 'auto' }}>Delete</Button>}
        </Box>
      </Box>
    </Dialog>
  )
}
