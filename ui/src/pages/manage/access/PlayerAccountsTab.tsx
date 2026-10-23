import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Box, Skeleton, Typography } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import { useLinkRequests, useLinkRequestsSummary } from '../../../api/playerAccountsApi'
import type { LinkRequest } from '../../../api/playerAccountsApi'
import { cardGridSx } from '../../../utils/cardGrid'
import { ApproveLinkRequestDialog } from './ApproveLinkRequestDialog'
import type { ApproveMode } from './ApproveLinkRequestDialog'
import { DeclineLinkRequestDialog } from './DeclineLinkRequestDialog'
import { LinkRequestCard } from './LinkRequestCard'
import { PlayerAccountsList } from './PlayerAccountsList'
import { countText } from './linkRequestFormat'

// docs/specs/119 Part 3: Access, Player accounts. Top to bottom: the "N link requests waiting" line, the request list,
// then Players and their main agent. Requests are untrusted input waiting for a human; each action opens its own confirm.
export default function PlayerAccountsTab() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const requests = useLinkRequests(clubId)
  const summary = useLinkRequestsSummary(clubId)
  const [approving, setApproving] = useState<{ request: LinkRequest; mode: ApproveMode } | null>(null)
  const [declining, setDeclining] = useState<LinkRequest | null>(null)

  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />

  const waiting = summary.data?.waiting ?? requests.data?.length
  return (
    <Box data-testid="player-accounts-tab" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box component="section" aria-labelledby="link-requests-heading" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography id="link-requests-heading" variant="h6" component="h2" fontWeight={700}>
          Link requests
        </Typography>
        {waiting !== undefined && (
          <Typography variant="body2" color="text.secondary" role="status" data-testid="link-requests-counter">
            {countText(waiting, 'link request', 'link requests')} waiting
          </Typography>
        )}

        {requests.isPending && (
          <Box aria-busy="true" sx={cardGridSx}>
            <Skeleton variant="rounded" height={200} />
            <Skeleton variant="rounded" height={200} />
          </Box>
        )}
        {requests.isError && <EmptyState title="Couldn't load link requests" description="Something went wrong loading the requests. Please try again." />}
        {requests.data && requests.data.length === 0 && (
          <EmptyState title="No link requests waiting" description="When someone asks to be linked to a player, you will review it here." />
        )}
        {requests.data && requests.data.length > 0 && (
          <Box sx={cardGridSx}>
            {requests.data.map((request) => (
              <LinkRequestCard
                key={request.id}
                request={request}
                onApprove={(r) => setApproving({ request: r, mode: 'existing' })}
                onNewPlayer={(r) => setApproving({ request: r, mode: 'new' })}
                onDecline={setDeclining}
              />
            ))}
          </Box>
        )}
      </Box>

      <PlayerAccountsList clubId={clubId} />

      <ApproveLinkRequestDialog clubId={clubId} request={approving?.request ?? null} mode={approving?.mode ?? 'existing'} onClose={() => setApproving(null)} />
      <DeclineLinkRequestDialog clubId={clubId} request={declining} onClose={() => setDeclining(null)} />
    </Box>
  )
}
