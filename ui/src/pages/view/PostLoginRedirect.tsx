import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container, Typography } from '@mui/material'
import { activateSession } from '../../api/meApi'

export default function PostLoginRedirect() {
  const navigate = useNavigate()
  const { data, isError } = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })

  useEffect(() => {
    if (isError) {
      navigate('/admin', { replace: true }) // same fallback as "no resolvable role" below
      return
    }
    if (!data) return
    if (data.platformAdmin) {
      navigate('/admin', { replace: true })
    } else if (data.clubAdminClubIds.length > 0) {
      navigate('/manage', { replace: true })
    } else {
      // No platform_admin authority and no CLUB_ADMIN grant — falls back to /admin, which
      // already renders its own "Not authorized" EmptyState for exactly this caller (005's
      // existing getAdminIdentity behaviour) rather than this page inventing a second one.
      navigate('/admin', { replace: true })
    }
  }, [data, isError, navigate])

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary">
        Signing you in…
      </Typography>
    </Container>
  )
}
