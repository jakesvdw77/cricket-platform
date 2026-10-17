import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { Input } from '../Input'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { generateResultFacebookText, FACEBOOK_RESULT_TEMPLATES } from '../../utils/share/resultTextFacebook'
import { MAX_SHARE_SPONSORS } from '../../utils/share/logoLayout'
import type { FacebookTemplate } from '../../utils/share/shareChoices'
import { downloadFile } from '../../utils/share/downloadFile'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareSponsorChooser } from './ShareSponsorChooser'
import { ShareTeamsControl } from './ShareTeamsControl'
import { useAttachedResultImage } from './shareImageOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { useEditableShareText } from './useEditableShareText'

// docs/specs/114-share-result.md (Format screen anatomy, Text content): the Facebook post text, built from the model and
// editable. A web page cannot post to Facebook, so the screen says so and offers Copy text and Download image.
export function FacebookShareScreen(props: ShareScreenProps) {
  const { model, choices, updateChoices, initials, sponsors, selectedSponsorIds } = props
  const options = choices.include.facebook
  const template = choices.templates.facebook
  const sponsorNames = options.mentionSponsor
    ? selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.name).filter((name): name is string => Boolean(name))
    : []
  const generated = generateResultFacebookText(model, { template, hashtags: options.hashtags, sponsorNames })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const { copy, copiedKey, failed } = useCopyToClipboard()
  const image = useAttachedResultImage(props, options.attachImage)
  const setInclude = (patch: Partial<typeof options>) =>
    guard(() => updateChoices({ include: { ...choices.include, facebook: { ...options, ...patch } } }))

  return (
    <>
      <ShareFormatScreen
        title="Facebook"
        controls={
          <>
            <ShareControlGroup label="Tone">
              <CompactToggleGroup
                value={template}
                ariaLabel="Tone"
                fullWidthOnPhone
                onChange={(next: FacebookTemplate) => guard(() => updateChoices({ templates: { ...choices.templates, facebook: next } }))}
              >
                {FACEBOOK_RESULT_TEMPLATES.map((item) => (
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
                onChange={(next) => guard(() => updateChoices({ teams: next }))}
              />
            </ShareControlGroup>
            <ShareControlGroup label="Include">
              <ShareInitialsControl initials={initials} collisions={model.initialsCollisions} onChange={(next) => guard(() => initials.setValue(next))} />
              <CompactSwitch label="Hashtags" checked={options.hashtags} onChange={(next) => setInclude({ hashtags: next })} />
              <CompactSwitch label="Mention the sponsor" checked={options.mentionSponsor} onChange={(next) => setInclude({ mentionSponsor: next })} />
              {options.mentionSponsor && (
                <ShareSponsorChooser
                  sponsors={sponsors}
                  selectedIds={selectedSponsorIds}
                  max={MAX_SHARE_SPONSORS}
                  onChange={(ids) => guard(() => updateChoices({ sponsorIds: ids }))}
                />
              )}
              <CompactSwitch
                label="Attach the result image"
                checked={options.attachImage}
                onChange={(next) => updateChoices({ include: { ...choices.include, facebook: { ...options, attachImage: next } } })}
              />
            </ShareControlGroup>
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              A web page cannot post to Facebook for you. Copy the text, then paste it into your page.
            </Alert>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="Facebook post" caption="Names you type yourself are not changed.">
            <Input label="Post text" multiline minRows={10} maxRows={22} value={text} onChange={(event) => setText(event.target.value)} />
          </SharePreviewStage>
        }
        actions={
          <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copy(text, 'message')} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                {copiedKey === 'message' ? 'Copied' : 'Copy text'}
              </Button>
              {image && (
                <Button variant="secondary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadFile(image)} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                  Download image
                </Button>
              )}
            </Box>
            <Typography variant="caption" color={failed ? 'error.main' : 'text.secondary'} role="status" aria-live="polite" sx={{ display: 'block', mt: 0.5 }}>
              {copiedKey === 'message' && 'Text copied.'}
              {failed && "Couldn't copy automatically - select the text and copy it manually."}
            </Typography>
          </Box>
        }
      />
      {confirmDialog}
    </>
  )
}
