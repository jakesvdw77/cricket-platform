// The chart code is its own chunk (it carries @mui/x-charts). The page preloads it when the Dashboard tab is the active tab, in
// parallel with the data request, and PlayerDashboardTab renders it with React.lazy: one import function, one chunk.
export const loadPlayerDashboardCharts = () => import('./PlayerDashboardCharts')
