import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { Button } from '../Button'
import { uploadMedia } from '../../api/mediaApi'

// Generic image upload control — file picker restricted to the image MIME allowlist
// client-side (mirrored, not replacing, the backend's own POST /platform/media check),
// preview of the current image, calls uploadMedia on selection and hands the resulting URL
// back via onUploaded. Doesn't know or care that its first two consumers are "logo" and
// "banner" — a future Sponsors icon/banner field can reuse it unchanged, per
// docs/specs/012-club-profile.md.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const ALLOWED_TYPES_LABEL = 'PNG, JPEG, or WebP'

export type MediaUploadVariant = 'logo' | 'banner'

export interface MediaUploadProps {
  label: string
  value: string | null
  onUploaded: (url: string) => void
  // Not called out explicitly in docs/plans/012-club-profile.md's MediaUpload props list, but
  // needed to match the approved mediaupload.html preview's two distinct shapes — a ~96-120px
  // square for a logo vs. a wide ~340x120px rectangle for a banner. Defaults to 'logo'.
  variant?: MediaUploadVariant
}

const DIMENSIONS: Record<MediaUploadVariant, { width: number | string; height: number }> = {
  logo: { width: 120, height: 120 },
  banner: { width: '100%', height: 120 },
}

export function MediaUpload({ label, value, onUploaded, variant = 'logo' }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dimensions = DIMENSIONS[variant]

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
    if (!file) {
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`"${file.name}" isn't a supported image type. Upload a ${ALLOWED_TYPES_LABEL} file instead.`)
      return
    }

    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadMedia(file)
      onUploaded(url)
    } catch {
      setError(`Something went wrong uploading "${file.name}". Please try again.`)
    } finally {
      setUploading(false)
    }
  }

  const showPreview = Boolean(value) && !uploading && !error

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>

      <Box
        sx={{
          width: dimensions.width,
          height: dimensions.height,
          border: '2px dashed',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: showPreview ? 'primary.main' : 'transparent',
        }}
      >
        {uploading ? (
          <CircularProgress size={28} sx={{ color: 'common.white' }} aria-label="Uploading" />
        ) : error ? (
          <CloseIcon color="error" />
        ) : !value ? (
          <ImageOutlinedIcon sx={{ color: 'text.secondary' }} fontSize="large" />
        ) : null}
      </Box>

      <Button
        variant={value ? 'ghost' : 'primary'}
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        sx={{ alignSelf: 'flex-start' }}
      >
        {uploading ? 'Uploading…' : value ? 'Replace' : `Upload ${label}`}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        hidden
        aria-label={`${label} file`}
        onChange={handleFileSelected}
      />

      <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'}>
        {error ?? `${ALLOWED_TYPES_LABEL}, up to 5MB.`}
      </Typography>
    </Box>
  )
}
