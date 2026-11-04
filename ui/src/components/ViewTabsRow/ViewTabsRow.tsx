import { Box, Tab, Tabs } from '@mui/material'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import type { To } from 'react-router-dom'
import { VIEW_TABS_PROPS, viewTabSx } from '../../utils/viewTabs'

export interface ViewTabsRowTab {
  value: string
  label: string
  to: To
  icon?: ReactNode
}

export interface ViewTabsRowProps {
  'aria-label': string
  // False when no tab matches the current path (MUI renders no selection).
  value: string | false
  tabs: ViewTabsRowTab[]
  // docs/specs/140: replace the history entry on a tab change (a tab that only switches a query value, so Back leaves the page, not each tab).
  replace?: boolean
  // The active view's own actions, right-aligned on the same row (under sm the caller decides how they wrap).
  children?: ReactNode
}

// docs/specs/136 (page-anatomy section 4): a real tab row of link navigation (a nav landmark, aria-current on the active tab) with the divider on the row,
// so it runs under the actions too. Used by the League view switcher and the Availability hub.
export function ViewTabsRow({ 'aria-label': ariaLabel, value, tabs, replace = false, children }: ViewTabsRowProps) {
  return (
    <Box component="nav" aria-label={ariaLabel} sx={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value} {...VIEW_TABS_PROPS} sx={{ minHeight: 44, flex: { xs: '1 1 100%', sm: '1 1 0' }, minWidth: 0 }}>
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            icon={tab.icon as never}
            iconPosition={tab.icon ? 'start' : undefined}
            component={RouterLink}
            to={tab.to}
            replace={replace}
            aria-current={tab.value === value ? 'page' : undefined}
            sx={viewTabSx}
          />
        ))}
      </Tabs>
      {children}
    </Box>
  )
}
