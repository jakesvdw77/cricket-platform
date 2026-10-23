import { Link as RouterLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { segmentedSwitchSx } from '../../../utils/segmentedSwitch'

// docs/specs/119 Part 3: Access has two tabs; the tab lives in the URL.
const TABS = [
  { value: 'managers', label: 'Managers', to: '/manage/permissions' },
  { value: 'player-accounts', label: 'Player accounts', to: '/manage/permissions/player-accounts' },
]

export default function AccessPage() {
  useDocumentTitle('Access')
  // ManagerHome's context (clubId), handed on to the tab.
  const context = useOutletContext<{ clubId?: string }>()
  const { pathname } = useLocation()
  const tab = pathname.startsWith('/manage/permissions/player-accounts') ? 'player-accounts' : 'managers'
  return (
    <Box data-testid="access-page">
      <ManageScreenHeader
        title="Access"
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
      <Outlet context={context} />
    </Box>
  )
}
