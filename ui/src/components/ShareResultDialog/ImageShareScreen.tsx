import { useMemo } from 'react'
import { ToggleButton } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { shareFileName } from '../../utils/share/shareFileName'
import type { ImageSize, ImageTemplate } from '../../utils/share/shareChoices'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareImageActions } from './ShareImageActions'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareLogoControls } from './ShareLogoControls'
import { ShareResultCanvas } from './ShareResultCanvas'
import { useShareImageOptions } from './shareImageOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { useResultImageOutput } from './useResultImageOutput'

const TEMPLATES: { value: ImageTemplate; label: string }[] = [
  { value: 'CLUB_GREEN', label: 'Club green' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'DAYLIGHT', label: 'Daylight' },
]
const SIZES: { value: ImageSize; label: string; pixels: string }[] = [
  { value: 'SQUARE', label: 'Square 1080', pixels: '1080 x 1080' },
  { value: 'PORTRAIT', label: 'Portrait 4:5', pixels: '1080 x 1350' },
  { value: 'STORY', label: 'Story 9:16', pixels: '1080 x 1920' },
]

// docs/specs/114-share-result.md (Format screen anatomy, Image): the result card. It always shows both scores, so there is no
// Teams control. The preview is the generator's own canvas; the file is read back from it.
export function ImageShareScreen(props: ShareScreenProps) {
  const { cardModel: model, choices, updateChoices, initials, shareTitle } = props
  const include = choices.include.image
  const template = choices.templates.image
  const size = choices.imageSize
  const options = useShareImageOptions(props, {
    format: 'IMAGE',
    size,
    template,
    topPerformers: include.topPerformers,
    playerOfTheMatch: include.playerOfTheMatch,
    venueAndDate: include.venueAndDate,
  })
  const fileName = useMemo(() => shareFileName(model, 'png'), [model])
  const { canvasRef, file, error } = useResultImageOutput(model, options, fileName)
  const setInclude = (patch: Partial<typeof include>) =>
    updateChoices({
      include: { ...choices.include, image: { ...include, ...patch } },
    })
  const pixels = SIZES.find((item) => item.value === size)?.pixels

  return (
    <ShareFormatScreen
      title="Image"
      controls={
        <>
          <ShareControlGroup label="Template">
            <CompactToggleGroup
              value={template}
              ariaLabel="Template"
              fullWidthOnPhone
              onChange={(next: ImageTemplate) =>
                updateChoices({
                  templates: { ...choices.templates, image: next },
                })
              }
            >
              {TEMPLATES.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          <ShareControlGroup label="Size">
            <CompactToggleGroup
              value={size}
              ariaLabel="Size"
              fullWidthOnPhone
              onChange={(next: ImageSize) => updateChoices({ imageSize: next })}
            >
              {SIZES.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          <ShareControlGroup label="Include">
            <ShareInitialsControl initials={initials} collisions={model.initialsCollisions} onChange={initials.setValue} />
            <CompactSwitch
              label="Top performers"
              checked={include.topPerformers}
              onChange={(next) => setInclude({ topPerformers: next })}
            />
            <CompactSwitch
              label="Player of the match"
              checked={include.playerOfTheMatch}
              onChange={(next) => setInclude({ playerOfTheMatch: next })}
            />
            <CompactSwitch
              label="Venue and date line"
              checked={include.venueAndDate}
              onChange={(next) => setInclude({ venueAndDate: next })}
            />
          </ShareControlGroup>
          <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage
          ariaLabel="Image preview"
          zoomable
          baseWidth={540}
          fitMaxWidth={size === 'STORY' ? 320 : 560}
          caption={`This is the file you will share (${pixels}). Both scores always show.`}
        >
          {(view) => (
            <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`Result card: ${model.resultLine}`} width={view.width} />
          )}
        </SharePreviewStage>
      }
      actions={<ShareImageActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
