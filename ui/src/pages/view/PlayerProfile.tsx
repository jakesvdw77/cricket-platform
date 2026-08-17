import { Typography } from '@mui/material'
import { Card } from '../../components/Card'
import { MOCK_PLAYER } from './mockPlayer'

export default function PlayerProfile() {
  return (
    <Card title="Profile">
      <Typography variant="body1">{MOCK_PLAYER.name}</Typography>
    </Card>
  )
}
