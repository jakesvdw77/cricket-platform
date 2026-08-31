import type { ReactNode } from 'react'
import { Box, Card as MuiCard, CardContent, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

export interface NavTileProps {
  title: string
  description: string
  icon: ReactNode
  to: string
}

// A dashboard nav card — ManagerDashboard.tsx and ConfigurationHome.tsx both used a bare `Card`
// with no icon and a plain white background, real user feedback that every card in the app read
// as an indistinguishable white rectangle. Extracted as its own component (rather than duplicating
// the icon-tile + tint styling in both dashboards) since both already needed the identical fix.
// Same light primary-tinted background RecordCard uses for the same reason — see that
// component's own doc comment.
export function NavTile({ title, description, icon, to }: NavTileProps) {
  return (
    <Box component={RouterLink} to={to} sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <MuiCard variant="outlined" sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: 'primary.dark',
              mb: 1.25,
              '& svg': { fontSize: 19 },
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1" component="h3" fontWeight={600} sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </CardContent>
      </MuiCard>
    </Box>
  )
}
