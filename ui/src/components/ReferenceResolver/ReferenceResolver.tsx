import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Checkbox, Chip, FormControlLabel, LinearProgress, TextField, Tooltip, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import type { ImportDecisions, ImportResolution, ReferenceCandidate, ReferenceProposal } from '../../api/importApi'
import { TARGET_KIND_COPY_LEAGUE_TEAM, TARGET_KIND_SISTER_TEAM } from '../../api/importApi'
import { confidenceBand, isProposalResolved, rankedCandidates, resolutionFor, withIdentifiedAsOurs, withResolution, withoutResolution } from '../../utils/importDecisions'
import { Button } from '../Button'

// What "Create new" asks of the manager when the consumer wants the new record's fields edited here (spec 098: a tidied name and
// an optional abbreviation, with a live duplicate hint). Omitted, Create new records nothing but the choice.
export interface ResolverCreateOptions {
  // The suggested name for a sheet value ("Pretoria High School" from "PRETORIA HIGH SCHOOL"); default: the value as typed.
  tidyName?: (value: string) => string
  // Offer the optional abbreviation field.
  withAbbreviation?: boolean
  // Names that already exist (compared case-insensitively): a name equal to one shows a duplicate hint.
  existingNames?: string[]
}

export interface ReferenceResolverProps {
  // 'resolve' links, creates or skips; 'identify' (Identify what is ours) only confirms which values are ours.
  mode: 'resolve' | 'identify'
  // The proposals of this step (the wizard filters batch.proposals by step).
  proposals: ReferenceProposal[]
  decisions: ImportDecisions
  onDecisionsChange: (next: ImportDecisions) => void
  // Identify mode: the values marked "Not ours" (kept by the wizard so it survives a step change).
  notOurs?: string[]
  onNotOursChange?: (next: string[]) => void
  // Extra lines under a proposal (the consumer's own detail, for example a league and season).
  renderProposalExtras?: (proposal: ReferenceProposal, candidate: ReferenceCandidate) => ReactNode
  // A short badge beside a candidate's name (where it comes from). Omitted, a plain-text origin is shown as a badge and a
  // raw code (OWN_OTHER) is not shown at all.
  candidateBadge?: (candidate: ReferenceCandidate) => string | null
  // "Create new" button label (the consumer names the thing: "Create new league team").
  createLabel?: string
  // What the values are called in the progress line ("names", "teams").
  noun?: string
  create?: ResolverCreateOptions
  // Candidates below 70 are listed behind a "Show weaker matches" button (a chosen one stays visible).
  collapseLow?: boolean
  disabled?: boolean
}

const touchSx = { minHeight: { xs: 44, md: 32 } } as const

// A short label with its explanation in a tooltip (shown on hover and on keyboard focus; it never takes focus). The span lets a
// disabled button keep its tooltip, and carries the flex sizing so the button fills it on a phone.
function HintedButton({ hint, grow = true, children }: { hint: string; grow?: boolean; children: ReactNode }) {
  return (
    <Tooltip title={hint} enterTouchDelay={400}>
      <Box component="span" sx={{ display: 'inline-flex', flex: grow ? { xs: 1, md: 'none' } : 'none', '& > button': { width: '100%' } }}>{children}</Box>
    </Tooltip>
  )
}

function decisionChip(proposal: ReferenceProposal, decisions: ImportDecisions, notOurs: string[], resolved: boolean) {
  if (!resolved) return <Chip size="small" variant="outlined" color="error" icon={<ErrorOutlineIcon />} label="Needs a decision" sx={{ fontWeight: 600 }} />
  if (proposal.step === 'IDENTIFY_OURS' && notOurs.includes(proposal.key)) return <Chip size="small" variant="outlined" label="Not ours" sx={{ fontWeight: 600 }} />
  const resolution = resolutionFor(decisions, proposal.key)
  const label = resolution?.kind === 'CREATE' ? 'Will create new' : resolution?.kind === 'LINK' && resolution.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM ? `Will copy${resolution.targetName ? `: ${resolution.targetName}` : ''}` : resolution?.kind === 'SKIP_ROWS' ? 'Rows skipped' : `${proposal.step === 'IDENTIFY_OURS' ? 'Ours' : 'Linked'}${resolution?.targetName ? `: ${resolution.targetName}` : ''}`
  return <Chip size="small" variant="outlined" color="success" icon={<CheckCircleOutlineIcon />} label={label} sx={{ fontWeight: 600, maxWidth: '100%' }} />
}

// docs/specs/097-import-framework.md, Resolve step ("Match teams") and Identify what is ours: one card per distinct unrecognised
// value, "N of M resolved" progress, ranked proposals (confidence and reason chips) and the choices Link to this, Create new and
// Skip these rows, with a "Remember this match" tick. Nothing is chosen for the manager except an exact match or a remembered
// alias (the server marks it `preselected`; the wizard seeds it into the decisions, and it is still shown and counted).
// Creation is only chosen here: it is confirmed once, on the Review step.
export function ReferenceResolver({ mode, proposals, decisions, onDecisionsChange, notOurs = [], onNotOursChange, renderProposalExtras, candidateBadge, createLabel = 'Create', noun = 'names', create, collapseLow = false, disabled = false }: ReferenceResolverProps) {
  // The Remember tick of a card that has no resolution yet (on by default); a resolution carries its own.
  const [pendingRemember, setPendingRemember] = useState<Record<string, boolean>>({})
  const [showLow, setShowLow] = useState<Record<string, boolean>>({})
  const identify = mode === 'identify'
  const resolvedCount = proposals.filter((proposal) => isProposalResolved(proposal, decisions, notOurs)).length
  const rememberFor = (key: string) => resolutionFor(decisions, key)?.remember ?? pendingRemember[key] ?? true

  const choose = (proposal: ReferenceProposal, resolution: Omit<ImportResolution, 'key' | 'remember'>) => {
    const current = resolutionFor(decisions, proposal.key)
    // Choosing the same thing again takes it back.
    const same = current && current.kind === resolution.kind && current.targetId === resolution.targetId
    let next = same ? withoutResolution(decisions, proposal.key) : withResolution(decisions, { ...resolution, key: proposal.key, remember: rememberFor(proposal.key) })
    if (identify) {
      next = withIdentifiedAsOurs(next, proposal.key, !same)
      if (onNotOursChange && notOurs.includes(proposal.key)) onNotOursChange(notOurs.filter((key) => key !== proposal.key))
    }
    onDecisionsChange(next)
  }

  const markNotOurs = (proposal: ReferenceProposal) => {
    if (!onNotOursChange) return
    const already = notOurs.includes(proposal.key)
    onNotOursChange(already ? notOurs.filter((key) => key !== proposal.key) : [...notOurs, proposal.key])
    onDecisionsChange(withoutResolution(withIdentifiedAsOurs(decisions, proposal.key, false), proposal.key))
  }

  const chooseCreate = (proposal: ReferenceProposal) => {
    const tidy = create?.tidyName ? create.tidyName(proposal.value) : null
    choose(proposal, { kind: 'CREATE', targetKind: null, targetId: null, targetName: tidy, abbreviation: null })
  }

  const editCreate = (current: ImportResolution, patch: Partial<ImportResolution>) => onDecisionsChange(withResolution(decisions, { ...current, ...patch }))

  // The duplicate hint of a new name: an existing record, or another new name chosen on this step.
  const duplicateOf = (key: string, name: string | null | undefined): string | null => {
    const wanted = (name ?? '').trim().toLowerCase()
    if (!wanted) return null
    if ((create?.existingNames ?? []).some((existing) => existing.trim().toLowerCase() === wanted)) return 'This name already exists. Link to it instead, or give the new one another name.'
    const clash = decisions.resolutions.some((other) => other.key !== key && other.kind === 'CREATE' && (other.targetName ?? '').trim().toLowerCase() === wanted)
    return clash ? 'Another new name above is the same. Link them to one team, or rename one.' : null
  }

  const setRemember = (proposal: ReferenceProposal, remember: boolean) => {
    const current = resolutionFor(decisions, proposal.key)
    setPendingRemember((existing) => ({ ...existing, [proposal.key]: remember }))
    if (current) onDecisionsChange(withResolution(decisions, { ...current, remember }))
  }

  if (proposals.length === 0) {
    return <Typography variant="body2" color="text.secondary" data-testid="resolver-empty">{identify ? 'Nothing to identify. Every value in the file was recognised.' : 'Nothing to match. Every value in the file was recognised.'}</Typography>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      <Box>
        <Typography variant="body2" color="text.secondary" role="status" data-testid="resolver-progress">
          {resolvedCount} of {proposals.length} {noun} {identify ? 'identified' : 'resolved'}
        </Typography>
        <LinearProgress variant="determinate" value={(resolvedCount / proposals.length) * 100} aria-label={`${resolvedCount} of ${proposals.length} ${noun} ${identify ? 'identified' : 'resolved'}`} sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
      </Box>

      {proposals.map((proposal) => {
        const resolved = isProposalResolved(proposal, decisions, notOurs)
        const resolution = resolutionFor(decisions, proposal.key)
        const ranked = rankedCandidates(proposal)
        const isNotOurs = notOurs.includes(proposal.key)
        return (
          <Box
            key={proposal.key}
            component="section"
            aria-label={proposal.value}
            data-testid={`resolver-card-${proposal.key}`}
            data-resolved={resolved ? 'true' : 'false'}
            sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: resolved ? 'success.main' : 'error.main', borderRadius: 1, p: { xs: 1.25, md: 1.5 }, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1rem', overflowWrap: 'anywhere' }}>{proposal.value}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Used in {proposal.rowNumbers.length} {proposal.rowNumbers.length === 1 ? 'row' : 'rows'}{resolved ? '' : ', needs a decision'}
                </Typography>
              </Box>
              {decisionChip(proposal, decisions, notOurs, resolved)}
            </Box>

            {ranked.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {identify ? 'No record of yours has a similar name.' : 'No similar name was found. Create it only if you are sure it is new.'}
              </Typography>
            )}

            {ranked.map((candidate, index) => {
              const selected = resolution?.kind === 'LINK' && resolution.targetId === candidate.targetId && resolution.targetKind === candidate.targetKind
              const hintOnly = candidate.targetKind === TARGET_KIND_SISTER_TEAM
              const weak = collapseLow && confidenceBand(candidate.confidence) === 'Low' && !selected
              if (weak && !showLow[proposal.key]) return index === firstWeakIndex(ranked, selectedIn(ranked, resolution)) ? (
                <Button key={`weak-${proposal.key}`} size="compact" variant="ghost" onClick={() => setShowLow((current) => ({ ...current, [proposal.key]: true }))} sx={{ ...touchSx, alignSelf: 'flex-start' }}>
                  {`Show ${ranked.filter((entry) => confidenceBand(entry.confidence) === 'Low').length} weaker ${ranked.filter((entry) => confidenceBand(entry.confidence) === 'Low').length === 1 ? 'match' : 'matches'}`}
                </Button>
              ) : null
              return (
                <Box
                  key={`${candidate.targetKind}-${candidate.targetId}`}
                  data-testid={`proposal-${proposal.key}-${index}`}
                  sx={{ border: 1, borderColor: selected || index === 0 ? 'primary.main' : 'divider', bgcolor: selected ? 'action.selected' : 'background.default', borderRadius: 1, p: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{candidate.targetName}</Typography>
                      {(() => {
                        const badge = candidateBadge ? candidateBadge(candidate) : candidate.origin && !/^[A-Z][A-Z0-9_]*$/.test(candidate.origin) ? candidate.origin : null
                        return badge ? <Chip size="small" variant="outlined" color="primary" label={badge} data-testid={`candidate-badge-${proposal.key}-${index}`} sx={{ height: 20, fontSize: '0.72rem' }} /> : null
                      })()}
                    </Box>
                    {candidate.reasons.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {candidate.reasons.map((reason) => <Chip key={reason} size="small" label={reason} sx={{ height: 20, fontSize: '0.72rem' }} />)}
                      </Box>
                    )}
                    {renderProposalExtras?.(proposal, candidate)}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: 'space-between', flex: 'none' }}>
                    <Chip size="small" variant="outlined" label={hintOnly ? 'Sister team' : confidenceBand(candidate.confidence)} sx={{ height: 20, fontSize: '0.72rem', fontWeight: 600 }} />
                    <Typography component="span" sx={{ fontWeight: 700, minWidth: 44, textAlign: 'right' }} aria-label={`${candidate.confidence} percent match`}>{candidate.confidence}%</Typography>
                    {hintOnly ? (
                      <Typography variant="caption" color="text.secondary" sx={{ flex: { xs: 1, md: 'none' }, maxWidth: { md: 160 } }}>A different team of the same club. Not linked.</Typography>
                    ) : (
                    <HintedButton hint={identify ? 'This team is one of yours' : candidate.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM ? 'Copy this team into this league and season' : 'Use this existing team for the name in your file'}>
                      <Button
                        size="compact"
                        variant={selected ? 'primary' : 'secondary'}
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={`${identify ? 'This is ours' : candidate.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM ? 'Copy' : 'Link'}: ${candidate.targetName}`}
                        onClick={() => choose(proposal, { kind: 'LINK', targetKind: candidate.targetKind, targetId: candidate.targetId, targetName: candidate.targetName })}
                        sx={touchSx}
                      >
                        {selected ? (identify ? 'Ours' : 'Linked') : identify ? 'This is ours' : candidate.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM ? 'Copy' : 'Link'}
                      </Button>
                    </HintedButton>
                    )}
                  </Box>
                </Box>
              )
            })}

            {resolution?.kind === 'CREATE' && create && (
              <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'flex-start' } }}>
                <TextField
                  size="small"
                  label="Name of the new team"
                  value={resolution.targetName ?? ''}
                  disabled={disabled}
                  onChange={(event) => editCreate(resolution, { targetName: event.target.value })}
                  error={!(resolution.targetName ?? '').trim() || duplicateOf(proposal.key, resolution.targetName) !== null}
                  helperText={!(resolution.targetName ?? '').trim() ? 'Enter a name.' : (duplicateOf(proposal.key, resolution.targetName) ?? ' ')}
                  sx={{ flex: 2, minWidth: 0 }}
                />
                {create.withAbbreviation && (
                  <TextField
                    size="small"
                    label="Abbreviation (optional)"
                    value={resolution.abbreviation ?? ''}
                    disabled={disabled}
                    onChange={(event) => editCreate(resolution, { abbreviation: event.target.value || null })}
                    inputProps={{ maxLength: 20 }}
                    helperText=" "
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {identify ? (
                <Button size="compact" variant={isNotOursVariant(isNotOurs)} disabled={disabled} aria-pressed={isNotOurs} onClick={() => markNotOurs(proposal)} sx={{ ...touchSx, flex: { xs: 1, md: 'none' } }}>
                  Not ours
                </Button>
              ) : (
                <>
                  <HintedButton hint="Add it as a new league team">
                    <Button size="compact" variant={resolution?.kind === 'CREATE' ? 'primary' : 'secondary'} disabled={disabled} aria-pressed={resolution?.kind === 'CREATE'} onClick={() => chooseCreate(proposal)} sx={touchSx}>
                      {createLabel}
                    </Button>
                  </HintedButton>
                  <Button size="compact" variant={resolution?.kind === 'SKIP_ROWS' ? 'primary' : 'ghost'} disabled={disabled} aria-pressed={resolution?.kind === 'SKIP_ROWS'} onClick={() => choose(proposal, { kind: 'SKIP_ROWS', targetKind: null, targetId: null, targetName: null })} sx={{ ...touchSx, flex: { xs: 1, md: 'none' } }}>
                    Skip these rows
                  </Button>
                </>
              )}
              {!isNotOurs && (
                <FormControlLabel
                  sx={{ ml: 0, mr: 0, minHeight: { xs: 44, md: 32 }, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', color: 'text.secondary' } }}
                  control={<Checkbox size="small" checked={rememberFor(proposal.key)} disabled={disabled} onChange={(event) => setRemember(proposal, event.target.checked)} />}
                  label="Remember this match"
                />
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

const selectedIn = (ranked: ReferenceCandidate[], resolution: ImportResolution | undefined) =>
  resolution?.kind === 'LINK' ? ranked.findIndex((candidate) => candidate.targetId === resolution.targetId && candidate.targetKind === resolution.targetKind) : -1
// Where the single "Show weaker matches" button stands: at the first weak candidate that is not the chosen one.
const firstWeakIndex = (ranked: ReferenceCandidate[], selectedIndex: number) =>
  ranked.findIndex((candidate, index) => index !== selectedIndex && confidenceBand(candidate.confidence) === 'Low')

const isNotOursVariant = (isNotOurs: boolean) => (isNotOurs ? 'primary' : 'secondary')
