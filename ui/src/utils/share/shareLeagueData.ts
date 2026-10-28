import type { League } from '../../api/leagueApi'
import { LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { LeagueContact } from '../../api/leagueContactApi'
import type { LeaguePlayingConditions } from '../../api/leaguePlayingConditionsApi'
import type { LeagueSeasonDates } from '../../api/leagueSeasonDatesApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'
import type { Match } from '../../api/matchApi'
import type { MyLeagueDto } from '../../api/myPlayersApi'
import type { ResultListItem } from '../../api/matchResultApi'
import type { Section } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'
import { ageRangeLabel } from '../ageRange'
import { DEFAULT_BALLS_PER_OVER } from '../oversFormat'
import { resolveEffectiveMaxOversPerBowler } from '../playingConditions'
import { resultLine } from '../resultLine'
import { isJuniorMatch } from './isJuniorMatch'
import type { JuniorMatchResult } from './isJuniorMatch'
import { LEAGUE_CONTENT_LABELS, orderedContents } from './leagueShareFormats'
import type { LeagueContent } from './leagueShareFormats'
import { shareName } from './shareName'
import { sideScoreText } from './shareResultData'

// docs/specs/122-league-sharing.md (Read model): ONE pure model every league share format reads, mirroring
// shareResultData. Every person's name in it is already in the shared form (shareName); a league with a maxAge of 18 or
// under (or whose own teams are junior) is junior for the whole share, so the initials are forced on. The Player Hub
// (group D) reuses this shape later. Pure; no React.

export interface LeagueShareSeason {
  label: string
}

export interface LeagueShareContact {
  role: string
  // shareName form.
  name: string
  // Present only when the manager opted in for this share.
  phone: string | null
  email: string | null
}

export interface LeagueShareDetails {
  name: string
  formatLabel: string | null
  ageLabel: string | null
  logoUrl: string | null
  website: string | null
  // Present only when the manager opted in for this share.
  phone: string | null
  email: string | null
  contacts: LeagueShareContact[]
  matchCount: number
}

export interface LeagueShareConditionRow {
  label: string
  value: string
}

export interface LeagueShareConditionSection {
  heading: string
  rows: LeagueShareConditionRow[]
}

export interface LeagueShareTeam {
  name: string
  abbreviation: string | null
  logoUrl: string | null
  own: boolean
}

export interface LeagueShareSide {
  name: string
  logoUrl: string | null
  own: boolean
}

export interface LeagueShareFixture {
  matchId: string
  // yyyy-mm-dd and "Saturday 17 October 2026" in the browser's time zone, then "14:30".
  dateIso: string
  dateLabel: string
  timeLabel: string
  // The match start as stored (an ISO date and time), for the calendar.
  startsAt: string
  home: LeagueShareSide
  away: LeagueShareSide
  venue: string | null
}

export interface LeagueShareResult {
  matchId: string
  dateIso: string
  dateLabel: string
  home: LeagueShareSide
  away: LeagueShareSide
  homeScore: string
  awayScore: string
  resultLine: string
  venue: string | null
}

export type LeagueKeyDateKind = 'LEAGUE_START' | 'LEAGUE_END' | 'FIRST_MATCH' | 'NEXT_MATCH' | 'LAST_MATCH'

export interface LeagueShareKeyDate {
  kind: LeagueKeyDateKind
  label: string
  dateIso: string
  dateLabel: string
}

export interface LeagueShareModel {
  // The ticked contents, in the standard order.
  contents: LeagueContent[]
  clubName: string | null
  season: LeagueShareSeason | null
  league: LeagueShareDetails
  junior: JuniorMatchResult
  // The value in force: always true for a junior share.
  initialsOnly: boolean
  includeContact: boolean
  conditions: LeagueShareConditionSection[]
  teams: LeagueShareTeam[]
  schedule: LeagueShareFixture[]
  results: LeagueShareResult[]
  keyDates: LeagueShareKeyDate[]
  // League, season and club names only: never a person's name.
  title: string
}

export interface BuildLeagueShareInput {
  contents: readonly string[]
  league: League
  season: { label: string } | null
  clubName: string | null
  conditions: LeaguePlayingConditions | null | undefined
  contacts?: LeagueContact[]
  // The club's own teams entered in the league for the season, and the league's registered opponents for the season.
  ownTeams: Team[]
  leagueTeams: LeagueTeam[]
  // Every club team by id, to name a side of a match.
  teamsById: Map<string, Team>
  matches: Match[]
  // Published results of the league and season.
  results: ResultListItem[]
  seasonDates: LeagueSeasonDates | null | undefined
  // The club or user choice; ignored (forced on) for a junior share.
  initialsOnly: boolean
  includeContact: boolean
  // The club's flat section list; undefined (not readable) fails safe to junior when the league has no maxAge.
  sections: Pick<Section, 'id' | 'parentSectionId' | 'name' | 'maxAge'>[] | undefined
  now?: Date
}

const pad = (value: number) => String(value).padStart(2, '0')

function dateParts(value: string): { iso: string; label: string; time: string } {
  // A bare yyyy-mm-dd is a calendar date, read in local time so it never shifts a day.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(value)
  if (Number.isNaN(date.getTime())) return { iso: value.slice(0, 10), label: value.slice(0, 10), time: '' }
  return {
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    label: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: bare ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export const leagueShareFileName = (model: Pick<LeagueShareModel, 'title'>, extension: string): string =>
  `${model.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()}.${extension}`

type ConditionsInput = Omit<LeaguePlayingConditions, 'id' | 'leagueId' | 'seasonId' | 'uploadedAt' | 'uploadedBy'>

function conditionSections(record: ConditionsInput | null | undefined): LeagueShareConditionSection[] {
  if (!record || record.maxOversPerInnings == null) return []
  const sections: LeagueShareConditionSection[] = []
  const format: LeagueShareConditionRow[] = [{ label: 'Overs per innings', value: String(record.maxOversPerInnings) }]
  if (record.powerplayOvers != null) format.push({ label: 'Powerplay overs', value: String(record.powerplayOvers) })
  const perBowler = resolveEffectiveMaxOversPerBowler(record.maxOversPerInnings, record.maxOversPerBowler)
  if (perBowler != null) format.push({ label: 'Max overs per bowler', value: String(perBowler) })
  format.push({ label: 'Substitutions', value: record.allowSubstitutions ? 'Allowed' : 'Not allowed' })
  sections.push({ heading: 'Match format', rows: format })

  const points: LeagueShareConditionRow[] = (
    [
      ['Win', record.pointsForWin],
      ['Loss', record.pointsForLoss],
      ['Draw', record.pointsForDraw],
      ['No result', record.pointsForNoResult],
      ['Forfeit win', record.pointsForForfeitWin],
    ] as [string, number | null][]
  )
    .filter(([, value]) => value != null)
    .map(([label, value]) => ({ label, value: String(value) }))
  if (points.length > 0) sections.push({ heading: 'Points', rows: points })

  if (
    record.bonusPointsEnabled &&
    record.bonusBattingOversThreshold != null &&
    record.bonusBowlingRestrictionPercentage != null
  ) {
    const threshold = record.bonusBattingOversThreshold
    sections.push({
      heading: 'Bonus points',
      rows: [
        { label: 'Batting', value: `Chase the target before over ${threshold} for a bonus point` },
        {
          label: 'Bowling',
          value: `Restrict them to ${record.bonusBowlingRestrictionPercentage}% of the target (or bowl them out) before over ${threshold} for a bonus point`,
        },
      ],
    })
  }
  return sections
}

// Why a content has nothing to share, or null when it has something. The dialog lists such a content greyed with this
// reason. `conditions` undefined (still loading) is treated as nothing yet by the caller, not here.
export function leagueContentGaps(input: {
  conditions: ConditionsInput | null | undefined
  teamCount: number
  matchCount: number
  publishedResultCount: number
  keyDateCount: number
}): Partial<Record<LeagueContent, string>> {
  const gaps: Partial<Record<LeagueContent, string>> = {}
  if (!input.conditions || input.conditions.maxOversPerInnings == null) {
    gaps.CONDITIONS = 'No playing conditions set for this season yet'
  }
  if (input.teamCount === 0) gaps.TEAMS = 'No teams entered for this season yet'
  if (input.matchCount === 0) gaps.SCHEDULE = 'No matches scheduled for this season yet'
  if (input.publishedResultCount === 0) gaps.RESULTS = 'No published results for this season yet'
  if (input.keyDateCount === 0) gaps.KEY_DATES = 'No dates set for this season yet'
  return gaps
}

export function buildLeagueShareModel(input: BuildLeagueShareInput): LeagueShareModel {
  const { league } = input
  const junior = isJuniorMatch({
    league,
    sections: input.sections,
    teams: input.ownTeams.map((team) => ({ sectionId: team.sectionId })),
  })
  const initialsOnly = junior.junior ? true : input.initialsOnly

  const side = (teamId: string | null, name: string | null, logo: string | null, fallback: string): LeagueShareSide => {
    const team = teamId ? input.teamsById.get(teamId) : undefined
    return {
      name: team?.name?.trim() || name?.trim() || fallback,
      logoUrl: logo || team?.logoUrl || null,
      own: Boolean(teamId),
    }
  }

  const activeMatches = input.matches.filter((match) => match.active).sort((a, b) => a.matchDate.localeCompare(b.matchDate))

  const schedule: LeagueShareFixture[] = activeMatches.map((match) => {
    const parts = dateParts(match.matchDate)
    return {
      matchId: match.id,
      dateIso: parts.iso,
      dateLabel: parts.label,
      timeLabel: parts.time,
      startsAt: match.matchDate,
      home: side(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, 'TBC'),
      away: side(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, 'TBC'),
      venue: match.venue,
    }
  })

  const results: LeagueShareResult[] = input.results
    .filter((item) => item.result.status === 'PUBLISHED')
    .sort((a, b) => a.match.matchDate.localeCompare(b.match.matchDate))
    .map(({ match, result }) => {
      const parts = dateParts(match.matchDate)
      const home = side(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, 'Home team')
      const away = side(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, 'Away team')
      const balls = result.ballsPerOver || DEFAULT_BALLS_PER_OVER
      return {
        matchId: match.id,
        dateIso: parts.iso,
        dateLabel: parts.label,
        home,
        away,
        homeScore: sideScoreText(result, 'HOME', balls),
        awayScore: sideScoreText(result, 'AWAY', balls),
        resultLine: resultLine(result, { home: home.name, away: away.name }),
        venue: match.venue,
      }
    })

  const teams: LeagueShareTeam[] = [
    ...input.ownTeams
      .filter((team) => team.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({ name: team.name, abbreviation: team.abbreviation, logoUrl: team.logoUrl, own: true })),
    ...input.leagueTeams
      .filter((team) => team.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({ name: team.name, abbreviation: team.abbreviation, logoUrl: team.logoUrl, own: false })),
  ]

  const keyDates: LeagueShareKeyDate[] = []
  const addDate = (kind: LeagueKeyDateKind, label: string, value: string | null | undefined) => {
    if (!value) return
    const parts = dateParts(value)
    keyDates.push({ kind, label, dateIso: parts.iso, dateLabel: parts.label })
  }
  addDate('LEAGUE_START', 'League starts', input.seasonDates?.startDate)
  addDate('FIRST_MATCH', 'First match', activeMatches[0]?.matchDate)
  const nowMs = (input.now ?? new Date()).getTime()
  addDate('NEXT_MATCH', 'Next match', activeMatches.find((match) => new Date(match.matchDate).getTime() >= nowMs)?.matchDate)
  addDate('LAST_MATCH', 'Last match', activeMatches[activeMatches.length - 1]?.matchDate)
  addDate('LEAGUE_END', 'League ends', input.seasonDates?.endDate)
  keyDates.sort((a, b) => a.dateIso.localeCompare(b.dateIso))

  const contacts: LeagueShareContact[] = (input.contacts ?? [])
    .filter((contact) => contact.active)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((contact) => ({
      role: contact.role,
      name: shareName({ firstName: contact.contact.firstName, lastName: contact.contact.lastName }, initialsOnly),
      phone: input.includeContact ? contact.contact.phone || null : null,
      email: input.includeContact ? contact.contact.email || null : null,
    }))

  const seasonLabel = input.season?.label ?? null
  return {
    contents: orderedContents(input.contents),
    clubName: input.clubName ?? null,
    season: input.season ? { label: input.season.label } : null,
    league: {
      name: league.name,
      formatLabel: league.format ? LEAGUE_FORMAT_LABELS[league.format] : null,
      ageLabel: ageRangeLabel(league),
      logoUrl: league.logoUrl,
      website: league.website,
      phone: input.includeContact ? league.phone : null,
      email: input.includeContact ? league.email : null,
      contacts,
      matchCount: activeMatches.length,
    },
    junior,
    initialsOnly,
    includeContact: input.includeContact,
    conditions: conditionSections(input.conditions),
    teams,
    schedule,
    results,
    keyDates,
    title: [league.name, seasonLabel].filter(Boolean).join(' '),
  }
}

// The heading of a content section, shared by the PDF and the texts.
export const leagueSectionHeading = (content: LeagueContent): string => LEAGUE_CONTENT_LABELS[content]

export interface BuildMyLeagueShareInput {
  contents: readonly string[]
  // The Player Hub read (docs/specs/123): no contacts exist in it, so the model never has any.
  league: MyLeagueDto
  clubName: string | null
  initialsOnly: boolean
}

// The second input source (docs/specs/123, Share): the same LeagueShareModel from the Player Hub's MyLeagueDto. Own teams
// are the `mine` ones; contacts and the phone and email are always empty; a junior share is decided on the league's maxAge
// alone (the Hub reads no sections, so an uncapped league fails safe to junior, initials on).
export function buildMyLeagueShareModel(input: BuildMyLeagueShareInput): LeagueShareModel {
  const { league: dto } = input
  const info = dto.league
  const junior = isJuniorMatch({ league: { maxAge: info.maxAge }, sections: undefined, teams: [] })
  const initialsOnly = junior.junior ? true : input.initialsOnly
  const ownNames = new Set(dto.teams.filter((team) => team.mine).map((team) => team.name))
  const side = (name: string, logoUrl: string | null): LeagueShareSide => ({ name: name.trim() || 'TBC', logoUrl, own: ownNames.has(name) })

  const schedule: LeagueShareFixture[] = [...dto.schedule]
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
    .map((row) => {
      const parts = dateParts(row.date)
      const time = row.time ? row.time.slice(0, 5) : ''
      return {
        matchId: row.matchId,
        dateIso: parts.iso,
        dateLabel: parts.label,
        timeLabel: time,
        startsAt: time ? `${row.date}T${time}:00` : row.date,
        home: side(row.homeName, row.homeLogoUrl),
        away: side(row.awayName, row.awayLogoUrl),
        venue: row.venue,
      }
    })

  const results: LeagueShareResult[] = [...dto.results]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const parts = dateParts(row.date)
      return {
        matchId: row.matchId,
        dateIso: parts.iso,
        dateLabel: parts.label,
        home: side(row.homeName, null),
        away: side(row.awayName, null),
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        resultLine: row.resultLine,
        venue: null,
      }
    })

  const teams: LeagueShareTeam[] = [...dto.teams]
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name))
    .map((team) => ({ name: team.name, abbreviation: team.abbreviation, logoUrl: team.logoUrl, own: team.mine }))

  const keyDates: LeagueShareKeyDate[] = []
  const addDate = (kind: LeagueKeyDateKind, label: string, value: string | null | undefined) => {
    if (!value) return
    const parts = dateParts(value)
    keyDates.push({ kind, label, dateIso: parts.iso, dateLabel: parts.label })
  }
  addDate('LEAGUE_START', 'League starts', dto.keyDates.seasonStart)
  addDate('FIRST_MATCH', 'First match', dto.keyDates.firstMatchDate)
  addDate('NEXT_MATCH', 'Next match', dto.keyDates.nextMatchDate)
  addDate('LAST_MATCH', 'Last match', dto.keyDates.lastMatchDate)
  addDate('LEAGUE_END', 'League ends', dto.keyDates.seasonEnd)
  keyDates.sort((a, b) => a.dateIso.localeCompare(b.dateIso))

  const seasonLabel = dto.season.name
  return {
    contents: orderedContents(input.contents),
    clubName: input.clubName,
    season: { label: seasonLabel },
    league: {
      name: info.name,
      formatLabel: info.format ? LEAGUE_FORMAT_LABELS[info.format] : null,
      ageLabel: ageRangeLabel(info),
      logoUrl: info.logoUrl,
      website: info.website,
      phone: null,
      email: null,
      contacts: [],
      matchCount: dto.schedule.length,
    },
    junior,
    initialsOnly,
    includeContact: false,
    conditions: conditionSections(dto.playingConditions),
    teams,
    schedule,
    results,
    keyDates,
    title: [info.name, seasonLabel].filter(Boolean).join(' '),
  }
}
