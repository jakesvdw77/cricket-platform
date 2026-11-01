import { useMemo, useState } from 'react'
import { Box, ToggleButton, Typography } from '@mui/material'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareControlGroup, ShareLogoControls, SharePdfActions } from '../ShareCore'
import { ShareResultCanvas } from '../ShareResultDialog/ShareResultCanvas'
import { usesLineup } from '../../utils/share/matchShareFormats'
import { PDF_TEMPLATES } from '../../utils/share/shareChoices'
import type { PdfTemplate } from '../../utils/share/shareChoices'
import { matchShareFileName } from '../../utils/share/shareMatchData'
import { MatchContentControls } from './MatchContentControls'
import type { MatchScreenProps } from './matchScreenTypes'
import { useMatchPdfOptions, useMatchPdfOutput } from './useMatchOutputs'

const TEMPLATE_LABELS: Record<PdfTemplate, string> = { CLUB: 'Club Colours', CLASSIC: 'Classic', COMPACT: 'Compact' }

// docs/specs/131 (Format screens, PDF; Team sheet A4): one A4 document, a page per side when Both is Separate. The preview is the
// generator's own laid-out page drawn into a canvas, so what is shown is what is made.
export function MatchPdfScreen(props: MatchScreenProps) {
  const { model: base, choices, updateChoices, shareTitle, layout } = props
  const model = useMemo(() => ({ ...base, layout }), [base, layout])
  const options = useMatchPdfOptions(props)
  const fileName = useMemo(() => matchShareFileName(model, 'pdf'), [model])
  const [pixelWidth, setPixelWidth] = useState<number | undefined>(undefined)
  const { canvasRef, file, pageCount, pageIndex, setPageIndex, error } = useMatchPdfOutput(model, options, fileName, pixelWidth)
  const include = choices.match.include
  const setInclude = (patch: Partial<typeof include>) => updateChoices({ match: { include: patch } })

  return (
    <ShareFormatScreen
      title="PDF"
      controls={
        <>
          <ShareControlGroup label="Template">
            <CompactToggleGroup value={choices.match.templates.pdf} ariaLabel="Template" fullWidthOnPhone onChange={(next: PdfTemplate) => updateChoices({ match: { templates: { pdf: next } } })}>
              {PDF_TEMPLATES.map((item) => (
                <ToggleButton key={item} value={item}>
                  {TEMPLATE_LABELS[item]}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          <MatchContentControls {...props} weatherOn={include.weather} onWeatherChange={(next) => setInclude({ weather: next })}>
            {usesLineup(model.content) && <CompactSwitch label="Captain And Keeper Marks" checked={include.marks} onChange={(next) => setInclude({ marks: next })} />}
            <CompactSwitch label="Venue And Date" checked={include.venueAndDate} onChange={(next) => setInclude({ venueAndDate: next })} />
          </MatchContentControls>
          <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage
          ariaLabel="PDF preview"
          zoomable
          baseWidth={794}
          fitMaxWidth={1100}
          fitAspect={297 / 210}
          onViewChange={(view) => setPixelWidth(view.pixelWidth)}
          footer={
            pageCount > 1 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                <Button size="compact" variant="ghost" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>
                  Previous Page
                </Button>
                <Typography variant="caption" color="text.secondary" role="status">
                  Page {pageIndex + 1} of {pageCount}
                </Typography>
                <Button size="compact" variant="ghost" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                  Next Page
                </Button>
              </Box>
            ) : undefined
          }
          caption="A4 page preview. This is the file you will share."
        >
          {(view) => <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`PDF of ${model.title}, page ${pageIndex + 1}`} width={view.width} />}
        </SharePreviewStage>
      }
      actions={<SharePdfActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
