import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import Typography from '@mui/material/Typography'
import { getAdminIdentity } from '../../api/adminApi'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'

export default function AdminHome() {
  const { data, isError } = useQuery({
    queryKey: ['admin-me'],
    queryFn: getAdminIdentity,
  })

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        px: 2,
        py: 5,
      }}
    >
      {isError && (
        <EmptyState
          title="Not authorized"
          description="You are not recognized as a platform admin."
        />
      )}
      {!isError && data && (
        <Card title="You are logged in as an admin" sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="body1">{data.username}</Typography>
          <Typography variant="body2" color="text.secondary">
            {data.email}
          </Typography>
        </Card>
      )}
    </Box>
  )
}
