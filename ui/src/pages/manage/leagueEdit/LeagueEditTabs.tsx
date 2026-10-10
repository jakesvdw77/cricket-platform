import { Tab, Tabs } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { LEAGUE_EDIT_TABS, resolveLeagueEditTab } from './leagueEditTabConfig'
import { VIEW_TABS_PROPS, viewTabsSx, viewTabSx } from '../../../utils/viewTabs'

// docs/specs/095-league-edit-gold-standard.md: the Edit League tab strip. The active tab lives in ?tab= (default Details),
// each tab is a router link that replaces the history entry and keeps the other parameters (for example seasonId), the
// same convention as LeagueViewLayout. The page decides whether to render it at all (never in create mode).
export function LeagueEditTabs() {
  const [searchParams] = useSearchParams()
  const active = resolveLeagueEditTab(searchParams.get('tab'))

  const searchFor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    return `?${next.toString()}`
  }

  return (
    <Tabs value={active} aria-label="League sections" {...VIEW_TABS_PROPS} sx={viewTabsSx}>
      {LEAGUE_EDIT_TABS.map((tab) => (
        <Tab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          component={RouterLink}
          to={{ search: searchFor(tab.value) }}
          replace
          sx={viewTabSx}
        />
      ))}
    </Tabs>
  )
}
