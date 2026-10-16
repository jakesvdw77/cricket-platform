import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { formatBytes } from '../../utils/formatBytes'
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

// docs/specs/104: what every mode shares. `accept` lists what the control takes, each entry a file extension (".json") or
// a MIME type, and replaces the PDF-only default; `maxBytes` refuses a bigger file before anything is sent; `helperText`
// replaces the caption line under the control.
interface DocumentUploadCommonProps {
  label: string
  accept?: string[]
  maxBytes?: number
  helperText?: string
}

// docs/specs/104: `mode="select"` only holds the chosen file (nothing is uploaded and there is no stored document); the
// caller reads `file` when it is ready to send it (the import wizard's Source step). The same refusals (type, size) apply.
export interface DocumentSelectProps extends DocumentUploadCommonProps {
  mode: 'select'
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

export interface DocumentUploadModeProps extends DocumentUploadCommonProps {
  // The default: the file is uploaded at once through `onUpload`.
  mode?: 'upload'
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

export type DocumentUploadProps = DocumentUploadModeProps | DocumentSelectProps

// Whether a file is one of the accepted kinds: an entry starting with a dot is an extension (compared without regard to
// case, a MIME type is unreliable for .json and .csv), anything else a MIME type.
function isAccepted(file: File, accept: string[]): boolean {
  const name = file.name.toLowerCase()
  return accept.some((entry) => (entry.startsWith('.') ? name.endsWith(entry.toLowerCase()) : file.type === entry))
}

function acceptLabel(accept: string[]): string {
  return accept.map((entry) => (entry.startsWith('.') ? entry : entry.split('/').pop() ?? entry)).join(', ')
}

// Why a chosen file is refused, or null when it is fine.
function refusalFor(file: File, accept: string[] | undefined, maxBytes: number | undefined): string | null {
  if (accept ? !isAccepted(file, accept) : !ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" isn't a supported document type. Upload a ${accept ? acceptLabel(accept) : ALLOWED_TYPES_LABEL} file instead.`
  }
  if (maxBytes !== undefined && file.size > maxBytes) {
    return `"${file.name}" is ${formatBytes(file.size)}, over the ${formatBytes(maxBytes)} limit.`
  }
  return null
}

// The backend never preserves a document's original filename (MediaServiceImpl generates a UUID
// filename on every upload, the same "/media/{filename}"-style URL an image upload already
// returns), the trailing URL segment is the closest thing to a display name available.
function filenameFromUrl(url: string): string {
  const segments = url.split('/')
  return segments[segments.length - 1] || url
}

export function DocumentUpload(props: DocumentUploadProps) {
  return props.mode === 'select' ? <SelectDocument {...props} /> : <UploadDocument {...props} />
}

function SelectDocument({ label, accept, maxBytes, helperText, file, onFileChange, disabled = false }: DocumentSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const choose = (chosen: File | undefined) => {
    if (!chosen) return
    const refusal = refusalFor(chosen, accept, maxBytes)
    setError(refusal)
    // A refused file never replaces the one already held.
    if (!refusal) onFileChange(chosen)
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0]
    // Reset so selecting the same file again still fires a change event.
    event.target.value = ''
    choose(chosen)
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled) choose(event.dataTransfer.files?.[0])
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1.75,
          p: { xs: 1.5, sm: 2.5 },
          border: 2,
          borderStyle: 'dashed',
          borderColor: error ? 'error.main' : 'primary.main',
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, dragging ? 0.1 : 0.04),
        })}
      >
        <DescriptionOutlinedIcon color="primary" sx={{ fontSize: 28, flex: 'none' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {file ? file.name : label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {file ? formatBytes(file.size) : 'No file chosen yet'}
          </Typography>
        </Box>
        {file ? (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onFileChange(null)} sx={{ minHeight: 44, minWidth: 44, color: 'info.main' }}>
            Remove
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()} sx={{ minHeight: 44 }}>
            Choose file
          </Button>
        )}
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={(accept ?? ALLOWED_TYPES).join(',')}
        hidden
        aria-label={`${label} file`}
        onChange={onChange}
      />
      <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'} role={error ? 'alert' : undefined}>
        {error ?? helperText ?? `${accept ? acceptLabel(accept) : ALLOWED_TYPES_LABEL}${maxBytes !== undefined ? `, up to ${formatBytes(maxBytes)}` : ''}. Drop a file here or choose one.`}
      </Typography>
    </Box>
  )
}

function UploadDocument({ label, value, onUpload, onUploaded, displayName, layout = 'card', accept, maxBytes, helperText }: DocumentUploadModeProps) {
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

    const refusal = refusalFor(file, accept, maxBytes)
    if (refusal) {
      setError(refusal)
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
      accept={(accept ?? ALLOWED_TYPES).join(',')}
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
        {error ?? helperText ?? `${ALLOWED_TYPES_LABEL}, up to 5MB.`}
      </Typography>
    </Box>
  )
}
