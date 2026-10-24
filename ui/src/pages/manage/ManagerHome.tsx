import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import { activateSession } from '../../api/meApi'
import { useMyPlayers } from '../../api/myPlayersApi'
import { getManagedClubProfile } from '../../api/clubApi'
import { ManagerShell } from '../../components/ManagerShell'
import { keycloak } from '../../auth/keycloak'
import { StatusScreen } from '../../components/StatusScreen'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { signOut } from '../../auth/signOut'
import { useKeycloakSettled } from '../../auth/sessionExpiry'
import { useProfileSwitch } from '../../hooks/useProfileSwitch'
import { forgetProfileChoices, resolveManagerClubId } from '../../utils/activeProfile'

export default function ManagerHome() {
  const keycloakSettled = useKeycloakSettled()
  // Same query key PostLoginRedirect.tsx already uses for this exact call — a fresh login's
  // cached result is reused here rather than double-fetched; a direct nav/refresh to /manage
  // fetches fresh (docs/specs/020-club-manager-access.md).
  const { data, isError } = useQuery({
    queryKey: ['me', 'activate'],
    queryFn: activateSession,
  })

  // docs/specs/119 slice 4: the club comes from the loaded profile card (address, last choice, first card), not a guess.
  const clubId = resolveManagerClubId(data?.profiles, data?.clubAdminClubIds)
  const profileItems = useProfileSwitch()

  // Same query key ManageClubProfilePage.tsx/TeamFormPage.tsx already use for this club's
  // profile — a manager who later opens Club Profile reuses this cached result rather than
  // double-fetching. Real club branding (logo + name) in the header, replacing the generic
  // "Cricket Legend Platform" text every non-admin shell showed before — a platform_admin with
  // no CLUB_ADMIN grant landing here (clubId undefined) keeps the generic brand, disabling this
  // query entirely rather than fetching a profile for a club that doesn't exist.
  const { data: clubProfile } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId),
  })

  // docs/specs/119 3C: a cheap check that never blocks the shell; a failure just hides the menu item.
  const { data: myPlayers } = useMyPlayers(Boolean(data))

  // Wait for Keycloak init so there is no blank flash; an expired or ended session (or a manual
  // logout) lands here unauthenticated and goes to the landing page to log in again, rather than
  // showing "Not authorized" to someone who is simply not logged in.
  if (!keycloakSettled) {
    return <FullPageLoader label="Loading" />
  }

  if (!keycloak.authenticated) {
    return <Navigate to="/" replace />
  }

  if (isError || (data && !data.platformAdmin && data.clubAdminClubIds.length === 0)) {
    return (
      <StatusScreen kind="not-authorised" message="You do not have access to the club manager area." secondaryAction={{ label: 'Sign out', onClick: signOut }} />
    )
  }

  if (!data) {
    return <FullPageLoader label="Loading your club" />
  }

  return (
    <ManagerShell
      brand={clubProfile?.name ?? 'Cricket Legend Platform'}
      logoUrl={clubProfile ? clubProfile.logoUrl : undefined}
      user={{ name: keycloak.tokenParsed?.name ?? '', email: keycloak.tokenParsed?.email }}
      onLogout={() => {
        forgetProfileChoices()
        signOut()
      }}
      profileTo="/manage/profile"
      homeTo="/manage"
      myPlayersTo={(myPlayers?.length ?? 0) > 0 && !profileItems ? '/account' : undefined}
      profileItems={profileItems}
    >
      <Outlet context={{ clubId }} />
    </ManagerShell>
  )
}
