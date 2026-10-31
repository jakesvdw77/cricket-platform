import { useEffect, useMemo, useState } from 'react'
import { Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import { useMatchFieldWeather } from '../../hooks/useMatchWeather'
import { useShareChoices } from '../../hooks/useShareChoices'
import { useShareMatchData } from '../../hooks/useShareMatchData'
import { useShareSettings } from '../../hooks/useShareSettings'
import { MAX_PRETICKED_FACTS } from '../../utils/share/matchFunFacts'
import { contentGap, MATCH_CONTENTS, matchFormatAvailability, sideGap } from '../../utils/share/matchShareFormats'
import type { MatchContent, MatchLayout, MatchSideChoice } from '../../utils/share/matchShareFormats'
import { MAX_SHARE_SPONSORS } from '../../utils/share/logoLayout'
import type { ShareFormat } from '../../utils/share/shareChoices'
import { buildMatchShareModel, sideRoles } from '../../utils/share/shareMatchData'
import type { TeamSheetSide } from '../../utils/teamSheetSide'
import { daysUntil } from '../../utils/weather/forecastWindow'
import { Button } from '../Button'
import { resolveShareInitials } from '../ShareCore'
import { ShareFillContext, ShareFooterContext } from '../ShareFormatScreen'
import { MatchContentStep } from './MatchContentStep'
import { MatchFormatStep } from './MatchFormatStep'
import { MatchImageScreen } from './MatchImageScreen'
import { MatchPdfScreen } from './MatchPdfScreen'
import { MatchFacebookScreen, MatchWhatsAppScreen } from './MatchTextScreens'
import type { MatchScreenProps } from './matchScreenTypes'
import { useMatchPicture } from './useMatchPicture'

export interface ShareMatchDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  // Home first, then away (the shape useTeamSheetShare assembles).
  sides: [TeamSheetSide, TeamSheetSide]
  // True while the host's sides and squads are being read.
  sidesLoading: boolean
  leagueName: string | null
  seasonLabel: string | null
  // What the entry point preselects: a content and a side (the Team Sheet button of a team panel).
  initialContent?: MatchContent
  // The home or away team a team panel is about; becomes Our Side or Opposition once the sides are known.
  initialScope?: 'home' | 'away'
}

type Step = 'contents' | 'formats' | 'screen'
const STEPS = ['What To Share', 'Format', 'Preview']

// docs/specs/131-match-sharing.md (ShareMatchDialog): step 1 What to share (one content, Side, Layout), step 2 Format (tiles), then the
// chosen format's screen on the 114 shell. Full screen on a phone; choice steps a 720 px card; the preview near full screen.
// Replaces TeamSheetCommunicationDialog. Everything it reads is fetched only while it is open.
export function ShareMatchDialog({ open, onClose, clubId, match, teamsById, sides, sidesLoading, leagueName, seasonLabel, initialContent, initialScope }: ShareMatchDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [choices, updateChoices] = useShareChoices(clubId)
  const [step, setStep] = useState<Step>('contents')
  const [content, setContent] = useState<MatchContent | null>(initialContent ?? null)
  const [side, setSide] = useState<MatchSideChoice>('OURS')
  const [layout, setLayout] = useState<MatchLayout>(choices.match.layout)
  const [picked, setPicked] = useState<ShareFormat | null>(null)
  const [unticked, setUnticked] = useState<string[]>([])
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const picture = useMatchPicture(open)
  const settings = useShareSettings(clubId, open)

  const ownKeys = useMemo(() => {
    const keys: ('home' | 'away')[] = []
    if (match.homeTeamId) keys.push('home')
    if (match.awayTeamId) keys.push('away')
    return keys
  }, [match.homeTeamId, match.awayTeamId])
  const sideOf = (key: 'home' | 'away' | null) => (key === 'home' ? sides[0] : key === 'away' ? sides[1] : undefined)
  const hasXi = (item: TeamSheetSide | undefined) => (item?.side?.players.length ?? 0) > 0
  // In a derby our side is the own side that has an XI (home first).
  const preferredOurs = ownKeys.find((key) => hasXi(sideOf(key))) ?? null
  const roles = sideRoles(ownKeys, preferredOurs)
  const oursSide = sideOf(roles.ours)
  const oppSide = sideOf(roles.opposition)
  const days = daysUntil(match.matchDate)
  const context = { hasOurXi: hasXi(oursSide), hasOppositionXi: Boolean(roles.opposition && ownKeys.includes(roles.opposition)) && hasXi(oppSide), past: Number.isFinite(days) && days < 0 }

  const oppositionTeamId = roles.opposition === 'home' ? match.homeTeamId : roles.opposition === 'away' ? match.awayTeamId : null
  const ownTeamId = roles.ours === 'home' ? match.homeTeamId : roles.ours === 'away' ? match.awayTeamId : null
  const data = useShareMatchData(clubId, match, teamsById, { ours: oursSide?.teamName ?? sides[0].teamName, opposition: oppSide?.teamName ?? sides[1].teamName }, ownTeamId, oppositionTeamId, open)
  const weather = useMatchFieldWeather(open ? clubId : undefined, match)

  // Every opening starts afresh: the entry point's content and side, else the remembered ones, step 1.
  useEffect(() => {
    if (open) {
      setStep('contents')
      setPicked(null)
      setUnticked([])
      setContent(initialContent ?? choices.match.content)
      setSide(initialScope ? (initialScope === roles.ours ? 'OURS' : 'OPPOSITION') : choices.match.side)
      setLayout(choices.match.layout)
    }
    // Only the moment of opening matters; later prop changes must not reset what the manager has chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const gaps = useMemo(() => {
    const result: Partial<Record<MatchContent, string>> = {}
    for (const item of MATCH_CONTENTS) {
      const reason = sidesLoading ? 'Loading the teams' : contentGap(item, context)
      if (reason) result[item] = reason
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidesLoading, context.hasOurXi, context.hasOppositionXi, context.past])
  const sideGaps: Record<MatchSideChoice, string | null> = { OURS: sideGap('OURS', context), OPPOSITION: sideGap('OPPOSITION', context), BOTH: sideGap('BOTH', context) }
  const chosenContent = content && !gaps[content] ? content : null
  const chosenSide: MatchSideChoice = sideGaps[side] ? 'OURS' : side
  const formats = useMemo(() => (chosenContent ? matchFormatAvailability(chosenContent, settings.settings?.disabledFormats) : null), [chosenContent, settings.settings?.disabledFormats])

  const initials = resolveShareInitials({
    choices,
    updateChoices,
    junior: data.junior,
    settings: settings.settings,
    setClubDefault: settings.setInitialsOnlyDefault,
    clubDefaultSaving: settings.isSaving,
    clubDefaultFailed: settings.saveFailed,
  })

  const tickedFacts = useMemo(() => data.facts.filter((fact) => !unticked.includes(fact.id)).slice(0, MAX_PRETICKED_FACTS), [data.facts, unticked])
  const candidateIds = useMemo(() => new Set(data.sponsors.map((sponsor) => sponsor.id)), [data.sponsors])
  const selectedSponsorIds = choices.sponsorIds.filter((id) => candidateIds.has(id)).slice(0, MAX_SHARE_SPONSORS)
  const sponsorName = data.sponsors.find((sponsor) => sponsor.id === selectedSponsorIds[0])?.name ?? null

  const model = useMemo(
    () =>
      buildMatchShareModel({
        content: chosenContent ?? 'FIXTURE',
        match,
        sides,
        logos: { home: sides[0].team.logoUrl ?? match.homeTeamLogoUrl, away: sides[1].team.logoUrl ?? match.awayTeamLogoUrl },
        ownKeys,
        preferredOurs,
        side: chosenSide,
        layout,
        initialsOnly: initials.value,
        leagueName,
        seasonLabel,
        clubName: data.clubProfile?.name ?? null,
        weather: weather.summary,
        facts: tickedFacts,
      }),
    [chosenContent, match, sides, ownKeys, preferredOurs, chosenSide, layout, initials.value, leagueName, seasonLabel, data.clubProfile?.name, weather.summary, tickedFacts],
  )

  const weatherReason = weather.summary
    ? null
    : weather.status === 'loading'
      ? 'Checking the forecast'
      : context.past
        ? 'No forecast: the match date has passed'
        : days >= 7
          ? 'No forecast: the match is more than 7 days away'
          : 'No forecast available for this field'

  const highlighted = formats ? ([picked, choices.match.format].find((format) => format !== null && formats.offered.includes(format)) ?? null) : null

  const next = () => {
    if (step === 'contents' && chosenContent) {
      updateChoices({ match: { content: chosenContent, side: chosenSide, layout } })
      setStep('formats')
    } else if (step === 'formats' && highlighted) {
      setPicked(highlighted)
      updateChoices({ match: { format: highlighted } })
      setStep('screen')
    }
  }

  const screenProps: MatchScreenProps = {
    model,
    side: chosenSide,
    onSideChange: (value) => {
      setSide(value)
      updateChoices({ match: { side: value } })
    },
    sideGaps,
    layout,
    onLayoutChange: (value) => {
      setLayout(value)
      updateChoices({ match: { layout: value } })
    },
    weatherReason,
    facts: data.facts,
    tickedFactIds: tickedFacts.map((fact) => fact.id),
    onToggleFact: (id) => setUnticked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])),
    picture,
    sponsorName,
    choices,
    updateChoices,
    initials,
    sponsors: data.sponsors,
    selectedSponsorIds,
    clubLogoUrl: data.clubProfile?.logoUrl ?? null,
    leagueLogoUrl: null,
    clubWebsite: data.clubProfile?.website ?? null,
    shareTitle: model.title,
  }

  const canNext = step === 'contents' ? chosenContent !== null && !sidesLoading : highlighted !== null
  const fill = !phone && step === 'screen'
  const stepIndex = step === 'contents' ? 0 : step === 'formats' ? 1 : 2

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth={false}
      aria-labelledby="share-match-title"
      PaperProps={{
        sx:
          step === 'screen'
            ? { width: { sm: '96vw' }, maxWidth: { sm: '96vw' }, height: { sm: '96vh' }, maxHeight: { sm: '96vh' } }
            : { width: { sm: '100%' }, maxWidth: { sm: 720 }, height: { sm: 'auto' }, maxHeight: { sm: '90vh' } },
      }}
    >
      <DialogTitle id="share-match-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">Share match</Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden', overflowY: fill ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box component="ol" aria-label="Steps" sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, listStyle: 'none', m: 0, mb: 1.5, p: 0 }}>
          {STEPS.slice(0, step === 'screen' ? 3 : 2).map((label, index) => (
            <Box
              component="li"
              key={label}
              aria-current={index === stepIndex ? 'step' : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8125rem', fontWeight: index === stepIndex ? 700 : 400, color: index === stepIndex ? 'primary.dark' : 'text.secondary' }}
            >
              <Box component="span" sx={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, bgcolor: index === stepIndex ? 'primary.main' : 'divider', color: index === stepIndex ? 'primary.contrastText' : 'text.primary' }}>
                {index + 1}
              </Box>
              {label}
            </Box>
          ))}
        </Box>

        {step === 'contents' && (
          <MatchContentStep
            value={chosenContent}
            onChange={setContent}
            gaps={gaps}
            side={chosenSide}
            onSideChange={(value) => setSide(value)}
            sideGaps={sideGaps}
            layout={layout}
            onLayoutChange={setLayout}
            loading={sidesLoading}
          />
        )}

        {step === 'formats' && chosenContent && formats && <MatchFormatStep content={chosenContent} availability={formats} value={highlighted} onChange={setPicked} />}

        {step === 'screen' && picked && chosenContent && (
          <ShareFooterContext.Provider value={footer}>
            <ShareFillContext.Provider value={fill}>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: fill ? 1 : '0 0 auto', minHeight: 0, minWidth: 0 }}>
                <Button size="compact" variant="ghost" startIcon={<ArrowBackIcon fontSize="small" />} onClick={() => setStep('formats')} sx={{ ml: -1, mb: 1, color: 'text.secondary', alignSelf: 'flex-start', flexShrink: 0 }}>
                  Back
                </Button>
                {data.isLoading ? (
                  <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading the match details…</Typography>
                  </Box>
                ) : picked === 'PDF' ? (
                  <MatchPdfScreen {...screenProps} />
                ) : picked === 'IMAGE' ? (
                  <MatchImageScreen {...screenProps} />
                ) : picked === 'TV' ? (
                  <MatchImageScreen {...screenProps} tv />
                ) : picked === 'WHATSAPP' ? (
                  <MatchWhatsAppScreen {...screenProps} />
                ) : (
                  <MatchFacebookScreen {...screenProps} />
                )}
              </Box>
            </ShareFillContext.Provider>
          </ShareFooterContext.Provider>
        )}
      </DialogContent>

      <DialogActions sx={{ display: 'flex', flexWrap: step === 'screen' ? 'nowrap' : 'wrap', alignItems: 'center', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        {step === 'screen' ? (
          <>
            <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0, flex: 1 }} />
            <Button size="compact" variant="secondary" onClick={onClose} sx={{ flexShrink: 0 }}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" role="status" sx={{ mr: 'auto', color: 'text.secondary' }}>
              {step === 'contents' ? (chosenContent ? '' : sidesLoading ? 'Loading the teams…' : 'Choose what to share') : highlighted ? '' : 'Choose a format'}
            </Typography>
            {step === 'formats' && (
              <Button size="compact" variant="ghost" onClick={() => setStep('contents')}>
                Back
              </Button>
            )}
            <Button size="compact" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="compact" disabled={!canNext} onClick={next}>
              Next
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
