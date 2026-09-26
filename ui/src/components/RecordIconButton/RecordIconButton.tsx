import { Avatar, ButtonBase, Typography } from '@mui/material'
import { avatarSx } from '../RecordCard'

export interface RecordIconButtonProps {
  imageUrl?: string | null
  shape: 'circular' | 'rounded'
  label: string
  name: string
  initials: string
  onClick: () => void
}

// One tappable avatar icon for a "tap to view" icon grid — extracted from ClubOverviewPage.tsx's
// own private RecordIconButton (docs/specs/056-club-profile-overview.md) once TeamDetailPage
// (docs/specs/057-team-extended-profile.md) needed the exact same image-or-initials-avatar +
// click-to-open-quick-view pattern for its own Contacts/Sponsors grids — per
// docs/standards/frontend.md's reuse rule, a second near-identical call site is the signal to
// share this rather than duplicate it a second time.
//
// `name` renders as a caption under the avatar — real user feedback on the Team detail page's
// Contacts/Sponsors grids: an unlabeled row of avatars gave no way to tell who's who without
// opening each one's quick-view dialog. `label`/`aria-label` stay as the fuller "name — role"
// accessible name (unchanged); `name` is deliberately just the bare name, kept short under the
// fixed avatar width.
export function RecordIconButton({ imageUrl, shape, label, name, initials, onClick }: RecordIconButtonProps) {
  return (
    <ButtonBase
      onClick={onClick}
      title={label}
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: 1, width: 84 }}
    >
      <Avatar src={imageUrl ?? undefined} variant={shape} sx={avatarSx(44, '0.8125rem')}>
        {initials}
      </Avatar>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>
        {name}
      </Typography>
    </ButtonBase>
  )
}
