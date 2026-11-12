import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import type { LeagueFormat } from './leagueApi'
import type { LeaguePlayingConditions } from './leaguePlayingConditionsApi'
import type { SocialLink } from '../components/marketing/SocialLinksRow'
import type { BattingStance, BowlingArm, BowlingType } from './playerApi'
import type { PublicAnswer, PublicAnswers } from './publicAvailabilityShared'
import type { PublicRoundWindow } from './publicSectionAvailabilityApi'

// docs/specs/119 Part 3 (3C): "Player Hub", what an agent (or a player for their own record) sees and does.
// Backend: /api/v1/me/players/**, authorised only from the caller's own active links and own player record.
export interface MyPlayerSummary {
  key: string
  firstName: string
  lastName: string
  photoUrl: string | null
  clubId: string
  clubName: string
  groupLabel: string | null
  self: boolean
  main: boolean
}

// The full list of agents, primary first, for every linked agent (docs/specs/121). maskedEmail and linkId only come for the
// main agent; INVITED rows too, after the active ones.
export interface MyPlayerAgent {
  linkId?: string
  name: string
  maskedEmail?: string
  main: boolean
  // True on the caller's own row.
  you?: boolean
  status: 'ACTIVE' | 'INVITED'
}

export interface MyPlayer extends MyPlayerSummary {
  sectionNames: string[]
  teamNames: string[]
  jerseyNumber: number | null
  canEditMedical: boolean
  // yyyy-MM-dd; editable by the main agent or the adult player only.
  dateOfBirth: string | null
  canEditDateOfBirth: boolean
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
  agentCount: number
  // Only the main agent may hand over, add agents or cancel invitations.
  canManageAgents: boolean
  // The caller's own link id, needed to leave. Not in the agreed contract yet; Leave is hidden while it is absent.
  myLinkId?: string | null
  // Only filled for the main agent.
  agents: MyPlayerAgent[]
}

export interface UpdateMyPlayerRequest {
  photoUrl: string | null
  // Echo the stored value when not editing or not allowed.
  dateOfBirth: string | null
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
}

export interface MyPoll {
  pollId: string
  kind: 'SQUAD' | 'GROUP'
  title: string
  teamName: string | null
  sectionName: string | null
  homeName: string | null
  awayName: string | null
  matchDate: string | null
  venue: string | null
  scheduledCloseAt: string | null
  windows: PublicRoundWindow[]
  answers: PublicAnswer[]
}

export async function listMyPlayers(): Promise<MyPlayerSummary[]> {
  const { data } = await api.get<MyPlayerSummary[]>('/me/players')
  return data
}

export async function getMyPlayer(key: string): Promise<MyPlayer> {
  const { data } = await api.get<MyPlayer>(`/me/players/${key}`)
  return data
}

export async function updateMyPlayer(key: string, body: UpdateMyPlayerRequest): Promise<MyPlayer> {
  const { data } = await api.put<MyPlayer>(`/me/players/${key}`, body)
  return data
}

export async function listMyPlayerPolls(key: string): Promise<MyPoll[]> {
  const { data } = await api.get<MyPoll[]>(`/me/players/${key}/polls`)
  return data
}

export async function saveMyPlayerPollAnswers(key: string, pollId: string, answers: PublicAnswer[]): Promise<PublicAnswers> {
  const { data } = await api.put<PublicAnswers>(`/me/players/${key}/polls/${pollId}/answers`, { answers })
  return data
}

export const myPlayersKey = ['me', 'players'] as const

export function useMyPlayers(enabled = true) {
  return useQuery({ queryKey: myPlayersKey, queryFn: listMyPlayers, enabled, retry: false })
}

export function useMyPlayer(key: string | undefined) {
  return useQuery({ queryKey: [...myPlayersKey, key], queryFn: () => getMyPlayer(key as string), enabled: Boolean(key), retry: false })
}

export function useUpdateMyPlayer(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMyPlayerRequest) => updateMyPlayer(key, body),
    onSuccess: (data) => {
      queryClient.setQueryData([...myPlayersKey, key], data)
      return queryClient.invalidateQueries({ queryKey: myPlayersKey, exact: true })
    },
  })
}

// docs/specs/146: the scoreboard ticker passes `enabled` and a longer `staleTime`; every other caller passes nothing.
export interface ReadOptions {
  enabled?: boolean
  staleTime?: number
}

export function useMyPlayerPolls(key: string | undefined, options: ReadOptions = {}) {
  return useQuery({
    queryKey: [...myPlayersKey, key, 'polls'],
    queryFn: () => listMyPlayerPolls(key as string),
    enabled: Boolean(key) && (options.enabled ?? true),
    ...(options.staleTime !== undefined && { staleTime: options.staleTime }),
    retry: false,
  })
}

export function useSaveMyPlayerPollAnswers(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pollId, answers }: { pollId: string; answers: PublicAnswer[] }) => saveMyPlayerPollAnswers(key, pollId, answers),
    onSuccess: () => {
      // The match page shows the answer too (docs/specs/135).
      void queryClient.invalidateQueries({ queryKey: myPlayerMatchesKey(key) })
      return queryClient.invalidateQueries({ queryKey: [...myPlayersKey, key, 'polls'] })
    },
  })
}

export async function inviteMyPlayerAgent(key: string, body: { email: string; mode: 'HANDOVER' | 'ADD' }): Promise<void> {
  await api.post(`/me/players/${key}/agents`, body)
}

export function useInviteAgent(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; mode: 'HANDOVER' | 'ADD' }) => inviteMyPlayerAgent(key, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...myPlayersKey, key] }),
  })
}

// docs/specs/121 (Field Directory): the club's fields for the selected player, read only. The server orders them (home first,
// then name) and caps the list at 200. mapUrl is https or null; the screen re-checks the scheme before linking.
export interface FieldDto {
  id: string
  name: string
  owner: string | null
  addressLine1: string | null
  city: string
  provinceState: string | null
  postalCode: string | null
  country: string
  mapUrl: string | null
  verified: boolean
  home: boolean
}

export async function listMyPlayerFields(key: string): Promise<FieldDto[]> {
  const { data } = await api.get<FieldDto[]>(`/me/players/${key}/fields`)
  return data
}

export function useMyPlayerFields(key: string | undefined) {
  return useQuery({ queryKey: [...myPlayersKey, key, 'fields'], queryFn: () => listMyPlayerFields(key as string), enabled: Boolean(key), retry: false })
}

// docs/specs/123-player-hub-leagues.md (API Contract): the leagues the selected player's teams play in, read only. Hand-typed
// from the spec; the server twin is MyLeagueService. No contacts, no manager-only fields, no fixture link target.
export interface MyLeagueSeasonOption {
  id: string
  name: string
  current: boolean
}

export interface MyLeagueTeamRef {
  id: string
  name: string
}

export interface MyLeagueSummaryDto {
  id: string
  name: string
  logoUrl: string | null
  minAge: number | null
  maxAge: number | null
  teamCount: number
  myTeams: MyLeagueTeamRef[]
  nextMatchDate: string | null
  matchCount: number
}

export interface MyLeaguesDto {
  seasons: MyLeagueSeasonOption[]
  seasonId: string
  leagues: MyLeagueSummaryDto[]
}

export interface MyLeagueInfoDto {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  minAge: number | null
  maxAge: number | null
  ageCutoffDay: number | null
  ageCutoffMonth: number | null
  format: LeagueFormat | null
  website: string | null
  socialLinks: SocialLink[]
}

export interface MyLeagueSeasonDto {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
}

// The structured conditions as the Conditions tab reads them, plus the PDF link; null on MyLeagueDto when none are set.
export type MyPlayingConditionsDto = Omit<LeaguePlayingConditions, 'id' | 'leagueId' | 'seasonId' | 'uploadedAt' | 'uploadedBy'>

export interface MyLeagueTeamDto {
  id: string
  name: string
  abbreviation: string | null
  logoUrl: string | null
  mine: boolean
}

export interface MyLeagueFixtureDto {
  matchId: string
  // yyyy-MM-dd and HH:mm.
  date: string
  time: string | null
  homeName: string
  homeLogoUrl: string | null
  awayName: string
  awayLogoUrl: string | null
  venue: string | null
  mine: boolean
  // docs/specs/133: the field and its stored position, for the forecast and Get Directions. Optional so older fixtures stay valid.
  playingAreaId?: string | null
  playingAreaName?: string | null
  playingAreaLatitude?: number | null
  playingAreaLongitude?: number | null
  playingAreaAccessLatitude?: number | null
  playingAreaAccessLongitude?: number | null
  playingAreaAccessNote?: string | null
}

export interface MyLeagueResultDto {
  matchId: string
  date: string
  homeName: string
  awayName: string
  homeScore: string
  awayScore: string
  resultLine: string
  mine: boolean
}

export interface MyLeagueKeyDatesDto {
  seasonStart: string | null
  seasonEnd: string | null
  firstMatchDate: string | null
  lastMatchDate: string | null
  nextMatchDate: string | null
}

export interface MyLeagueDto {
  league: MyLeagueInfoDto
  season: MyLeagueSeasonDto
  playingConditions: MyPlayingConditionsDto | null
  teams: MyLeagueTeamDto[]
  schedule: MyLeagueFixtureDto[]
  results: MyLeagueResultDto[]
  // Only the fields this league's matches or results use in the selected season; the Field Directory shape.
  fields: FieldDto[]
  keyDates: MyLeagueKeyDatesDto
  // LEAGUE share format codes the club has disabled.
  shareDisabledFormats: string[]
}

export async function getMyPlayerLeagues(key: string, seasonId?: string): Promise<MyLeaguesDto> {
  const { data } = await api.get<MyLeaguesDto>(`/me/players/${key}/leagues`, { params: seasonId ? { seasonId } : undefined })
  return data
}

export async function getMyPlayerLeague(key: string, leagueId: string, seasonId?: string): Promise<MyLeagueDto> {
  const { data } = await api.get<MyLeagueDto>(`/me/players/${key}/leagues/${leagueId}`, { params: seasonId ? { seasonId } : undefined })
  return data
}

export function useMyPlayerLeagues(key: string | undefined, seasonId?: string) {
  return useQuery({
    queryKey: [...myPlayersKey, key, 'leagues', seasonId ?? 'current'],
    queryFn: () => getMyPlayerLeagues(key as string, seasonId),
    enabled: Boolean(key),
    retry: false,
  })
}

export function useMyPlayerLeague(key: string | undefined, leagueId: string | undefined, seasonId?: string) {
  return useQuery({
    queryKey: [...myPlayersKey, key, 'leagues', leagueId, seasonId ?? 'current'],
    queryFn: () => getMyPlayerLeague(key as string, leagueId as string, seasonId),
    enabled: Boolean(key) && Boolean(leagueId),
    retry: false,
  })
}

// docs/specs/135 (Player Hub match view): the held player's matches and one match page. Backend: GET /me/players/{key}/matches and
// .../matches/{matchId} (404 outside the player's teams). The server decides phase, selection, the announced-only XI, the junior
// initials and the embed URL; the client only formats and renders what it is given.
export type MyMatchPhase = 'LIVE' | 'UPCOMING' | 'RECENT'
export type MyMatchSelection = 'SELECTED' | 'SELECTED_TWELFTH' | 'NOT_SELECTED' | 'NOT_ANNOUNCED'
export type MyMatchStatus = 'UPCOMING' | 'PLAYED' | 'CANCELLED' | 'POSTPONED'
export type MyStreamProvider = 'YOUTUBE' | 'VIMEO' | 'FACEBOOK' | 'OTHER'

export interface MyMatchTeamDto {
  name: string
  logoUrl?: string | null
}

export interface MyMatchResultDto {
  homeScore: string
  awayScore: string
  resultLine: string
}

export interface MyMatchSummaryDto {
  matchId: string
  phase: MyMatchPhase
  // yyyy-MM-dd and HH:mm.
  date: string
  time: string | null
  startedAt?: string | null
  home: MyMatchTeamDto
  away: MyMatchTeamDto
  league?: string | null
  venue?: string | null
  mine: boolean
  selection: MyMatchSelection
  hasLiveScore: boolean
  hasStream: boolean
  result?: MyMatchResultDto | null
  // Optional until the server sends the player's side outcome for a recent row; the row only colours itself when it is there.
  outcome?: 'WON' | 'LOST' | 'TIED' | null
  // The player's own squad-poll answer; upcoming rows with a poll only.
  availability?: MyMatchAvailabilityDto | null
}

export interface MyMatchListDto {
  live: MyMatchSummaryDto[]
  upcoming: MyMatchSummaryDto[]
  recent: MyMatchSummaryDto[]
  // The full counts behind the pills (recent is capped by recentLimit). Optional so an older server does not break the page.
  upcomingTotal?: number
  recentTotal?: number
}

// The LiveScore seam: a discriminated source. Only HubLiveScore reads it; a NATIVE kind joins later.
export interface LiveScoreSource {
  kind: 'EXTERNAL'
  url: string
  host: string
}

export interface MyMatchStreamDto {
  url: string
  provider: MyStreamProvider
  // Built by the server from an allow-listed template; null means nothing can be embedded.
  embedUrl?: string | null
}

export interface MyMatchPlayerDto {
  name: string
  role?: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | null
  captain: boolean
  keeper: boolean
  twelfth: boolean
}

export interface MyMatchSideDto {
  name: string
  logoUrl?: string | null
  mine: boolean
  announced: boolean
  players: MyMatchPlayerDto[]
}

export interface MyMatchAvailabilityDto {
  answer?: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE' | null
  pollId: string
  pollOpen: boolean
}

export interface MyMatchRefDto {
  id: string
  name: string
}

export interface MyMatchDto {
  matchId: string
  date: string
  time: string | null
  startedAt?: string | null
  phase: MyMatchPhase
  status: MyMatchStatus
  league?: MyMatchRefDto | null
  season?: MyMatchRefDto | null
  venue?: string | null
  playingAreaId?: string | null
  playingAreaName?: string | null
  playingAreaLatitude?: number | null
  playingAreaLongitude?: number | null
  playingAreaAccessLatitude?: number | null
  playingAreaAccessLongitude?: number | null
  playingAreaAccessNote?: string | null
  home: MyMatchSideDto
  away: MyMatchSideDto
  selection: MyMatchSelection
  availability?: MyMatchAvailabilityDto | null
  liveScore?: LiveScoreSource | null
  stream?: MyMatchStreamDto | null
  result?: MyMatchResultDto | null
}

export async function getMyPlayerMatches(key: string, recentLimit?: number): Promise<MyMatchListDto> {
  const { data } = await api.get<MyMatchListDto>(`/me/players/${key}/matches`, { params: recentLimit ? { recentLimit } : undefined })
  return data
}

export async function getMyPlayerMatch(key: string, matchId: string): Promise<MyMatchDto> {
  const { data } = await api.get<MyMatchDto>(`/me/players/${key}/matches/${matchId}`)
  return data
}

// The live phase is the server's clock; while one is showing, ask again every minute so the badge, elapsed time and Watch Live follow it.
export const MATCH_REFRESH_MS = 60_000

export const myPlayerMatchesKey = (key: string | undefined) => [...myPlayersKey, key, 'matches'] as const

export function useMyPlayerMatches(key: string | undefined, options: ReadOptions & { recentLimit?: number } = {}) {
  return useQuery({
    queryKey: [...myPlayerMatchesKey(key), 'list', options.recentLimit ?? 'default'],
    queryFn: () => getMyPlayerMatches(key as string, options.recentLimit),
    placeholderData: keepPreviousData,
    enabled: Boolean(key) && (options.enabled ?? true),
    ...(options.staleTime !== undefined && { staleTime: options.staleTime }),
    retry: false,
    refetchInterval: (query) => ((query.state.data?.live.length ?? 0) > 0 ? MATCH_REFRESH_MS : false),
  })
}

export function useMyPlayerMatch(key: string | undefined, matchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...myPlayerMatchesKey(key), matchId],
    queryFn: () => getMyPlayerMatch(key as string, matchId as string),
    enabled: enabled && Boolean(key) && Boolean(matchId),
    retry: false,
    refetchInterval: (query) => (query.state.data?.phase === 'LIVE' ? MATCH_REFRESH_MS : false),
  })
}
