import { Box, Button as MuiButton, Chip, MenuItem, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'
import EastIcon from '@mui/icons-material/East'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import { Link as RouterLink } from 'react-router-dom'
import type { ResultSide } from '../../../../api/matchResultApi'
import type { ImportedResult, ImportExactness, TeamMapping } from '../../../../api/resultImportApi'
import { Button } from '../../../../components/Button'
import { Input } from '../../../../components/Input'
import { badgeSx } from '../../../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../../../components/RecordCard'
import { AcknowledgementTick } from './AcknowledgementTick'
import { ImportNotesList } from './ImportNotesList'
import { ImportProblemAlert } from './ImportProblemAlert'
import { checksSentence, EXACTNESS_WORDS, resolvedSentence, squadMismatchSentence } from './importSummary'
import type { ImportStepContext } from './importWizardTypes'

const TONE: Record<ImportExactness, RecordCardBadgeTone> = { EXACT: 'active', NORMALISED: 'side', AI_SUGGESTED: 'side', UNRESOLVED: 'warning' }

function lastEdited(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function TeamCard({
  file,
  proposal,
  value,
  homeName,
  awayName,
  homeIsClub,
  awayIsClub,
  onChange,
  disabled,
}: {
  file: NonNullable<ImportedResult['teams']>[number]
  proposal: TeamMapping | undefined
  value: ResultSide | null
  homeName: string
  awayName: string
  homeIsClub: boolean
  awayIsClub: boolean
  onChange: (side: ResultSide) => void
  disabled: boolean
}) {
  // The chip describes the server's proposal; once the manager picks a different side it says the choice is theirs.
  const changed = Boolean(proposal) && proposal?.side !== value
  const exactness = proposal?.exactness ?? 'UNRESOLVED'
  // A side that is only a typed name is not a club team: its name can match exactly and still hold nobody of ours.
  // The nearest side by name, offered only while nothing is chosen and the server could not place the team.
  const closest = value === null && proposal?.closestSide ? { side: proposal.closestSide, name: proposal.closestSide === 'HOME' ? homeName : awayName } : null
  const outside = value !== null && !(value === 'HOME' ? homeIsClub : awayIsClub)
  return (
    <Box sx={{ flex: 1, minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: { xs: 1.5, md: 2.25 }, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          In the file
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</Typography>
      </Box>
      <Input
        select
        label="Is this side of the match"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value as ResultSide)}
        disabled={disabled}
        SelectProps={{ displayEmpty: true }}
        InputLabelProps={{ shrink: true }}
        sx={{ '& .MuiOutlinedInput-root': { minHeight: 44 } }}
      >
        <MenuItem value="" disabled>
          Choose a side
        </MenuItem>
        <MenuItem value="HOME">{homeName} (home)</MenuItem>
        <MenuItem value="AWAY">{awayName} (away)</MenuItem>
      </Input>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {outside ? (
          <Chip size="small" label="Not one of your teams" sx={{ ...badgeSx('neutral'), height: 24, fontSize: '0.75rem' }} />
        ) : changed ? (
          <Chip size="small" label="Chosen by you" sx={{ ...badgeSx('neutral'), height: 24, fontSize: '0.75rem' }} />
        ) : (
          <Chip
            size="small"
            icon={exactness === 'EXACT' ? <CheckIcon sx={{ fontSize: 14 }} /> : exactness === 'NORMALISED' ? <EastIcon sx={{ fontSize: 14 }} /> : undefined}
            label={EXACTNESS_WORDS[exactness]}
            sx={{ ...badgeSx(TONE[exactness]), height: 24, fontSize: '0.75rem' }}
          />
        )}
        {!changed && !outside && proposal?.reason && (
          <Typography variant="caption" color="text.secondary">
            {proposal.reason}
          </Typography>
        )}
      </Box>
      {closest && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} data-testid="closest-side">
          <Typography variant="caption" color="text.secondary">
            Closest side by name: {closest.name}
          </Typography>
          <MuiButton variant="text" onClick={() => onChange(closest.side)} disabled={disabled} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600, color: 'info.main' }}>
            Use {closest.name}
          </MuiButton>
        </Box>
      )}
    </Box>
  )
}

// docs/specs/104-match-results-import-adaptors.md, step 3 Teams: which side of the match each team in the file is, with the
// server's proposal and how sure it was, a Swap sides control, the required tick to replace an existing draft, and "Create
// draft and review", the one write. Nothing is published. Afterwards a summary of the draft with the button into the wizard.
export function TeamsMappingStep(context: ImportStepContext) {
  const { preview, matchId, mapping, onMappingChange, onSwap, replaceAck, onReplaceAckChange, creating, createProblem, resolved, onCreate, onReview, onBack } = context
  const candidate = preview?.matchCandidates.find((item) => item.matchId === matchId) ?? null
  const teams = preview?.document.teams ?? []
  if (!preview || !candidate) return null

  const draftExists = candidate.existingResult?.status === 'DRAFT'
  const clubTeamName = candidate.homeIsClubTeam !== candidate.awayIsClubTeam ? (candidate.homeIsClubTeam ? candidate.homeName : candidate.awayName) : null
  const squadWarning = resolved ? squadMismatchSentence(resolved.counts, clubTeamName) : null
  const complete = teams.length === 2 && teams.every((team) => mapping[team.key])
  const noClubTeam = !candidate.homeIsClubTeam && !candidate.awayIsClubTeam
  const canCreate = !noClubTeam && complete && (!draftExists || replaceAck) && !creating && !resolved
  const locked = creating || resolved !== null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
      <Box>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, fontSize: { md: '1.125rem' } }}>
          Which side is which?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Match each team in the file to a side of the match. Mixing them up would put the scores on the wrong team.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1.5, md: 2 }, alignItems: { md: 'center' } }}>
        {teams[0] && (
          <TeamCard
            file={teams[0]}
            proposal={preview.teamMapping.find((item) => item.fileKey === teams[0].key)}
            value={mapping[teams[0].key] ?? null}
            homeName={candidate.homeName}
            awayName={candidate.awayName}
            homeIsClub={candidate.homeIsClubTeam}
            awayIsClub={candidate.awayIsClubTeam}
            onChange={(side) => onMappingChange(teams[0].key, side)}
            disabled={locked}
          />
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', flex: 'none' }}>
          <Button variant="secondary" onClick={onSwap} disabled={locked || teams.length !== 2} startIcon={<SwapVertIcon sx={{ transform: { md: 'rotate(90deg)' } }} />} sx={{ minHeight: 44, borderRadius: 6, textTransform: 'none', fontWeight: 600, bgcolor: 'background.paper' }}>
            Swap sides
          </Button>
        </Box>
        {teams[1] && (
          <TeamCard
            file={teams[1]}
            proposal={preview.teamMapping.find((item) => item.fileKey === teams[1].key)}
            value={mapping[teams[1].key] ?? null}
            homeName={candidate.homeName}
            awayName={candidate.awayName}
            homeIsClub={candidate.homeIsClubTeam}
            awayIsClub={candidate.awayIsClubTeam}
            onChange={(side) => onMappingChange(teams[1].key, side)}
            disabled={locked}
          />
        )}
      </Box>

      {noClubTeam && (
        <Box role="alert" data-testid="no-club-team" sx={{ display: 'flex', flexDirection: 'column', gap: 1, border: 1, borderColor: 'warning.main', borderRadius: 2, p: 1.5, bgcolor: 'background.paper' }}>
          <Typography variant="body2" fontWeight={700}>
            Neither team of this match is one of your club&apos;s teams.
          </Typography>
          <Typography variant="body2">
            Nobody on the scorecard can be linked to your players. Open the match, choose your own team as home or away, then come back. Your file is kept.
          </Typography>
          <MuiButton component={RouterLink} to={`/manage/fixtures/matches/${candidate.matchId}`} target="_blank" rel="noopener noreferrer" variant="text" sx={{ alignSelf: 'flex-start', minHeight: 44, textTransform: 'none' }}>
            Open the match
          </MuiButton>
        </Box>
      )}

      {draftExists && candidate.existingResult && (
        <AcknowledgementTick
          id="replace-draft"
          title="Replace the existing draft"
          detail={`This match already has a draft, last edited ${lastEdited(candidate.existingResult.updatedAt)}. Importing replaces it. A published result is never touched.`}
          checked={replaceAck}
          onChange={onReplaceAckChange}
          disabled={locked}
        />
      )}

      {createProblem && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ImportProblemAlert problem={createProblem} input="file" onRetry={onCreate} retrying={creating} />
          {createProblem.otherMatchId && (
            <MuiButton component={RouterLink} to={`/manage/fixtures/matches/${createProblem.otherMatchId}`} target="_blank" rel="noopener noreferrer" variant="text" sx={{ alignSelf: 'flex-start', minHeight: 44, textTransform: 'none' }}>
              View the match that has it
            </MuiButton>
          )}
        </Box>
      )}

      {resolved && (
        <Box
          role="status"
          data-testid="import-created"
          sx={(theme) => ({ border: 1, borderColor: alpha(theme.palette.success.main, 0.5), borderRadius: 2, bgcolor: 'background.paper', p: { xs: 1.5, md: 1.75 }, display: 'flex', flexDirection: 'column', gap: 1 })}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TaskAltIcon sx={{ color: 'success.main' }} />
            <Typography variant="body2" fontWeight={700}>
              {resolvedSentence(resolved.counts)}
            </Typography>
          </Box>
          {squadWarning && (
            <Typography variant="body2" role="alert" data-testid="import-squad-warning" sx={{ color: 'warning.dark', fontWeight: 600 }}>
              {squadWarning}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {checksSentence(resolved.validation)}
          </Typography>
          <ImportNotesList notes={resolved.notes} />
          <Box sx={{ display: 'flex' }}>
            <Button onClick={onReview} sx={{ minHeight: 44, flex: { xs: 1, md: 'none' } }}>
              Review in the result wizard
            </Button>
          </Box>
        </Box>
      )}

      {!resolved && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'row' }, alignItems: 'center', gap: { xs: 1.25, md: 1.5 }, flexWrap: { md: 'wrap' } }}>
            <Button variant="secondary" onClick={onBack} disabled={creating} sx={{ flex: { xs: 1, md: 'none' }, minHeight: 44, minWidth: { md: 110 } }}>
              Back
            </Button>
            <Button onClick={onCreate} disabled={!canCreate} sx={{ flex: { xs: 2, md: 'none' }, minHeight: 44 }}>
              {creating ? 'Creating the draft…' : 'Create draft and review'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
              Nothing is published. The draft is only visible to managers.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: { md: 'none' } }}>
            Nothing is published. The draft is only visible to managers.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
