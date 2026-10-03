import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

// The small "section title + optional actions" row every card on the league views uses - built by
// hand inside Card's children, since Card's own `title` prop has no room for trailing actions
// (same convention the old LeagueDetailPage and TeamDetailPage use).
export function CardHeaderRow({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} component="h2">
        {title}
      </Typography>
      {action}
    </Stack>
  )
}
