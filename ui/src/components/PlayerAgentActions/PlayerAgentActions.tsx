import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Skeleton, Typography } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAgentLinkActions, usePlayerLinks } from '../../api/playerAccountsApi'
import type { PlayerLink } from '../../api/playerAccountsApi'

export interface PlayerAgentActionsProps {
  clubId: string
  playerId: string
  playerName: string
}

type Pending =
  | { kind: 'invite'; email: string }
  | { kind: 'make-main'; link: PlayerLink }
  | { kind: 'remove'; link: PlayerLink }
  | null

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// docs/specs/119 slice 4 (Decision 26): the manager's one implementation of Invite as main agent, Make main agent and Remove link,
// used by the Access > Player accounts rows and the player's Account section. Every change goes through a confirm dialog and
// is sent with confirm: true; the old agent's access ends at once. A failed read of the links (for example a section the
// manager cannot see) renders nothing.
export function PlayerAgentActions({ clubId, playerId, playerName }: PlayerAgentActionsProps) {
  const links = usePlayerLinks(clubId, playerId)
  const { removeLink, makeMain, inviteMain } = useAgentLinkActions(clubId, playerId)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [pending, setPending] = useState<Pending>(null)
  const busy = removeLink.isPending || makeMain.isPending || inviteMain.isPending
  const failed = removeLink.isError || makeMain.isError || inviteMain.isError

  useEffect(() => {
    if (!pending) {
      removeLink.reset()
      makeMain.reset()
      inviteMain.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  if (links.isError) return null
  if (links.isPending) return <Skeleton variant="rounded" height={48} />

  const ask = (event: FormEvent) => {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!EMAIL.test(address)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailError(undefined)
    setPending({ kind: 'invite', email: address })
  }

  const close = () => setPending(null)
  const confirm = () => {
    if (!pending) return
    if (pending.kind === 'invite') inviteMain.mutate(pending.email, { onSuccess: () => { setEmail(''); close() } })
    else if (pending.kind === 'make-main') makeMain.mutate(pending.link.linkId, { onSuccess: close })
    else removeLink.mutate(pending.link.linkId, { onSuccess: close })
  }

  const title =
    pending?.kind === 'invite' ? 'Invite as main agent?' : pending?.kind === 'make-main' ? 'Make main agent?' : pending?.kind === 'remove' ? 'Remove this link?' : ''
  const body =
    pending?.kind === 'invite'
      ? `${pending.email} will be invited to manage ${playerName} as main agent. The current main agent loses main status when it is accepted.`
      : pending?.kind === 'make-main'
        ? `${pending.link.agentName} becomes the main agent for ${playerName}. The current main agent stays an ordinary agent.`
        : pending?.kind === 'remove'
          ? `${pending.link.agentName} will no longer see or manage ${playerName}. Their access ends at once.`
          : ''

  return (
    <Box data-testid="player-agent-actions" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {(links.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No agents are linked to {playerName}.
        </Typography>
      ) : (
        (links.data ?? []).map((link) => (
          <Box key={link.linkId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flex: '1 1 160px' }}>
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {link.agentName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {link.maskedEmail}
              </Typography>
            </Box>
            {link.main && <Chip size="small" label="Main agent" color="primary" />}
            {link.status === 'INVITED' && <Chip size="small" label="Pending" variant="outlined" />}
            {!link.main && link.status !== 'INVITED' && (
              <Button variant="secondary" size="compact" onClick={() => setPending({ kind: 'make-main', link })}>
                Make main agent
              </Button>
            )}
            <Button variant="secondary" size="compact" onClick={() => setPending({ kind: 'remove', link })}>
              Remove link
            </Button>
          </Box>
        ))
      )}

      <Box component="form" noValidate onSubmit={ask} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 220px' }}>
          <Input label="Invite an email as main agent" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={Boolean(emailError)} helperText={emailError} autoComplete="off" />
        </Box>
        <Button type="submit" variant="secondary" size="compact" sx={{ mt: 0.5 }}>
          Invite as main agent
        </Button>
      </Box>

      <Dialog open={Boolean(pending)} onClose={busy ? undefined : close} fullWidth maxWidth="xs">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DialogContentText>{body}</DialogContentText>
          {failed && <Alert severity="error">We could not make that change. Please try again.</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={pending?.kind === 'remove' ? 'danger' : 'primary'} onClick={confirm} disabled={busy}>
            {busy ? 'Saving…' : pending?.kind === 'remove' ? 'Remove link' : pending?.kind === 'make-main' ? 'Make main agent' : 'Send invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
