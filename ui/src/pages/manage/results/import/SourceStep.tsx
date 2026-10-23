import { Box, Chip, Tab, Tabs, TextField, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { Button } from '../../../../components/Button'
import { WizardFooter } from '../../../../components/WizardFooter'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { DocumentUpload } from '../../../../components/DocumentUpload'
import { JsonEditor } from '../../../../components/JsonEditor'
import { TileChoiceGroup } from '../../../../components/TileChoiceGroup'
import { badgeSx } from '../../../../components/RecordCard'
import { viewTabSx, viewTabsSx } from '../../../../utils/viewTabs'
import { formatBytes } from '../../../../utils/formatBytes'
import type { ImportAdaptor } from '../../../../api/resultImportApi'
import { ConvertWithAiHelper } from './ConvertWithAiHelper'
import { ImportProblemAlert } from './ImportProblemAlert'
import { chosenInput } from './importSource'
import type { ImportStepContext } from './importWizardTypes'

const NO_PASTE_LINE = 'This source reads files, not pasted text.'

function FormatChips({ adaptor }: { adaptor: ImportAdaptor }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
      {adaptor.inputs.map((input) => (
        <Chip key={input.format} size="small" label={input.textBased ? input.format : `${input.format}, upload only`} sx={{ ...badgeSx('positive'), height: 24, fontSize: '0.75rem' }} />
      ))}
    </Box>
  )
}

// docs/specs/104-match-results-import-adaptors.md, step 1 Source. Everything on it comes from the discovery catalogue (the
// sources, their formats, the file types and the limits): nothing here knows an adaptor. Text formats offer Upload file or
// Paste; a binary format only the upload. Errors are shown under the input, which is never cleared.
export function SourceStep({ catalogue, source, onSourceChange, previewing, sourceProblem, canContinue, onContinue }: ImportStepContext) {
  const adaptor = catalogue.adaptors.find((candidate) => candidate.type === source.adaptorType)
  const input = chosenInput(adaptor, source.format)
  const pasteAllowed = Boolean(input?.acceptsPaste)
  const prompt = adaptor?.conversionPrompt ?? null
  // Other holds the "convert it with your own AI" prompt, so it exists only for a source that has one.
  const tab = source.tab === 'other' ? (prompt ? 'other' : 'upload') : pasteAllowed ? source.tab : 'upload'
  const limit = catalogue.limits.maxPasteCharacters
  const over = source.paste.length > limit
  const sourceName = adaptor?.displayName
  const hasExample = Boolean(adaptor?.example)
  const hasProblem = sourceProblem !== null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
      <Box>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, fontSize: { md: '1.125rem' } }}>
          Where is the result coming from?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Choose a source, then upload the file or paste its content. Nothing is saved until you confirm.
        </Typography>
      </Box>

      <TileChoiceGroup<string>
        label="Source"
        value={source.adaptorType}
        onChange={(type) => {
          if (type === source.adaptorType) return
          // A different source reads different files: its first format, and no file carried over.
          const next = catalogue.adaptors.find((candidate) => candidate.type === type)
          onSourceChange({ adaptorType: type, format: next?.inputs[0]?.format ?? null, file: null })
        }}
        disabled={previewing}
        columns={{ xs: '1fr', md: 'repeat(auto-fill, minmax(340px, 1fr))' }}
        tileSx={{ alignItems: 'flex-start', textAlign: 'left', gap: 1.5, py: 1.5 }}
        options={catalogue.adaptors.map((candidate) => ({
          value: candidate.type,
          content: (
            <>
              <Box
                aria-hidden
                sx={{
                  width: 32,
                  height: 32,
                  flex: 'none',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: candidate.type === source.adaptorType ? 'primary.main' : (theme) => alpha(theme.palette.primary.main, 0.12),
                  color: candidate.type === source.adaptorType ? 'primary.contrastText' : 'primary.dark',
                }}
              >
                <DescriptionOutlinedIcon fontSize="small" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="span" sx={{ display: 'block', fontSize: '0.9375rem', fontWeight: 700 }}>
                  {candidate.displayName}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {candidate.description}
                </Typography>
                <FormatChips adaptor={candidate} />
              </Box>
              {candidate.type === source.adaptorType && <CheckCircleOutlineIcon color="primary" role="img" aria-label="Selected" sx={{ flex: 'none' }} />}
            </>
          ),
        }))}
      />

      {adaptor && adaptor.inputs.length > 1 && (
        <CompactToggleGroup<string> value={input?.format ?? ''} onChange={(format) => onSourceChange({ format, file: null })} ariaLabel="File format" fullWidthOnPhone>
          {adaptor.inputs.map((candidate) => (
            <ToggleButton key={candidate.format} value={candidate.format} aria-label={candidate.format} disabled={previewing}>
              {candidate.format}
            </ToggleButton>
          ))}
        </CompactToggleGroup>
      )}

      {adaptor && input && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {pasteAllowed || prompt ? (
            <Tabs value={tab} onChange={(_event, value: 'upload' | 'paste' | 'other') => onSourceChange({ tab: value })} aria-label="How to provide the result" variant="fullWidth" sx={viewTabsSx}>
              <Tab value="upload" label="Upload file" sx={viewTabSx} disabled={previewing} />
              {pasteAllowed && <Tab value="paste" label="Paste" sx={viewTabSx} disabled={previewing} />}
              {prompt && <Tab value="other" label="Other" sx={viewTabSx} disabled={previewing} />}
            </Tabs>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {NO_PASTE_LINE}
            </Typography>
          )}

          {tab === 'other' && prompt ? (
            <ConvertWithAiHelper prompt={prompt} />
          ) : tab === 'paste' ? (
            <Box>
              {input.format === 'JSON' ? (
                <JsonEditor
                  value={source.paste}
                  onChange={(paste) => onSourceChange({ paste })}
                  disabled={previewing}
                  error={hasProblem || over}
                  placeholder="Paste the result here"
                  ariaLabel="Pasted result content"
                />
              ) : (
                <TextField
                  multiline
                  minRows={8}
                  maxRows={14}
                  fullWidth
                  value={source.paste}
                  onChange={(event) => onSourceChange({ paste: event.target.value })}
                  disabled={previewing}
                  error={hasProblem || over}
                  placeholder="Paste the result here"
                  inputProps={{ 'aria-label': 'Pasted result content', spellCheck: false }}
                  sx={{ '& textarea': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.75rem', lineHeight: 1.5 } }}
                />
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, gap: 1 }}>
                {hasExample ? (
                  <Button variant="ghost" size="compact" disabled={previewing} onClick={() => onSourceChange({ paste: adaptor.example ?? '' })} sx={{ color: 'info.main', fontWeight: 600, textTransform: 'none' }}>
                    Insert example
                  </Button>
                ) : (
                  <span />
                )}
                <Typography variant="caption" color={over ? 'error.main' : 'text.secondary'} aria-live="polite">
                  {source.paste.length.toLocaleString('en-GB')} / {limit.toLocaleString('en-GB')}
                  {over ? ' (too long)' : ''}
                </Typography>
              </Box>
            </Box>
          ) : (
            <DocumentUpload
              mode="select"
              label="Result file"
              accept={input.extensions}
              maxBytes={input.maxBytes}
              helperText={`Accepts ${input.extensions.join(', ')} files up to ${formatBytes(input.maxBytes)}. Drop a file here or choose one.`}
              file={source.file}
              onFileChange={(file) => onSourceChange({ file })}
              disabled={previewing}
            />
          )}
        </Box>
      )}

      {sourceProblem && (
        <Box>
          <ImportProblemAlert problem={sourceProblem} sourceName={sourceName} input={tab === 'paste' ? 'paste' : 'file'} onRetry={onContinue} retrying={previewing} />
        </Box>
      )}

      {tab !== 'other' && (
      <WizardFooter primary={{ label: previewing ? 'Reading…' : 'Continue', onClick: onContinue, disabled: !canContinue || previewing }} note="Nothing is saved at this step." />
      )}
    </Box>
  )
}
