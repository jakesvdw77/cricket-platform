import type { ReactNode } from 'react'
import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { downloadImportTemplate, importErrorMessage } from '../../api/importApi'
import type { ImportScope, ImportScopeMode, ImportTemplateScope, ImportType } from '../../api/importApi'
import { formatBytes } from '../../utils/formatBytes'
import { triggerDownload } from '../../utils/triggerDownload'
import { Button } from '../Button'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { DocumentUpload } from '../DocumentUpload'

export interface ImportUploadStepProps {
  clubId: string
  type: ImportType
  // The consumer's scope params plus the two choices made here.
  scope: ImportScope
  onScopeChange: (patch: Partial<Pick<ImportScope, 'scopeMode' | 'templateScope'>>) => void
  file: File | null
  onFileChange: (file: File | null) => void
  uploading?: boolean
  // A file-level problem from the preview ("This is not the league schedule template").
  error?: string | null
  // From a batch for this very file (a repeat import): a warning, not a block.
  earlierImportWarning?: string | null
  // The consumer's own words for the choices (defaults are generic).
  templateScopeLabels?: Record<ImportTemplateScope, string>
  templateScopeHelp?: Record<ImportTemplateScope, string>
  scopeModeLabels?: Record<ImportScopeMode, string>
  scopeModeHelp?: Record<ImportScopeMode, string>
  // The consumer's own controls (for example an "Advanced" disclosure), shown between the scope choice and the file.
  extras?: ReactNode
  // Spec 125 (a type with editable rows): a secondary button that starts with no file. Omitted, none is shown.
  onStartBlank?: () => void
  startBlankLabel?: string
  startingBlank?: boolean
}

const TEMPLATE_LABELS: Record<ImportTemplateScope, string> = { OURS_ONLY: 'Our records only', OURS_AND_OTHERS: 'Ours and others' }
const TEMPLATE_HELP: Record<ImportTemplateScope, string> = {
  OURS_ONLY: 'Only your own teams appear in the drop-downs.',
  OURS_AND_OTHERS: "Your teams and the league's teams appear in the drop-downs.",
}
const MODE_LABELS: Record<ImportScopeMode, string> = { OURS_ONLY: 'Ours only', ALL: 'Everything' }
const MODE_HELP: Record<ImportScopeMode, string> = {
  OURS_ONLY: 'Only rows that involve your records are imported. Every other row is listed as skipped, not ours.',
  ALL: 'Every row in the file is checked and imported.',
}
const FORMAT_LABELS: Record<string, string> = { xlsx: 'Excel', csv: 'CSV' }

const sectionSx = { display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, md: 3 }, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 } as const

// docs/specs/097-import-framework.md, step 1 (Upload): the template download (with the lookup-sheet choice when the type has an
// "ours" notion), the import scope choice, the drop zone with its limits and any file-level error.
// The Upload button itself is the wizard footer's.
export function ImportUploadStep({ clubId, type, scope, onScopeChange, file, onFileChange, uploading = false, error, earlierImportWarning, templateScopeLabels = TEMPLATE_LABELS, templateScopeHelp = TEMPLATE_HELP, scopeModeLabels = MODE_LABELS, scopeModeHelp = MODE_HELP, extras, onStartBlank, startBlankLabel = 'Start with no rows', startingBlank = false }: ImportUploadStepProps) {
  const template = useMutation({
    mutationFn: (format: string) => downloadImportTemplate(clubId, type.type, format, scope),
    onSuccess: ({ blob, fileName }) => triggerDownload(URL.createObjectURL(blob), fileName),
  })
  const templateScope = scope.templateScope ?? 'OURS_AND_OTHERS'
  const scopeMode = scope.scopeMode ?? 'ALL'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Box component="section" aria-labelledby="import-template-heading" sx={sectionSx}>
        <Typography id="import-template-heading" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>1. Download the template</Typography>
        <Typography variant="body2" color="text.secondary">Fill it in, or ask an AI to convert your own file into it, then upload it below.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: type.supportsOursScope ? '1fr 1fr' : '1fr' }, gap: { xs: 2, md: 3 }, alignItems: 'start', pt: 0.5 }}>
          {type.supportsOursScope && (
            <Box role="group" aria-labelledby="import-template-scope-label" sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" id="import-template-scope-label" sx={{ fontWeight: 700 }}>Lists in the template</Typography>
              <CompactToggleGroup<ImportTemplateScope> value={templateScope} onChange={(next) => onScopeChange({ templateScope: next })} ariaLabel="What the template's lists contain" fullWidthOnPhone>
                {(Object.keys(templateScopeLabels) as ImportTemplateScope[]).map((option) => (
                  <ToggleButton key={option} value={option} aria-label={templateScopeLabels[option]}>{templateScopeLabels[option]}</ToggleButton>
                ))}
              </CompactToggleGroup>
              <Typography variant="body2" color="text.secondary">{templateScopeHelp[templateScope]}</Typography>
            </Box>
          )}
          <Box role="group" aria-labelledby="import-template-download-label" sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" id="import-template-download-label" sx={{ fontWeight: 700 }}>Download</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.max(type.formats.length, 1)}, minmax(0, 1fr))` }, gap: { xs: 1, sm: 1.5 } }}>
              {type.formats.map((format) => (
                <Button key={format} size="compact" variant="secondary" startIcon={<FileDownloadOutlinedIcon />} disabled={template.isPending} onClick={() => template.mutate(format)} sx={{ minHeight: { xs: 44, md: 32 } }}>
                  {FORMAT_LABELS[format] ?? format.toUpperCase()} template
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
        {template.isError && <Alert severity="error">{importErrorMessage(template.error, 'We could not download the template.')}</Alert>}
      </Box>

      {type.supportsOursScope && (
        <Box component="section" aria-labelledby="import-scope-heading" sx={sectionSx}>
          <Typography id="import-scope-heading" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>2. What to import</Typography>
          <CompactToggleGroup<ImportScopeMode> value={scopeMode} onChange={(next) => onScopeChange({ scopeMode: next })} ariaLabel="What to import" fullWidthOnPhone>
            {(Object.keys(scopeModeLabels) as ImportScopeMode[]).map((option) => (
              <ToggleButton key={option} value={option} aria-label={scopeModeLabels[option]}>{scopeModeLabels[option]}</ToggleButton>
            ))}
          </CompactToggleGroup>
          <Typography variant="body2" color="text.secondary">{scopeModeHelp[scopeMode]}</Typography>
        </Box>
      )}

      {extras}

      <Box component="section" aria-labelledby="import-file-heading" sx={sectionSx}>
        <Typography id="import-file-heading" component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>{type.supportsOursScope ? '3. Upload your file' : '2. Upload your file'}</Typography>
        {earlierImportWarning && <Alert severity="warning">{earlierImportWarning}</Alert>}
        <DocumentUpload
          mode="select"
          label="Import file"
          accept={['.xlsx', '.csv']}
          maxBytes={type.limits.maxFileBytes}
          helperText={`Excel (.xlsx) or CSV, up to ${formatBytes(type.limits.maxFileBytes)} and ${type.limits.maxRows.toLocaleString('en-GB')} rows. Drop a file here or choose one.`}
          file={file}
          onFileChange={onFileChange}
          disabled={uploading || startingBlank}
          helperAction={onStartBlank && (
            <Button size="compact" variant="ghost" startIcon={<EditOutlinedIcon />} disabled={uploading || startingBlank} onClick={onStartBlank} sx={{ minHeight: { xs: 44, md: 32 }, color: 'primary.main', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
              {startingBlank ? 'Starting...' : `No file? ${startBlankLabel}`}
            </Button>
          )}
        />
        {error && <Alert severity="error" role="alert">{error}</Alert>}
      </Box>
    </Box>
  )
}
