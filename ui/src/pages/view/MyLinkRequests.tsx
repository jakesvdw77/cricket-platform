import { Alert, Box, Chip, Skeleton, Typography } from '@mui/material'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { Button } from '../../components/Button'
import { badgeSx } from '../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../components/RecordCard'
import { useCancelLinkRequest, useMyLinkRequests } from '../../api/meApi'
import type { MyLinkRequest, MyLinkRequestStatus } from '../../api/meApi'

const STATUS: Record<MyLinkRequestStatus, { label: (clubName: string) => string; tone: RecordCardBadgeTone }> = {
  PENDING: { label: (club) => `Waiting for ${club}`, tone: 'warning' },
  APPROVED: { label: () => 'Accepted', tone: 'positive' },
  DECLINED: { label: () => 'Declined', tone: 'closed' },
  CANCELLED: { label: () => 'Cancelled', tone: 'muted' },
}

const sentOn = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Row({ request, onCancel, cancelling }: { request: MyLinkRequest; onCancel: (id: string) => void; cancelling: boolean }) {
  const status = STATUS[request.status]
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="my-link-request">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={700}>
          {request.playerName}
        </Typography>
        <Chip size="small" label={status.label(request.clubName)} sx={badgeSx(status.tone)} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {request.clubName} · Sent {sentOn(request.createdAt)}
      </Typography>
      {request.status === 'DECLINED' && request.decisionNote && (
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          Note from the club: {request.decisionNote}
        </Typography>
      )}
      {request.status === 'PENDING' && (
        <Box>
          <Button variant="secondary" size="compact" startIcon={<CancelOutlinedIcon />} disabled={cancelling} onClick={() => onCancel(request.id)}>
            Cancel request
          </Button>
        </Box>
      )}
    </Box>
  )
}

// docs/specs/119 Part 3: the requester's own status list (the full My players page is slice 3C). The in-app status is the
// source of truth; the email is an addition.
export function MyLinkRequests() {
  const requests = useMyLinkRequests()
  const cancel = useCancelLinkRequest()
  if (requests.isPending) return <Skeleton variant="rounded" height={72} />
  if (requests.isError) return <Alert severity="error">We could not load your requests. Please try again later.</Alert>
  if (requests.data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        You have not sent any requests yet.
      </Typography>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} role="list" aria-label="My requests">
      {requests.data.map((request) => (
        <Box key={request.id} role="listitem">
          <Row request={request} onCancel={(id) => cancel.mutate(id)} cancelling={cancel.isPending} />
        </Box>
      ))}
      {cancel.isError && <Alert severity="error">We could not cancel that request. Please try again.</Alert>}
    </Box>
  )
}
