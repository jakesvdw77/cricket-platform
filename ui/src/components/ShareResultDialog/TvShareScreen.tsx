import { useMemo } from 'react'
import { ToggleButton } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { shareFileName } from '../../utils/share/shareFileName'
import type { TvPerformers, TvTemplate } from '../../utils/share/shareChoices'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareImageActions } from './ShareImageActions'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareLogoControls } from './ShareLogoControls'
import { ShareResultCanvas } from './ShareResultCanvas'
import { useShareImageOptions } from './shareImageOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { useResultImageOutput } from './useResultImageOutput'

const TEMPLATES: { value: TvTemplate; label: string }[] = [
  { value: 'BROADCAST', label: 'Broadcast' },
  { value: 'CLUB', label: 'Club colour' },
  { value: 'LIGHT', label: 'Light' },
]

// docs/specs/114-share-result.md (Format screen anatomy, TV summary): the widescreen summary, always 1920 x 1080 and always
// both teams (so no Teams control). Same preview, delivery and logo controls as the Image screen.
export function TvShareScreen(props: ShareScreenProps) {
  const { cardModel: model, choices, updateChoices, initials, shareTitle } = props
  const include = choices.include.tv
  const template = choices.templates.tv
  const options = useShareImageOptions(props, {
    format: 'TV',
    template,
    performers: choices.tvPerformers,
    batters: include.batters,
    bowlers: include.bowlers,
    playerOfTheMatch: include.playerOfTheMatchBar,
  })
  const fileName = useMemo(() => shareFileName(model, 'png'), [model])
  const { canvasRef, file, error } = useResultImageOutput(model, options, fileName)
  const setInclude = (patch: Partial<typeof include>) =>
    updateChoices({
      include: { ...choices.include, tv: { ...include, ...patch } },
    })

  return (
    <ShareFormatScreen
      title="TV summary"
      controls={
        <>
          <ShareControlGroup label="Template">
            <CompactToggleGroup
              value={template}
              ariaLabel="Template"
              fullWidthOnPhone
              onChange={(next: TvTemplate) => updateChoices({ templates: { ...choices.templates, tv: next } })}
            >
              {TEMPLATES.map((item) => (
                <ToggleButton key={item.value} value={item.value}>
                  {item.label}
                </ToggleButton>
              ))}
            </CompactToggleGroup>
          </ShareControlGroup>
          <ShareControlGroup label="Performers per innings">
            <CompactToggleGroup
              value={String(choices.tvPerformers)}
              ariaLabel="Performers per innings"
              fullWidthOnPhone
              onChange={(next: string) =>
                updateChoices({
                  tvPerformers: (next === '2' ? 2 : 3) as TvPerformers,
                })
              }
            >
              <ToggleButton value="2">Top 2</ToggleButton>
              <ToggleButton value="3">Top 3</ToggleButton>
            </CompactToggleGroup>
          </ShareControlGroup>
          <ShareControlGroup label="Include">
            <ShareInitialsControl initials={initials} collisions={model.initialsCollisions} onChange={initials.setValue} />
            <CompactSwitch label="Batters" checked={include.batters} onChange={(next) => setInclude({ batters: next })} />
            <CompactSwitch label="Bowlers" checked={include.bowlers} onChange={(next) => setInclude({ bowlers: next })} />
            <CompactSwitch
              label="Player of the match bar"
              checked={include.playerOfTheMatchBar}
              onChange={(next) => setInclude({ playerOfTheMatchBar: next })}
            />
          </ShareControlGroup>
          <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage
          ariaLabel="TV summary preview"
          zoomable
          baseWidth={960}
          fitMaxWidth={720}
          caption="This is the file you will share (1920 x 1080). Both scores always show."
        >
          {(view) => (
            <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`Match summary: ${model.resultLine}`} width={view.width} />
          )}
        </SharePreviewStage>
      }
      actions={<ShareImageActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
