import { Alert, Box, ToggleButton, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { useCopyImage } from '../../hooks/useCopyImage'
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
import { ResultImageCard } from './ResultImageCard'
import { useCanShareImageWithText } from './useCanShareImageWithText'
import { FacebookPostPreview } from './FacebookPostPreview'
import { useEditableShareText } from './useEditableShareText'

// docs/specs/114-share-result.md (Format screen anatomy, Text content): the Facebook post text, built from the model and
// editable. A web page cannot post to Facebook and a link carries no image, so the screen says so, offers Copy text, Copy image
// and Download image, and shows the image inside the post only where the phone share sheet can send it with the text.
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
  const image = useAttachedResultImage(props, true)
  const canShareImageWithText = useCanShareImageWithText(image)
  const showImageInPost = canShareImageWithText && options.attachImage
  const copyImage = useCopyImage()
  const setInclude = (patch: Partial<typeof options>) =>
    guard(() => updateChoices({ include: { facebook: patch } }))

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
                onChange={(next: FacebookTemplate) => guard(() => updateChoices({ templates: { facebook: next } }))}
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
              <ShareInitialsControl initials={initials} collisions={model.initialsCollisions} onChange={(next) => guard(() => initials.setValue(next))} guard={guard} />
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
              {canShareImageWithText && (
                <CompactSwitch
                  label="Attach the result image"
                  checked={options.attachImage}
                  onChange={(next) => updateChoices({ include: { facebook: { attachImage: next } } })}
                />
              )}
            </ShareControlGroup>
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              A web page cannot post to Facebook for you. Copy the text, then paste it into your page.
            </Alert>
          </>
        }
        preview={
          <SharePreviewStage ariaLabel="Facebook post" caption="Names you type yourself are not changed.">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', gap: 1.5 }}>
              <FacebookPostPreview clubName={model.clubName} text={text} onTextChange={setText} attachImage={showImageInPost} image={image} />
              {!showImageInPost && (
                <ResultImageCard
                  file={image}
                  title="Image to upload"
                  caption="Upload this image with your post. Facebook links carry text only."
                  alt="Result image to upload"
                />
              )}
            </Box>
          </SharePreviewStage>
        }
        actions={
          <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copy(text, 'message')} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                {copiedKey === 'message' ? 'Copied' : 'Copy text'}
              </Button>
              {copyImage.canCopyImage && (
                <Button variant="secondary" startIcon={<ContentCopyOutlinedIcon />} disabled={!image} onClick={() => void copyImage.copyImage(image)} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                  Copy image
                </Button>
              )}
              <Button variant="secondary" startIcon={<FileDownloadOutlinedIcon />} disabled={!image} onClick={() => image && downloadFile(image)} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
                Download image
              </Button>
            </Box>
            <Typography variant="caption" color={failed ? 'error.main' : 'text.secondary'} role="status" aria-live="polite" sx={{ display: 'block', mt: 0.5 }}>
              {copiedKey === 'message' && 'Text copied.'}
              {failed && "Couldn't copy automatically - select the text and copy it manually."}
              {copyImage.message}
            </Typography>
          </Box>
        }
      />
      {confirmDialog}
    </>
  )
}
