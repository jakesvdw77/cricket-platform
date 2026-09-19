import { Box } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { NavTile } from '../../components/NavTile'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'

// The "Fixtures" dashboard card's real destination — mirrors ConfigurationHome.tsx's own
// hub-of-cards pattern exactly (docs/specs/007-configuration-hub-overview.md), composed
// entirely from the existing NavTile component (a thin wrapper around Card — see its own doc
// comment), no new shared component. Results now has its own separate dashboard card/route
// (a placeholder for now) rather than sharing this one — split out at the user's request.
export default function ManageFixturesHome() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Fixtures" />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        <NavTile
          title="Leagues"
          description="Create and manage your club's own leagues"
          to="/manage/fixtures/leagues"
          icon={<EmojiEventsOutlinedIcon />}
        />
        <NavTile
          title="Seasons"
          description="Define the date ranges that scope affiliations and matches"
          to="/manage/fixtures/seasons"
          icon={<EventOutlinedIcon />}
        />
        <NavTile
          title="Matches"
          description="Schedule fixtures and build playing XIs"
          to="/manage/fixtures/matches"
          icon={<SportsCricketOutlinedIcon />}
        />
      </Box>
    </Box>
  )
}
