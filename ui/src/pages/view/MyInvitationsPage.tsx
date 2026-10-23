import { useState } from 'react'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useInvitationAction, useMyInvitations } from '../../api/meApi'
import type { MyInvitation } from '../../api/meApi'
import { formatDateTime } from '../../utils/publicAvailabilityFormat'
import { HubBackButton, HubFrame } from './myPlayers/HubFrame'
import { HUB, hubGoldButton, hubOutlineButton } from './myPlayers/hubStyle'
import { creamAlpha, blackAlpha } from '../../brandTokens'

// docs/specs/119 slice 4: invitations to manage a player, in the dark console. Accepting an invitation that makes you the
// main agent asks for a confirm first, inside the tile (nothing opens over the console).
function InvitationTile({ invitation }: { invitation: MyInvitation }) {
  const accept = useInvitationAction('accept')
  const decline = useInvitationAction('decline')
  const [confirming, setConfirming] = useState(false)
  const busy = accept.isPending || decline.isPending
  const failed = accept.isError || decline.isError

  return (
    <Box data-testid="invitation-tile" sx={{ border: 1, borderColor: HUB.line, bgcolor: HUB.panelDark, borderRadius: '4px', p: 2, display: 'grid', gap: 1.25 }}>
      <Box>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 26, letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          {invitation.playerName}
        </Typography>
        <Typography fontSize={14} sx={{ color: HUB.muted }}>
          {invitation.clubName} · Invited by {invitation.invitedByName}
        </Typography>
        <Typography fontSize={13} sx={{ color: HUB.muted }}>
          Expires {formatDateTime(invitation.expiresAt)}
        </Typography>
        {invitation.makeMain && (
          <Typography fontSize={14} fontWeight={600} sx={{ color: HUB.gold, mt: 0.5 }}>
            This will make you the main agent
          </Typography>
        )}
      </Box>
      {confirming ? (
        <Box role="alert" sx={{ border: 1, borderColor: HUB.gold, borderRadius: '4px', p: 1.5, display: 'grid', gap: 1 }}>
          <Typography fontSize={14}>
            Accept and become the main agent for {invitation.playerName}? The current main agent stays an agent but can no longer add or remove agents.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="compact" sx={hubGoldButton} disabled={busy} onClick={() => accept.mutate(invitation.linkId)}>
              {accept.isPending ? 'Accepting…' : 'Yes, accept'}
            </Button>
            <Button variant="secondary" size="compact" sx={hubOutlineButton} disabled={busy} onClick={() => setConfirming(false)}>
              Not now
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="compact" sx={hubGoldButton} disabled={busy} onClick={() => (invitation.makeMain ? setConfirming(true) : accept.mutate(invitation.linkId))}>
            Accept
          </Button>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} disabled={busy} onClick={() => decline.mutate(invitation.linkId)}>
            Decline
          </Button>
        </Box>
      )}
      {failed && <Alert severity="error">We could not do that. The invitation may have expired or been cancelled.</Alert>}
    </Box>
  )
}

export default function MyInvitationsPage() {
  const navigate = useNavigate()
  const invitations = useMyInvitations()
  const list = invitations.data ?? []
  return (
    <HubFrame title="Invitations" maxWidth={720} testId="my-invitations-page">
      <HubBackButton onClick={() => navigate('/account')}>Back to players</HubBackButton>
      {invitations.isLoading && <Skeleton variant="rounded" height={120} sx={{ bgcolor: creamAlpha(.12) }} />}
      {invitations.isError && <Alert severity="error">We could not load your invitations. Please try again later.</Alert>}
      {invitations.data && list.length === 0 && (
        <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2.5, bgcolor: blackAlpha(.22), color: HUB.muted }}>No invitations waiting.</Box>
      )}
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {list.map((invitation) => (
          <InvitationTile key={invitation.linkId} invitation={invitation} />
        ))}
      </Box>
    </HubFrame>
  )
}
