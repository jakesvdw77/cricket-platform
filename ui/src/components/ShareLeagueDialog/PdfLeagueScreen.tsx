import { useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Button } from '../Button'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareLogoControls, SharePdfActions } from '../ShareCore'
import { ShareResultCanvas } from '../ShareResultDialog/ShareResultCanvas'
import { leagueShareFileName } from '../../utils/share/shareLeagueData'
import { LeagueContentControls } from './LeagueContentControls'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'
import { useLeaguePdfOptions } from './useLeaguePdfOptions'
import { useLeaguePdfOutput } from './useLeaguePdfOutput'

// docs/specs/122-league-sharing.md (Format screens, PDF): one A4 document with a section per ticked content. The preview is
// the generator's own laid-out page drawn into a canvas, so what is shown is what is made.
export function PdfLeagueScreen(props: LeagueScreenProps) {
  const { model, shareTitle, ticked } = props
  const options = useLeaguePdfOptions(props)
  const fileName = useMemo(() => leagueShareFileName(model, 'pdf'), [model])
  const [pixelWidth, setPixelWidth] = useState<number | undefined>(undefined)
  const { canvasRef, file, pageCount, pageIndex, setPageIndex, error } = useLeaguePdfOutput(model, options, fileName, pixelWidth)

  return (
    <ShareFormatScreen
      title="PDF"
      controls={
        <>
          <LeagueLeftOutNote format="PDF" ticked={ticked} />
          <LeagueContentControls {...props} />
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
                  Previous page
                </Button>
                <Typography variant="caption" color="text.secondary" role="status">
                  Page {pageIndex + 1} of {pageCount}
                </Typography>
                <Button size="compact" variant="ghost" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                  Next page
                </Button>
              </Box>
            ) : undefined
          }
          caption={pageCount > 1 ? 'A4 page preview. This is the file you will share. A long league runs to more than one page.' : 'A4 page preview. This is the file you will share.'}
        >
          {(view) => <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`PDF of ${model.title}, page ${pageIndex + 1}`} width={view.width} />}
        </SharePreviewStage>
      }
      actions={<SharePdfActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
