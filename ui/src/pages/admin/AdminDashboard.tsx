import { useOutletContext } from 'react-router-dom'
import { Typography } from '@mui/material'
import { Card } from '../../components/Card'
import type { AdminIdentity } from '../../api/adminApi'

export default function AdminDashboard() {
  const identity = useOutletContext<AdminIdentity>()

  return (
    <Card title="You are logged in as an admin" sx={{ maxWidth: 400 }}>
      <Typography variant="body1">{identity.username}</Typography>
      <Typography variant="body2" color="text.secondary">
        {identity.email}
      </Typography>
    </Card>
  )
}
