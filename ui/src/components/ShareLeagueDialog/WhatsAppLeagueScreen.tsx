import { ToggleButton } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { ShareControlGroup, useEditableShareText } from '../ShareCore'
import { WhatsAppPhonePreview } from '../ShareResultDialog/WhatsAppPhonePreview'
import type { LeagueWhatsAppTemplate } from '../../utils/share/leagueShareFormats'
import { generateLeagueWhatsAppText, WHATSAPP_LEAGUE_TEMPLATES } from '../../utils/share/leagueTextWhatsApp'
import { LeagueContentControls } from './LeagueContentControls'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'

// docs/specs/122-league-sharing.md (Format screens, WhatsApp): the league message, one section per ticked content, editable
// and delivered through the shared WhatsAppSendActions. Text only: a WhatsApp link carries no image.
export function WhatsAppLeagueScreen(props: LeagueScreenProps) {
  const { model, choices, updateChoices, shareTitle, ticked } = props
  const template = choices.league.templates.whatsapp
  const { emoji } = choices.league.include.whatsapp
  const generated = generateLeagueWhatsAppText(model, { template, emoji, resultLine: choices.league.include.results.resultLine })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)

  return (
    <>
      <ShareFormatScreen
        title="WhatsApp"
        controls={
          <>
            <LeagueLeftOutNote format="WHATSAPP" ticked={ticked} />
            <ShareControlGroup label="Message style">
              <CompactToggleGroup
                value={template}
                ariaLabel="Message style"
                fullWidthOnPhone
                onChange={(next: LeagueWhatsAppTemplate) => guard(() => updateChoices({ league: { templates: { whatsapp: next } } }))}
              >
                {WHATSAPP_LEAGUE_TEMPLATES.map((item) => (
                  <ToggleButton key={item.value} value={item.value}>
                    {item.label}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </ShareControlGroup>
            <LeagueContentControls {...props} guard={guard}>
              <CompactSwitch label="Emoji" checked={emoji} onChange={(next) => guard(() => updateChoices({ league: { include: { whatsapp: { emoji: next } } } }))} />
            </LeagueContentControls>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="WhatsApp message" caption="Names you type yourself are not changed.">
            <WhatsAppPhonePreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
          </SharePreviewStage>
        }
        actions={<WhatsAppSendActions text={text} shareTitle={shareTitle} copyLabel="Copy text" />}
      />
      {confirmDialog}
    </>
  )
}
