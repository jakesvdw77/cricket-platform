import { useEffect, useMemo, useState } from 'react'
import { Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import { useQuery } from '@tanstack/react-query'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { useShareChoices } from '../../hooks/useShareChoices'
import { useShareLeagueData } from '../../hooks/useShareLeagueData'
import { useShareSettings } from '../../hooks/useShareSettings'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { isJuniorMatch } from '../../utils/share/isJuniorMatch'
import { availability, LEAGUE_CONTENTS, supportedContents } from '../../utils/share/leagueShareFormats'
import type { LeagueContent, LeagueShareFormat } from '../../utils/share/leagueShareFormats'
import { MAX_SHARE_SPONSORS } from '../../utils/share/logoLayout'
import { buildLeagueShareModel } from '../../utils/share/shareLeagueData'
import { Button } from '../Button'
import { HeaderSeasonSelect } from '../HeaderSeasonSelect'
import { resolveShareInitials } from '../ShareCore'
import { ShareFillContext, ShareFooterContext } from '../ShareFormatScreen'
import { CalendarLeagueScreen } from './CalendarLeagueScreen'
import { FacebookLeagueScreen } from './FacebookLeagueScreen'
import { LeagueContentStep } from './LeagueContentStep'
import { LeagueFormatStep } from './LeagueFormatStep'
import { PdfLeagueScreen } from './PdfLeagueScreen'
import { PosterLeagueScreen } from './PosterLeagueScreen'
import { WhatsAppLeagueScreen } from './WhatsAppLeagueScreen'
import type { LeagueScreenProps } from './leagueScreenTypes'

export interface ShareLeagueDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  league: League
  // The season the caller is showing; absent, the dialog offers a Season pill and starts on the default season.
  seasonId?: string | null
  // What is ticked on opening, by entry point (League card: details and schedule; Playing conditions tab: conditions).
  preselected: LeagueContent[]
}

type Step = 'contents' | 'formats' | 'screen'

const STEPS = ['What to share', 'Format', 'Share']

// docs/specs/122-league-sharing.md (ShareLeagueDialog): step 1 What to share (checkboxes), step 2 Output format (tiles), then
// the chosen format's screen on the 114 shell. Full screen on a phone. Everything it reads is fetched only while it is open.
// Back keeps the ticks; Include phone and email is off every time the dialog opens and is never stored.
export function ShareLeagueDialog({ open, onClose, clubId, league, seasonId, preselected }: ShareLeagueDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [step, setStep] = useState<Step>('contents')
  const [ticked, setTicked] = useState<LeagueContent[]>(preselected)
  const [picked, setPicked] = useState<LeagueShareFormat | null>(null)
  const [chosenSeasonId, setChosenSeasonId] = useState<string>(seasonId ?? '')
  const [includeContact, setIncludeContact] = useState(false)
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const [choices, updateChoices] = useShareChoices(clubId)
  const settings = useShareSettings(clubId, open)
  const data = useShareLeagueData(clubId, league, chosenSeasonId, open)
  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId),
    enabled: open && Boolean(clubId),
    retry: false,
  })
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])

  // Every opening starts afresh: the entry point's contents, step 1, the caller's season and no contact details.
  useEffect(() => {
    if (open) {
      setStep('contents')
      setTicked(preselected)
      setPicked(null)
      setChosenSeasonId(seasonId ?? '')
      setIncludeContact(false)
    }
    // Only the moment of opening matters; later prop changes must not reset what the manager has ticked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Opened without a season: start on the default one once the seasons are known (the pill changes it).
  useEffect(() => {
    if (open && !chosenSeasonId && seasons.length > 0) {
      setChosenSeasonId(pickDefaultSeasonId(seasons) ?? '')
    }
  }, [open, chosenSeasonId, seasons])

  const noSeason = !chosenSeasonId
  const gaps = useMemo(() => {
    if (!noSeason) return data.gaps
    const reason = 'Choose a season first'
    return { CONDITIONS: reason, TEAMS: reason, SCHEDULE: reason, RESULTS: reason, KEY_DATES: reason } as Partial<Record<LeagueContent, string>>
  }, [noSeason, data.gaps])
  const contents = useMemo(() => LEAGUE_CONTENTS.filter((content) => ticked.includes(content) && !gaps[content]), [ticked, gaps])
  const formats = useMemo(() => availability(contents, settings.settings?.disabledFormats), [contents, settings.settings?.disabledFormats])

  const junior = useMemo(
    () => isJuniorMatch({ league, sections: data.sections, teams: data.ownTeams.map((team) => ({ sectionId: team.sectionId })) }),
    [league, data.sections, data.ownTeams],
  )
  const initials = resolveShareInitials({
    choices,
    updateChoices,
    junior,
    settings: settings.settings,
    setClubDefault: settings.setInitialsOnlyDefault,
    clubDefaultSaving: settings.isSaving,
    clubDefaultFailed: settings.saveFailed,
  })

  const candidateIds = useMemo(() => new Set(data.sponsors.map((sponsor) => sponsor.id)), [data.sponsors])
  const selectedSponsorIds = choices.sponsorIds.filter((id) => candidateIds.has(id)).slice(0, MAX_SHARE_SPONSORS)

  // The chosen format carries only the ticked contents it supports; the rest are left out of that output.
  const modelContents = useMemo(() => (picked && step === 'screen' ? supportedContents(picked, contents) : contents), [picked, step, contents])
  const model = useMemo(
    () =>
      buildLeagueShareModel({
        contents: modelContents,
        league,
        season: data.season ? { label: data.season.label } : null,
        clubName: data.clubProfile?.name ?? null,
        conditions: data.conditions,
        contacts: data.contacts,
        ownTeams: data.ownTeams,
        leagueTeams: data.leagueTeams,
        teamsById: data.teamsById,
        matches: data.matches,
        results: data.results,
        seasonDates: data.seasonDates,
        initialsOnly: initials.value,
        includeContact,
        sections: data.sections,
      }),
    [
      modelContents,
      league,
      data.season,
      data.clubProfile,
      data.conditions,
      data.contacts,
      data.ownTeams,
      data.leagueTeams,
      data.teamsById,
      data.matches,
      data.results,
      data.seasonDates,
      data.sections,
      initials.value,
      includeContact,
    ],
  )

  const highlighted = [picked, choices.league.format].find((format) => format !== null && formats.offered.includes(format)) ?? null

  const toggle = (content: LeagueContent) =>
    setTicked((current) => (current.includes(content) ? current.filter((item) => item !== content) : [...current, content]))

  const next = () => {
    if (step === 'contents') {
      updateChoices({ league: { contents } })
      setStep('formats')
    } else if (step === 'formats' && highlighted) {
      setPicked(highlighted)
      updateChoices({ league: { format: highlighted } })
      setStep('screen')
    }
  }

  const screenProps: LeagueScreenProps = {
    model,
    ticked: contents,
    includeContact,
    onIncludeContactChange: setIncludeContact,
    choices,
    updateChoices,
    initials,
    sponsors: data.sponsors,
    selectedSponsorIds,
    clubLogoUrl: data.clubProfile?.logoUrl ?? null,
    leagueLogoUrl: league.logoUrl ?? null,
    clubWebsite: data.clubProfile?.website ?? null,
    shareTitle: model.title,
  }

  const canNext = step === 'contents' ? contents.length > 0 && !data.isLoading : highlighted !== null
  // Desktop, format screen: nothing scrolls around the screen; it fills the content and scrolls its own parts.
  const fill = !phone && step === 'screen'
  const stepIndex = step === 'contents' ? 0 : step === 'formats' ? 1 : 2

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth
      maxWidth={false}
      aria-labelledby="share-league-title"
      // Near full screen on a desktop (full screen on a phone), so a PDF page or poster is shown large; the footer stays pinned.
      PaperProps={{ sx: { width: { sm: '96vw' }, maxWidth: { sm: '96vw' }, height: { sm: '96vh' }, maxHeight: { sm: '96vh' } } }}
    >
      <DialogTitle id="share-league-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">Share league</Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      {/* The body is the one scroll region: no horizontal scrollbar, the footer below stays put. */}
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden', overflowY: fill ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box component="ol" aria-label="Steps" sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, listStyle: 'none', m: 0, mb: 1.5, p: 0 }}>
          {STEPS.slice(0, step === 'screen' ? 3 : 2).map((label, index) => (
            <Box
              component="li"
              key={label}
              aria-current={index === stepIndex ? 'step' : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8125rem', fontWeight: index === stepIndex ? 700 : 400, color: index === stepIndex ? 'primary.dark' : 'text.secondary' }}
            >
              <Box
                component="span"
                sx={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, bgcolor: index === stepIndex ? 'primary.main' : 'divider', color: index === stepIndex ? 'primary.contrastText' : 'text.primary' }}
              >
                {index + 1}
              </Box>
              {index === 2 ? 'Share' : label}
            </Box>
          ))}
        </Box>

        {step === 'contents' && (
          <>
            {seasons.length > 0 && !seasonId && (
              <Box sx={{ mb: 1.5 }}>
                <HeaderSeasonSelect
                  seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
                  value={chosenSeasonId || null}
                  onChange={(id) => setChosenSeasonId(id ?? '')}
                  showAll={false}
                />
              </Box>
            )}
            <LeagueContentStep ticked={ticked} onToggle={toggle} gaps={gaps} loading={data.isLoading} />
          </>
        )}

        {step === 'formats' && <LeagueFormatStep contents={contents} availability={formats} value={highlighted} onChange={setPicked} />}

        {step === 'screen' && picked && (
          <ShareFooterContext.Provider value={footer}>
          <ShareFillContext.Provider value={fill}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: fill ? 1 : '0 0 auto', minHeight: 0, minWidth: 0 }}>
              <Button size="compact" variant="ghost" startIcon={<ArrowBackIcon fontSize="small" />} onClick={() => setStep('formats')} sx={{ ml: -1, mb: 1, color: 'text.secondary', alignSelf: 'flex-start', flexShrink: 0 }}>
                Back
              </Button>
              {data.isLoading ? (
                <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Loading the league details…</Typography>
                </Box>
              ) : picked === 'PDF' ? (
                <PdfLeagueScreen {...screenProps} />
              ) : picked === 'POSTER' ? (
                <PosterLeagueScreen {...screenProps} />
              ) : picked === 'CALENDAR' ? (
                <CalendarLeagueScreen {...screenProps} />
              ) : picked === 'WHATSAPP' ? (
                <WhatsAppLeagueScreen {...screenProps} />
              ) : (
                <FacebookLeagueScreen {...screenProps} />
              )}
            </Box>
          </ShareFillContext.Provider>
          </ShareFooterContext.Provider>
        )}
      </DialogContent>

      <DialogActions
        sx={{ display: step === 'screen' ? 'block' : 'flex', flexWrap: 'wrap', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        {step === 'screen' ? (
          !data.isLoading && <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0 }} />
        ) : (
          <>
            <Typography variant="body2" role="status" sx={{ mr: 'auto', color: step === 'contents' && contents.length === 0 && !data.isLoading ? 'error.main' : 'text.secondary' }}>
              {step === 'contents'
                ? contents.length === 0
                  ? data.isLoading
                    ? 'Loading what can be shared…'
                    : 'Tick at least one thing to share'
                  : `${contents.length} selected`
                : highlighted
                  ? ''
                  : 'Choose a format'}
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
