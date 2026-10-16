import { Box, Button as MuiButton, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ImportMatchReason, MatchCandidate } from '../../../../api/resultImportApi'
import { deleteMatch } from '../../../../api/matchApi'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { MatchFormDialog } from '../../../../components/MatchFormDialog'
import { badgeSx } from '../../../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../../../components/RecordCard'
import { TileChoiceGroup } from '../../../../components/TileChoiceGroup'
import { errorDetail } from '../../../../utils/errorDetail'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { AcknowledgementTick } from './AcknowledgementTick'
import { ImportProblemAlert } from './ImportProblemAlert'
import { dateMismatch, fileDateTime, matchPrefill, fileResultLine, fileSourceLine, fileTeamsLine } from './importSummary'
import type { ImportStepContext } from './importWizardTypes'

const REASON_WORDS: Record<ImportMatchReason, string> = {
  EXTERNAL_ID: 'External id',
  GIVEN: 'Chosen in the file',
  DATE: 'Date',
  TEAMS: 'Teams',
  VENUE: 'Venue',
  COMPETITION: 'League',
}

const chipSx = (tone: RecordCardBadgeTone) => ({ ...badgeSx(tone), height: 24, fontSize: '0.75rem' })

// The status of a candidate's existing result, in words (never colour alone): published matches cannot be chosen.
function statusOf(candidate: MatchCandidate, importedBefore: boolean): { label: string; tone: RecordCardBadgeTone } | null {
  if (!candidate.homeIsClubTeam && !candidate.awayIsClubTeam) return { label: 'Neither team is yours. Edit the match first', tone: 'warning' }
  if (candidate.existingResult?.status === 'PUBLISHED') return { label: 'Published. Unpublish it first', tone: 'muted' }
  if (importedBefore) return { label: 'Imported from this id before', tone: 'side' }
  if (candidate.existingResult?.status === 'DRAFT') return { label: 'Draft result exists', tone: 'warning' }
  return null
}

// An amber note, icon plus words (never colour alone).
function WarningNote({ children }: { children: ReactNode }) {
  return (
    <Box
      role="status"
      sx={(theme) => ({ bgcolor: alpha(theme.palette.warning.main, 0.12), border: 1, borderColor: alpha(theme.palette.warning.main, 0.4), borderRadius: 2, p: 1.25, fontSize: '0.8125rem', display: 'flex', gap: 1, alignItems: 'flex-start' })}
    >
      <WarningAmberIcon aria-hidden fontSize="small" sx={{ flex: 'none', color: 'warning.main' }} />
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  )
}

function FileSummary({ context }: { context: ImportStepContext }) {
  const document = context.preview?.document
  if (!document) return null
  const rows: Array<[string, string | null]> = [
    ['Date and time', fileDateTime(document)],
    ['Venue', document.match?.venue ?? null],
    ['Teams', fileTeamsLine(document)],
    ['Source', fileSourceLine(document)],
  ]
  const competition = document.match?.competition
  if (competition) rows.splice(3, 0, ['Competition', competition])
  const result = fileResultLine(document)
  return (
    <Box
      data-testid="import-file-summary"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: { xs: 1.5, md: 2.25 }, display: 'flex', flexDirection: 'column', gap: { xs: 1.25, md: 1.5 }, width: { md: 340 }, flex: 'none', minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box aria-hidden sx={{ display: { xs: 'none', md: 'flex' }, width: 32, height: 32, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', alignItems: 'center', justifyContent: 'center' }}>
          <DescriptionOutlinedIcon fontSize="small" />
        </Box>
        <Typography component="h2" sx={{ fontSize: { xs: '0.75rem', md: '0.9375rem' }, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          What the file says
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '1fr' }, gap: { xs: '10px 14px', md: 1.5 } }}>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" component="div">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        {result && (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="caption" color="text.secondary" component="div">
              Result
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {result}
            </Typography>
          </Box>
        )}
      </Box>
      {result && (
        <Typography variant="body2" color="text.secondary" sx={{ display: { md: 'none' } }}>
          Result: {result}
        </Typography>
      )}
    </Box>
  )
}

// docs/specs/104-match-results-import-adaptors.md, step 2 Match: what the file says, then the matches in the fixtures it could
// belong to as radio rows, each with the reasons (icon-free words, never colour alone) and a status when the match already has
// a result. Nothing is chosen for the manager when there is more than one candidate; a single one is only pre-selected.
export function MatchStep(context: ImportStepContext) {
  const { clubId, preview, matchId, onMatchChange, onMatchCreated, onMatchDeleted, launchedMatchId, matchPending, matchProblem, onMatchNext, dateAck, onDateAckChange, onBack } = context
  const [adding, setAdding] = useState(false)
  // docs/specs/109-delete-empty-match.md: the candidate whose Delete was pressed, awaiting the confirmation.
  const [deleting, setDeleting] = useState<MatchCandidate | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (candidate: MatchCandidate) => deleteMatch(clubId, candidate.matchId),
    onSuccess: (_data, candidate) => {
      setDeleting(null)
      onMatchDeleted(candidate.matchId)
    },
  })
  const closeDelete = () => {
    setDeleting(null)
    deleteMutation.reset()
  }
  const candidates = preview?.matchCandidates ?? []
  const chosen = candidates.find((candidate) => candidate.matchId === matchId) ?? null
  // Warn when the manager came from a match the file does not look like (neither its date nor its teams matched).
  const mismatch = chosen !== null && launchedMatchId === chosen.matchId && (!chosen.reasons.includes('DATE') || !chosen.reasons.includes('TEAMS'))
  const dateGap = chosen && preview ? dateMismatch(preview.document, chosen.matchDate) : null
  const importedBeforeId = preview?.existingForExternalId?.matchId ?? null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1.75, md: 3 }, alignItems: { md: 'flex-start' } }}>
        <FileSummary context={context} />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: { xs: 1.25, md: 1.5 } }}>
          <Box>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, fontSize: { md: '1.125rem' } }}>
              Which match is this?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Choose the match the result belongs to. Nothing is picked for you.
            </Typography>
          </Box>

          {candidates.length === 0 ? (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
              <Typography variant="body2" fontWeight={700}>
                No match in your fixtures looks like this file.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add the match here, then import the result onto it. What you gave is kept.
              </Typography>
              <MuiButton onClick={() => setAdding(true)} variant="outlined" sx={{ minHeight: 44 }}>
                Add match
              </MuiButton>
            </Box>
          ) : (
            <>
              <TileChoiceGroup<string>
                label="Match"
                value={matchId}
                onChange={onMatchChange}
                columns="1fr"
                disabled={matchPending}
                tileSx={{ alignItems: 'flex-start', textAlign: 'left', gap: 1.5, py: 1.5, px: { xs: 1.5, md: 2 }, display: 'flex' }}
                options={candidates.map((candidate) => {
                  const published = candidate.existingResult?.status === 'PUBLISHED'
                  const selected = candidate.matchId === matchId
                  const status = statusOf(candidate, candidate.matchId === importedBeforeId)
                  const meta = [formatMatchDateTime(candidate.matchDate), candidate.leagueName].filter(Boolean).join(' · ')
                  return {
                    value: candidate.matchId,
                    disabled: published,
                    adornment: candidate.deletable ? (
                      <MuiButton
                        color="error"
                        variant="text"
                        aria-label={`Delete match ${candidate.homeName} v ${candidate.awayName}`}
                        disabled={matchPending}
                        onClick={() => setDeleting(candidate)}
                        sx={{ minHeight: 44, minWidth: 44, px: 1, py: 0, fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none' }}
                      >
                        Delete
                      </MuiButton>
                    ) : undefined,
                    content: (
                      <>
                        {published ? (
                          <BlockOutlinedIcon role="img" aria-label="Not available" sx={{ flex: 'none', mt: 0.25, color: 'text.secondary' }} />
                        ) : selected ? (
                          <RadioButtonCheckedIcon role="img" aria-label="Selected" color="primary" sx={{ flex: 'none', mt: 0.25 }} />
                        ) : (
                          <RadioButtonUncheckedIcon role="img" aria-label="Not selected" sx={{ flex: 'none', mt: 0.25, color: 'text.secondary' }} />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', columnGap: 1.5, rowGap: 0.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <Typography component="span" sx={{ fontSize: '0.9375rem', fontWeight: 700, overflowWrap: 'anywhere' }}>
                              {candidate.homeName} v {candidate.awayName}
                            </Typography>
                            <Typography component="span" variant="body2" color="text.secondary">
                              {meta}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                            {candidate.reasons.map((reason) => (
                              <Chip key={reason} size="small" label={REASON_WORDS[reason]} sx={chipSx('positive')} />
                            ))}
                            {status && <Chip size="small" label={status.label} sx={chipSx(status.tone)} />}
                          </Box>
                        </Box>
                      </>
                    ),
                  }
                })}
              />
              <MuiButton onClick={() => setAdding(true)} variant="text" sx={{ alignSelf: 'flex-start', minHeight: 44, textTransform: 'none', fontWeight: 600, color: 'info.main' }}>
                Match not listed? Add the match first
              </MuiButton>
            </>
          )}
        </Box>
      </Box>

      <MatchFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        clubId={clubId}
        onCreated={onMatchCreated}
        initialValues={preview ? matchPrefill(preview.document) : undefined}
        inferSeason
        hint="Filled in from the file where it could be. Check each box, and choose which side is your team."
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this match?"
        description={
          <>
            It has nothing recorded against it. This cannot be undone.
            {deleteMutation.isError && (
              <Typography role="alert" variant="body2" color="error" sx={{ mt: 1.5 }}>
                {errorDetail(deleteMutation.error, 'Something went wrong deleting this match. Please try again.')}
              </Typography>
            )}
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        onClose={closeDelete}
      />

      {matchProblem && (
        <Box>
          <ImportProblemAlert problem={matchProblem} input="file" onRetry={onMatchNext} retrying={matchPending} />
        </Box>
      )}

      {mismatch && <WarningNote>The file&apos;s teams do not look like the sides of the match you chose.</WarningNote>}

      {dateGap && (
        <>
          <WarningNote>
            The file says {dateGap.fileDay} but this match is on {dateGap.matchDay}.
          </WarningNote>
          <AcknowledgementTick id="date-check" title="I have checked this is the right match" checked={dateAck} onChange={onDateAckChange} disabled={matchPending} />
        </>
      )}

      <Box sx={{ display: 'flex', gap: 1.25, flexDirection: 'row' }}>
        <Button variant="secondary" onClick={onBack} disabled={matchPending} sx={{ flex: { xs: 1, md: 'none' }, minHeight: 44, minWidth: { md: 110 } }}>
          Back
        </Button>
        <Button onClick={onMatchNext} disabled={!chosen || matchPending || (dateGap !== null && !dateAck)} sx={{ flex: { xs: 2, md: 'none' }, minHeight: 44, minWidth: { md: 110 } }}>
          {matchPending ? 'Checking…' : 'Next'}
        </Button>
      </Box>
    </Box>
  )
}
