import { ButtonBase, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface ChoiceTileProps {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
}

// docs/specs/136: shared by the Add Team and Create New Poll choosers. A large tile button for "choose one of these" dialogs (Add Team, Add Poll): at least 44 px high, a native button so Tab, Enter and Space work.
export function ChoiceTile({ icon, label, description, onClick, disabled }: ChoiceTileProps) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.5,
        width: '100%',
        minHeight: 72,
        px: 2,
        py: 1.5,
        textAlign: 'left',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        '&.Mui-disabled': { opacity: 0.6 },
        '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <span aria-hidden style={{ display: 'flex' }}>
        {icon}
      </span>
      <span>
        <Typography variant="subtitle2" component="span" display="block" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="caption" component="span" display="block" color="text.secondary">
          {description}
        </Typography>
      </span>
    </ButtonBase>
  )
}
