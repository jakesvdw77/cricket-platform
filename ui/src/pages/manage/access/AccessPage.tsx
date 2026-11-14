import { useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Alert, Box, Snackbar, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { listSections } from '../../../api/sectionApi'
import { useAccessGrants, useAccessRoles } from '../../../api/accessGrantsApi'
import { AddPersonDialog } from './AddPersonDialog'
import { addOutcome } from './accessGrantFormat'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { segmentedSwitchSx } from '../../../utils/segmentedSwitch'

// docs/specs/119 Part 3 and docs/specs/150: Access has three tabs; the tab lives in the URL.
const TABS = [
  { value: 'people', label: 'People', to: '/manage/permissions' },
  { value: 'roles', label: 'Roles', to: '/manage/permissions/roles' },
  { value: 'player-accounts', label: 'Player accounts', to: '/manage/permissions/player-accounts' },
]

export default function AccessPage() {
  useDocumentTitle('Access')
  // ManagerHome's context (clubId), handed on to the tab.
  const context = useOutletContext<{ clubId?: string }>()
  const { pathname } = useLocation()
  const tab = pathname.startsWith('/manage/permissions/player-accounts')
    ? 'player-accounts'
    : pathname.startsWith('/manage/permissions/roles')
      ? 'roles'
      : 'people'
  const clubId = context?.clubId
  const grants = useAccessGrants(clubId)
  const roles = useAccessRoles(clubId)
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled: Boolean(clubId) })
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'warning' } | null>(null)
  const tell = (message: string, tone: 'success' | 'warning') => setNotice({ message, tone })
  // The filled button is hidden for anyone who may give no access (the server decides, see canManage).
  const canAdd = tab === 'people' && Boolean(grants.data?.canManage)
  return (
    <Box data-testid="access-page">
      <ManageScreenHeader
        title="Access"
        action={
          canAdd ? (
            <Button size="compact" onClick={() => setAdding(true)}>
              Add New Person
            </Button>
          ) : undefined
        }
        middle={
          <Box component="nav" aria-label="Access tabs" sx={{ display: 'flex', flexDirection: 'column', alignSelf: { xs: 'stretch', sm: 'auto' } }}>
            <ToggleButtonGroup value={tab} exclusive size="small" aria-label="Access tabs" sx={segmentedSwitchSx}>
              {TABS.map((entry) => (
                <ToggleButton
                  key={entry.value}
                  component={RouterLink}
                  to={entry.to}
                  value={entry.value}
                  aria-current={entry.value === tab ? 'page' : undefined}
                >
                  {entry.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
      />
      <Outlet context={{ ...context, notice: tell, openAddPerson: () => setAdding(true) }} />
      {clubId && (
        <AddPersonDialog
          clubId={clubId}
          open={adding}
          list={grants.data}
          roles={roles.data}
          sections={sections.data ?? []}
          onClose={() => setAdding(false)}
          onAdded={(result) => {
            setAdding(false)
            const outcome = addOutcome(result)
            tell(outcome.message, outcome.tone)
          }}
        />
      )}
      <Snackbar open={Boolean(notice)} autoHideDuration={7000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.tone ?? 'success'} onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
