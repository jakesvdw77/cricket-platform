import { Avatar } from '@mui/material'
import type { SideLogo } from './teamLogoHelpers'

export function TeamLogo({ logo, testId }: { logo: SideLogo; testId: string }) {
  return (
    <Avatar
      variant="rounded"
      src={logo.src ?? undefined}
      alt=""
      aria-hidden
      data-testid={testId}
      sx={{
        width: { xs: 36, md: 44 },
        height: { xs: 36, md: 44 },
        flex: 'none',
        fontSize: { xs: '0.7rem', md: '0.8rem' },
        fontWeight: 700,
        bgcolor: 'background.paper',
        color: 'primary.main',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.25,
      }}
    >
      {logo.initials}
    </Avatar>
  )
}
