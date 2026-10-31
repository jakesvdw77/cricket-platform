import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { ShareControlGroup, useEditableShareText } from '../ShareCore'
import { FacebookPostPreview } from '../ShareResultDialog/FacebookPostPreview'
import { WhatsAppPhonePreview } from '../ShareResultDialog/WhatsAppPhonePreview'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { FACEBOOK_MATCH_TEMPLATES, generateMatchFacebookText, generateMatchWhatsAppText, WHATSAPP_MATCH_TEMPLATES } from '../../utils/share/matchText'
import type { MatchFacebookTemplate, MatchWhatsAppTemplate } from '../../utils/share/matchShareFormats'
import { MatchContentControls } from './MatchContentControls'
import type { MatchScreenProps } from './matchScreenTypes'

// docs/specs/131 (Format screens, WhatsApp): the message, editable and delivered through the shared WhatsAppSendActions.
export function MatchWhatsAppScreen(props: MatchScreenProps) {
  const { model, choices, updateChoices, shareTitle } = props
  const template = choices.match.templates.whatsapp
  const { emoji, weather } = choices.match.include
  const generated = generateMatchWhatsAppText(model, template, { emoji, weather: weather && model.weather !== null })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  return (
    <>
      <ShareFormatScreen
        title="WhatsApp"
        controls={
          <>
            <ShareControlGroup label="Message style">
              <CompactToggleGroup value={template} ariaLabel="Message style" fullWidthOnPhone onChange={(next: MatchWhatsAppTemplate) => guard(() => updateChoices({ match: { templates: { whatsapp: next } } }))}>
                {WHATSAPP_MATCH_TEMPLATES.map((item) => (
                  <ToggleButton key={item.value} value={item.value}>
                    {item.label}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </ShareControlGroup>
            <MatchContentControls {...props} guard={guard} showFacts={template === 'WITH_FACTS'} weatherOn={weather} onWeatherChange={(next) => updateChoices({ match: { include: { weather: next } } })}>
              <CompactSwitch label="Emoji" checked={emoji} onChange={(next) => guard(() => updateChoices({ match: { include: { emoji: next } } }))} />
            </MatchContentControls>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="WhatsApp message" caption="Names you type yourself are not changed.">
            <WhatsAppPhonePreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
          </SharePreviewStage>
        }
        actions={<WhatsAppSendActions text={text} shareTitle={shareTitle} copyLabel="Copy Text" />}
      />
      {confirmDialog}
    </>
  )
}

// docs/specs/131 (Format screens, Facebook): the post text, editable. A web page cannot post to Facebook, so it offers Copy Text.
export function MatchFacebookScreen(props: MatchScreenProps) {
  const { model, choices, updateChoices, sponsorName } = props
  const template = choices.match.templates.facebook
  const { emoji, weather, hashtags } = choices.match.include
  const generated = generateMatchFacebookText(model, template, { emoji, weather: weather && model.weather !== null, hashtags, mentionSponsor: sponsorName })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const { copy, copiedKey, failed } = useCopyToClipboard()
  return (
    <>
      <ShareFormatScreen
        title="Facebook"
        controls={
          <>
            <ShareControlGroup label="Tone">
              <CompactToggleGroup value={template} ariaLabel="Tone" fullWidthOnPhone onChange={(next: MatchFacebookTemplate) => guard(() => updateChoices({ match: { templates: { facebook: next } } }))}>
                {FACEBOOK_MATCH_TEMPLATES.map((item) => (
                  <ToggleButton key={item.value} value={item.value}>
                    {item.label}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </ShareControlGroup>
            <MatchContentControls {...props} guard={guard} showFacts={template === 'ANNOUNCEMENT'} weatherOn={weather} onWeatherChange={(next) => updateChoices({ match: { include: { weather: next } } })}>
              <CompactSwitch label="Emoji" checked={emoji} onChange={(next) => guard(() => updateChoices({ match: { include: { emoji: next } } }))} />
              <CompactSwitch label="Hashtags" checked={hashtags} onChange={(next) => guard(() => updateChoices({ match: { include: { hashtags: next } } }))} />
              {sponsorName && <Typography variant="caption" color="text.secondary">The first chosen sponsor, {sponsorName}, is mentioned.</Typography>}
            </MatchContentControls>
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              A web page cannot post to Facebook for you. Copy the text, then paste it into your page.
            </Alert>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="Facebook post" caption="Names you type yourself are not changed.">
            <FacebookPostPreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
          </SharePreviewStage>
        }
        actions={
          <Box>
            <Button size="compact" startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copy(text, 'message')}>
              {copiedKey === 'message' ? 'Copied' : 'Copy Text'}
            </Button>
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
