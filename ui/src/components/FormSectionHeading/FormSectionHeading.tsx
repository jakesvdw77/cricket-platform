import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

export interface FormSectionHeadingProps {
  // A 20 px MUI outlined icon, drawn on the solid-green tile.
  icon: ReactNode
  title: string
}

// docs/specs/089 (the compact Add/Edit match form) and docs/specs/091 (the league form): the icon-tile heading of a form
// section - the same solid-green 32 px tile and uppercase title the detail-page cards use.
export function FormSectionHeading({ icon, title }: FormSectionHeadingProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        aria-hidden
        sx={{
          width: 32,
          height: 32,
          flex: 'none',
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle2" component="h2" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem' }}>
        {title}
      </Typography>
    </Box>
  )
}
