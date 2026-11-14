import { useOutletContext } from 'react-router-dom'
import { Box, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import { useAccessRoles } from '../../../api/accessGrantsApi'
import { PERMISSION_GROUPS, ROW_LABELS, cellFor, isClubWideRow } from './accessGrantFormat'

// docs/specs/150: Access, Roles. A read-only grid: what each built-in role can do. Edit includes view. Rows that have no
// section behind the data only count when the role is given for the whole club.
export default function RolesTab() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const roles = useAccessRoles(clubId)
  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />
  if (roles.isPending) return <Skeleton variant="rounded" height={320} />
  if (roles.isError || !roles.data) return <EmptyState title="Couldn't load roles" description="Something went wrong loading the roles. Please try again." />

  return (
    <Box data-testid="roles-tab" sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowX: 'auto' }}>
      <Table size="small" aria-label="What each role can do" sx={{ minWidth: 640, bgcolor: 'background.paper' }}>
        <TableHead>
          <TableRow>
            <TableCell>What It Allows</TableCell>
            {roles.data.map((role) => (
              <TableCell key={role.id} align="center">
                {role.name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {PERMISSION_GROUPS.map((group) => [
            <TableRow key={group.title}>
              <TableCell colSpan={roles.data.length + 1} sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>
                {group.title}
              </TableCell>
            </TableRow>,
            ...group.keys.map((row) => (
              <TableRow key={row}>
                <TableCell>
                  {ROW_LABELS[row]}
                  {isClubWideRow(row, roles.data) && (
                    <Typography component="div" variant="caption" color="warning.dark">
                      Whole-club grant only
                    </Typography>
                  )}
                </TableCell>
                {roles.data.map((role) => {
                  const cell = cellFor(role, row)
                  return (
                    <TableCell key={role.id} align="center" sx={{ color: cell === 'edit' ? 'primary.main' : 'text.secondary', fontWeight: cell === 'edit' ? 700 : 400 }}>
                      {cell === 'none' ? '' : cell === 'edit' ? 'Edit' : 'View'}
                    </TableCell>
                  )
                })}
              </TableRow>
            )),
          ])}
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary">
        Edit includes view. Permissions only add up: someone with two roles has both.
      </Typography>
    </Box>
  )
}
