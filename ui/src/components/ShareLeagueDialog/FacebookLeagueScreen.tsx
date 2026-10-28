import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareControlGroup, useEditableShareText } from '../ShareCore'
import { FacebookPostPreview } from '../ShareResultDialog/FacebookPostPreview'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import type { LeagueFacebookTemplate } from '../../utils/share/leagueShareFormats'
import { FACEBOOK_LEAGUE_TEMPLATES, generateLeagueFacebookText } from '../../utils/share/leagueTextFacebook'
import { LeagueContentControls } from './LeagueContentControls'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'

// docs/specs/122-league-sharing.md (Format screens, Facebook): the post text, built from the model and editable. A web page
// cannot post to Facebook, so the screen says so and offers Copy text.
export function FacebookLeagueScreen(props: LeagueScreenProps) {
  const { model, choices, updateChoices, ticked } = props
  const template = choices.league.templates.facebook
  const { hashtags } = choices.league.include.facebook
  const generated = generateLeagueFacebookText(model, { template, hashtags, resultLine: choices.league.include.results.resultLine })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const { copy, copiedKey, failed } = useCopyToClipboard()

  return (
    <>
      <ShareFormatScreen
        title="Facebook"
        controls={
          <>
            <LeagueLeftOutNote format="FACEBOOK" ticked={ticked} />
            <ShareControlGroup label="Tone">
              <CompactToggleGroup
                value={template}
                ariaLabel="Tone"
                fullWidthOnPhone
                onChange={(next: LeagueFacebookTemplate) => guard(() => updateChoices({ league: { templates: { facebook: next } } }))}
              >
                {FACEBOOK_LEAGUE_TEMPLATES.map((item) => (
                  <ToggleButton key={item.value} value={item.value}>
                    {item.label}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </ShareControlGroup>
            <LeagueContentControls {...props} guard={guard}>
              <CompactSwitch label="Hashtags" checked={hashtags} onChange={(next) => guard(() => updateChoices({ league: { include: { facebook: { hashtags: next } } } }))} />
            </LeagueContentControls>
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
              {copiedKey === 'message' ? 'Copied' : 'Copy text'}
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
