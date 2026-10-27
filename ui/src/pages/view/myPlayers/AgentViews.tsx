import { useState } from 'react'
import type { FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Alert, Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { useInviteAgent } from '../../../api/myPlayersApi'
import type { MyPlayer, MyPlayerAgent } from '../../../api/myPlayersApi'
import { useRemoveMyLink } from '../../../api/meApi'
import { HubLeaveConfirm, useHubLeaveGuard } from './hubLeaveGuard'
import { HUB, darkFieldSx, hubGoldButton, hubOutlineButton, hubPageHeading } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/119 slice 4, "Changing agents": the main agent hands over or adds another agent (one Edit agents view) and cancels a pending invitation,
// or any other agent leaves. Each is a sub-view that replaces the console body, with an explicit confirm step. Back is the hub footer's (docs/specs/121).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Confirm({ children }: { children: string }) {
  return (
    <Box role="alert" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(.3) }}>
      <Typography fontSize={15}>{children}</Typography>
    </Box>
  )
}

export type AgentMode = 'ADD' | 'HANDOVER'

const toggleSx = {
  alignSelf: 'flex-start',
  '& .MuiToggleButton-root': {
    minHeight: 44,
    px: 2,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 15,
    color: HUB.cream,
    borderColor: HUB.line,
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: alpha(HUB.gold, 0.18), color: HUB.gold, fontWeight: 700 },
    '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
  },
} as const

// A pending invitation with its own Cancel invitation (a small inline confirm first; nothing opens over the console).
function PendingRow({ agent }: { agent: MyPlayerAgent }) {
  const remove = useRemoveMyLink()
  const [confirming, setConfirming] = useState(false)
  return (
    <Box sx={{ display: 'grid', gap: 1 }} data-testid="pending-invitation">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 44 }}>
        <Typography fontWeight={600} fontSize={16}>
          {agent.name}
        </Typography>
        {agent.maskedEmail && (
          <Typography fontSize={14} sx={{ color: HUB.muted }}>
            {agent.maskedEmail}
          </Typography>
        )}
        {!confirming && (
          <Button variant="secondary" size="compact" sx={{ ...hubOutlineButton, ml: 'auto' }} disabled={!agent.linkId} onClick={() => setConfirming(true)}>
            Cancel invitation
          </Button>
        )}
      </Box>
      {confirming && (
        <Box role="alert" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, display: 'grid', gap: 1, bgcolor: blackAlpha(0.3) }}>
          <Typography fontSize={14}>Cancel this invitation? The invited person will no longer be able to accept it.</Typography>
          {remove.isError && <Alert severity="error">We could not do that. Please try again.</Alert>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="compact" sx={hubGoldButton} disabled={remove.isPending} onClick={() => agent.linkId && remove.mutate(agent.linkId)}>
              {remove.isPending ? 'Working…' : 'Yes, cancel it'}
            </Button>
            <Button variant="secondary" size="compact" sx={hubOutlineButton} disabled={remove.isPending} onClick={() => setConfirming(false)}>
              Not now
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// The Agents edit view (profile/agents/edit): add another agent or hand over (a new primary agent), with an explicit confirm
// step, then the pending invitations with Cancel invitation. The mode lives in the URL (?mode=add|handover) via the parent.
export function EditAgentsView({ player, mode, onModeChange }: { player: MyPlayer; mode: AgentMode; onModeChange?: (mode: AgentMode) => void }) {
  const invite = useInviteAgent(player.key)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'confirm' | 'sent'>('email')
  const [error, setError] = useState<string | undefined>()
  const handover = mode === 'HANDOVER'
  const address = email.trim().toLowerCase()
  const pending = player.agents.filter((agent) => agent.status === 'INVITED')
  useHubLeaveGuard(email.trim() !== '' && step !== 'sent')

  const changeMode = (next: AgentMode) => {
    if (next === mode) return
    if (step === 'sent') setEmail('')
    setStep('email')
    setError(undefined)
    onModeChange?.(next)
  }

  const next = (event: FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(address)) {
      setError('Enter a valid email address')
      return
    }
    setError(undefined)
    setStep('confirm')
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} data-testid="agent-change-view">
      <HubLeaveConfirm />
      <Typography component="h2" sx={hubPageHeading}>
        Edit agents
      </Typography>
      <ToggleButtonGroup exclusive size="small" aria-label="What to do" value={mode} onChange={(_event, value: AgentMode | null) => value && changeMode(value)} sx={toggleSx}>
        <ToggleButton value="ADD">Add another agent</ToggleButton>
        <ToggleButton value="HANDOVER">Hand over (change primary agent)</ToggleButton>
      </ToggleButtonGroup>
      {step === 'email' && (
        <Box component="form" noValidate onSubmit={next} sx={{ display: 'grid', gap: 1.5, ...darkFieldSx }}>
          <Typography fontSize={14} sx={{ color: HUB.muted }}>
            {handover
              ? `Enter the email address of the person who will become the primary agent for ${player.firstName}. They accept by signing in with that address.`
              : `Enter the email address of another agent for ${player.firstName}. They can see and update ${player.firstName} and answer availability, but cannot add or remove agents.`}
          </Typography>
          <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={Boolean(error)} helperText={error} autoComplete="off" />
          <Box>
            <Button type="submit" size="compact" sx={hubGoldButton}>
              Continue
            </Button>
          </Box>
        </Box>
      )}
      {step === 'confirm' && (
        <>
          <Confirm>
            {handover
              ? `Hand over ${player.firstName} to ${address}? You stay an agent until they accept.`
              : `Add ${address} as an agent for ${player.firstName}? They will be able to see and update the player and answer availability.`}
          </Confirm>
          {invite.isError && <Alert severity="error">We could not send the invitation. Please try again.</Alert>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="compact"
              sx={hubGoldButton}
              disabled={invite.isPending}
              onClick={() => invite.mutate({ email: address, mode }, { onSuccess: () => setStep('sent') })}
            >
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
            <Button variant="secondary" size="compact" sx={hubOutlineButton} disabled={invite.isPending} onClick={() => setStep('email')}>
              Change email address
            </Button>
          </Box>
        </>
      )}
      {step === 'sent' && <Confirm>{`Invitation sent to ${address}. It shows as pending until they accept, and expires after 14 days.`}</Confirm>}

      <Typography component="h3" sx={{ ...hubPageHeading, fontSize: 16, color: HUB.muted, mt: 1 }}>
        Pending invitations
      </Typography>
      {pending.length === 0 ? (
        <Typography fontSize={15} sx={{ color: HUB.muted }}>
          No pending invitations.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          {pending.map((agent, index) => (
            <PendingRow key={agent.linkId ?? `${agent.name}-${index}`} agent={agent} />
          ))}
        </Box>
      )}
    </Box>
  )
}

// Leave as an agent, or cancel a pending invitation: one confirm, one DELETE /me/links/{linkId}.
export function RemoveLinkView({ player, linkId, kind, onDone }: { player: MyPlayer; linkId: string | null | undefined; kind: 'leave' | 'cancel'; onDone: () => void }) {
  const remove = useRemoveMyLink()
  const leaving = kind === 'leave'
  const handOverFirst = isAxiosError(remove.error) && remove.error.response?.status === 409
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} data-testid="remove-link-view">
      <Typography component="h2" sx={hubPageHeading}>
        {leaving ? `Leave ${player.firstName}` : 'Cancel invitation'}
      </Typography>
      <Confirm>
        {leaving
          ? `Stop managing ${player.firstName}? You will no longer see or answer for them, and cannot undo this yourself.`
          : 'Cancel this invitation? The invited person will no longer be able to accept it.'}
      </Confirm>
      {handOverFirst && <Alert severity="warning">Hand over to another agent first, then you can leave.</Alert>}
      {remove.isError && !handOverFirst && <Alert severity="error">We could not do that. Please try again.</Alert>}
      <Box>
        <Button size="compact" sx={hubGoldButton} disabled={!linkId || remove.isPending} onClick={() => linkId && remove.mutate(linkId, { onSuccess: onDone })}>
          {remove.isPending ? 'Working…' : leaving ? 'Yes, leave' : 'Yes, cancel it'}
        </Button>
      </Box>
    </Box>
  )
}
