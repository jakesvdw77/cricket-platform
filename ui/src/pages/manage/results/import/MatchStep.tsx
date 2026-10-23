import { Box, Button as MuiButton, Chip, Typography } from '@mui/material'
import { Button, compactButtonSx } from '../../../../components/Button'
import { alpha } from '@mui/material/styles'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ImportMatchReason, MatchCandidate } from '../../../../api/resultImportApi'
import { WizardFooter } from '../../../../components/WizardFooter'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { MatchDateTimeDialog } from '../../../../components/MatchDateTimeDialog'
import { MatchFormDialog } from '../../../../components/MatchFormDialog'
import { badgeSx } from '../../../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../../../components/RecordCard'
import { TileChoiceGroup } from '../../../../components/TileChoiceGroup'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { AcknowledgementTick } from './AcknowledgementTick'
import { FindMatchSearch } from './FindMatchSearch'
import { ImportProblemAlert } from './ImportProblemAlert'
import { useDeleteMatchDialog } from '../../../../hooks/useDeleteMatchDialog'
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
  const { clubId, preview, matchId, onMatchChange, onMatchCreated, onMatchDeleted, onMatchFound, onMatchDateChanged, launchedMatchId, matchPending, matchProblem, onMatchNext, dateAck, onDateAckChange, onBack } = context
  const [adding, setAdding] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const deleteFlow = useDeleteMatchDialog(clubId, onMatchDeleted)
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
              <Button onClick={() => setAdding(true)} variant="secondary" size="compact">
                Add match
              </Button>
              <FindMatchSearch clubId={clubId} listedIds={[]} onFound={onMatchFound} onDelete={deleteFlow.request} disabled={matchPending} defaultOpen />
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
                        size="small"
                        aria-label={`Delete match ${candidate.homeName} v ${candidate.awayName}`}
                        disabled={matchPending}
                        onClick={() => deleteFlow.request({ id: candidate.matchId, name: `${candidate.homeName} v ${candidate.awayName}` })}
                        sx={compactButtonSx}
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
              <Button onClick={() => setAdding(true)} variant="ghost" size="compact" sx={{ alignSelf: 'flex-start', color: 'info.main' }}>
                Match not listed? Add the match first
              </Button>
              <FindMatchSearch clubId={clubId} listedIds={candidates.map((candidate) => candidate.matchId)} onFound={onMatchFound} onDelete={deleteFlow.request} disabled={matchPending} />
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
        hint="Filled in from the file where it could be. A team whose name matches one of yours is picked as My team; check each box and choose which side is your team if it is not."
      />

      {deleteFlow.dialog}

      {matchProblem && (
        <Box>
          <ImportProblemAlert problem={matchProblem} input="file" onRetry={onMatchNext} retrying={matchPending} />
        </Box>
      )}

      {chosen && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} data-testid="import-match-date">
          <Typography variant="body2">
            <Typography component="span" variant="body2" color="text.secondary">
              This match is on{' '}
            </Typography>
            <strong>{formatMatchDateTime(chosen.matchDate)}</strong>
          </Typography>
          <MuiButton
            variant="text"
            size="small"
            startIcon={<EditOutlinedIcon fontSize="small" />}
            aria-label="Edit date and time"
            onClick={() => setEditingDate(true)}
            disabled={matchPending}
            sx={{ ...compactButtonSx, alignSelf: 'flex-start' }}
          >
            Edit date and time
          </MuiButton>
          <MatchDateTimeDialog
            open={editingDate}
            onClose={() => setEditingDate(false)}
            clubId={clubId}
            matchId={chosen.matchId}
            matchDate={chosen.matchDate}
            onSaved={onMatchDateChanged}
          />
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

      <WizardFooter
        back={{ label: 'Back', onClick: onBack, disabled: matchPending }}
        primary={{ label: matchPending ? 'Checking…' : 'Next', onClick: onMatchNext, disabled: !chosen || matchPending || (dateGap !== null && !dateAck) }}
      />
    </Box>
  )
}
