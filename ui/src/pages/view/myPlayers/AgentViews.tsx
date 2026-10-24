import { useState } from 'react'
import type { FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Alert, Box, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { useInviteAgent } from '../../../api/myPlayersApi'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { useRemoveMyLink } from '../../../api/meApi'
import { HubLeaveConfirm, useHubLeaveGuard } from './hubLeaveGuard'
import { HUB, darkFieldSx, hubGoldButton, hubOutlineButton, hubPageHeading } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/119 slice 4, "Changing agents": the main agent hands over or adds another agent, cancels a pending invitation,
// or any other agent leaves. Each is a sub-view that replaces the console body, with an explicit confirm step. Back is the hub footer's (docs/specs/121).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Confirm({ children }: { children: string }) {
  return (
    <Box role="alert" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(.3) }}>
      <Typography fontSize={15}>{children}</Typography>
    </Box>
  )
}

export function AgentChangeView({ player, mode }: { player: MyPlayer; mode: 'HANDOVER' | 'ADD' }) {
  const invite = useInviteAgent(player.key)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'confirm' | 'sent'>('email')
  const [error, setError] = useState<string | undefined>()
  const handover = mode === 'HANDOVER'
  const address = email.trim().toLowerCase()
  useHubLeaveGuard(email.trim() !== '' && step !== 'sent')

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
        {handover ? `Hand over ${player.firstName}` : 'Add another agent'}
      </Typography>
      {step === 'email' && (
        <Box component="form" noValidate onSubmit={next} sx={{ display: 'grid', gap: 1.5, ...darkFieldSx }}>
          <Typography fontSize={14} sx={{ color: HUB.muted }}>
            {handover
              ? `Enter the email address of the person who will become the main agent for ${player.firstName}. They accept by signing in with that address.`
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
              : `Add ${address} as another agent for ${player.firstName}? They will be sent an invitation.`}
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
      {step === 'sent' && (
        <>
          <Confirm>{`Invitation sent to ${address}. It shows as pending until they accept, and expires after 14 days.`}</Confirm>
        </>
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
