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
// Solid `background.paper` + shadow, not a tint — every shell's <main> now carries its own
// brand-tinted gradient (theme.ts's pageBackgroundGradient), and a translucent tint card read as
// indistinguishable from that background; an opaque, shadowed card reads as a surface floating
// above it instead. Same treatment RecordCard uses for the same reason.
//
// The whole tile has always been a single RouterLink (there's only one destination, no
// separate View/Edit split), but it carried no hover feedback — real user feedback that every
// clickable card in the app should show the same hover halo RecordCard.tsx gained in
// docs/specs/059-record-card-click-to-view.md, dashboard tiles included.
export function NavTile({ title, description, icon, to }: NavTileProps) {
  return (
    <Box component={RouterLink} to={to} sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <MuiCard
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 2,
          transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
          outline: '1px solid transparent',
          '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
        }}
      >
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
