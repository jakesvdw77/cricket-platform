import { useState } from 'react'
import { Box, Chip, ListSubheader, MenuItem, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import type { BattingEntry, BowlingEntry, FieldingEntry, MatchAward, ResultPlayer, ResultSide, Scorecard } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { InfoCard } from '../../../../components/InfoCard'
import { Input } from '../../../../components/Input'
import { PlayerName } from '../../../../components/PlayerName'
import { badgeSx } from '../../../../components/RecordCard'
import { StandoutToggle } from '../../../../components/StandoutToggle'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { canFeatureBatter, canFeatureBowler, canFeatureFielder, effectiveFeatured } from '../../../../utils/standout'
import { ballsToOvers } from '../../../../utils/oversFormat'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, entryRefOf, playerRowKey } from '../../../../utils/scorecardPrefill'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import {
  battingOf,
  bowlingOf,
  fieldingOf,
  officialAward,
  patchBatting,
  patchBowling,
  patchFielding,
  playersByKey,
  playersOfSide,
  scorecardOf,
  setAward,
  teamAward,
  withScorecard,
} from '../scorecardDraft'
import type { OurSide, ScorecardStepProps } from './stepTypes'

const NONE = 'none'
const OTHER = 'other'

const opposite = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')

// A suggested row, a row the manager featured, and a suggestion they removed (kept visible so it can be restored).
const listed = (entry: { suggested?: boolean | null; featuredOverride: 'FEATURE' | 'HIDE' | null }) =>
  Boolean(entry.suggested) || entry.featuredOverride !== null

function battingFigure(entry: BattingEntry): string {
  if (entry.runs === null) return 'batted'
  return entry.balls != null ? `${entry.runs} off ${entry.balls}` : `${entry.runs}`
}

function bowlingFigure(entry: BowlingEntry, ballsPerOver: number): string {
  const overs = entry.balls != null ? ` (${ballsToOvers(entry.balls, ballsPerOver)})` : ''
  return `${entry.wickets ?? 0} ${entry.wickets === 1 ? 'wicket' : 'wickets'} for ${entry.runs ?? 0} runs${overs.replace(')', ' overs)')}`
}

function fieldingFigure(entry: FieldingEntry): string {
  const parts = [
    [entry.catches, 'catch', 'catches'],
    [entry.stumpings, 'stumping', 'stumpings'],
    [entry.runOuts, 'run-out', 'run-outs'],
  ] as const
  return parts
    .filter(([count]) => (count ?? 0) > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`)
    .join(', ')
}

interface PersonSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  // The players to choose from, grouped by the team they played for when more than one group is given.
  groups: Array<{ title: string | null; players: ResultPlayer[] }>
  standoutKeys: Set<string>
  view: PersonName[]
  noneLabel: string
  otherLabel?: string
  disabled?: boolean
}

function PersonSelect({ label, value, onChange, groups, standoutKeys, view, noneLabel, otherLabel, disabled }: PersonSelectProps) {
  const items = groups.flatMap((group) => {
    const ordered = [...group.players.filter((p) => standoutKeys.has(playerRowKey(p))), ...group.players.filter((p) => !standoutKeys.has(playerRowKey(p)))]
    return [
      ...(group.title && groups.length > 1 ? [<ListSubheader key={`h-${group.title}`}>{group.title}</ListSubheader>] : []),
      ...ordered.map((player) => (
        <MenuItem key={playerRowKey(player)} value={playerRowKey(player)} sx={{ minHeight: 44, gap: 1 }}>
          <PlayerName person={scorecardPersonName(player)} view={view} />
          {!player.playerProfileId && <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem' }} />}
          {standoutKeys.has(playerRowKey(player)) && <StarOutlineIcon fontSize="small" aria-label="Standout" sx={{ color: 'warning.main', ml: 'auto' }} />}
        </MenuItem>
      )),
    ]
  })
  return (
    <Input select label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} inputProps={{ 'aria-label': label }}>
      <MenuItem value={NONE} sx={{ minHeight: 44 }}>
        {noneLabel}
      </MenuItem>
      {items}
      {otherLabel && (
        <MenuItem value={OTHER} sx={{ minHeight: 44 }}>
          {otherLabel}
        </MenuItem>
      )}
    </Input>
  )
}

// docs/specs/101-match-results-our-side-scorecard.md, step "Awards": the standouts the scorecard suggests (a star on
// each row to remove or add one), the official player of the match (one of our players, someone else by name, or none)
// and our team's player of the match. In a derby the official pick lists both teams' players and each team has its own
// pick; the Home | Away switch only chooses which team's standouts are shown.
export function AwardsStep({ draft, onReplace, disabled, oursSides, scorecardSide, onScorecardSideChange, sides, onGoToStep }: ScorecardStepProps) {
  const ours = oursSides.find((candidate) => candidate.side === scorecardSide) ?? oursSides[0]
  const derby = oursSides.length > 1
  const scorecard = scorecardOf(draft)
  const ballsPerOver = draft.ballsPerOver ?? 6
  const byKey = playersByKey(scorecard)
  const allPlayers = oursSides.flatMap((candidate) => playersOfSide(scorecard, candidate.side))
  const view: PersonName[] = allPlayers.map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const commit = (next: Scorecard) => onReplace(withScorecard(draft, next))
  const opposingName = sides.find((side) => side.side === opposite(ours.side))?.name ?? 'the other side'

  const personOf = (key: string | null): PersonName => {
    const found = key ? byKey.get(key) : undefined
    return found ? scorecardPersonName(found) : { firstName: '', lastName: '' }
  }

  // ---- standouts of the shown team ----
  const side = ours.side
  const batters = battingOf(scorecard, side).filter(canFeatureBatter).filter(listed)
  const bowlers = bowlingOf(scorecard, side).filter(canFeatureBowler).filter(listed)
  const fielders = fieldingOf(scorecard, side).filter((entry) => canFeatureFielder(entry) && listed(entry))
  const standoutKeys = (forSide: ResultSide) =>
    new Set(
      [
        ...battingOf(scorecard, forSide).filter(canFeatureBatter).filter((e) => effectiveFeatured(e.suggested, e.featuredOverride)),
        ...bowlingOf(scorecard, forSide).filter(canFeatureBowler).filter((e) => effectiveFeatured(e.suggested, e.featuredOverride)),
        ...fieldingOf(scorecard, forSide).filter(canFeatureFielder).filter((e) => effectiveFeatured(e.suggested, e.featuredOverride)),
      ].map((entry) => entryPlayerKey(entry) as string),
    )
  const allStandouts = new Set(oursSides.flatMap((candidate) => [...standoutKeys(candidate.side)]))

  const row = (key: string, figure: string, toggle: React.ReactNode) => {
    const player = byKey.get(key)
    return (
      <Box
        key={key}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, px: 1, borderRadius: 1, '&:nth-of-type(even)': { bgcolor: 'action.hover' } }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
          <PlayerName person={personOf(key)} view={view} />
          {player && !player.playerProfileId && (
            <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem', ml: 0.75 }} />
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {figure}
        </Typography>
        {toggle}
      </Box>
    )
  }

  const group = (title: string, rows: React.ReactNode[]) =>
    rows.length > 0 && (
      <Box key={title}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
          {title}
        </Typography>
        {rows}
      </Box>
    )

  // ---- official player of the match ----
  const official = officialAward(scorecard)
  const officialKey = official ? entryPlayerKey(official) : null
  const [otherSelected, setOtherSelected] = useState(() => Boolean(official && !officialKey && official.displayName))
  const officialValue = otherSelected ? OTHER : (officialKey ?? NONE)

  const awardFor = (type: MatchAward['awardType'], key: string, forSide: ResultSide | null): MatchAward | null => {
    const player = byKey.get(key)
    if (!player) return null
    return { awardType: type, side: forSide ?? player.side, ...entryRefOf(player), displayName: null }
  }

  const setOfficial = (value: string) => {
    if (value === OTHER) {
      setOtherSelected(true)
      commit(setAward(scorecard, 'PLAYER_OF_MATCH', null, null))
      return
    }
    setOtherSelected(false)
    commit(setAward(scorecard, 'PLAYER_OF_MATCH', null, value === NONE ? null : awardFor('PLAYER_OF_MATCH', value, null)))
  }

  const setTeam = (forSide: ResultSide, value: string) =>
    commit(setAward(scorecard, 'TEAM_PLAYER_OF_MATCH', forSide, value === NONE ? null : awardFor('TEAM_PLAYER_OF_MATCH', value, forSide)))

  // A free-text name is the other side's player; in a derby (no "other side") it is filed under Home.
  const otherSide: ResultSide = derby ? 'HOME' : opposite(ours.side)

  const officialGroups = oursSides.map((candidate: OurSide) => ({
    title: candidate.teamName,
    players: playersOfSide(scorecard, candidate.side),
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader oursSides={oursSides} scorecardSide={side} onSideChange={onScorecardSideChange} />

      <InfoCard
        title="Standouts"
        icon={<StarOutlineIcon />}
        note={derby ? ours.teamName : undefined}
        testId="awards-standouts"
      >
        <Typography variant="body2" color="text.secondary">
          Suggested from the scorecard. Tap the star to remove or add one.
        </Typography>
        {batters.length + bowlers.length + fielders.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nothing stands out yet. Enter the batting, bowling and fielding first, or star a player on those steps.
          </Typography>
        )}
        {group(
          'Batting',
          batters.map((entry) =>
            row(
              entryPlayerKey(entry) as string,
              battingFigure(entry),
              <StandoutToggle
                suggested={Boolean(entry.suggested)}
                override={entry.featuredOverride}
                onChange={(override) => commit(patchBatting(scorecard, entryPlayerKey(entry) as string, { featuredOverride: override }))}
                playerLabel={label(personOf(entryPlayerKey(entry)))}
              />,
            ),
          ),
        )}
        {group(
          'Bowling',
          bowlers.map((entry) =>
            row(
              entryPlayerKey(entry) as string,
              bowlingFigure(entry, ballsPerOver),
              <StandoutToggle
                suggested={Boolean(entry.suggested)}
                override={entry.featuredOverride}
                onChange={(override) => commit(patchBowling(scorecard, entryPlayerKey(entry) as string, { featuredOverride: override }))}
                playerLabel={label(personOf(entryPlayerKey(entry)))}
              />,
            ),
          ),
        )}
        {group(
          'Fielding',
          fielders.map((entry) =>
            row(
              entryPlayerKey(entry) as string,
              fieldingFigure(entry),
              <StandoutToggle
                suggested={Boolean(entry.suggested)}
                override={entry.featuredOverride}
                onChange={(override) => commit(patchFielding(scorecard, entryPlayerKey(entry) as string, { featuredOverride: override }))}
                playerLabel={label(personOf(entryPlayerKey(entry)))}
              />,
            ),
          ),
        )}
      </InfoCard>

      <InfoCard title="Player of the match" icon={<EmojiEventsOutlinedIcon />} testId="awards-official">
        <Typography variant="body2" color="text.secondary">
          The official player of the match{derby ? ', from either team' : ''}.
        </Typography>
        <PersonSelect
          label="Player of the match"
          value={officialValue}
          onChange={setOfficial}
          groups={officialGroups}
          standoutKeys={allStandouts}
          view={view}
          noneLabel="None"
          otherLabel={derby ? 'Someone else (type a name)' : `Someone from ${opposingName}`}
          disabled={disabled}
        />
        {otherSelected && (
          <Input
            label={derby ? 'Name' : `Player from ${opposingName}`}
            value={official?.displayName ?? ''}
            onChange={(event) => {
              const name = event.target.value
              commit(
                setAward(
                  scorecard,
                  'PLAYER_OF_MATCH',
                  null,
                  name.trim() === '' ? null : { awardType: 'PLAYER_OF_MATCH', side: otherSide, resultPlayerId: null, playerClientKey: null, displayName: name },
                ),
              )
            }}
            disabled={disabled}
            inputProps={{ maxLength: 120 }}
          />
        )}
      </InfoCard>

      <InfoCard title={derby ? "Teams' players of the match" : "Our team's player of the match"} icon={<WorkspacePremiumOutlinedIcon />} testId="awards-team">
        <Typography variant="body2" color="text.secondary">
          {derby ? 'Each team can name its own player of the match.' : "The club team's own pick, if it gives one."}
        </Typography>
        {oursSides.map((candidate) => {
          const award = teamAward(scorecard, candidate.side)
          return (
            <PersonSelect
              key={candidate.side}
              label={derby ? `${candidate.teamName} player of the match` : 'Our team player of the match'}
              value={award ? (entryPlayerKey(award) ?? NONE) : NONE}
              onChange={(value) => setTeam(candidate.side, value)}
              groups={[{ title: candidate.teamName, players: playersOfSide(scorecard, candidate.side) }]}
              standoutKeys={standoutKeys(candidate.side)}
              view={view}
              noneLabel="None"
              disabled={disabled}
            />
          )
        })}
      </InfoCard>

      {onGoToStep && (
        <Typography variant="body2" color="text.secondary">
          Not listed?{' '}
          <Button variant="ghost" size="sm" onClick={() => onGoToStep('our-team', ours.side)} sx={{ minHeight: { xs: 44, sm: 0 } }}>
            Add them on Our team
          </Button>
        </Typography>
      )}
    </Box>
  )
}
