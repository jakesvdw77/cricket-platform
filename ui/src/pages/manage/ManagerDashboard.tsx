import { Box, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { Card } from '../../components/Card'

interface ManagerCard {
  title: string
  description: string
  to: string
}

interface ManagerGroup {
  label: string
  cards: ManagerCard[]
}

const GROUPS: ManagerGroup[] = [
  {
    label: 'Club manager',
    cards: [
      { title: 'Sections & Age Groups', description: 'Set up age-group sections', to: '/manage/sections' },
      { title: 'Teams', description: 'Register teams', to: '/manage/teams' },
      { title: 'Players', description: 'Manage the player roster', to: '/manage/players' },
      { title: 'Fixtures & Results', description: 'Matches and captured results', to: '/manage/fixtures' },
      { title: 'Team Managers & Permissions', description: 'Add managers, manage access', to: '/manage/permissions' },
    ],
  },
  {
    label: 'Team manager',
    cards: [
      { title: 'Squads', description: 'Pick squads per match', to: '/manage/squads' },
      { title: 'Communication', description: 'Message the squad', to: '/manage/communication' },
      { title: 'Availability Polls', description: "Ask who's available", to: '/manage/availability' },
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
              <Box
                key={card.to}
                component={RouterLink}
                to={card.to}
                sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Card title={card.title}>
                  <Typography variant="body2" color="text.secondary">
                    {card.description}
                  </Typography>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </>
  )
}
