import type { ReactNode } from 'react'
import { ButtonBase, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { Link as RouterLink } from 'react-router-dom'

export interface AddCardProps {
  // Title Case, e.g. "Add League".
  label: string
  // A link (a real anchor) or a click handler.
  to?: string
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  testId?: string
}

// docs/standards/page-anatomy.md section 6: the dashed filler card that ends a record card grid where adding is allowed. Flat, a thin
// dashed hairline in the card edge colour, a hover tint, keyboard focusable. Stretches to the height of the cards beside it.
export function AddCard({ label, to, onClick, disabled = false, icon, testId = 'add-card' }: AddCardProps) {
  const link = to && !disabled ? { component: RouterLink, to } : {}
  return (
    <ButtonBase
      {...link}
      data-testid={testId}
      disabled={disabled}
      onClick={to ? undefined : onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        minHeight: 120,
        height: '100%',
        width: '100%',
        px: 2,
        py: 3,
        borderRadius: 1,
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'primary.main',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06), borderColor: 'primary.main' },
        '&.Mui-focusVisible': { outline: (theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        '&.Mui-disabled': { opacity: 0.5 },
      }}
    >
      {icon ?? <AddOutlinedIcon />}
      <Typography variant="body2" fontWeight={700} component="span">
        {label}
      </Typography>
    </ButtonBase>
  )
}
