import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { Button } from '../Button'

// docs/specs/050-league-schedule-and-fixtures.md: the first PDF/document upload control in this
// codebase, a sibling to MediaUpload, not a variant on it (there's no image to preview for a
// PDF, so overloading MediaUpload's image-specific preview box/DIMENSIONS map would bend that
// component around a case it wasn't built for). Client-side allowlist restricted to PDF only,
// mirroring MediaUpload's own client-side-allowlist pattern but for one type instead of three.
const ALLOWED_TYPES = ['application/pdf']
const ALLOWED_TYPES_LABEL = 'PDF'

export interface DocumentUploadValue {
  documentUrl: string
  uploadedAt: string
}

export interface DocumentUploadProps {
  label: string
  value: DocumentUploadValue | null
  // Injected upload delegate, resolving a selected file to the new document's URL, kept generic
  // (rather than a fixed import the way MediaUpload picks between uploadMedia/uploadManagedMedia
  // via its own namespace prop) so this component stays genuinely reusable for a future PDF/
  // document field beyond its first consumer, LeagueFormPage.tsx's Schedule tab (wired to
  // leaguePlayingConditionsApi's uploadPlayingConditions, which needs clubId/leagueId/seasonId
  // this component has no reason to know about).
  onUpload: (file: File) => Promise<string>
  // Notifies the caller once onUpload resolves, e.g. to invalidate/re-fetch the query backing
  // `value`, since (unlike MediaUpload's plain form-state value) this control's value is normally
  // server state owned by the caller, not local form state.
  onUploaded: (documentUrl: string) => void
  // docs/specs/072-league-view-pages.md: replaces the stored (uuid-prefixed) file name as the line
  // shown for an uploaded document. Omitted, the name derived from the URL is shown as before.
  displayName?: string
  // docs/specs/095: 'inline' is the compact pair of buttons for a content line (a View button named displayName and a
  // Upload / Replace button, errors in a small line under them) instead of the bordered 'card' with its caption.
  layout?: 'card' | 'inline'
}

// The backend never preserves a document's original filename (MediaServiceImpl generates a UUID
// filename on every upload, the same "/media/{filename}"-style URL an image upload already
// returns), the trailing URL segment is the closest thing to a display name available.
function filenameFromUrl(url: string): string {
  const segments = url.split('/')
  return segments[segments.length - 1] || url
}

export function DocumentUpload({ label, value, onUpload, onUploaded, displayName, layout = 'card' }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
    if (!file) {
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`"${file.name}" isn't a supported document type. Upload a ${ALLOWED_TYPES_LABEL} file instead.`)
      return
    }

    setError(null)
    setUploading(true)
    try {
      const documentUrl = await onUpload(file)
      onUploaded(documentUrl)
    } catch {
      setError(`Something went wrong uploading "${file.name}". Please try again.`)
    } finally {
      setUploading(false)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ALLOWED_TYPES.join(',')}
      hidden
      aria-label={`${label} file`}
      onChange={handleFileSelected}
    />
  )

  if (layout === 'inline') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {value && (
            <Button
              variant="secondary"
              size="sm"
              startIcon={<DescriptionOutlinedIcon fontSize="small" />}
              onClick={() => window.open(value.documentUrl, '_blank', 'noopener')}
            >
              {displayName ?? 'View'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            startIcon={uploading ? <CircularProgress size={16} aria-label="Uploading" /> : <UploadFileOutlinedIcon fontSize="small" />}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
        </Stack>
        {fileInput}
        {error && (
          <Typography variant="caption" color="error.main" role="alert">
            {error}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          p: 1.5,
          border: 1,
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
            }}
          >
            {uploading ? (
              <CircularProgress size={20} color="error" aria-label="Uploading" />
            ) : (
              <DescriptionOutlinedIcon color="error" fontSize="small" />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {value ? (displayName ?? filenameFromUrl(value.documentUrl)) : 'No document uploaded yet'}
            </Typography>
            {value && (
              <Typography variant="caption" color="text.secondary">
                Uploaded {new Date(value.uploadedAt).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            variant={value ? 'ghost' : 'primary'}
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button variant="secondary" size="sm" onClick={() => window.open(value.documentUrl, '_blank')}>
              View
            </Button>
          )}
        </Stack>
      </Box>

      {fileInput}

      <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'}>
        {error ?? `${ALLOWED_TYPES_LABEL}, up to 5MB.`}
      </Typography>
    </Box>
  )
}
