import { Alert, Link, Stack, Typography } from '@mui/material'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { Button } from '../../../components/Button'
import { RecordCard } from '../../../components/RecordCard'
import { initialsFromName } from '../../../utils/initials'
import type { LinkRequest } from '../../../api/playerAccountsApi'
import { bornText, dobDiffers, dobDiffersText, waitingText } from './linkRequestFormat'
import { formatDateOfBirth } from '../../../utils/playerFormat'

export interface LinkRequestCardProps {
  request: LinkRequest
  onApprove: (request: LinkRequest) => void
  onDecline: (request: LinkRequest) => void
  onNewPlayer: (request: LinkRequest) => void
}

// docs/specs/119 Part 3: one waiting request. It shows what the requester typed beside the suggested match so the
// manager can verify it before deciding. Nothing here is a grant; the three actions open their own confirm steps.
export function LinkRequestCard({ request, onApprove, onDecline, onNewPlayer }: LinkRequestCardProps) {
  const asked = `${request.typedFirstName} ${request.typedLastName}`
  const s = request.suggestedPlayer
  const label = { variant: 'caption', color: 'text.secondary', sx: { textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 } } as const
  return (
    <RecordCard
      title={asked}
      avatar={{ fallback: initialsFromName(asked), shape: 'circular' }}
      description={`Born ${bornText(request.typedDateOfBirth, request.typedAge)}`}
      footerActions={
        <>
          <Button variant="ghost" size="compact" startIcon={<CloseOutlinedIcon />} onClick={() => onDecline(request)}>
            Decline
          </Button>
          <Button variant="secondary" size="compact" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => onNewPlayer(request)}>
            New player and approve
          </Button>
          <Button size="compact" startIcon={<CheckOutlinedIcon />} onClick={() => onApprove(request)}>
            Approve
          </Button>
        </>
      }
    >
      <Stack spacing={0.25} data-testid="link-request-requester">
        <Typography {...label}>Requested by</Typography>
        <Typography variant="body2" fontWeight={600}>
          {request.requesterName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {request.requesterEmail} (verified)
        </Typography>
        {request.contactNumber && (
          <Typography variant="body2">
            Contact:{' '}
            <Link href={`tel:${request.contactNumber.replace(/\s+/g, '')}`} color="inherit" sx={{ position: 'relative' }}>
              {request.contactNumber}
            </Link>
          </Typography>
        )}
        {request.sectionName && (
          <Typography variant="body2">Section: {request.sectionName}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Waiting {waitingText(request.createdAt)}
        </Typography>
      </Stack>
      <Stack spacing={0.25} data-testid="link-request-suggestion">
        <Typography {...label}>Suggested match</Typography>
        {s ? (
          <>
            <Typography variant="body2" fontWeight={600}>
              {dobDiffers(request) ? 'Possible match: ' : ''}
              {s.firstName} {s.lastName}
              {s.sectionName ? `, ${s.sectionName}` : ''}
              {dobDiffers(request) && s.dateOfBirth ? `, born ${formatDateOfBirth(s.dateOfBirth)}` : ''}
            </Typography>
            {dobDiffers(request) && (
              <Alert severity="warning" sx={{ py: 0 }}>
                {dobDiffersText(request.typedDateOfBirth)}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {s.hasMainAgent ? `Already has a main agent${s.mainAgentName ? ` (${s.mainAgentName})` : ''}` : 'No main agent yet'}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No matching player at your club. Use New player and approve to add them.
          </Typography>
        )}
      </Stack>
      {request.message && (
        <Stack spacing={0.25}>
          <Typography {...label}>Message</Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {request.message}
          </Typography>
        </Stack>
      )}
    </RecordCard>
  )
}
