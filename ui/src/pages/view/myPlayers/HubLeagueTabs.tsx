import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, Button as MuiButton, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import LanguageIcon from '@mui/icons-material/Language'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import XIcon from '@mui/icons-material/X'
import YouTubeIcon from '@mui/icons-material/YouTube'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { compactButtonSx } from '../../../components/Button/Button'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB, hubFramedIconSx, hubOutlineButton } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { HubFieldCard } from './HubFieldCard'
import { LEAGUE_TABS, ageBand, isHttps, localDate, longDate, shortDate, todayIso } from './leagueFormat'
import type { LeagueTab } from './leagueFormat'
import { describeBallsPerOver, describeFreeHit } from '../../../utils/playingConditions'

// docs/specs/123 (League page): the tab row (a pill row on a phone, a tab bar on wider screens, role=tablist with arrow keys)
// and the read-only Details, Playing conditions, and Teams tabs. Schedule and Results live in HubLeagueGames.
export const tabId = (tab: LeagueTab) => `hub-league-tab-${tab}`
export const panelId = (tab: LeagueTab) => `hub-league-panel-${tab}`

export function HubLeagueTabBar({ value, onChange, counts }: { value: LeagueTab; onChange: (tab: LeagueTab) => void; counts?: Partial<Record<LeagueTab, number>> }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = LEAGUE_TABS.findIndex((tab) => tab.id === value)
    const next = LEAGUE_TABS[(index + step + LEAGUE_TABS.length) % LEAGUE_TABS.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <Box
      role="tablist"
      aria-label="League sections"
      onKeyDown={onKeyDown}
      sx={{ display: 'flex', gap: 1, overflowX: 'auto', minWidth: 0, maxWidth: '100%', py: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {LEAGUE_TABS.map((tab) => {
        const selected = tab.id === value
        const count = counts?.[tab.id]
        return (
          <ButtonBase
            key={tab.id}
            ref={(node) => { refs.current[tab.id] = node }}
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            sx={{
              flex: 'none',
              minHeight: 44,
              px: 2,
              gap: 1,
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 15,
              whiteSpace: 'nowrap',
              color: selected ? HUB.ink : HUB.cream,
              bgcolor: selected ? HUB.gold : 'transparent',
              border: `1px solid ${selected ? HUB.gold : HUB.line}`,
              borderRadius: 999,
              '&:hover': { bgcolor: selected ? HUB.gold : alpha(HUB.gold, 0.12) },
              '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            {tab.label}
            {count !== undefined && (
              <Box component="span" aria-hidden sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, bgcolor: selected ? alpha(HUB.ink, 0.22) : creamAlpha(0.16) }}>
                {count}
              </Box>
            )}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

export const emptyLine = { border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted } as const
export const tagSx = { height: 26, borderRadius: '4px', fontSize: 13, fontWeight: 600, bgcolor: HUB.gold, color: HUB.ink } as const

export function FactTile({ label, value, gold = false }: { label: string; value: ReactNode; gold?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: HUB.line, bgcolor: creamAlpha(0.07), borderRadius: '4px', p: 1.5, minWidth: 0 }}>
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 600, color: gold ? HUB.gold : HUB.cream, overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  )
}

const tileGrid = { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } } as const

function LinkButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <MuiButton variant="outlined" size="small" startIcon={icon} href={href} target="_blank" rel="noopener noreferrer" sx={[compactButtonSx, hubOutlineButton, { minHeight: 44 }] as never}>
      {children}
    </MuiButton>
  )
}

const SOCIAL_HOSTS: [RegExp, string, ReactNode][] = [
  [/(^|\.)(facebook|fb)\.com$/, 'Facebook', <FacebookIcon key="f" />],
  [/(^|\.)instagram\.com$/, 'Instagram', <InstagramIcon key="i" />],
  [/(^|\.)(x|twitter)\.com$/, 'X', <XIcon key="x" />],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', <YouTubeIcon key="y" />],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', <LinkedInIcon key="l" />],
]

function socialFor(url: string, fallback: string): { name: string; icon: ReactNode } {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    host = ''
  }
  const match = SOCIAL_HOSTS.find(([pattern]) => pattern.test(host))
  return match ? { name: match[1], icon: match[2] } : { name: fallback, icon: <LanguageIcon /> }
}

// Icon-only links to the league's website and social pages, fixed top right of the league header.
export function HubLeagueSocialLinks({ league }: { league: MyLeagueDto['league'] }) {
  const links = [...(isHttps(league.website) ? [{ platform: 'Website', url: league.website as string }] : []), ...league.socialLinks.filter((link) => isHttps(link.url))]
  if (links.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
      {links.map((link) => {
        const { name, icon } = link.platform === 'Website' ? { name: 'Website', icon: <LanguageIcon /> } : socialFor(link.url, link.platform.charAt(0).toUpperCase() + link.platform.slice(1))
        const label = `${name} (opens in a new tab)`
        return (
          <Tooltip key={`${link.platform}-${link.url}`} title={name}>
            <IconButton component="a" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={label} sx={hubFramedIconSx}>
              {icon}
            </IconButton>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// Owner, 2026-11-12: one facts card (label and value pairs, all cream, no gaps) and a small season timeline, in place of loose tiles.
const datePill = (value: string) => {
  const date = localDate(value)
  return date ? `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${shortDate(value)}` : value
}

function Fact({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <Box sx={{ p: '12px 16px', minWidth: 0, borderBottom: last ? 0 : `1px solid ${HUB.lineSoft}`, '&:nth-of-type(odd)': { borderRight: { sm: `1px solid ${HUB.lineSoft}` } } }}>
      <Typography sx={{ fontSize: 13, color: HUB.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 600, color: HUB.cream, overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  )
}

// start, today and end on one line; "today" sits where it falls between them. Once the season is over it is one line of text instead.
function SeasonTimeline({ start, end }: { start: string; end: string }) {
  const startDate = localDate(start)
  const endDate = localDate(end)
  if (!startDate || !endDate || endDate < startDate) return null
  const today = localDate(todayIso()) as Date
  if (today > endDate) return <Typography data-testid="season-ended" sx={{ p: '12px 16px', borderTop: `1px solid ${HUB.lineSoft}`, fontSize: 14, color: HUB.muted }}>Season ended {shortDate(end)}</Typography>
  const span = endDate.getTime() - startDate.getTime()
  const pct = span === 0 ? 0 : Math.min(100, Math.max(0, ((today.getTime() - startDate.getTime()) / span) * 100))
  const started = today >= startDate
  const dot = (left: string, fill: string, ring: string) => <Box aria-hidden sx={{ position: 'absolute', top: '50%', left, transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', bgcolor: fill, border: `2px solid ${ring}` }} />
  return (
    <Box data-testid="season-timeline" sx={{ p: '16px 16px 14px', borderTop: `1px solid ${HUB.lineSoft}` }}>
      <Box aria-hidden sx={{ position: 'relative', height: 14, mx: '6px' }}>
        <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, bgcolor: HUB.line, transform: 'translateY(-50%)' }} />
        {started && <Box sx={{ position: 'absolute', top: '50%', left: 0, width: `${pct}%`, height: 2, bgcolor: HUB.gold, transform: 'translateY(-50%)' }} />}
        {dot('0%', HUB.gold, HUB.gold)}
        {started && pct > 0 && pct < 100 && dot(`${pct}%`, HUB.ink, HUB.cream)}
        {dot('100%', HUB.ink, HUB.sand)}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 1, fontSize: 13, color: HUB.muted }}>
        <span><Box component="b" sx={{ display: 'block', color: HUB.cream, fontWeight: 600, fontSize: 14 }}>{shortDate(start)}</Box>Starts</span>
        <Box component="span" sx={{ textAlign: 'center' }}><Box component="b" sx={{ display: 'block', color: HUB.cream, fontWeight: 600, fontSize: 14 }}>{started ? 'Today' : 'Not started'}</Box>{started ? shortDate(todayIso()) : `Starts ${shortDate(start)}`}</Box>
        <Box component="span" sx={{ textAlign: 'right' }}><Box component="b" sx={{ display: 'block', color: HUB.cream, fontWeight: 600, fontSize: 14 }}>{shortDate(end)}</Box>Ends</Box>
      </Box>
    </Box>
  )
}

export function HubLeagueDetails({ dto }: { dto: MyLeagueDto }) {
  const { league, keyDates: k } = dto
  const band = ageBand(league)
  const facts: [string, ReactNode][] = [
    ...(band ? ([['Age group', band]] as [string, ReactNode][]) : []),
    ...(league.format ? ([['Format', LEAGUE_FORMAT_LABELS[league.format]]] as [string, ReactNode][]) : []),
    ...(([['Season starts', k.seasonStart], ['Season ends', k.seasonEnd], ['First match', k.firstMatchDate], ['Next match', k.nextMatchDate], ['Last match', k.lastMatchDate]] as [string, string | null][])
      .filter(([, value]) => value)
      .map(([label, value]) => [label, <span key={label} aria-label={longDate(value as string)}>{datePill(value as string)}</span>] as [string, ReactNode])),
  ]
  const hasAny = Boolean(league.description) || facts.length > 0
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      {league.description && <Typography sx={{ fontSize: 17, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{league.description}</Typography>}
      {facts.length > 0 && (
        <Box data-testid="league-facts" sx={{ border: 1, borderColor: HUB.lineSoft, bgcolor: creamAlpha(0.04), borderRadius: '8px', overflow: 'hidden' }}>
          <Typography component="h3" sx={{ p: '10px 16px', borderBottom: `1px solid ${HUB.lineSoft}`, fontFamily: HUB.display, fontWeight: 600, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: HUB.muted }}>League facts</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {facts.map(([label, value], index) => <Fact key={label} label={label} value={value} last={index >= facts.length - (facts.length % 2 === 0 ? 2 : 1)} />)}
          </Box>
          {k.seasonStart && k.seasonEnd && <SeasonTimeline start={k.seasonStart} end={k.seasonEnd} />}
        </Box>
      )}
      {!hasAny && <Box sx={emptyLine}>No further details have been added for this league.</Box>}
    </Box>
  )
}

export function HubLeagueConditions({ dto }: { dto: MyLeagueDto }) {
  const c = dto.playingConditions
  if (!c) return <Box sx={emptyLine}>No playing conditions set for this season yet.</Box>
  const facts: [string, string | number | null][] = [
    ['Overs per innings', c.maxOversPerInnings],
    ['Powerplay overs', c.powerplayOvers],
    ['Max overs per bowler', c.maxOversPerBowler],
    ['Balls per over', c.maxOversPerInnings != null ? describeBallsPerOver(c.maxBallsPerOver) : null],
    ['Free hit after a no ball', c.maxOversPerInnings != null ? describeFreeHit(c.freeHitOnNoBall) : null],
    ['Substitutions', c.maxOversPerInnings != null || c.allowSubstitutions ? (c.allowSubstitutions ? 'Allowed' : 'Not allowed') : null],
    ['Win', c.pointsForWin],
    ['Loss', c.pointsForLoss],
    ['Draw', c.pointsForDraw],
    ['No result', c.pointsForNoResult],
    ['Forfeit win', c.pointsForForfeitWin],
    // A bonus point is always one point (docs/specs/052): 1 when bonus points apply, 0 when the league scores points but has none.
    ['Bonus point', c.bonusPointsEnabled ? 1 : [c.pointsForWin, c.pointsForLoss, c.pointsForDraw, c.pointsForNoResult, c.pointsForForfeitWin].some((v) => v != null) ? 0 : null],
  ]
  const shown = facts.filter(([, value]) => value != null) as [string, string | number][]
  const notes = [c.fieldingRestrictionsNotes, c.additionalNotes].filter(Boolean)
  const pdf = isHttps(c.documentUrl) ? c.documentUrl : null
  if (shown.length === 0 && notes.length === 0 && !pdf) return <Box sx={emptyLine}>No playing conditions set for this season yet.</Box>
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      {shown.length > 0 && (
        <Box sx={tileGrid}>
          {shown.map(([label, value]) => <FactTile key={label} label={label} value={value} />)}
        </Box>
      )}
      {c.bonusPointsEnabled && c.bonusBattingOversThreshold != null && c.bonusBowlingRestrictionPercentage != null && (
        <Typography sx={{ fontSize: 16, color: HUB.muted }}>
          Bonus points apply: chase the target before over {c.bonusBattingOversThreshold}, or restrict the opposition to {c.bonusBowlingRestrictionPercentage}% of the target before over {c.bonusBattingOversThreshold}.
        </Typography>
      )}
      {notes.map((note) => <Typography key={note} sx={{ fontSize: 16, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{note}</Typography>)}
      {pdf && <LinkButton href={pdf} icon={<PictureAsPdfOutlinedIcon />}>Open PDF</LinkButton>}
    </Box>
  )
}

export function HubLeagueTeams({ dto }: { dto: MyLeagueDto }) {
  if (dto.teams.length === 0) return <Box sx={emptyLine}>No teams entered yet.</Box>
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
      {dto.teams.map((team) => (
        <Box key={team.id} component="article" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44, border: 1, borderColor: team.mine ? HUB.gold : HUB.line, bgcolor: team.mine ? alpha(HUB.gold, 0.12) : creamAlpha(0.07), borderRadius: '4px', p: 1.5 }}>
          <LeagueLogo logoUrl={team.logoUrl} size={40} />
          <Typography sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 0, overflowWrap: 'anywhere' }}>{team.name}</Typography>
          {team.mine && <Chip size="small" label="Your team" sx={{ ...tagSx, ml: 'auto' }} />}
        </Box>
      ))}
    </Box>
  )
}

export function HubLeagueFields({ dto }: { dto: MyLeagueDto }) {
  const fields = dto.fields ?? []
  if (fields.length === 0) return <Box sx={emptyLine}>No fields for this league yet</Box>
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
      {fields.map((field) => <HubFieldCard key={field.id} field={field} />)}
    </Box>
  )
}
