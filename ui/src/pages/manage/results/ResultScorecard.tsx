import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Chip, Typography, useMediaQuery, useTheme } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import StarIcon from '@mui/icons-material/Star'
import type { Match } from '../../../api/matchApi'
import { getScorecard, linkResultPlayer, resultKeys, resultsKey } from '../../../api/matchResultApi'
import type {
  BattingEntry,
  BowlingEntry,
  FieldingEntry,
  Innings,
  MatchAward,
  MatchResult,
  ResultPlayer,
  ResultSide,
  Scorecard,
} from '../../../api/matchResultApi'
import { LinkButton } from '../../../components/LinkButton'
import { NameModeToggle } from '../../../components/NameModeToggle'
import { PlayerName } from '../../../components/PlayerName'
import { PlayerSlotPicker } from '../../../components/PlayerSlotPicker'
import { StandoutToggle } from '../../../components/StandoutToggle'
import { usePlayerLabeler } from '../../../hooks/usePlayerLabeler'
import { dismissalText } from '../../../utils/dismissal'
import { ballsToOvers } from '../../../utils/oversFormat'
import { scorecardPersonName } from '../../../utils/playerDisplayName'
import type { PersonName } from '../../../utils/playerDisplayName'
import { effectiveFeatured } from '../../../utils/standout'
import { playerRowKey } from '../../../utils/scorecardPrefill'
import { zebraTint } from '../../../utils/zebraTint'
import type { OwnSides } from '../../../utils/resultLine'
import { ResultSection } from './ResultSection'
import { extrasLine, fieldingCredits, runsPerOver, strikeRate, targetLine, totalLine } from './scorecardView'

const DASH = '–'
const other = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')
const num = (value: number | null | undefined) => (value === null || value === undefined ? DASH : value)
const isGuest = (player: ResultPlayer) => !player.opposition && (player.guest ?? !player.playerProfileId)
const featuredOf = (entry: { featured?: boolean | null; suggested?: boolean | null; featuredOverride: 'FEATURE' | 'HIDE' | null }) =>
  entry.featured ?? effectiveFeatured(entry.suggested, entry.featuredOverride)

interface Column<T> {
  key: string
  header: string
  width: string
  numeric?: boolean
  // Shown on a phone; the others join from sm.
  phone?: boolean
  render: (row: T) => ReactNode
}

// A zebra table: a bordered box that scrolls sideways inside its card on a phone (the page itself never scrolls).
function ScoreTable<T>({ label, columns, rows, rowKey, phone }: { label: string; columns: Array<Column<T>>; rows: T[]; rowKey: (row: T) => string; phone: boolean }) {
  const shown = columns.filter((column) => !phone || column.phone)
  const template = shown.map((column) => column.width).join(' ')
  const rowSx = { display: 'grid', gridTemplateColumns: template, columnGap: 1, alignItems: 'center', px: 1.25, fontVariantNumeric: 'tabular-nums' } as const
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
      <Box role="table" aria-label={label} sx={{ minWidth: phone ? 420 : 0 }}>
        <Box
          role="row"
          sx={{ ...rowSx, minHeight: 36, bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'text.secondary' }}
        >
          {shown.map((column) => (
            <Box key={column.key} role="columnheader" sx={{ textAlign: column.numeric ? 'right' : 'left' }}>
              {column.header}
            </Box>
          ))}
        </Box>
        {rows.map((row, index) => (
          <Box key={rowKey(row)} role="row" sx={{ ...rowSx, minHeight: 44, py: 0.5, ...(index % 2 === 1 ? { bgcolor: zebraTint } : {}) }}>
            {shown.map((column) => (
              <Box key={column.key} role="cell" sx={{ minWidth: 0, textAlign: column.numeric ? 'right' : 'left' }}>
                {column.render(row)}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" component="h3" fontWeight={700} sx={{ mt: 2, mb: 0.75 }}>
      {children}
    </Typography>
  )
}

export interface ResultScorecardProps {
  clubId: string
  match: Match
  result: MatchResult
  names: { home: string; away: string }
  ours: OwnSides
  toss: string | null
  // The capture wizard's preview: no Link to player buttons, nothing that changes the result.
  readOnly?: boolean
  // The club team's section on each side, carried into a player created from the Link to player dialog.
  sectionIds?: { home?: string | null; away?: string | null }
}

// docs/specs/101-match-results-our-side-scorecard.md (Review step and result page): the scorecard of both sides on the
// result page, a section per side (the team's name as the heading) with its batting, bowling and fielding as zebra tables,
// the extras and total lines, and for our sides the standouts and the team's player of the match. Names go through
// PlayerName (Full name | First name at the top). A guest row of our side offers Link to player, on a draft and on a
// published result alike.
export function ResultScorecard({ clubId, match, result, names, ours, toss, readOnly = false, sectionIds }: ResultScorecardProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const queryClient = useQueryClient()
  const [linking, setLinking] = useState<ResultPlayer | null>(null)

  const scorecardQuery = useQuery({
    queryKey: resultKeys.scorecard(clubId, match.id),
    queryFn: () => getScorecard(clubId, match.id),
  })
  const scorecard: Scorecard | undefined = scorecardQuery.data

  const linkMutation = useMutation({
    mutationFn: ({ player, profileId }: { player: ResultPlayer; profileId: string }) =>
      linkResultPlayer(clubId, match.id, player.id as string, profileId),
    onSuccess: () => {
      setLinking(null)
      void queryClient.invalidateQueries({ queryKey: resultsKey(clubId) })
      void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    },
    onError: () => setLinking(null),
  })

  const players = useMemo(() => scorecard?.players ?? [], [scorecard])
  const view: PersonName[] = useMemo(() => players.map(scorecardPersonName), [players])
  const label = usePlayerLabeler(view)

  if (scorecardQuery.isPending) return null
  if (scorecardQuery.isError || !scorecard) {
    return (
      <ResultSection title="Scorecard">
        <Alert severity="error">We couldn&apos;t load the scorecard. Please try again.</Alert>
      </ResultSection>
    )
  }

  const byKey = new Map(players.map((player) => [playerRowKey(player), player]))
  const playerOf = (entry: { resultPlayerId?: string | null; playerClientKey?: string | null }) =>
    byKey.get((entry.resultPlayerId ?? entry.playerClientKey) as string)
  const nameOfPlayer = (player: ResultPlayer | undefined) => (player ? label(scorecardPersonName(player)) : null)

  const regular = result.innings
    .filter((innings) => innings.kind !== 'SUPER_OVER')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const inningsOf = (side: ResultSide): Innings | undefined => regular.find((innings) => innings.battingSide === side)
  const order: ResultSide[] = [
    ...new Set<ResultSide>([...regular.map((innings) => innings.battingSide).filter((side): side is ResultSide => side !== null), 'HOME', 'AWAY']),
  ]
  const hasContent = (side: ResultSide) => players.some((player) => player.side === side)
  const sides = order.filter(hasContent)

  const official = scorecard.awards.find((award) => award.awardType === 'PLAYER_OF_MATCH')
  const awardName = (award: MatchAward): ReactNode => {
    const player = playerOf(award)
    if (player) return <PlayerName person={scorecardPersonName(player)} view={view} />
    return award.displayName ?? award.playerName ?? DASH
  }

  const takenOnSide = (side: ResultSide) =>
    Object.fromEntries(
      players.filter((player) => player.side === side && player.playerProfileId).map((player) => [player.playerProfileId as string, 'Already on this side']),
    )

  const sideBlock = (side: ResultSide) => {
    const sidePlayers = players.filter((player) => player.side === side)
    const isOurs = side === 'HOME' ? ours.home : ours.away
    const batting = scorecard.batting.filter((entry) => (playerOf(entry)?.side ?? entry.battingSide) === side)
    const bowling = scorecard.bowling
      .filter((entry) => (playerOf(entry)?.side ?? other(entry.battingSide)) === side)
      .sort((a, b) => (a.bowlingOrder ?? 999) - (b.bowlingOrder ?? 999))
    const fielding = scorecard.fielding.filter((entry) => (playerOf(entry)?.side ?? other(entry.battingSide)) === side)
    const batted = batting.filter((entry) => entry.howOut !== 'DID_NOT_BAT').sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    const withFigures = new Set([...batting, ...bowling, ...fielding].map((entry) => (entry.resultPlayerId ?? entry.playerClientKey) as string))
    const didNotBat = batting.length === 0 ? [] : sidePlayers.filter((player) => !batted.some((entry) => playerOf(entry) === player) && (!player.substitute || withFigures.has(playerRowKey(player))))
    const twelfth = sidePlayers.filter((player) => player.substitute && !withFigures.has(playerRowKey(player)))
    const innings = inningsOf(side)
    const scoreInnings = scorecard.innings?.find((candidate) => candidate.battingSide === side)
    const extras = innings ? extrasLine(scoreInnings, innings.extras) : null
    const total = innings ? totalLine(innings, result.ballsPerOver) : null
    const target = targetLine(result, regular[0], regular.length > 1 && regular[1]?.battingSide === side)
    const teamAward = scorecard.awards.find((award) => award.awardType === 'TEAM_PLAYER_OF_MATCH' && award.side === side)
    const showDots = bowling.some((entry) => entry.dots !== null && entry.dots !== undefined)
    const fielders = fielding.filter((entry) => fieldingCredits(entry) !== '')

    const nameCell = (player: ResultPlayer | undefined, entry: { featured?: boolean | null; suggested?: boolean | null; featuredOverride: 'FEATURE' | 'HIDE' | null }, extra?: ReactNode) => {
      if (!player) return DASH
      const person = scorecardPersonName(player)
      const guest = isGuest(player)
      return (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600} component="span" sx={{ overflowWrap: 'anywhere' }}>
              <PlayerName person={person} view={view} />
            </Typography>
            {guest && <Chip size="small" label="Guest" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />}
            {guest && isOurs && !readOnly && <LinkButton onClick={() => setLinking(player)} />}
            {isOurs && featuredOf(entry) && <StandoutToggle suggested readOnly override={null} onChange={() => {}} playerLabel={label(person)} />}
          </Box>
          {extra}
          {/* linkedBy is a user id, not a name, so only the date is shown until a name lookup exists. */}
          {!guest && isOurs && player.linkedBy && player.linkedAt && (
            <Typography variant="caption" color="text.secondary" component="div">
              Linked to a registered player on {new Date(player.linkedAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      )
    }

    const howOut = (entry: BattingEntry) =>
      dismissalText(entry.howOut, nameOfPlayer(byKey.get(entry.bowlerPlayerId as string)), nameOfPlayer(byKey.get(entry.fielderPlayerId as string)))

    const battingColumns: Array<Column<BattingEntry>> = [
      { key: 'pos', header: '#', width: '32px', render: (entry) => num(entry.position) },
      {
        key: 'player',
        header: 'Batter',
        width: phone ? 'minmax(130px, 1fr)' : 'minmax(140px, 1.2fr)',
        phone: true,
        render: (entry) => {
          const player = playerOf(entry)
          return nameCell(
            player,
            entry,
            <>
              {phone && (
                <Typography variant="caption" color="text.secondary" component="div">
                  {howOut(entry)}
                </Typography>
              )}
            </>,
          )
        },
      },
      { key: 'how', header: 'How out', width: 'minmax(140px, 1.4fr)', render: (entry) => <Typography variant="body2">{howOut(entry)}</Typography> },
      { key: 'r', header: 'R', width: '40px', numeric: true, phone: true, render: (entry) => <b>{num(entry.runs)}</b> },
      { key: 'b', header: 'B', width: '40px', numeric: true, phone: true, render: (entry) => num(entry.balls) },
      { key: '4s', header: '4s', width: '36px', numeric: true, phone: true, render: (entry) => num(entry.fours) },
      { key: '6s', header: '6s', width: '36px', numeric: true, phone: true, render: (entry) => num(entry.sixes) },
      { key: 'sr', header: 'SR', width: '56px', numeric: true, render: (entry) => strikeRate(entry.runs, entry.balls) },
    ]

    const bowlingColumns: Array<Column<BowlingEntry>> = [
      { key: 'player', header: 'Bowler', width: 'minmax(120px, 1.4fr)', phone: true, render: (entry) => nameCell(playerOf(entry), entry) },
      { key: 'overs', header: 'Overs', width: '52px', numeric: true, phone: true, render: (entry) => (entry.balls === null ? DASH : ballsToOvers(entry.balls, result.ballsPerOver)) },
      { key: 'maidens', header: 'Maidens', width: '68px', numeric: true, phone: true, render: (entry) => num(entry.maidens) },
      ...(showDots ? [{ key: 'dots', header: 'Dots', width: '48px', numeric: true, render: (entry: BowlingEntry) => num(entry.dots) }] : []),
      { key: 'runs', header: 'Runs', width: '48px', numeric: true, phone: true, render: (entry) => num(entry.runs) },
      { key: 'wkts', header: 'Wickets', width: '64px', numeric: true, phone: true, render: (entry) => <b>{num(entry.wickets)}</b> },
      { key: 'econ', header: 'Economy', width: '68px', numeric: true, phone: true, render: (entry) => runsPerOver(entry.runs, entry.balls, result.ballsPerOver) },
      { key: 'wides', header: 'Wides', width: '52px', numeric: true, render: (entry) => num(entry.wides) },
      { key: 'nb', header: 'No-balls', width: '68px', numeric: true, render: (entry) => num(entry.noBalls) },
    ]

    const standouts: ReactNode[] = isOurs
      ? [
          ...batted.filter(featuredOf).map((entry) => (
            <span key={`b${entry.id ?? entry.position}`}>
              <PlayerName person={scorecardPersonName(playerOf(entry) as ResultPlayer)} view={view} /> {num(entry.runs)} ({num(entry.balls)})
            </span>
          )),
          ...bowling.filter(featuredOf).map((entry) => (
            <span key={`w${entry.id ?? entry.bowlingOrder}`}>
              <PlayerName person={scorecardPersonName(playerOf(entry) as ResultPlayer)} view={view} /> {num(entry.wickets)}/{num(entry.runs)}
            </span>
          )),
          ...fielding.filter(featuredOf).map((entry: FieldingEntry) => (
            <span key={`f${entry.id ?? entry.resultPlayerId}`}>
              <PlayerName person={scorecardPersonName(playerOf(entry) as ResultPlayer)} view={view} /> {fieldingCredits(entry)}
            </span>
          )),
        ]
      : []

    const inningsNumber = regular.findIndex((candidate) => candidate.battingSide === side) + 1
    return (
      <ResultSection key={side} title={names[side === 'HOME' ? 'home' : 'away']} testId={`scorecard-${side.toLowerCase()}`}>
        {target && (
          <Typography variant="body2" fontWeight={600} data-testid="scorecard-target" sx={{ mb: 1 }}>
            {target}
          </Typography>
        )}
        {batted.length === 0 && bowling.length === 0 && fielders.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No scorecard captured for this side.
          </Typography>
        ) : null}

        {batted.length > 0 && (
          <>
            <Heading>{inningsNumber > 0 ? `Batting · Innings ${inningsNumber}` : 'Batting'}</Heading>
            <ScoreTable label={`${names[side === 'HOME' ? 'home' : 'away']} batting`} columns={battingColumns} rows={batted} rowKey={(entry) => String(entry.id ?? entry.resultPlayerId)} phone={phone} />
            {extras && <Typography variant="body2" sx={{ mt: 1, px: 0.5 }}>{extras}</Typography>}
            {total && (
              <Typography variant="body2" fontWeight={700} sx={{ px: 0.5 }} data-testid="scorecard-total">
                {total.text}
                {total.runRate ? ` (run rate ${total.runRate})` : ''}
              </Typography>
            )}
          </>
        )}
        {didNotBat.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1, px: 0.5 }} data-testid="scorecard-did-not-bat">
            <b>Did not bat:</b>{' '}
            {didNotBat.map((player, index) => (
              <span key={playerRowKey(player)}>
                {index > 0 && ', '}
                <PlayerName person={scorecardPersonName(player)} view={view} />
                {isGuest(player) && isOurs && !readOnly && (
                  <LinkButton onClick={() => setLinking(player)} sx={{ ml: 0.5 }} />
                )}
              </span>
            ))}
          </Typography>
        )}
        {twelfth.length > 0 && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, px: 0.5 }}>
            12th man:{' '}
            {twelfth.map((player, index) => (
              <span key={playerRowKey(player)}>
                {index > 0 && ', '}
                <PlayerName person={scorecardPersonName(player)} view={view} />
              </span>
            ))}
          </Typography>
        )}

        {bowling.length > 0 && (
          <>
            <Heading>Bowling</Heading>
            <ScoreTable label={`${names[side === 'HOME' ? 'home' : 'away']} bowling`} columns={bowlingColumns} rows={bowling} rowKey={(entry) => String(entry.id ?? entry.resultPlayerId)} phone={phone} />
          </>
        )}

        {fielders.length > 0 && (
          <>
            <Heading>Fielding</Heading>
            <Box component="ul" aria-label="Fielding" sx={{ m: 0, pl: 2.5 }}>
              {fielders.map((entry) => (
                <Typography component="li" variant="body2" key={String(entry.id ?? entry.resultPlayerId)}>
                  {playerOf(entry) ? <PlayerName person={scorecardPersonName(playerOf(entry) as ResultPlayer)} view={view} /> : DASH}: {fieldingCredits(entry)}
                </Typography>
              ))}
            </Box>
          </>
        )}

        {isOurs && standouts.length > 0 && (
          <>
            <Heading>Standouts</Heading>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="scorecard-standouts">
              {standouts.map((node, index) => (
                <Chip key={index} size="small" icon={<StarIcon />} label={node} sx={{ '& .MuiChip-icon': { color: 'warning.main' } }} />
              ))}
            </Box>
          </>
        )}
        {isOurs && teamAward && (
          <Box sx={{ mt: 1.5 }}>
            <Chip icon={<EmojiEventsOutlinedIcon />} color="primary" variant="outlined" data-testid="scorecard-team-award" label={<>Team player of the match: {awardName(teamAward)}</>} />
          </Box>
        )}
      </ResultSection>
    )
  }

  return (
    <>
      <ResultSection title="Scorecard" testId="scorecard-intro">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box sx={{ maxWidth: { sm: 320 } }}>
            <NameModeToggle />
          </Box>
          {toss && <Typography variant="body2">{toss}</Typography>}
          {official && (
            <Box>
              <Chip icon={<EmojiEventsOutlinedIcon />} color="primary" data-testid="scorecard-official-award" label={<>Player of the match: {awardName(official)}</>} />
            </Box>
          )}
          {linkMutation.isError && (
            <Alert severity="error" role="alert">
              We couldn&apos;t link that player. Please try again.
            </Alert>
          )}
        </Box>
      </ResultSection>
      {sides.map(sideBlock)}
      <PlayerSlotPicker
        open={linking !== null}
        onClose={() => setLinking(null)}
        clubId={clubId}
        teamId={linking?.side === 'AWAY' ? match.awayTeamId ?? null : match.homeTeamId ?? null}
        seasonId={match.seasonId}
        title="Link to a registered player"
        note="Choose the registered player this guest was. Their figures then count toward that player."
        allowGuest={false}
        takenPlayers={linking ? takenOnSide(linking.side) : {}}
        onPickPlayer={(picked) => linking && linkMutation.mutate({ player: linking, profileId: picked.playerProfileId })}
        onPickGuest={() => {}}
        clubScope={linking ? { sectionId: (linking.side === 'AWAY' ? sectionIds?.away : sectionIds?.home) ?? null, leagueId: match.leagueId } : undefined}
        newPlayer={linking ? { name: linking.displayName ?? [linking.firstName, linking.lastName].filter(Boolean).join(' '), sectionId: (linking.side === 'AWAY' ? sectionIds?.away : sectionIds?.home) ?? null, leagueId: match.leagueId, seasonId: match.seasonId } : undefined}
      />
    </>
  )
}
