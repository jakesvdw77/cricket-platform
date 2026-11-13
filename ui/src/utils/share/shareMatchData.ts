import type { Match } from '../../api/matchApi'
import type { PlayingRole } from '../../api/matchSideApi'
import type { TeamSheetSide } from '../teamSheetSide'
import type { WeatherSummary } from '../weather/wmo'
import { daysUntil } from '../weather/forecastWindow'
import { shareName } from './shareName'
import { countdownWording, usesLineup } from './matchShareFormats'
import type { MatchContent, MatchLayout, MatchLineupOrder, MatchSideChoice } from './matchShareFormats'
import type { FunFact } from './matchFunFacts'
import { googleMapsDirectionsUrl } from '../directions'
import type { DirectionsTarget } from '../fieldLocation'

// docs/specs/131-match-sharing.md (Content catalogue): the ONE model every match output (PDF, image, TV, WhatsApp, Facebook)
// is built from. Every player name in it has already passed through shareName, so no generator formats a name by hand.
// Pure; no React.

export interface MatchSharePlayer {
  // The position in the batting order, null for a selected player without one yet.
  order: number | null
  name: string
  captain: boolean
  keeper: boolean
  role: PlayingRole
  jersey: number | null
}

export interface MatchShareLineup {
  teamName: string
  logoUrl: string | null
  // Our own team (a club Team) or the opposition.
  own: boolean
  players: MatchSharePlayer[]
  twelfthMan: string | null
  // docs/specs/144: true when the list is in batting order, so the generators draw the position numbers; false for an alphabetical list.
  numbered: boolean
}

// docs/specs/133 (Match share): the Directions line. Field name, a Google Maps link and the access note when set. Never a person.
export interface MatchShareDirections {
  fieldName: string
  url: string
  note: string | null
  approximate: boolean
}

// "Directions: Wanderers (approximate), use gate 2 off Main Rd" (the link is a separate line or follows it, per format).
export function directionsText(directions: MatchShareDirections): string {
  return `Directions: ${directions.fieldName}${directions.approximate ? ' (approximate)' : ''}${directions.note ? `, ${directions.note}` : ''}`
}

export function directionsOf(target: DirectionsTarget | null | undefined): MatchShareDirections | null {
  return target ? { fieldName: target.name, url: googleMapsDirectionsUrl(target.point), note: target.viaAccess ? target.accessNote : null, approximate: target.approximate } : null
}

export interface MatchShareModel {
  content: MatchContent
  title: string
  homeName: string
  awayName: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  dateIso: string
  dayLabel: string
  timeLabel: string
  whenLabel: string
  venue: string | null
  leagueName: string | null
  seasonLabel: string | null
  clubName: string | null
  // "3 days to go", "Tomorrow", "Today", "Match day"; null for a past day.
  countdown: string | null
  weather: WeatherSummary | null
  // docs/specs/133: null when no point resolves; the generators draw it only when the Include Directions switch is on.
  directions: MatchShareDirections | null
  // The lineups in scope, in the order they are shown.
  lineups: MatchShareLineup[]
  layout: MatchLayout
  facts: FunFact[]
}

export interface BuildMatchShareInput {
  content: MatchContent
  match: Match
  // Home first, then away (the shape useTeamSheetShare assembles).
  sides: [TeamSheetSide, TeamSheetSide]
  logos: { home: string | null; away: string | null }
  ownKeys: ('home' | 'away')[]
  // The own side to treat as ours in a derby (the one with a selected XI); absent, the home side.
  preferredOurs?: 'home' | 'away' | null
  side: MatchSideChoice
  layout: MatchLayout
  // docs/specs/144: how the lineups are listed; omitted means batting order (every existing caller is unchanged).
  lineupOrder?: MatchLineupOrder
  initialsOnly: boolean
  leagueName: string | null
  seasonLabel: string | null
  clubName: string | null
  weather: WeatherSummary | null
  // docs/specs/133: where Get Directions goes; omitted, the model has no Directions line.
  directions?: DirectionsTarget | null
  facts: FunFact[]
  now?: Date
}

const pad = (value: number): string => String(value).padStart(2, '0')

export function matchDateParts(matchDate: string): { dateIso: string; dayLabel: string; timeLabel: string; whenLabel: string } {
  const date = new Date(matchDate)
  if (Number.isNaN(date.getTime())) return { dateIso: '', dayLabel: '', timeLabel: '', whenLabel: '' }
  const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
  const timeLabel = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return {
    dateIso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    dayLabel,
    timeLabel,
    whenLabel: `${dayLabel} ${timeLabel}`,
  }
}

// Surname then first name, ignoring case and accents (the same collation as the availability responses list).
const byName = (a: { lastName: string; firstName: string }, b: { lastName: string; firstName: string }): number =>
  a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) || a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })

// The selected XI of a side, in batting order (players without a position after the numbered ones) or alphabetical (docs/specs/144);
// the 12th man is always separate and last.
export function lineupOf(side: TeamSheetSide, own: boolean, logoUrl: string | null, initialsOnly: boolean, order: MatchLineupOrder = 'BATTING'): MatchShareLineup {
  const squadById = new Map(side.squad.map((member) => [member.playerProfileId, member]))
  const players = side.side?.players ?? []
  const twelfthId = side.side?.twelfthManPlayerId ?? null
  // The real name of a player, before shareName turns it into initials, so an alphabetical list never reorders when the initials switch flips.
  const personOf = (playerProfileId: string) => {
    const member = squadById.get(playerProfileId)
    const entry = players.find((player) => player.playerProfileId === playerProfileId)
    return member
      ? { id: playerProfileId, firstName: member.firstName, lastName: member.lastName }
      : { id: playerProfileId, firstName: entry?.firstName ?? '', lastName: entry?.lastName ?? '' }
  }
  const nameOf = (playerProfileId: string): string => shareName(personOf(playerProfileId), initialsOnly) || 'Unknown player'
  const rows = players.filter((player) => player.playerProfileId !== twelfthId)
  const positioned = rows.filter((row) => row.battingOrder != null).sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
  const waiting = rows.filter((row) => row.battingOrder == null)
  const batting = order === 'BATTING'
  // Batting order: the numbered players first, then the ones still waiting for a position. Alphabetical: everyone by name.
  const listed = batting ? [...positioned, ...waiting] : [...rows].sort((a, b) => byName(personOf(a.playerProfileId), personOf(b.playerProfileId)))
  return {
    teamName: side.teamName,
    logoUrl,
    own,
    twelfthMan: twelfthId ? nameOf(twelfthId) : null,
    numbered: batting,
    players: listed.map((row) => ({
      order: row.battingOrder ?? null,
      name: nameOf(row.playerProfileId),
      captain: side.side?.captainPlayerId === row.playerProfileId,
      keeper: side.side?.wicketKeeperPlayerId === row.playerProfileId,
      role: row.role,
      jersey: squadById.get(row.playerProfileId)?.squadJerseyNumber ?? null,
    })),
  }
}

// Which of home or away is "our side" and which "the opposition": our side is the home team when both are ours (a derby), unless
// `preferred` names the own side to treat as ours (the one with a selected XI).
export function sideRoles(ownKeys: ('home' | 'away')[], preferred?: 'home' | 'away' | null): { ours: 'home' | 'away' | null; opposition: 'home' | 'away' | null } {
  const ours = preferred && ownKeys.includes(preferred) ? preferred : ownKeys.includes('home') ? 'home' : ownKeys.includes('away') ? 'away' : null
  if (!ours) return { ours: null, opposition: null }
  return { ours, opposition: ours === 'home' ? 'away' : 'home' }
}

export function buildMatchShareModel(input: BuildMatchShareInput): MatchShareModel {
  const { match, sides, ownKeys } = input
  const parts = matchDateParts(match.matchDate)
  const { ours, opposition } = sideRoles(ownKeys, input.preferredOurs)
  const sideOf = (key: 'home' | 'away') => (key === 'home' ? sides[0] : sides[1])
  const logoOf = (key: 'home' | 'away') => (key === 'home' ? input.logos.home : input.logos.away)
  const lineupFor = (key: 'home' | 'away') => lineupOf(sideOf(key), ownKeys.includes(key), logoOf(key), input.initialsOnly, input.lineupOrder)

  const keys: ('home' | 'away')[] = []
  if (usesLineup(input.content)) {
    if (input.side === 'BOTH') keys.push('home', 'away')
    else if (input.side === 'OPPOSITION' && opposition) keys.push(opposition)
    else if (ours) keys.push(ours)
  }
  const now = input.now ?? new Date()
  const days = daysUntil(match.matchDate, now)
  const started = new Date(match.matchDate).getTime() <= now.getTime()

  return {
    content: input.content,
    title: `${sides[0].teamName} v ${sides[1].teamName}`,
    homeName: sides[0].teamName,
    awayName: sides[1].teamName,
    homeLogoUrl: input.logos.home,
    awayLogoUrl: input.logos.away,
    ...parts,
    venue: match.venue,
    leagueName: input.leagueName,
    seasonLabel: input.seasonLabel,
    clubName: input.clubName,
    countdown: countdownWording(days, started),
    weather: input.weather,
    directions: directionsOf(input.directions),
    lineups: usesLineup(input.content) ? keys.map(lineupFor) : [],
    layout: input.layout,
    facts: input.facts,
  }
}

const clean = (name: string): string => name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()

// "<home> v <away> <yyyy-mm-dd>[ <suffix>].<ext>": team names only, never a player name.
export function matchShareFileName(model: Pick<MatchShareModel, 'homeName' | 'awayName' | 'dateIso'>, extension: string, suffix?: string): string {
  const base = `${clean(model.homeName)} v ${clean(model.awayName)} ${model.dateIso}`
  return `${suffix ? `${base} ${clean(suffix)}` : base}.${extension}`
}

export const lineupTitle = (model: MatchShareModel): string => model.lineups.map((lineup) => lineup.teamName).join(' and ')
