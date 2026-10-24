import { useQuery } from '@tanstack/react-query'
import { activateSession } from '../../../api/meApi'

// Where a manager or platform admin goes back to; null for everyone else. Same query key PostLoginRedirect and ManagerHome use.
export function useClubHome(): string | null {
  const access = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession, retry: false }).data
  if (access?.platformAdmin) return '/admin'
  return access && access.clubAdminClubIds.length > 0 ? '/manage' : null
}
