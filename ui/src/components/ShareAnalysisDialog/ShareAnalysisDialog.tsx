import { useMemo, useState } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FacebookIcon from '@mui/icons-material/Facebook'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { useQuery } from '@tanstack/react-query'
import { listSections } from '../../api/sectionApi'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useShareChoices } from '../../hooks/useShareChoices'
import { useShareSettings } from '../../hooks/useShareSettings'
import { isJuniorMatch } from '../../utils/share/isJuniorMatch'
import { analysisFileName, generateAnalysisFacebookText, generateAnalysisPdf, generateAnalysisWhatsAppText } from '../../utils/share/analysisShare'
import type { AnalysisShareMeta } from '../../utils/share/analysisShare'
import { shareName } from '../../utils/share/shareName'
import { BATTING_POSITION_LABEL } from '../../utils/playerLabels'
import { analyseSquad, BATTING_POSITIONS, FULL_SIDE } from '../../utils/squadAnalysis'
import type { AnalysisPlayer } from '../../utils/squadAnalysis'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { ShareControlGroup, ShareInitialsControl, resolveShareInitials } from '../ShareCore'
import { ShareFillContext, ShareFooterContext, ShareFormatScreen } from '../ShareFormatScreen'
import { SharePdfActions } from '../ShareCore'
import { SharePreviewStage } from '../SharePreviewStage'
import { TileChoiceGroup } from '../TileChoiceGroup'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { FacebookPostPreview } from '../ShareResultDialog/FacebookPostPreview'
import { WhatsAppPhonePreview } from '../ShareResultDialog/WhatsAppPhonePreview'
import { useEditableShareText } from '../ShareCore'

type AnalysisFormat = 'WHATSAPP' | 'FACEBOOK' | 'PDF'

const FORMATS: { value: AnalysisFormat; label: string; subtitle: string; icon: JSX.Element }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp', subtitle: 'Message text to edit and send', icon: <WhatsAppIcon /> },
  { value: 'FACEBOOK', label: 'Facebook', subtitle: 'Post text to copy', icon: <FacebookIcon /> },
  { value: 'PDF', label: 'PDF', subtitle: 'A4 document to print or send', icon: <PictureAsPdfOutlinedIcon /> },
]

export interface ShareAnalysisDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  teamName: string
  // The team's own section, to tell a junior side (whose players are shared as initials) from an adult one.
  sectionId: string | null
  seasonLabel: string | null
  clubName: string | null
  players: AnalysisPlayer[]
}

// docs/specs/151, slice B (sharing): the same share journey as the other pages (format tiles, then the format's screen on the shared
// shell) for the squad analysis. WhatsApp and Facebook texts and an A4 PDF. Junior sides are always shared with first names as initials
// (docs/specs/114); nothing is posted anywhere from here.
export function ShareAnalysisDialog({ open, onClose, clubId, teamName, sectionId, seasonLabel, clubName, players }: ShareAnalysisDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [picked, setPicked] = useState<AnalysisFormat | null>(null)
  const [highlighted, setHighlighted] = useState<AnalysisFormat | null>(null)
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const [choices, updateChoices] = useShareChoices(clubId)
  const settings = useShareSettings(clubId, open)
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId), enabled: open && Boolean(clubId) })

  // Not knowing the sections fails safe to junior, so names are initials until the answer is in.
  const junior = useMemo(() => isJuniorMatch({ league: null, sections: sections.data, teams: [{ sectionId }] }), [sections.data, sectionId])
  const initials = resolveShareInitials({
    choices,
    updateChoices,
    junior,
    settings: settings.settings,
    setClubDefault: settings.setInitialsOnlyDefault,
    clubDefaultSaving: settings.isSaving,
    clubDefaultFailed: settings.saveFailed,
  })

  const analysis = useMemo(
    () => analyseSquad(players, new Date(), (player) => shareName(player, initials.value)),
    [players, initials.value],
  )
  // Two different players who show as the same shortened name ("M. Naidoo").
  const collisions = useMemo(() => {
    if (!initials.value) return []
    const counts = new Map<string, number>()
    players.forEach((player) => {
      const name = shareName(player, true)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    })
    return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
  }, [players, initials.value])

  const meta: AnalysisShareMeta = { teamName, seasonLabel, clubName }
  const reset = () => {
    setPicked(null)
    setHighlighted(null)
  }
  const close = () => {
    reset()
    onClose()
  }
  const fill = !phone && picked !== null

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={phone}
      fullWidth
      maxWidth={false}
      aria-labelledby="share-analysis-title"
      PaperProps={{
        sx: picked
          ? { width: { sm: '96vw' }, maxWidth: { sm: '96vw' }, height: { sm: '96vh' }, maxHeight: { sm: '96vh' } }
          : { width: { sm: '100%' }, maxWidth: { sm: 720 }, height: { sm: 'auto' }, maxHeight: { sm: '90vh' } },
      }}
    >
      <DialogTitle id="share-analysis-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">Share Squad Analysis</Box>
        <IconButton aria-label="Close" onClick={close} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden', overflowY: fill ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!picked && (
          <Box>
            <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
              Format for {teamName} analysis
            </Typography>
            <TileChoiceGroup<AnalysisFormat>
              label="Share format"
              value={highlighted}
              onChange={setHighlighted}
              columns={{ xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }}
              tileSx={{ minHeight: 96, py: 1.5, alignItems: 'center', justifyContent: 'center' }}
              options={FORMATS.map((format) => ({
                value: format.value,
                content: (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center' }}>
                    <Box sx={{ color: 'primary.main', display: 'flex', '& svg': { fontSize: 28 } }}>{format.icon}</Box>
                    <Typography sx={{ fontWeight: 700 }}>{format.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                      {format.subtitle}
                    </Typography>
                  </Box>
                ),
              }))}
            />
          </Box>
        )}

        {picked && (
          <ShareFooterContext.Provider value={footer}>
            <ShareFillContext.Provider value={fill}>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: fill ? 1 : '0 0 auto', minHeight: 0, minWidth: 0 }}>
                <Button size="compact" variant="ghost" startIcon={<ArrowBackIcon fontSize="small" />} onClick={reset} sx={{ ml: -1, mb: 1, color: 'text.secondary', alignSelf: 'flex-start', flexShrink: 0 }}>
                  Back
                </Button>
                {picked === 'PDF' ? (
                  <AnalysisPdfScreen analysis={analysis} meta={meta} initials={initials} collisions={collisions} />
                ) : (
                  <AnalysisTextScreen format={picked} analysis={analysis} meta={meta} initials={initials} collisions={collisions} />
                )}
              </Box>
            </ShareFillContext.Provider>
          </ShareFooterContext.Provider>
        )}
      </DialogContent>

      <DialogActions sx={{ display: 'flex', flexWrap: picked ? 'nowrap' : 'wrap', alignItems: 'center', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        {picked ? (
          <>
            <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0, flex: 1 }} />
            <Button size="compact" variant="secondary" onClick={close} sx={{ flexShrink: 0 }}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" role="status" sx={{ mr: 'auto', color: 'text.secondary' }}>
              {highlighted ? '' : 'Choose a format'}
            </Typography>
            <Button size="compact" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button size="compact" disabled={!highlighted} onClick={() => setPicked(highlighted)}>
              Next
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

interface ScreenProps {
  analysis: ReturnType<typeof analyseSquad>
  meta: AnalysisShareMeta
  initials: ReturnType<typeof resolveShareInitials>
  collisions: string[]
}

function AnalysisTextScreen({ format, analysis, meta, initials, collisions }: ScreenProps & { format: 'WHATSAPP' | 'FACEBOOK' }) {
  const [emoji, setEmoji] = useState(true)
  const generated =
    format === 'WHATSAPP' ? generateAnalysisWhatsAppText(analysis, meta, { emoji }) : generateAnalysisFacebookText(analysis, meta, { emoji })
  const { text, setText, guard, confirmDialog } = useEditableShareText(generated)
  const { copy, copiedKey, failed } = useCopyToClipboard()
  const controls = (
    <ShareControlGroup label="Include">
      <ShareInitialsControl initials={initials} collisions={collisions} onChange={(next) => guard(() => initials.setValue(next))} guard={guard} />
      <CompactSwitch label="Emoji" checked={emoji} onChange={(next) => guard(() => setEmoji(next))} />
    </ShareControlGroup>
  )
  return (
    <>
      <ShareFormatScreen
        title={format === 'WHATSAPP' ? 'WhatsApp' : 'Facebook'}
        controls={
          <>
            {controls}
            {format === 'FACEBOOK' && (
              <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
                A web page cannot post to Facebook for you. Copy the text, then paste it into your page.
              </Alert>
            )}
          </>
        }
        preview={
          <SharePreviewStage ariaLabel={format === 'WHATSAPP' ? 'WhatsApp message' : 'Facebook post'} caption="Names you type yourself are not changed.">
            {format === 'WHATSAPP' ? (
              <WhatsAppPhonePreview clubName={meta.clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
            ) : (
              <FacebookPostPreview clubName={meta.clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
            )}
          </SharePreviewStage>
        }
        actions={
          format === 'WHATSAPP' ? (
            <WhatsAppSendActions text={text} shareTitle={`${meta.teamName} squad analysis`} copyLabel="Copy Text" />
          ) : (
            <Box>
              <Button size="compact" startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copy(text, 'message')}>
                {copiedKey === 'message' ? 'Copied' : 'Copy Text'}
              </Button>
              <Typography variant="caption" color={failed ? 'error.main' : 'text.secondary'} role="status" aria-live="polite" sx={{ display: 'block', mt: 0.5 }}>
                {copiedKey === 'message' && 'Text copied.'}
                {failed && "Couldn't copy automatically - select the text and copy it manually."}
              </Typography>
            </Box>
          )
        }
      />
      {confirmDialog}
    </>
  )
}

function AnalysisPdfScreen({ analysis, meta, initials, collisions }: ScreenProps) {
  const result = useMemo(() => {
    try {
      return { file: generateAnalysisPdf(analysis, meta), error: null as string | null }
    } catch {
      return { file: null, error: 'The PDF could not be created. Try again.' }
    }
  }, [analysis, meta])
  return (
    <ShareFormatScreen
      title="PDF"
      controls={
        <ShareControlGroup label="Include">
          <ShareInitialsControl initials={initials} collisions={collisions} onChange={(next) => initials.setValue(next)} />
        </ShareControlGroup>
      }
      preview={
        <Box sx={{ minHeight: 0, overflow: 'auto' }}>
          <AnalysisPaperPreview analysis={analysis} meta={meta} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }} data-testid="analysis-pdf-ready">
            {result.file ? `${analysisFileName(meta, 'pdf')}. This preview shows what the PDF holds.` : 'The PDF could not be created.'}
          </Typography>
        </Box>
      }
      actions={<SharePdfActions file={result.file} shareTitle={`${meta.teamName} squad analysis`} error={result.error} />}
    />
  )
}

// A paper-style preview of the PDF's content: the same blocks in the same order, built from the same analysis, so what is read here is
// what the PDF says. (A page image is not drawn, so the preview works on every browser and phone.)
function AnalysisPaperPreview({ analysis, meta }: { analysis: ScreenProps['analysis']; meta: AnalysisShareMeta }) {
  const warnings = analysis.gaps.filter((gap) => gap.tone === 'warning')
  const heading = (text: string) => (
    <Typography sx={{ fontWeight: 700, color: 'primary.dark', mt: 2, mb: 0.5, fontSize: '0.95rem' }}>{text}</Typography>
  )
  const names = (list: string[]) => (list.length > 0 ? list.join(', ') : 'None')
  const figures: [string, number][] = [
    ['Batters', analysis.batters.length],
    ['Main bowlers', analysis.mainBowlers.length],
    ['Part-time', analysis.partTimeBowlers.length],
    ['All-rounders', analysis.allRounders.length],
    ['Keepers', analysis.keepers.length],
  ]
  const { experience } = analysis
  return (
    <Box
      data-testid="analysis-paper"
      sx={{ bgcolor: '#fff', color: '#10231a', border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 2, p: { xs: 2, sm: 3 }, width: '100%', maxWidth: 794, mx: 'auto', fontSize: '0.8125rem' }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', color: 'primary.dark', lineHeight: 1.2 }}>{meta.teamName}</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
        {[meta.seasonLabel, meta.clubName, `${analysis.size} players`].filter(Boolean).join('  |  ')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 1, mt: 1.5 }}>
        {figures.map(([label, value]) => (
          <Box key={label} sx={{ border: 1, borderColor: 'divider', borderRadius: 0.5, p: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: 'primary.dark', lineHeight: 1 }}>{value}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {warnings.length > 0 && (
        <>
          {heading('Things to check')}
          {warnings.map((gap) => (
            <Typography key={gap.id} sx={{ fontSize: '0.8125rem', ml: 1 }}>
              - {gap.text}
            </Typography>
          ))}
        </>
      )}

      {heading('Batting order')}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        {BATTING_POSITIONS.map((position) => (
          <Box key={position}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: 'primary.dark' }}>
              {BATTING_POSITION_LABEL[position]} ({analysis.battingOrder[position].length})
            </Typography>
            {analysis.battingOrder[position].length === 0 ? (
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Nobody</Typography>
            ) : (
              analysis.battingOrder[position].map((name) => (
                <Typography key={name} sx={{ fontSize: '0.8125rem' }}>
                  {name}
                </Typography>
              ))
            )}
          </Box>
        ))}
      </Box>
      {analysis.battingNotSet.length > 0 && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Not set: {analysis.battingNotSet.join(', ')}</Typography>}

      {heading('Bowling')}
      <Typography>Pace: {names(analysis.bowling.pace)}</Typography>
      <Typography>Medium: {names(analysis.bowling.medium)}</Typography>
      <Typography>Spin: {names(analysis.bowling.spin)}</Typography>
      <Typography>Part-time: {names(analysis.bowling.partTime)}</Typography>

      {heading('Hands')}
      <Typography>
        Batters: {analysis.hands.rightBat} right-hand, {analysis.hands.leftBat} left-hand. Bowlers: {analysis.hands.rightArm} right-arm, {analysis.hands.leftArm} left-arm.
      </Typography>

      {heading('Experience')}
      <Typography>
        {experience.averageAge === null ? '' : `Average age ${experience.averageAge}, youngest ${experience.youngest}, oldest ${experience.oldest}. `}
        Squad size {analysis.size} of {FULL_SIDE} needed.
      </Typography>
    </Box>
  )
}
