import { Typography, ToggleButton } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { Input } from '../Input'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { generateResultWhatsAppText, WHATSAPP_RESULT_TEMPLATES } from '../../utils/share/resultTextWhatsApp'
import type { WhatsAppTemplate } from '../../utils/share/shareChoices'
import { ShareControlGroup } from './ShareControlGroup'
import { ShareInitialsControl } from './ShareInitialsControl'
import { ShareTeamsControl } from './ShareTeamsControl'
import type { ShareScreenProps } from './shareScreenTypes'
import { useEditableShareText } from './useEditableShareText'

// docs/specs/114-share-result.md (Format screen anatomy, Text content): the WhatsApp text, built from the model, editable,
// delivered through the shared WhatsAppSendActions. The image is a later slice (the switch is shown, disabled).
export function WhatsAppShareScreen({ model, choices, updateChoices, initials, shareTitle }: ShareScreenProps) {
  const options = choices.include.whatsapp
  const template = choices.templates.whatsapp
  const generated = generateResultWhatsAppText(model, { template, emoji: options.emoji })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)

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
              <CompactSwitch label="Attach the result image" checked={false} disabled describedBy="share-wa-image-reason" onChange={() => {}} />
              <Typography id="share-wa-image-reason" variant="caption" color="text.secondary">
                Image comes next
              </Typography>
            </ShareControlGroup>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="WhatsApp message" caption="Names you type yourself are not changed.">
            <Input label="Message text" multiline minRows={10} maxRows={22} value={text} onChange={(event) => setText(event.target.value)} />
          </SharePreviewStage>
        }
        actions={<WhatsAppSendActions text={text} shareTitle={shareTitle} copyLabel="Copy text" />}
      />
      {confirmDialog}
    </>
  )
}
