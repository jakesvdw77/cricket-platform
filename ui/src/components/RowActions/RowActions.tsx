import { useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { IconButton, ListItemIcon, Menu, MenuItem, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { Link as RouterLink } from 'react-router-dom'
import type { To } from 'react-router-dom'

export interface RowAction {
  id: string
  label: string
  icon: ReactNode
  onClick?: () => void
  to?: To
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
}

export interface RowActionsProps {
  // The row's name, used in accessible names such as "Edit <label>" and "<label>, more actions".
  label: string
  actions: RowAction[]
}

// A row's actions are never inside the row's stretched link, so a click or key press here must not reach it.
const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation()

// docs/specs/095-league-edit-gold-standard.md: from sm up a right-aligned run of 36 px icon buttons with tooltips;
// on a phone one three-dot button opening a menu of 44 px items. Purely presentational: the caller supplies handlers.
export function RowActions({ label, actions }: RowActionsProps) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const visible = actions.filter((action) => !action.hidden)

  if (visible.length === 0) return null

  if (isPhone) {
    return (
      <>
        <IconButton
          aria-label={`${label}, more actions`}
          aria-haspopup="menu"
          aria-expanded={anchorEl ? true : undefined}
          onClick={(event) => {
            stop(event)
            setAnchorEl(event.currentTarget)
          }}
          onKeyDown={stop}
          sx={{ width: 44, height: 44, position: 'relative' }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          onClick={stop}
          onKeyDown={stop}
          MenuListProps={{ 'aria-label': `${label}, actions` }}
        >
          {visible.map((action) => (
            <MenuItem
              key={action.id}
              disabled={action.disabled}
              {...(action.to !== undefined ? { component: RouterLink, to: action.to } : {})}
              onClick={() => {
                setAnchorEl(null)
                action.onClick?.()
              }}
              sx={{ minHeight: 44, color: action.destructive ? 'error.main' : undefined }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{action.icon}</ListItemIcon>
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    )
  }

  return (
    <span
      data-testid="row-actions"
      style={{ display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}
      onClick={stop}
      onKeyDown={stop}
    >
      {visible.map((action) => {
        const button = (
          <IconButton
            aria-label={`${action.label} ${label}`}
            disabled={action.disabled}
            {...(action.to !== undefined ? { component: RouterLink, to: action.to } : {})}
            onClick={() => action.onClick?.()}
            sx={{ width: 36, height: 36, position: 'relative', color: action.destructive ? 'error.main' : 'text.secondary' }}
          >
            {action.icon}
          </IconButton>
        )
        return (
          <Tooltip key={action.id} title={action.label} describeChild={action.disabled}>
            {/* A disabled button swallows pointer events, so the tooltip hangs off a wrapper instead. */}
            {action.disabled ? <span style={{ position: 'relative' }}>{button}</span> : button}
          </Tooltip>
        )
      })}
    </span>
  )
}
