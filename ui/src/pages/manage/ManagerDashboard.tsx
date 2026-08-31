import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
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

const GROUPS: ManagerGroup[] = [
  {
    label: 'Club manager',
    cards: [
      { title: 'Club Profile', description: "Edit your club's details", to: '/manage/club-profile', icon: <BusinessOutlinedIcon /> },
      { title: 'Club Contacts', description: "Manage your club's named contacts", to: '/manage/club-contacts', icon: <ContactsOutlinedIcon /> },
      { title: 'Club Sponsors', description: "Manage your club's sponsors", to: '/manage/sponsors', icon: <HandshakeOutlinedIcon /> },
      { title: 'Club Structure', description: "Define your club's own section tree", to: '/manage/sections', icon: <AccountTreeOutlinedIcon /> },
      { title: 'Teams', description: 'Register teams', to: '/manage/teams', icon: <GroupsOutlinedIcon /> },
      { title: 'Players', description: 'Manage the player roster', to: '/manage/players', icon: <SportsCricketOutlinedIcon /> },
      { title: 'Fixtures & Results', description: 'Matches and captured results', to: '/manage/fixtures', icon: <EventOutlinedIcon /> },
      { title: 'Team Managers & Permissions', description: 'Add managers, manage access', to: '/manage/permissions', icon: <AdminPanelSettingsOutlinedIcon /> },
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
