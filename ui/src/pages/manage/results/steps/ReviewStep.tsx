import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Button } from '../../../../components/Button'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { DetailLine } from '../../../../components/DetailLine'
import { ResultSummary } from '../../../../components/ResultSummary'
import { badgeSx } from '../../../../components/RecordCard'
import { NameModeToggle } from '../../../../components/NameModeToggle'
import { PlayerName } from '../../../../components/PlayerName'
import type { ResultIssue, ResultSide, ResultValidation } from '../../../../api/matchResultApi'
import { addPlayerToSquad } from '../scorecard/squadAdd'
import { errorDetail } from '../../../../utils/errorDetail'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey } from '../../../../utils/scorecardPrefill'
import type { MarginCheck } from '../../../../utils/marginCheck'
import { inningsFor, resultLine } from '../../../../utils/resultLine'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { PlayingConditionsDialog } from './PlayingConditionsDialog'
import { ResultPreviewDialog } from './ResultPreviewDialog'
import { tossLine } from '../resultListHelpers'
import { toPayload } from '../resultDraftHelpers'
import { dedupeWarnings } from './dedupeWarnings'
import { isScorecardStep, issuesOf, stepIdForIssue } from './reviewIssues'
import type { ScorecardStepProps } from './stepTypes'
import { officialAward, playersByKey, playersOfSide, scorecardOf, sideStatus, teamAward } from '../scorecardDraft'

export interface ReviewStepProps extends ScorecardStepProps {
  check: MarginCheck
  needsAck: boolean
  onFix: () => void
  validation: ResultValidation | null
  validating: boolean
  validationFailed: boolean
  warningsAcknowledged: boolean
  onAcknowledgeChange: (acknowledged: boolean) => void
  fieldName: string | null
  // Saves the draft and says whether the server took it (the page shows the problem itself when it did not).
  onSaveForPreview: () => Promise<boolean>
  // Runs the checks again (after Add to squad).
  onRevalidate?: () => void
}

function CheckRow({ tone, text, action, chip, problem }: { tone: 'ok' | 'warning' | 'error' | 'info'; text: string; action?: ReactNode; chip?: string | null; problem?: string | null }) {
  const icon =
    tone === 'ok' ? <CheckCircleOutlineIcon color="success" fontSize="small" />
    : tone === 'error' ? <ErrorOutlineIcon color="error" fontSize="small" />
    : tone === 'warning' ? <WarningAmberOutlinedIcon color="warning" fontSize="small" />
    : <InfoOutlinedIcon color="disabled" fontSize="small" />
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.75, listStyle: 'none' }} data-tone={tone}>
      <Box sx={{ display: 'flex', pt: 0.1 }}>{icon}</Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        {chip && <Chip size="small" label={chip} sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.75rem', mr: 0.75, verticalAlign: 'text-bottom' }} />}
        {text}
        {problem && (
          <Typography component="span" variant="caption" color="error" role="alert" sx={{ display: 'block' }}>
            {problem}
          </Typography>
        )}
      </Typography>
      {action}
    </Box>
  )
}

// docs/specs/100-match-results-core.md, step "Review and publish": the result exactly as the card shows it, the status of
// each side's scorecard, then the server's validation - errors block publishing, warnings need a tick, INFO lines (a team
// that was not selected) are quiet. Scorecard issues carry a chip with the team they belong to. The Publish button lives in
// the page's footer.
export function ReviewStep({
  clubId,
  match,
  draft,
  sides,
  oursSides,
  scorecardAvailable,
  onGoToStep,
  check,
  needsAck,
  onFix,
  validation,
  validating,
  validationFailed,
  warningsAcknowledged,
  onAcknowledgeChange,
  fieldName,
  onSaveForPreview,
  onRevalidate,
}: ReviewStepProps) {
  const payload = toPayload(draft)
  const names = { home: sides[0].name, away: sides[1].name }
  const toss = tossLine({ tossWonBy: payload.tossWonBy ?? null, tossDecision: payload.tossDecision ?? null }, names)
  const line = resultLine(
    {
      outcomeType: payload.outcomeType ?? null,
      decidedBy: payload.decidedBy ?? 'REGULAR',
      winningSide: payload.winningSide ?? null,
      marginType: payload.marginType ?? null,
      marginValue: payload.marginValue ?? null,
    },
    names,
  )
  const ballsPerOver = payload.ballsPerOver ?? 6
  const [conditionsOpen, setConditionsOpen] = useState(false)
  // docs/specs/104-match-results-import-adaptors.md: Preview result saves the draft first, and opens only if that worked.
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSaving, setPreviewSaving] = useState(false)
  const openPreview = async () => {
    setPreviewSaving(true)
    try {
      if (await onSaveForPreview()) setPreviewOpen(true)
    } finally {
      setPreviewSaving(false)
    }
  }
  // The league's rules, for a match that has a league and season: the overs this result was scheduled for are compared with them.
  const leagueRules = match.leagueId && match.seasonId ? { leagueId: match.leagueId, seasonId: match.seasonId } : null
  const scheduledOvers = payload.scheduledBalls != null ? payload.scheduledBalls / ballsPerOver : null
  const derby = oursSides.length > 1
  const teamNameOf = (side: ResultSide | null) => (side ? (sides.find((candidate) => candidate.side === side)?.name ?? null) : null)

  // Typed issues; in a derby each scorecard issue is prefixed with the team it belongs to, and Fix opens that side's tab.
  const issues = validation ? issuesOf(validation) : []
  const errors = issues.filter((issue) => issue.severity === 'ERROR')
  const warnings = issues
    .filter((issue) => issue.severity === 'WARNING')
    // The margin checks are worded by the server and by the client check; only these string-only issues are matched by
    // wording. Scorecard issues are never matched.
    .filter((issue) => isScorecardStep(issue.step) || issue.side !== null || dedupeWarnings([issue.message], check).length > 0)
  const infos = issues.filter((issue) => issue.severity === 'INFO')
  const issueText = (issue: ResultIssue) => issue.message
  const issueChip = (issue: ResultIssue) => (issue.side && isScorecardStep(issue.step) ? teamNameOf(issue.side) : null)
  // docs/specs/118: a player the side lists who is not in the team's squad for the season - one tap adds them, then the checks run again.
  const [squadBusy, setSquadBusy] = useState(false)
  const [squadProblems, setSquadProblems] = useState<Record<string, string>>({})
  const squadTeamOf = (issue: ResultIssue) => (issue.side ? (oursSides.find((ours) => ours.side === issue.side)?.teamId ?? null) : null)
  const isSquadIssue = (issue: ResultIssue) =>
    issue.code === 'PLAYER_NOT_IN_SQUAD' && Boolean(issue.playerProfileId) && Boolean(match.seasonId) && squadTeamOf(issue) !== null
  const addToSquadFor = async (list: ResultIssue[]) => {
    setSquadBusy(true)
    const problems: Record<string, string> = {}
    for (const issue of list) {
      try {
        await addPlayerToSquad(clubId, squadTeamOf(issue) as string, match.seasonId, issue.playerProfileId as string)
      } catch (error) {
        problems[issue.playerProfileId as string] = errorDetail(error, 'The player could not be added to the squad.')
      }
    }
    setSquadProblems(problems)
    setSquadBusy(false)
    onRevalidate?.()
  }
  const issueFix = (issue: ResultIssue) => {
    if (isSquadIssue(issue)) {
      return (
        <Button variant="secondary" size="compact" disabled={squadBusy} onClick={() => void addToSquadFor([issue])}>
          Add to squad
        </Button>
      )
    }
    const id = stepIdForIssue(issue.step, issue.code)
    if (!id || !onGoToStep) return undefined
    return (
      <Button variant="secondary" size="compact" onClick={() => onGoToStep(id, issue.side ?? undefined)}>
        Fix
      </Button>
    )
  }

  // The scorecard: what has been entered for each of our sides, and the player of the match for the card.
  const scorecard = scorecardOf(draft)
  const byKey = playersByKey(scorecard)
  const view: PersonName[] = sides.flatMap((candidate) => playersOfSide(scorecard, candidate.side)).map((player) => scorecardPersonName(player))
  const official = officialAward(scorecard)
  const personFor = (award: { resultPlayerId?: string | null; playerClientKey?: string | null }) => {
    const found = byKey.get(entryPlayerKey(award) ?? '')
    return found ? scorecardPersonName(found) : null
  }
  const awardValue = (award: ReturnType<typeof officialAward>) => {
    if (!award) return null
    const person = personFor(award)
    return person ? <PlayerName person={person} view={view} /> : (award.displayName ?? null)
  }
  const officialValue = awardValue(official)
  const teamAwards = oursSides.map((ours) => ({ ours, value: awardValue(teamAward(scorecard, ours.side)) }))
  // docs/specs/118: a value that was not specified is shown as a warning-coloured "Not recorded" with a jump to the step that sets it.
  // A visual hint only: it never blocks publishing.
  const missingIcon = (icon: ReactNode) => (
    <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}>
      {icon}
    </Box>
  )
  const missingValue = (stepId: string, side?: ResultSide) => (
    <Box component="span" data-testid="review-not-recorded" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <WarningAmberOutlinedIcon fontSize="inherit" sx={{ color: 'warning.main' }} aria-hidden />
      <Box component="span" sx={{ color: 'warning.dark', fontWeight: 600 }}>
        Not recorded
      </Box>
      {onGoToStep && stepId && (
        <Button variant="ghost" size="compact" onClick={() => onGoToStep(stepId, side)}>
          Add
        </Button>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <FormSectionHeading icon={<FactCheckOutlinedIcon />} title="This is how the result will look" />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
          <NameModeToggle inline />
          <Button variant="secondary" size="compact" startIcon={<VisibilityOutlinedIcon fontSize="small" />} disabled={previewSaving} onClick={() => void openPreview()}>
            {previewSaving ? 'Saving the draft…' : 'Preview result'}
          </Button>
        </Box>
      </Box>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.75, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: 'background.paper' }} data-testid="result-preview">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Chip size="small" label="Draft" sx={{ ...badgeSx('warning'), height: 22, fontSize: '0.75rem' }} />
        </Box>
        <ResultSummary
          sides={sides.map((side) => ({
            key: side.side,
            name: side.name,
            innings: inningsFor(payload.innings ?? [], side.side),
            winner: payload.outcomeType === 'WON' && payload.winningSide === side.side,
          }))}
          ballsPerOver={ballsPerOver}
          resultLine={line}
        >
          <DetailLine icon={toss ? <SportsCricketOutlinedIcon fontSize="small" /> : missingIcon(<SportsCricketOutlinedIcon fontSize="small" />)} label="Toss" value={toss ?? missingValue('toss')} />
          <DetailLine
            icon={match.matchDate ? <EventOutlinedIcon fontSize="small" /> : missingIcon(<EventOutlinedIcon fontSize="small" />)}
            label="Played"
            value={match.matchDate ? formatMatchDateTime(match.matchDate) : missingValue('')}
          />
          <DetailLine icon={fieldName ? <PlaceOutlinedIcon fontSize="small" /> : missingIcon(<PlaceOutlinedIcon fontSize="small" />)} label="Field" value={fieldName ?? missingValue('toss')} />
          {officialValue && <DetailLine icon={<EmojiEventsOutlinedIcon fontSize="small" />} label="Player of the match" value={officialValue} labelWidth={110} />}
          {(scorecardAvailable ? teamAwards : teamAwards.filter((item) => item.value)).map(({ ours, value }) => (
            <DetailLine
              key={ours.side}
              icon={value ? <EmojiEventsOutlinedIcon fontSize="small" /> : missingIcon(<EmojiEventsOutlinedIcon fontSize="small" />)}
              label={derby ? `${ours.teamName} player` : 'Team player'}
              value={value ?? missingValue('awards', ours.side)}
              labelWidth={110}
            />
          ))}
        </ResultSummary>
      </Box>

      {scorecardAvailable && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FormSectionHeading icon={<SportsCricketOutlinedIcon />} title="Scorecard" />
          <Box component="ul" aria-label="Scorecard status" sx={{ m: 0, p: 0 }}>
            {sides.map((info) => {
              const status = sideStatus(draft, info.side)
              const text =
                status === 'COMPLETE'
                  ? `${info.name}: complete. Batting, bowling and fielding entered`
                  : status === 'PARTIAL'
                    ? `${info.name}: partial. Some of the batting, bowling and fielding is missing`
                    : `${info.name}: none. Summary only`
              return (
                <CheckRow
                  key={info.side}
                  tone={status === 'COMPLETE' ? 'ok' : 'info'}
                  text={text}
                  action={
                    status !== 'COMPLETE' && onGoToStep ? (
                      <Button variant="secondary" size="compact" onClick={() => onGoToStep(status === 'NONE' ? 'teams' : 'batting', info.side)}>
                        {status === 'NONE' ? 'Add' : 'Complete'}
                      </Button>
                    ) : undefined
                  }
                />
              )
            })}
          </Box>
        </Box>
      )}

      <Box aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <FormSectionHeading icon={<FactCheckOutlinedIcon />} title="Checks" />
          {leagueRules && (
            <Button variant="secondary" size="compact" startIcon={<GavelOutlinedIcon fontSize="small" />} onClick={() => setConditionsOpen(true)}>
              Playing conditions
            </Button>
          )}
        </Box>
        {validating && (
          <Typography variant="body2" color="text.secondary">
            Checking the result…
          </Typography>
        )}
        {validationFailed && <Alert severity="error">We couldn't check the result. Please try again.</Alert>}
        {validation && (
          <Box component="ul" aria-label="Checks" sx={{ m: 0, p: 0 }}>
            {errors.map((issue, index) => (
              <CheckRow key={`e-${index}-${issue.message}`} tone="error" text={issueText(issue)} chip={issueChip(issue)} action={issueFix(issue)} problem={issue.playerProfileId ? squadProblems[issue.playerProfileId] : null} />
            ))}
            {check.status === 'mismatch' && (
              <CheckRow
                tone="warning"
                text={check.reason}
                action={
                  check.suggestion ? (
                    <Button variant="secondary" size="compact" onClick={onFix}>
                      Fix
                    </Button>
                  ) : undefined
                }
              />
            )}
            {check.status === 'match' && <CheckRow tone="ok" text={check.reason} />}
            {check.status === 'cannot-check' && <CheckRow tone="info" text={check.reason} />}
            {warnings.map((issue, index) => (
              <CheckRow
                key={`w-${index}-${issue.message}`}
                tone="warning"
                text={issueText(issue)}
                chip={issueChip(issue)}
                action={issueFix(issue)}
                problem={issue.playerProfileId ? squadProblems[issue.playerProfileId] : null}
              />
            ))}
            {oursSides.map((ours) => {
              const several = warnings.filter((issue) => isSquadIssue(issue) && issue.side === ours.side)
              if (several.length < 2) return null
              return (
                <Box component="li" key={`squad-all-${ours.side}`} sx={{ listStyle: 'none', py: 0.5, pl: 4 }}>
                  <Button variant="secondary" size="compact" disabled={squadBusy} onClick={() => void addToSquadFor(several)}>
                    {`Add all ${several.length} to the ${derby ? `${ours.teamName} ` : ''}squad`}
                  </Button>
                </Box>
              )
            })}
            {infos.map((issue, index) => (
              <CheckRow key={`i-${index}-${issue.message}`} tone="info" text={issueText(issue)} chip={issueChip(issue)} />
            ))}
            {errors.length === 0 && warnings.length === 0 && check.status !== 'mismatch' && (
              <CheckRow tone="ok" text="Everything checks out. This result is ready to publish." />
            )}
          </Box>
        )}
        {validation && errors.length === 0 && needsAck && (
          <FormControlLabel
            control={<Checkbox checked={warningsAcknowledged} onChange={(event) => onAcknowledgeChange(event.target.checked)} />}
            label="I have checked these warnings and want to publish anyway"
            sx={{ minHeight: 44, alignItems: 'center' }}
          />
        )}
      </Box>
      <ResultPreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} clubId={clubId} match={match} />
      {leagueRules && (
        <PlayingConditionsDialog
          open={conditionsOpen}
          onClose={() => setConditionsOpen(false)}
          clubId={clubId}
          leagueId={leagueRules.leagueId}
          seasonId={leagueRules.seasonId}
          scheduledOvers={scheduledOvers}
        />
      )}
    </Box>
  )
}
