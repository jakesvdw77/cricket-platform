import { Box, Typography } from '@mui/material'
import { NavTile } from '../../components/NavTile'
import { MANAGER_NAV, OVERVIEW_TILE_GROUPS, flatNavItems } from '../../components/ManagerShell'

// docs/specs/079-manager-shell-and-overview.md: the /manage index. In this slice it shows the
// former dashboard's NavTile grid unchanged, now derived from the shared manager navigation
// (components/ManagerShell/managerNav.ts) so the menu and the tiles cannot drift apart. The real
// overview cards replace it in a later slice.
//
// docs/specs/056-club-profile-overview.md: the four separate club-level cards (Profile/Contacts/
// Sponsors/Structure) collapse into one "Club Profile" card leading to the consolidated
// ClubOverviewPage; Leagues/Matches are direct cards; Gallery/Notifications are "Coming soon"
// placeholders. docs/specs/073-availability-hub.md: one Availability tile for the hub.
export default function ManagerOverviewPage() {
  const items = flatNavItems(MANAGER_NAV)

  return (
    <>
      {OVERVIEW_TILE_GROUPS.map((group) => (
        <Box key={group.label} sx={{ mb: 4 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {group.label}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}
          >
            {group.ids.flatMap((id) => {
              const item = items.find((candidate) => candidate.id === id)
              if (!item || item.icon === 'menu') return []
              return [
                <NavTile
                  key={item.id}
                  title={item.tileTitle ?? item.label}
                  description={item.description}
                  to={item.to}
                  brandIcon={item.icon}
                />,
              ]
            })}
          </Box>
        </Box>
      ))}
    </>
  )
}
