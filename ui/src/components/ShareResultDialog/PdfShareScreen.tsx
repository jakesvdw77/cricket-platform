import { useMemo } from 'react'
import { Box, ToggleButton, Typography } from '@mui/material'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { shareFileName } from '../../utils/share/shareFileName'
import type { PdfTemplate } from '../../utils/share/shareChoices'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareLogoControls } from './ShareLogoControls'
import { ShareResultCanvas } from './ShareResultCanvas'
import { SharePdfActions } from './SharePdfActions'
import { ShareTeamsControl } from './ShareTeamsControl'
import { useSharePdfOptions } from './sharePdfOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { useResultPdfOutput } from './useResultPdfOutput'

const TEMPLATES: { value: PdfTemplate; label: string }[] = [
  { value: 'CLUB', label: 'Club colours' },
  { value: 'CLASSIC', label: 'Classic' },
  { value: 'COMPACT', label: 'Compact' },
]

// docs/specs/114-share-result.md (Format screen anatomy, PDF scorecard): the A4 scorecard. The preview is the generator's own
// laid-out page drawn into a canvas (jsPDF cannot rasterise), so what is shown is what is made; the file is the generator's
// output. Teams is offered here (unlike the Image and TV cards), so the model passed in already honours it.
export function PdfShareScreen(props: ShareScreenProps) {
  const { model, choices, updateChoices, initials, shareTitle } = props
  const include = choices.include.pdf
  const template = choices.templates.pdf
  const options = useSharePdfOptions(props)
  const fileName = useMemo(() => shareFileName(model, 'pdf'), [model])
  const { canvasRef, file, pageCount, pageIndex, setPageIndex, error } = useResultPdfOutput(model, options, fileName)
  const setInclude = (patch: Partial<typeof include>) =>
    updateChoices({ include: { ...choices.include, pdf: { ...include, ...patch } } })

  return (
    <ShareFormatScreen
      title="PDF scorecard"
      controls={
        <>
          <ShareControlGroup label="Template">
            <CompactToggleGroup
              value={template}
              ariaLabel="Template"
              fullWidthOnPhone
              onChange={(next: PdfTemplate) => updateChoices({ templates: { ...choices.templates, pdf: next } })}
            >
              {TEMPLATES.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          <ShareControlGroup label="Teams">
            <ShareTeamsControl
              value={model.teams}
              disabledReason={model.teamsChoiceDisabledReason}
              onChange={(next) => updateChoices({ teams: next })}
            />
          </ShareControlGroup>
          <ShareControlGroup label="Include">
            <ShareInitialsControl initials={initials} collisions={model.initialsCollisions} onChange={initials.setValue} />
            <CompactSwitch label="Batting" checked={include.batting} onChange={(next) => setInclude({ batting: next })} />
            <CompactSwitch label="Bowling" checked={include.bowling} onChange={(next) => setInclude({ bowling: next })} />
            <CompactSwitch label="Extras" checked={include.extras} onChange={(next) => setInclude({ extras: next })} />
            <CompactSwitch label="Toss and conditions" checked={include.toss} onChange={(next) => setInclude({ toss: next })} />
            <CompactSwitch
              label="Player of the match"
              checked={include.playerOfTheMatch}
              onChange={(next) => setInclude({ playerOfTheMatch: next })}
            />
          </ShareControlGroup>
          <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage
          ariaLabel="PDF preview"
          caption={
            pageCount > 1
              ? 'A4 page preview. This is the file you will share. A long scorecard runs to more than one page.'
              : 'A4 page preview. This is the file you will share.'
          }
        >
          <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`PDF scorecard, page ${pageIndex + 1}: ${model.resultLine}`} />
          {pageCount > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
              <Button variant="ghost" size="sm" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>
                Previous page
              </Button>
              <Typography variant="caption" color="text.secondary" role="status">
                Page {pageIndex + 1} of {pageCount}
              </Typography>
              <Button variant="ghost" size="sm" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                Next page
              </Button>
            </Box>
          )}
        </SharePreviewStage>
      }
      actions={<SharePdfActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
