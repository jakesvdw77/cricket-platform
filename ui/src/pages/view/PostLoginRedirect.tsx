import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Container, Typography } from '@mui/material'
import { activateSession } from '../../api/meApi'
import { useMyPlayers } from '../../api/myPlayersApi'

export default function PostLoginRedirect() {
  const navigate = useNavigate()
  const { data, isError, error } = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })

  // docs/specs/119 3C: a person with no manager or admin access but with players (their own record or linked ones)
  // goes to My players. Only asked for exactly that caller, so everyone else keeps today's routing untouched.
  const noManagerAccess = Boolean(data) && !data?.platformAdmin && data?.clubAdminClubIds.length === 0 && data?.personId !== null
  const players = useMyPlayers(noManagerAccess)

  useEffect(() => {
    if (isError) {
      if (isAxiosError(error) && error.response?.status === 403) return // suspended: shown below
      navigate('/admin', { replace: true }) // same fallback as "no resolvable role" below
      return
    }
    if (!data) return
    if (data.platformAdmin) {
      navigate('/admin', { replace: true })
    } else if (data.clubAdminClubIds.length > 0) {
      navigate('/manage', { replace: true })
    } else if (data.personId === null) {
      // Signed in but no Person resolved (e.g. a first-time Google user): spec 119 Part 2.
      // A caller WITH a Person but no club-admin grant (e.g. a section-scoped manager, whom
      // MeAccess cannot distinguish further) keeps the existing /admin fallback below.
      navigate('/welcome', { replace: true })
    } else if (players.isLoading) {
      // Waiting for the players check; this effect runs again when it settles.
    } else if ((players.data?.length ?? 0) > 0) {
      navigate('/account', { replace: true })
    } else {
      // No platform_admin authority and no CLUB_ADMIN grant — falls back to /admin, which
      // already renders its own "Not authorized" EmptyState for exactly this caller (005's
      // existing getAdminIdentity behaviour) rather than this page inventing a second one.
      navigate('/admin', { replace: true })
    }
  }, [data, isError, error, navigate, players.isLoading, players.data])

  if (isError && isAxiosError(error) && error.response?.status === 403) {
    return (
      <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="h6" component="h1" gutterBottom>
          Account suspended
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This account has been suspended. Please contact your club.
        </Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary">
        Signing you in…
      </Typography>
    </Container>
  )
}
