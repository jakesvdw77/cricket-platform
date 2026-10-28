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
import { HUB, hubOutlineButton } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { LEAGUE_TABS, ageBand, isHttps, longDate } from './leagueFormat'
import type { LeagueTab } from './leagueFormat'

// docs/specs/123 (League page): the tab row (a pill row on a phone, a tab bar on wider screens, role=tablist with arrow keys)
// and the read-only Details, Playing conditions, Teams and Key dates tabs. Schedule and Results live in HubLeagueGames.
export const tabId = (tab: LeagueTab) => `hub-league-tab-${tab}`
export const panelId = (tab: LeagueTab) => `hub-league-panel-${tab}`

export function HubLeagueTabBar({ value, onChange }: { value: LeagueTab; onChange: (tab: LeagueTab) => void }) {
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
      sx={{
        display: 'flex',
        gap: { xs: 1, sm: 0.5 },
        overflowX: 'auto',
        py: { xs: 1, sm: 0 },
        borderBottom: { sm: `1px solid ${HUB.line}` },
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {LEAGUE_TABS.map((tab) => {
        const selected = tab.id === value
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
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 15,
              whiteSpace: 'nowrap',
              color: { xs: selected ? HUB.ink : HUB.cream, sm: selected ? HUB.gold : HUB.cream },
              bgcolor: { xs: selected ? HUB.gold : 'transparent', sm: 'transparent' },
              border: { xs: `1px solid ${selected ? HUB.gold : HUB.line}`, sm: 'none' },
              borderRadius: { xs: 999, sm: 0 },
              borderBottom: { sm: `3px solid ${selected ? HUB.gold : 'transparent'}` },
              '&:hover': { bgcolor: { xs: selected ? HUB.gold : alpha(HUB.gold, 0.12), sm: alpha(HUB.gold, 0.08) } },
              '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            {tab.label}
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
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {links.map((link) => {
        const { name, icon } = link.platform === 'Website' ? { name: 'Website', icon: <LanguageIcon /> } : socialFor(link.url, link.platform.charAt(0).toUpperCase() + link.platform.slice(1))
        const label = `${name} (opens in a new tab)`
        return (
          <Tooltip key={`${link.platform}-${link.url}`} title={name}>
            <IconButton component="a" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={label} sx={{ width: 44, height: 44, color: HUB.gold, '&:hover': { bgcolor: alpha(HUB.gold, 0.12) }, '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}>
              {icon}
            </IconButton>
          </Tooltip>
        )
      })}
    </Box>
  )
}

export function HubLeagueDetails({ dto }: { dto: MyLeagueDto }) {
  const { league } = dto
  const band = ageBand(league)
  const hasAny = league.description || band || league.format
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {league.description && <Typography sx={{ fontSize: 17, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{league.description}</Typography>}
      <Box sx={tileGrid}>
        {band && <FactTile label="Age group" value={band} />}
        {league.format && <FactTile label="Format" value={LEAGUE_FORMAT_LABELS[league.format]} />}
      </Box>
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
    ['Substitutions', c.maxOversPerInnings != null || c.allowSubstitutions ? (c.allowSubstitutions ? 'Allowed' : 'Not allowed') : null],
    ['Win', c.pointsForWin],
    ['Loss', c.pointsForLoss],
    ['Draw', c.pointsForDraw],
    ['No result', c.pointsForNoResult],
    ['Forfeit win', c.pointsForForfeitWin],
  ]
  const shown = facts.filter(([, value]) => value != null) as [string, string | number][]
  const notes = [c.fieldingRestrictionsNotes, c.additionalNotes].filter(Boolean)
  const pdf = isHttps(c.documentUrl) ? c.documentUrl : null
  if (shown.length === 0 && notes.length === 0 && !pdf) return <Box sx={emptyLine}>No playing conditions set for this season yet.</Box>
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
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
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
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

export function HubLeagueDates({ dto }: { dto: MyLeagueDto }) {
  const k = dto.keyDates
  const dates: [string, string | null][] = [
    ['Season starts', k.seasonStart],
    ['Season ends', k.seasonEnd],
    ['First match', k.firstMatchDate],
    ['Next match', k.nextMatchDate],
    ['Last match', k.lastMatchDate],
  ]
  const shown = dates.filter(([, value]) => value) as [string, string][]
  if (shown.length === 0) return <Box sx={emptyLine}>No key dates set for this season yet.</Box>
  return (
    <Box sx={tileGrid}>
      {shown.map(([label, value]) => <FactTile key={label} label={label} value={longDate(value)} gold />)}
    </Box>
  )
}

