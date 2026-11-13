import type { ReactNode } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { Fact, FactTile } from './HubFacts'
import { HubSocialIconRow, LinkButton } from './HubSocialLinks'
import { HubTabBar, hubPanelId, hubTabId } from './HubTabBar'
import { LeagueLogo } from './HubLeagueCard'
import { HubFieldCard } from './HubFieldCard'
import { LEAGUE_TABS, ageBand, isHttps, localDate, longDate, shortDate, todayIso } from './leagueFormat'
import type { LeagueTab } from './leagueFormat'
import { describeBallsPerOver, describeFreeHit } from '../../../utils/playingConditions'

// docs/specs/123 (League page): the tab row (a pill row on a phone, a tab bar on wider screens, role=tablist with arrow keys)
// and the read-only Details, Playing conditions, and Teams tabs. Schedule and Results live in HubLeagueGames.
export const tabId = (tab: LeagueTab) => hubTabId('hub-league', tab)
export const panelId = (tab: LeagueTab) => hubPanelId('hub-league', tab)

export function HubLeagueTabBar({ value, onChange, counts }: { value: LeagueTab; onChange: (tab: LeagueTab) => void; counts?: Partial<Record<LeagueTab, number>> }) {
  return <HubTabBar tabs={LEAGUE_TABS} value={value} onChange={onChange} counts={counts} ariaLabel="League sections" idPrefix="hub-league" />
}

export const emptyLine = { border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted } as const
export const tagSx = { height: 26, borderRadius: '4px', fontSize: 13, fontWeight: 600, bgcolor: HUB.gold, color: HUB.ink } as const

const tileGrid = { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } } as const

// Icon-only links to the league's website and social pages, fixed top right of the league header.
export function HubLeagueSocialLinks({ league }: { league: MyLeagueDto['league'] }) {
  const links = [...(isHttps(league.website) ? [{ platform: 'Website', url: league.website as string }] : []), ...league.socialLinks]
  return <HubSocialIconRow links={links} />
}

// Owner, 2026-11-12: one facts card (label and value pairs, all cream, no gaps) and a small season timeline, in place of loose tiles.
const datePill = (value: string) => {
  const date = localDate(value)
  return date ? `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${shortDate(value)}` : value
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
