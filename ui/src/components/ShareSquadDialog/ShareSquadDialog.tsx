import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ToggleButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../../api/clubApi'
import { listSponsors } from '../../api/sponsorApi'
import { listSquad } from '../../api/teamSquadApi'
import type { Team } from '../../api/teamApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useRememberedState } from '../../hooks/useRememberedState'
import { useShareChoices } from '../../hooks/useShareChoices'
import { drawSquadImage, generateSquadImage, squadImageSize } from '../../utils/share/squadImage'
import type { SquadImageOptions, SquadLayout, SquadShareModel } from '../../utils/share/squadImage'
import { IMAGE_SIZES, IMAGE_TEMPLATES } from '../../utils/share/shareChoices'
import type { ImageSize, ImageTemplate } from '../../utils/share/shareChoices'
import { MAX_SHARE_SPONSORS } from '../../utils/share/logoLayout'
import { shareName } from '../../utils/share/shareName'
import { SHARE_TEXT_SCALE } from '../../utils/share/textSize'
import { playerAvatarSrc } from '../BrandIcon'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareControlGroup, ShareImageActions, ShareLogoControls, ShareTextSizeControl, useShareLogoImages } from '../ShareCore'
import { ShareFillContext, ShareFooterContext, ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareResultCanvas } from '../ShareResultDialog/ShareResultCanvas'

export interface ShareSquadDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  team: Team
  seasonId: string
  seasonLabel: string | null
}

const TEMPLATE_LABELS: Record<ImageTemplate, string> = { CLUB_GREEN: 'Club Green', NIGHT: 'Night', DAYLIGHT: 'Daylight' }
const SIZE_LABELS: Record<ImageSize, string> = { SQUARE: 'Square 1080', PORTRAIT: 'Portrait 4:5', STORY: 'Story 9:16' }
const LAYOUT_LABELS: Record<SquadLayout, string> = { GRID: 'Grid', LIST: 'List' }

const isBoolean = (value: unknown): boolean => typeof value === 'boolean'

// Share Squad: a picture poster of a team's whole squad for a season, not tied to any match. The same picture screen as the match posters:
// template, size, Text Size, the logo switches and sponsors, Download PNG and Share (with the other sizes). docs/specs/131 for the family.
export function ShareSquadDialog({ open, onClose, clubId, team, seasonId, seasonLabel }: ShareSquadDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [choices, updateChoices] = useShareChoices(clubId)
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const { main, dark, contrastText } = theme.palette.primary

  // The squad poster's own switches, remembered per club.
  const key = (name: string) => `squadShare:${name}:${clubId}`
  const [layout, setLayout] = useRememberedState<SquadLayout>(key('layout'), 'GRID', (value) => value === 'GRID' || value === 'LIST')
  const [shirtNumbers, setShirtNumbers] = useRememberedState<boolean>(key('shirtNumbers'), true, isBoolean)
  const [marks, setMarks] = useRememberedState<boolean>(key('marks'), true, isBoolean)
  const [playerPictures, setPlayerPictures] = useRememberedState<boolean>(key('playerPictures'), true, isBoolean)
  const [initialsOnly, setInitialsOnly] = useRememberedState<boolean>(key('initialsOnly'), false, isBoolean)

  const squadQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams', team.id, 'squad', seasonId, 'share'], queryFn: () => listSquad(clubId, team.id, seasonId), enabled: open && Boolean(clubId && team.id && seasonId), retry: false })
  const profileQuery = useQuery({ queryKey: ['managed-club', clubId, 'profile'], queryFn: () => getManagedClubProfile(clubId), enabled: open && Boolean(clubId), retry: false })
  const sponsorsQuery = useQuery({ queryKey: ['managed-club', clubId, 'sponsors'], queryFn: () => listSponsors(clubId), enabled: open && Boolean(clubId), retry: false })
  const sponsors = useMemo(() => (sponsorsQuery.data ?? []).filter((sponsor) => sponsor.active && sponsor.logoUrl), [sponsorsQuery.data])
  const candidateIds = useMemo(() => new Set(sponsors.map((sponsor) => sponsor.id)), [sponsors])
  const selectedSponsorIds = choices.sponsorIds.filter((id) => candidateIds.has(id)).slice(0, MAX_SHARE_SPONSORS)
  const sponsorUrls = useMemo(
    () => selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(selectedSponsorIds), sponsors],
  )

  const model = useMemo<SquadShareModel>(() => {
    const players = (squadQuery.data ?? [])
      .filter((member) => member.active !== false)
      .map((member) => ({
        key: member.playerProfileId,
        firstName: shareName({ firstName: member.firstName, lastName: '' }, initialsOnly) || member.firstName,
        lastName: member.lastName,
        shirt: member.squadJerseyNumber ?? member.jerseyNumber ?? null,
        captain: member.isCaptain === true,
        keeper: member.isWicketKeeper === true,
        photoUrl: playerAvatarSrc(member.photoUrl, member.gender) ?? null,
        sortFirst: member.firstName,
      }))
      // Surname then first name, as the team sheet lists the squad.
      .sort((a, b) => a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) || a.sortFirst.localeCompare(b.sortFirst, undefined, { sensitivity: 'base' }))
      .map(({ sortFirst: _sortFirst, ...player }) => player)
    return { teamName: team.name, teamLogoUrl: team.logoUrl, seasonLabel, players }
  }, [squadQuery.data, team.name, team.logoUrl, seasonLabel, initialsOnly])

  const clubLogoUrl = profileQuery.data?.logoUrl ?? null
  const teamLogoUrl = team.logoUrl ?? null
  const wanted = [choices.logos.club ? clubLogoUrl : null, choices.logos.teamAffiliation ? (team.affiliationLogoUrl ?? null) : null, choices.logos.team ? teamLogoUrl : null, ...sponsorUrls, ...(playerPictures ? model.players.map((player) => player.photoUrl) : [])]
  const images = useShareLogoImages(open ? wanted.filter((url): url is string => Boolean(url)) : [])

  const size = choices.imageSize
  const template = choices.templates.image
  const options = useMemo<SquadImageOptions>(
    () => ({
      size,
      template,
      colour: { main, dark, contrastText },
      layout,
      include: { shirtNumbers, marks, playerPictures },
      logos: { clubUrl: choices.logos.club ? clubLogoUrl : null, teamAffiliationUrl: choices.logos.teamAffiliation ? (team.affiliationLogoUrl ?? null) : null, teamLogo: choices.logos.team, sponsorUrls },
      textScale: SHARE_TEXT_SCALE[choices.textSize],
      images,
      clubWebsite: profileQuery.data?.website ?? null,
      footerLine: choices.footerLine,
    }),
    [size, template, main, dark, contrastText, layout, shirtNumbers, marks, playerPictures, choices.logos.club, choices.logos.teamAffiliation, choices.logos.team, clubLogoUrl, team.affiliationLogoUrl, sponsorUrls, choices.textSize, images, profileQuery.data?.website, choices.footerLine],
  )

  const fileName = useMemo(() => `Squad - ${team.name}${seasonLabel ? ` ${seasonLabel}` : ''}.png`, [team.name, seasonLabel])
  const loading = squadQuery.isLoading || profileQuery.isLoading
  const { canvasRef, file, error } = useSquadImageOutput(model, options, fileName, !loading && !squadQuery.isError)
  const fill = !phone

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth={false}
      aria-labelledby="share-squad-title"
      PaperProps={{ sx: { width: { sm: '96vw' }, maxWidth: { sm: '96vw' }, height: { sm: '96vh' }, maxHeight: { sm: '96vh' } } }}
    >
      <DialogTitle id="share-squad-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">Share squad</Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden', overflowY: fill ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ShareFooterContext.Provider value={footer}>
          <ShareFillContext.Provider value={fill}>
            {loading ? (
              <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
                <CircularProgress size={20} />
                <Typography color="text.secondary">Loading the squad…</Typography>
              </Box>
            ) : squadQuery.isError ? (
              <Typography role="alert" color="error">
                The squad could not be loaded. Close this and try again.
              </Typography>
            ) : (
              <ShareFormatScreen
                title="Squad Poster"
                controls={
                  <>
                    <ShareControlGroup label="Layout">
                      <CompactToggleGroup value={layout} ariaLabel="Layout" fullWidthOnPhone onChange={(next: SquadLayout) => setLayout(next)}>
                        {(['GRID', 'LIST'] as SquadLayout[]).map((item) => (
                          <ToggleButton key={item} value={item}>
                            {LAYOUT_LABELS[item]}
                          </ToggleButton>
                        ))}
                      </CompactToggleGroup>
                    </ShareControlGroup>
                    <ShareControlGroup label="Template">
                      <CompactToggleGroup value={template} ariaLabel="Template" fullWidthOnPhone onChange={(next: ImageTemplate) => updateChoices({ templates: { image: next } })}>
                        {IMAGE_TEMPLATES.map((item) => (
                          <ToggleButton key={item} value={item}>
                            {TEMPLATE_LABELS[item]}
                          </ToggleButton>
                        ))}
                      </CompactToggleGroup>
                    </ShareControlGroup>
                    <ShareControlGroup label="Size">
                      <CompactToggleGroup value={size} ariaLabel="Size" fullWidthOnPhone onChange={(next: ImageSize) => updateChoices({ imageSize: next })}>
                        {IMAGE_SIZES.map((item) => (
                          <ToggleButton key={item} value={item}>
                            {SIZE_LABELS[item]}
                          </ToggleButton>
                        ))}
                      </CompactToggleGroup>
                    </ShareControlGroup>
                    <ShareTextSizeControl choices={choices} updateChoices={updateChoices} />
                    <ShareControlGroup label="Include">
                      <CompactSwitch label="Player Pictures" checked={playerPictures} onChange={setPlayerPictures} />
                      <CompactSwitch label="Shirt Numbers" checked={shirtNumbers} onChange={setShirtNumbers} />
                      <CompactSwitch label="Captain And Keeper Marks" checked={marks} onChange={setMarks} />
                      <CompactSwitch label="First Names As Initials" checked={initialsOnly} onChange={setInitialsOnly} />
                    </ShareControlGroup>
                    <ShareLogoControls
                      choices={choices}
                      updateChoices={updateChoices}
                      sponsors={sponsors}
                      selectedSponsorIds={selectedSponsorIds}
                      clubLogoUrl={clubLogoUrl}
                      teamAffiliationLogoUrl={team.affiliationLogoUrl ?? null}
                      clubWebsite={profileQuery.data?.website ?? null}
                    />
                  </>
                }
                preview={
                  <SharePreviewStage ariaLabel="Squad poster preview" zoomable baseWidth={540} fitMaxWidth={size === 'STORY' ? 320 : 560} caption={`This is the file you will share (${squadImageSize(size).width} x ${squadImageSize(size).height}).`}>
                    {(view) => <ShareResultCanvas canvasRef={canvasRef} ariaLabel={`Squad poster: ${team.name}`} width={view.width} />}
                  </SharePreviewStage>
                }
                actions={
                  <ShareImageActions
                    file={file}
                    shareTitle={`${team.name} squad`}
                    error={error}
                    sizes={{
                      current: size,
                      options: IMAGE_SIZES.map((item) => ({
                        id: item,
                        label: SIZE_LABELS[item],
                        make: async () => new File([await generateSquadImage(model, { ...options, size: item })], fileName.replace(/\.png$/, ` - ${SIZE_LABELS[item]}.png`), { type: 'image/png' }),
                      })),
                    }}
                  />
                }
              />
            )}
          </ShareFillContext.Provider>
        </ShareFooterContext.Provider>
      </DialogContent>
      <DialogActions sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0, flex: 1 }} />
        <Button size="compact" variant="secondary" onClick={onClose} sx={{ flexShrink: 0 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Draws the poster into the preview canvas (debounced) with the same function the file comes from, then reads the canvas back as the PNG
// file, handed out only while it was made from the current input.
// `ready`: the canvas is on screen (it appears only once the squad has loaded), so the first draw waits for it.
function useSquadImageOutput(model: SquadShareModel, options: SquadImageOptions, fileName: string, ready: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [made, setMade] = useState<{ input: object; file: File | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useMemo(() => ({ model, options }), [model, options])
  const debounced = useDebouncedValue(input, 150)
  const file = made && made.input === input ? made.file : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!ready || !canvas) return
    let cancelled = false
    setMade(null)
    try {
      drawSquadImage(canvas, debounced.model, debounced.options)
    } catch {
      setError('The image could not be created. Try again.')
      return
    }
    canvas.toBlob((blob) => {
      if (cancelled) return
      if (!blob) {
        setError('The image could not be created. Try again.')
        return
      }
      setError(null)
      setMade({ input: debounced, file: new File([blob], fileName, { type: 'image/png' }) })
    }, 'image/png')
    return () => {
      cancelled = true
    }
  }, [debounced, fileName, ready])

  return { canvasRef, file, error }
}
