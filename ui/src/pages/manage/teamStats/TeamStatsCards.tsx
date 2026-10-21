import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Link as MuiLink, Typography } from '@mui/material'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { TeamStatsMatchRef, TeamStatsPageData } from '../../../api/teamStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { resultViewTo } from '../results/resultListHelpers'
import { coverageCaption } from '../playerStats/statsFormat'
import {
  countText,
  matchLineText,
  netRunRateCard,
  rateText,
  recordedCaption,
  winPercentText,
} from '../leaderboards/teamStatsFormat'

// docs/specs/116-team-stats.md ("The team page"): the six InfoCards. Every figure is the server's; this only chooses words,
// decimals and dashes. The cards sit in the shared CardGrid.

// One highlight: a label, the figure, an optional caption and the match line as a link to that result.
interface Highlight {
  key: string
  label: string
  value: string
  caption?: string
  match?: Pick<TeamStatsMatchRef, 'matchId' | 'matchDate' | 'opponentName'> | null
}

function Highlights({ items, backTo }: { items: Highlight[]; backTo: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: { xs: 2, md: 2.5 }, rowGap: { xs: 2, md: 2.5 } }}>
      {items.map((item) => (
        <Box key={item.key} data-testid={`highlight-${item.key}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.3 }}>
            {item.label}
          </Typography>
          <Typography variant="body2" color={item.value === NOT_ON_FILE ? 'text.secondary' : 'text.primary'} sx={{ fontWeight: item.value === NOT_ON_FILE ? 400 : 600, fontSize: { xs: '1.125rem', md: '1.1875rem' }, lineHeight: 1.3 }}>
            {item.value}
          </Typography>
          {item.match && (
            <MuiLink
              component={RouterLink}
              to={resultViewTo(item.match.matchId)}
              state={{ backTo, backLabel: 'Team' }}
              aria-label={`${item.label}, ${matchLineText(item.match) || 'match'}, open result`}
              sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere', display: 'inline-flex', alignItems: 'center', minHeight: 24 }}
            >
              {matchLineText(item.match) || 'Open result'}
            </MuiLink>
          )}
          {item.caption && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>
              {item.caption}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  )
}

function totalText(total: { runs: number; wickets?: number | null } | null | undefined): string {
  if (!total) return NOT_ON_FILE
  return total.wickets === null || total.wickets === undefined ? String(total.runs) : `${total.runs}/${total.wickets}`
}

const matchOf = (ref: TeamStatsMatchRef | null | undefined) => (ref ? { matchId: ref.matchId, matchDate: ref.matchDate, opponentName: ref.opponentName } : null)

export function RecordCard({ stats }: { stats: TeamStatsPageData }) {
  const { record, basis } = stats
  return (
    <InfoCard
      fieldSize="large"
      testId="team-record-card"
      title="Record"
      icon={<BarChartOutlinedIcon />}
      fields={[
        { label: 'Played', value: countText(record.played) },
        { label: 'Win %', value: winPercentText(record.winPercent), caption: record.decisive === 0 ? undefined : `of ${record.decisive} decisive results` },
        { label: 'Won', value: countText(record.won) },
        { label: 'Lost', value: countText(record.lost) },
        { label: 'Tied', value: countText(record.tied) },
        { label: 'Drawn', value: countText(record.drawn) },
        { label: 'No result', value: countText(record.noResult) },
        { label: 'Forfeits received · conceded', value: `${countText(basis.forfeits.received)} · ${countText(basis.forfeits.conceded)}` },
      ]}
    />
  )
}

export function BattingCard({ stats, backTo }: { stats: TeamStatsPageData; backTo: string }) {
  const { batting } = stats
  const usable = coverageCaption(batting.coverage.inningsUsable, batting.coverage.inningsCounted, 'with a full score')
  const classified = coverageCaption(batting.coverage.inningsClassifiable, batting.coverage.inningsCounted, 'that could be classed as complete')
  return (
    <InfoCard
      fieldSize="large"
      testId="team-batting-card"
      title="Batting"
      icon={<SportsCricketOutlinedIcon />}
      fields={[
        { label: 'Runs', value: countText(batting.runs), caption: usable },
        { label: 'Wickets lost', value: countText(batting.wicketsLost), caption: usable },
        { label: 'Average', value: rateText(batting.battingAverage), caption: usable },
        { label: 'Runs per innings', value: rateText(batting.runsPerInnings), caption: usable },
        { label: 'Run rate', value: rateText(batting.runRate), caption: coverageCaption(batting.coverage.inningsUsable, batting.coverage.inningsCounted, 'with balls recorded') },
      ]}
    >
      <Highlights
        backTo={backTo}
        items={[
          { key: 'highest-total', label: 'Highest total', value: totalText(batting.highestTotal), match: matchOf(batting.highestTotal) },
          { key: 'lowest-total', label: 'Lowest total', value: totalText(batting.lowestTotal), match: matchOf(batting.lowestTotal), caption: classified },
        ]}
      />
    </InfoCard>
  )
}

export function HighlightsCard({ stats, backTo }: { stats: TeamStatsPageData; backTo: string }) {
  const { chasing } = stats
  const chase = chasing.highestSuccessfulChase
  const byRuns = chasing.largestVictoryByRuns
  const byWickets = chasing.largestVictoryByWickets
  return (
    <InfoCard fieldSize="large" testId="team-highlights-card" title="Results highlights" icon={<EmojiEventsOutlinedIcon />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
        <Highlights
          backTo={backTo}
          items={[
            {
              key: 'chase',
              label: 'Highest successful chase',
              value: chase ? String(chase.runs) : NOT_ON_FILE,
              caption: chase ? `chasing ${chase.target}` : undefined,
              match: matchOf(chase),
            },
          ]}
        />
        <Highlights
          backTo={backTo}
          items={[
            { key: 'win-runs', label: 'Largest win by runs', value: byRuns ? `${byRuns.margin} ${byRuns.margin === 1 ? 'run' : 'runs'}` : NOT_ON_FILE, match: matchOf(byRuns) },
            {
              key: 'win-wickets',
              label: 'Largest win by wickets',
              value: byWickets ? `${byWickets.margin} ${byWickets.margin === 1 ? 'wicket' : 'wickets'}` : NOT_ON_FILE,
              match: matchOf(byWickets),
            },
          ]}
        />
      </Box>
    </InfoCard>
  )
}

export function BowlingCard({ stats }: { stats: TeamStatsPageData }) {
  const { bowling } = stats
  const usable = coverageCaption(bowling.coverage.inningsUsable, bowling.coverage.inningsCounted, 'with a full score')
  return (
    <InfoCard
      fieldSize="large"
      testId="team-bowling-card"
      title="Bowling"
      icon={<SportsBaseballOutlinedIcon />}
      fields={[
        { label: 'Wickets taken', value: countText(bowling.wicketsTaken), caption: usable },
        { label: 'Runs conceded', value: countText(bowling.runsConceded), caption: usable },
        { label: 'Average', value: rateText(bowling.bowlingAverage), caption: usable },
        { label: 'Economy', value: rateText(bowling.economy), caption: coverageCaption(bowling.coverage.inningsUsable, bowling.coverage.inningsCounted, 'with balls recorded') },
      ]}
    />
  )
}

export function ExtrasCard({ stats }: { stats: TeamStatsPageData }) {
  const { extras } = stats
  const overall = recordedCaption(extras.coverage.inningsWithExtras, extras.coverage.inningsCounted)
  const component = (key: keyof TeamStatsPageData['extras']['componentCoverage']) => {
    const coverage = extras.componentCoverage[key]
    return recordedCaption(coverage.inningsRecorded, coverage.inningsCounted)
  }
  return (
    <InfoCard
      fieldSize="large"
      testId="team-extras-card"
      title="Extras conceded"
      icon={<AddCircleOutlineIcon />}
      fields={[
        { label: 'Total', value: countText(extras.conceded), caption: overall },
        { label: 'Per match', value: rateText(extras.averagePerMatch), caption: overall },
        { label: 'Wides', value: countText(extras.wides), caption: component('wides') },
        { label: 'No-balls', value: countText(extras.noBalls), caption: component('noBalls') },
        { label: 'Byes', value: countText(extras.byes), caption: component('byes') },
        { label: 'Leg byes', value: countText(extras.legByes), caption: component('legByes') },
        { label: 'Penalty runs', value: countText(extras.penaltyRuns), caption: component('penaltyRuns') },
      ]}
    />
  )
}

export function NetRunRateCard({ stats }: { stats: TeamStatsPageData }) {
  const { value, detail } = netRunRateCard(stats.netRunRate)
  const shown = stats.netRunRate.status === 'SHOWN'
  const body: ReactNode = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography data-testid="nrr-value" sx={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.1, color: shown ? 'primary.dark' : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" data-testid="nrr-detail" sx={{ fontSize: '0.9375rem', lineHeight: 1.4 }}>
        An all-out innings counts at the full overs. {detail}
      </Typography>
    </Box>
  )
  return (
    <InfoCard fieldSize="large" testId="team-nrr-card" title="Net run rate" icon={<SpeedOutlinedIcon />}>
      {body}
    </InfoCard>
  )
}
