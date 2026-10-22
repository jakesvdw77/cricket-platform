// The chart code is its own chunk (it carries @mui/x-charts). The page preloads it while the block is shown, in parallel with the data
// request, and TeamDashboardBlock renders it with React.lazy.
export const loadTeamDashboardCharts = () => import('./TeamDashboardCharts')
