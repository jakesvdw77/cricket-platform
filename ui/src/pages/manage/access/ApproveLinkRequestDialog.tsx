import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { SectionTreeSelect } from '../../../components/SectionTreeSelect'
import { listPlayers } from '../../../api/playerApi'
import type { Player } from '../../../api/playerApi'
import { listSections } from '../../../api/sectionApi'
import { useApproveLinkRequest, usePlayerLinks } from '../../../api/playerAccountsApi'
import type { LinkRequest, MainAgentMode } from '../../../api/playerAccountsApi'
import { formatDateOfBirth } from '../../../utils/playerFormat'
import { dobDiffers, dobDiffersText } from './linkRequestFormat'

export type ApproveMode = 'existing' | 'new'

export interface ApproveLinkRequestDialogProps {
  clubId: string
  request: LinkRequest | null
  mode: ApproveMode
  onClose: () => void
}

type Step = 'choose' | 'confirm'

const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`

// docs/specs/119 Part 3: approve in two steps, choose then an explicit confirm (the server also refuses without
// confirm: true). "existing" picks or confirms the suggested player (and, when that player already has a main agent,
// asks replace or add); "new" is "New player and approve" with the typed details editable first.
export function ApproveLinkRequestDialog({ clubId, request, mode, onClose }: ApproveLinkRequestDialogProps) {
  const approve = useApproveLinkRequest(clubId)
  const [step, setStep] = useState<Step>('choose')
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null)
  const [agentMode, setAgentMode] = useState<MainAgentMode | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)

  useEffect(() => {
    if (!request) return
    setStep('choose')
    setAgentMode(null)
    approve.reset()
    const suggested = request.suggestedPlayer
    setPicked(suggested ? { id: suggested.playerId, label: name(suggested) } : null)
    setFirstName(request.typedFirstName)
    setLastName(request.typedLastName)
    setDateOfBirth(request.typedDateOfBirth)
    setSectionId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, mode])

  const open = Boolean(request)
  const existing = mode === 'existing'
  const players = useQuery({
    queryKey: ['managed-club', clubId, 'players', 'link-picker'],
    queryFn: () => listPlayers(clubId, { includeInactive: false }),
    enabled: open && existing,
  })
  const sections = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId),
    enabled: open && !existing,
  })
  const links = usePlayerLinks(clubId, existing ? picked?.id : undefined)
  const suggested = request?.suggestedPlayer
  const hasMainAgent = useMemo(() => {
    if (!existing || !picked) return false
    if (links.data) return links.data.some((link) => link.main)
    return suggested && suggested.playerId === picked.id ? suggested.hasMainAgent : false
  }, [existing, picked, links.data, suggested])
  const mainAgentName = links.data?.find((link) => link.main)?.agentName ?? (suggested?.playerId === picked?.id ? suggested?.mainAgentName : null)

  const options = useMemo(() => (players.data ?? []).map((p: Player) => ({ id: p.id, label: name(p) })), [players.data])
  const effectiveMode: MainAgentMode = existing && hasMainAgent ? (agentMode ?? 'ADD') : 'MAKE_MAIN'
  const choiceComplete = existing ? Boolean(picked) && (!hasMainAgent || agentMode !== null) : Boolean(firstName.trim() && lastName.trim() && dateOfBirth)
  const busy = approve.isPending

  const submit = () => {
    if (!request) return
    approve.mutate(
      {
        id: request.id,
        input: existing
          ? { playerId: picked?.id, mainAgentMode: effectiveMode, confirm: true }
          : {
              newPlayer: { firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth, ...(sectionId ? { sectionId } : {}) },
              mainAgentMode: 'MAKE_MAIN',
              confirm: true,
            },
      },
      { onSuccess: onClose },
    )
  }

  const confirmLines = existing
    ? [
        `Link ${request?.requesterName} (${request?.requesterEmail}) to ${picked?.label}.`,
        effectiveMode === 'MAKE_MAIN'
          ? hasMainAgent
            ? `They become the main agent and replace ${mainAgentName ?? 'the current main agent'}.`
            : 'They become the main agent.'
          : 'They are added as another agent. The current main agent stays.',
      ]
    : [
        `Create the player ${firstName.trim()} ${lastName.trim()}, born ${formatDateOfBirth(dateOfBirth)}, as a verified player.`,
        `Link ${request?.requesterName} (${request?.requesterEmail}) as their main agent.`,
      ]

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{existing ? 'Approve link request' : 'New player and approve'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {request && (
          <Typography variant="body2" color="text.secondary">
            {request.requesterName} asked to link {request.typedFirstName} {request.typedLastName}, born {formatDateOfBirth(request.typedDateOfBirth)}.
          </Typography>
        )}

        {step === 'choose' && existing && (
          <>
            <Autocomplete
              options={options}
              value={picked}
              loading={players.isPending}
              onChange={(_, value) => {
                setPicked(value)
                setAgentMode(null)
              }}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(option) => option.label}
              renderInput={(params) => <TextField {...params} size="small" label="Player" />}
            />
            {suggested && picked?.id === suggested.playerId && (
              <Typography variant="caption" color="text.secondary">
                Suggested by name and date of birth{suggested.sectionName ? `, ${suggested.sectionName}` : ''}.
              </Typography>
            )}
            {picked && hasMainAgent && (
              <FormControl>
                <FormLabel id="main-agent-mode-label">{mainAgentName ?? 'This player'} is already the main agent. What should happen?</FormLabel>
                <RadioGroup aria-labelledby="main-agent-mode-label" value={agentMode ?? ''} onChange={(event) => setAgentMode(event.target.value as MainAgentMode)}>
                  <FormControlLabel value="MAKE_MAIN" control={<Radio />} label="Make main agent (replaces)" />
                  <FormControlLabel value="ADD" control={<Radio />} label="Add as another agent" />
                </RadioGroup>
              </FormControl>
            )}
          </>
        )}

        {step === 'choose' && !existing && (
          <>
            <Input label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="off" />
            <Input label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="off" />
            <Input
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <SectionTreeSelect label="Section (optional)" sections={sections.data ?? []} value={sectionId} onChange={setSectionId} allowClear allLabel="No section" />
          </>
        )}

        {step === 'confirm' && (
          <Box role="group" aria-label="Confirm approval" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {confirmLines.map((line) => (
              <Typography key={line} variant="body2" fontWeight={600}>
                {line}
              </Typography>
            ))}
            {existing && request && picked?.id === suggested?.playerId && dobDiffers(request) && (
              <Alert severity="warning">{dobDiffersText(request.typedDateOfBirth)}</Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              They will be able to see this player and answer availability. Please check you have verified the request.
            </Typography>
          </Box>
        )}

        {approve.isError && <Alert severity="error">We could not approve this request. It may already have been decided. Please try again.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {step === 'confirm' ? (
          <>
            <Button onClick={() => setStep('choose')} disabled={busy}>
              Back
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Approving…' : 'Confirm and approve'}
            </Button>
          </>
        ) : (
          <Button onClick={() => setStep('confirm')} disabled={!choiceComplete}>
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
