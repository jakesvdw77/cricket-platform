import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Typography } from '@mui/material'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { Card } from '../../components/Card'
import { NavTile } from '../../components/NavTile'
import { getPlatformPlayingAreasSummary, platformFieldsSummaryKey } from '../../api/platformPlayingAreaApi'
import type { AdminIdentity } from '../../api/adminApi'

export default function AdminDashboard() {
  // AdminHome only renders <Outlet context={data} /> once its identity query has resolved
  // (see its `if (!data) return null` guard), so `identity` is never actually undefined here
  // despite useOutletContext's generic being an unchecked cast, not a runtime guarantee.
  const identity = useOutletContext<AdminIdentity>()

  // docs/specs/099-fields-directory.md (9): the queue is noticed here, with its count, not as a badge in a menu. A failed
  // request leaves the tile without a count rather than showing a wrong one.
  const summary = useQuery({ queryKey: platformFieldsSummaryKey, queryFn: getPlatformPlayingAreasSummary, retry: false })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card title="You are logged in as an admin" sx={{ maxWidth: 400 }}>
        <Typography variant="body1">{identity.username}</Typography>
        <Typography variant="body2" color="text.secondary">
          {identity.email}
        </Typography>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, maxWidth: 960 }}>
        <NavTile
          title="Fields to verify"
          description="Check the fields clubs have added"
          icon={<PlaceOutlinedIcon />}
          to="/admin/fields"
          count={summary.data?.unverified}
        />
      </Box>
    </Box>
  )
}
