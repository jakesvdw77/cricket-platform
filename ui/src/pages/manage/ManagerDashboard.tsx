import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import GroupWorkOutlinedIcon from '@mui/icons-material/GroupWorkOutlined'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import { NavTile } from '../../components/NavTile'

interface ManagerCard {
  title: string
  description: string
  to: string
  icon: ReactNode
}

interface ManagerGroup {
  label: string
  cards: ManagerCard[]
}

// docs/specs/056-club-profile-overview.md: the four separate club-level cards (Profile/Contacts/
// Sponsors/Structure) collapse into one "Club Profile" card leading to the new consolidated
// ClubOverviewPage; Leagues/Matches are promoted out of the dissolved "Leagues and Fixtures" hub
// into their own direct cards; Gallery/Notifications join as new "Coming soon" placeholders,
// matching the existing Results/Permissions precedent. Order matches the approved mockup exactly.
const GROUPS: ManagerGroup[] = [
  {
    label: 'Club manager',
    cards: [
      { title: 'Club Profile', description: "Edit your club's details", to: '/manage/club-profile', icon: <BusinessOutlinedIcon /> },
      { title: 'Teams', description: 'Register teams', to: '/manage/teams', icon: <GroupsOutlinedIcon /> },
      { title: 'Players', description: 'Manage the player roster', to: '/manage/players', icon: <SportsCricketOutlinedIcon /> },
      { title: 'Leagues', description: "Create and manage your club's own leagues", to: '/manage/fixtures/leagues', icon: <EmojiEventsOutlinedIcon /> },
      { title: 'Matches', description: 'Schedule fixtures and build playing XIs', to: '/manage/fixtures/matches', icon: <SportsCricketOutlinedIcon /> },
      { title: 'Results', description: 'Capture and review match results', to: '/manage/results', icon: <AssessmentOutlinedIcon /> },
      { title: 'Team Managers & Permissions', description: 'Add managers, manage access', to: '/manage/permissions', icon: <AdminPanelSettingsOutlinedIcon /> },
      { title: 'Gallery', description: 'Share photos and highlights from your club', to: '/manage/gallery', icon: <PhotoLibraryOutlinedIcon /> },
      { title: 'Notifications', description: 'Announcements and reminders for your club', to: '/manage/notifications', icon: <NotificationsNoneOutlinedIcon /> },
    ],
  },
  {
    label: 'Team manager',
    cards: [
      { title: 'Squads', description: 'Pick squads per match', to: '/manage/squads', icon: <GroupWorkOutlinedIcon /> },
      { title: 'Communication', description: 'Message the squad', to: '/manage/communication', icon: <ChatOutlinedIcon /> },
      { title: 'Availability Polls', description: "Ask who's available", to: '/manage/availability', icon: <EventAvailableOutlinedIcon /> },
    ],
  },
]

export default function ManagerDashboard() {
  return (
    <>
      {GROUPS.map((group) => (
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
            {group.cards.map((card) => (
              <NavTile key={card.to} title={card.title} description={card.description} to={card.to} icon={card.icon} />
            ))}
          </Box>
        </Box>
      ))}
    </>
  )
}
