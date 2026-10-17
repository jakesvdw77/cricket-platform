import { Box, ToggleButton, Typography } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { Button } from '../Button'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { generateResultWhatsAppText, WHATSAPP_RESULT_TEMPLATES } from '../../utils/share/resultTextWhatsApp'
import type { WhatsAppTemplate } from '../../utils/share/shareChoices'
import { useShareCapability } from '../../utils/share/useShareCapability'
import { downloadFile } from '../../utils/share/downloadFile'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareTeamsControl } from './ShareTeamsControl'
import { useAttachedResultImage } from './shareImageOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { WhatsAppPhonePreview } from './WhatsAppPhonePreview'
import { useEditableShareText } from './useEditableShareText'

// docs/specs/114-share-result.md (Format screen anatomy, Text content): the WhatsApp text, built from the model, editable,
// delivered through the shared WhatsAppSendActions. With Attach the result image on, the SQUARE Club green card travels with
// the text through the share sheet; where files cannot be shared the screen says to attach the downloaded image.
export function WhatsAppShareScreen(props: ShareScreenProps) {
  const { model, choices, updateChoices, initials, shareTitle } = props
  const capability = useShareCapability()
  const options = choices.include.whatsapp
  const template = choices.templates.whatsapp
  const generated = generateResultWhatsAppText(model, { template, emoji: options.emoji })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const image = useAttachedResultImage(props, options.attachImage)

  return (
    <>
      <ShareFormatScreen
        title="WhatsApp"
        controls={
          <>
            <ShareControlGroup label="Message style">
              <CompactToggleGroup
                value={template}
                ariaLabel="Message style"
                fullWidthOnPhone
                onChange={(next: WhatsAppTemplate) => guard(() => updateChoices({ templates: { ...choices.templates, whatsapp: next } }))}
              >
                {WHATSAPP_RESULT_TEMPLATES.map((item) => (
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
              <CompactSwitch
                label="Emoji"
                checked={options.emoji}
                onChange={(next) => guard(() => updateChoices({ include: { ...choices.include, whatsapp: { ...options, emoji: next } } }))}
              />
              <CompactSwitch
                label="Attach the result image"
                checked={options.attachImage}
                onChange={(next) => updateChoices({ include: { ...choices.include, whatsapp: { ...options, attachImage: next } } })}
              />
            </ShareControlGroup>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="WhatsApp message" caption="Names you type yourself are not changed.">
            <WhatsAppPhonePreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={options.attachImage} image={image} />
          </SharePreviewStage>
        }
        actions={
          <>
            <WhatsAppSendActions text={text} file={image ?? undefined} shareTitle={shareTitle} copyLabel="Copy text" />
            {image && !capability.canShareFiles(image) && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Attach the downloaded image in WhatsApp
                </Typography>
                <Button variant="secondary" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadFile(image)} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                  Download image
                </Button>
              </Box>
            )}
          </>
        }
      />
      {confirmDialog}
    </>
  )
}
