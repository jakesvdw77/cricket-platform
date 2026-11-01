import { useMemo, useState } from 'react'
import { Box, ToggleButton, Typography } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareControlGroup, ShareImageActions, ShareLogoControls } from '../ShareCore'
import { ShareResultCanvas } from '../ShareResultDialog/ShareResultCanvas'
import { downloadFile } from '../../utils/share/downloadFile'
import { effectiveLayout, MATCH_CONTENT_LABELS, usesLineup } from '../../utils/share/matchShareFormats'
import { generateMatchImage, matchImageSize } from '../../utils/share/matchImage'
import { IMAGE_SIZES, IMAGE_TEMPLATES, TV_TEMPLATES } from '../../utils/share/shareChoices'
import type { ImageSize, ImageTemplate, TvTemplate } from '../../utils/share/shareChoices'
import { matchShareFileName } from '../../utils/share/shareMatchData'
import type { MatchShareModel } from '../../utils/share/shareMatchData'
import { MatchContentControls } from './MatchContentControls'
import { MatchPictureControls } from './MatchPictureControls'
import type { MatchScreenProps } from './matchScreenTypes'
import { useMatchImageOptions, useMatchImageOutput } from './useMatchOutputs'

const TEMPLATE_LABELS: Record<ImageTemplate | TvTemplate, string> = {
  CLUB_GREEN: 'Club Green', NIGHT: 'Night', DAYLIGHT: 'Daylight', BROADCAST: 'Broadcast', CLUB: 'Club Colour', LIGHT: 'Light',
}
const SIZE_LABELS: Record<ImageSize, string> = { SQUARE: 'Square 1080', PORTRAIT: 'Portrait 4:5', STORY: 'Story 9:16' }

// docs/specs/131 (Format screens, Image and TV summary): the match poster. The preview is the generator's own canvas and the
// file is read back from it. Both sides in Separate layout give one image per side, stepped here and downloaded separately.
export function MatchImageScreen(props: MatchScreenProps & { tv?: boolean }) {
  const { tv = false, model, choices, updateChoices, shareTitle, picture, layout } = props
  const include = choices.match.include
  const template = tv ? choices.match.templates.tv : choices.match.templates.image
  const size: ImageSize = tv ? 'PORTRAIT' : choices.match.imageSize
  const lineup = usesLineup(model.content)
  const { layout: effective, fellBack } = effectiveLayout(layout, size, tv)
  const separate = lineup && model.lineups.length > 1 && effective === 'SEPARATE'
  const [index, setIndex] = useState(0)
  const shownIndex = Math.min(index, Math.max(0, model.lineups.length - 1))
  const shown: MatchShareModel = useMemo(
    () => ({ ...model, layout: effective, lineups: separate ? [model.lineups[shownIndex]] : model.lineups }),
    [model, effective, separate, shownIndex],
  )
  const options = useMatchImageOptions(props, shown, { format: tv ? 'TV' : 'IMAGE', size, template, picture: picture.image, pictureSettings: picture.settings })
  const suffix = separate ? shown.lineups[0]?.teamName : undefined
  const fileName = useMemo(() => matchShareFileName(shown, 'png', suffix), [shown, suffix])
  const { canvasRef, file, error } = useMatchImageOutput(shown, options, fileName)
  const dimensions = matchImageSize(options)
  const setInclude = (patch: Partial<typeof include>) => updateChoices({ match: { include: patch } })
  const selection = model.content === 'TEAM_SELECTION'

  const downloadAll = async () => {
    for (let position = 0; position < model.lineups.length; position += 1) {
      const one: MatchShareModel = { ...model, layout: effective, lineups: [model.lineups[position]] }
      const blob = await generateMatchImage(one, options)
      downloadFile(new File([blob], matchShareFileName(one, 'png', one.lineups[0].teamName), { type: 'image/png' }))
    }
  }

  const label = `${MATCH_CONTENT_LABELS[model.content]}: ${model.title}, ${model.dayLabel}`
  return (
    <ShareFormatScreen
      title={tv ? 'TV Summary' : 'Image'}
      controls={
        <>
          <ShareControlGroup label="Template">
            <CompactToggleGroup
              value={template}
              ariaLabel="Template"
              fullWidthOnPhone
              onChange={(next: ImageTemplate | TvTemplate) => updateChoices({ match: { templates: tv ? { tv: next as TvTemplate } : { image: next as ImageTemplate } } })}
            >
              {(tv ? TV_TEMPLATES : IMAGE_TEMPLATES).map((item) => (
                <ToggleButton key={item} value={item}>
                  {TEMPLATE_LABELS[item]}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          {!tv && (
            <ShareControlGroup label="Size">
              <CompactToggleGroup value={size} ariaLabel="Size" fullWidthOnPhone onChange={(next: ImageSize) => updateChoices({ match: { imageSize: next } })}>
                {IMAGE_SIZES.map((item) => (
                  <ToggleButton key={item} value={item}>
                    {SIZE_LABELS[item]}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </ShareControlGroup>
          )}
          {fellBack && (
            <Typography variant="caption" color="text.secondary" role="status" sx={{ display: 'block', mb: 1.5 }}>
              Both teams do not fit side by side at this size, so each team gets its own image.
            </Typography>
          )}
          <MatchContentControls
            {...props}
            weatherOn={include.weather}
            onWeatherChange={(next) => setInclude({ weather: next })}
          >
            {lineup && <CompactSwitch label="Captain And Keeper Marks" checked={include.marks} onChange={(next) => setInclude({ marks: next })} />}
            <CompactSwitch label="Venue And Date" checked={include.venueAndDate} onChange={(next) => setInclude({ venueAndDate: next })} />
          </MatchContentControls>
          {selection && <MatchPictureControls picture={picture} include={include.picture} onIncludeChange={(next) => setInclude({ picture: next })} />}
          <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage
          ariaLabel={tv ? 'TV summary preview' : 'Image preview'}
          zoomable
          baseWidth={tv ? 640 : 540}
          fitMaxWidth={tv ? 900 : size === 'STORY' ? 320 : 560}
          footer={
            separate ? (
              <Box role="group" aria-label="Team images" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                {model.lineups.map((item, position) => (
                  <Button key={item.teamName} size="compact" variant={position === shownIndex ? 'primary' : 'secondary'} aria-pressed={position === shownIndex} onClick={() => setIndex(position)}>
                    {item.teamName}
                  </Button>
                ))}
                <Button size="compact" variant="ghost" startIcon={<FileDownloadOutlinedIcon />} onClick={() => void downloadAll()}>
                  Download Both
                </Button>
              </Box>
            ) : undefined
          }
          caption={`This is the file you will share (${dimensions.width} x ${dimensions.height}).`}
        >
          {(view) => <ShareResultCanvas canvasRef={canvasRef} ariaLabel={label} width={view.width} />}
        </SharePreviewStage>
      }
      actions={<ShareImageActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
