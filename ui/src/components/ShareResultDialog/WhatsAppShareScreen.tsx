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
import { useCopyImage } from '../../hooks/useCopyImage'
import { downloadFile } from '../../utils/share/downloadFile'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareTeamsControl } from './ShareTeamsControl'
import { useAttachedResultImage } from './shareImageOptions'
import type { ShareScreenProps } from './shareScreenTypes'
import { ResultImageCard } from './ResultImageCard'
import { useCanShareImageWithText } from './useCanShareImageWithText'
import { WhatsAppPhonePreview } from './WhatsAppPhonePreview'
import { useEditableShareText } from './useEditableShareText'

// docs/specs/114-share-result.md (Format screen anatomy, Text content): the WhatsApp text, built from the model, editable,
// delivered through the shared WhatsAppSendActions. A WhatsApp link carries text only: only where the share sheet can send the
// PNG file (canShareImageWithText) is there an Attach switch and an image in the bubble. Elsewhere the image is a separate card
// with Copy image and Download image, to paste into the chat.
export function WhatsAppShareScreen(props: ShareScreenProps) {
  const { model, choices, updateChoices, initials, shareTitle } = props
  const options = choices.include.whatsapp
  const template = choices.templates.whatsapp
  const generated = generateResultWhatsAppText(model, { template, emoji: options.emoji })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const image = useAttachedResultImage(props, true)
  const canShareImageWithText = useCanShareImageWithText(image)
  const showImageInBubble = canShareImageWithText && options.attachImage
  const copyImage = useCopyImage()

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
              {canShareImageWithText && (
                <CompactSwitch
                  label="Attach the result image"
                  checked={options.attachImage}
                  onChange={(next) => updateChoices({ include: { ...choices.include, whatsapp: { ...options, attachImage: next } } })}
                />
              )}
            </ShareControlGroup>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="WhatsApp message" caption="Names you type yourself are not changed.">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', gap: 1.5 }}>
              <WhatsAppPhonePreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={showImageInBubble} image={image} />
              {!canShareImageWithText && (
                <ResultImageCard
                  file={image}
                  title="Result image"
                  caption="Paste or attach this image in the chat. WhatsApp links carry text only."
                  alt="Result image to paste or attach"
                />
              )}
            </Box>
          </SharePreviewStage>
        }
        actions={
          <>
            <WhatsAppSendActions
              text={text}
              file={showImageInBubble ? (image ?? undefined) : undefined}
              shareTitle={shareTitle}
              copyLabel="Copy text"
              extraStatus={copyImage.message}
              extraActions={
                !canShareImageWithText && (
                  <>
                    {copyImage.canCopyImage && (
                      <Button
                        variant="secondary"
                        startIcon={<ContentCopyOutlinedIcon />}
                        disabled={!image}
                        onClick={() => void copyImage.copyImage(image)}
                        sx={{ minHeight: { xs: 44, sm: 'auto' } }}
                      >
                        Copy image
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      startIcon={<FileDownloadOutlinedIcon />}
                      disabled={!image}
                      onClick={() => image && downloadFile(image)}
                      sx={{ minHeight: { xs: 44, sm: 'auto' } }}
                    >
                      Download image
                    </Button>
                  </>
                )
              }
            />
            {!canShareImageWithText && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                WhatsApp links carry text only. On a computer, paste the copied image into the chat before you send.
              </Typography>
            )}
          </>
        }
      />
      {confirmDialog}
    </>
  )
}
