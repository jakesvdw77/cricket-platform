import { Avatar, IconButton } from '@mui/material'
import { alpha } from '@mui/material/styles'

export interface RecordIconButtonProps {
  imageUrl?: string | null
  shape: 'circular' | 'rounded'
  label: string
  initials: string
  onClick: () => void
}

// One tappable avatar icon for a "tap to view" icon grid — extracted from ClubOverviewPage.tsx's
// own private RecordIconButton (docs/specs/056-club-profile-overview.md) once TeamDetailPage
// (docs/specs/057-team-extended-profile.md) needed the exact same image-or-initials-avatar +
// click-to-open-quick-view pattern for its own Contacts/Sponsors grids — per
// docs/standards/frontend.md's reuse rule, a second near-identical call site is the signal to
// share this rather than duplicate it a second time.
export function RecordIconButton({ imageUrl, shape, label, initials, onClick }: RecordIconButtonProps) {
  return (
    <IconButton onClick={onClick} title={label} aria-label={label} sx={{ p: 0 }}>
      <Avatar
        src={imageUrl ?? undefined}
        variant={shape}
        sx={{
          width: 44,
          height: 44,
          fontSize: '0.8125rem',
          fontWeight: 600,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
          color: 'primary.dark',
        }}
      >
        {initials}
      </Avatar>
    </IconButton>
  )
}
