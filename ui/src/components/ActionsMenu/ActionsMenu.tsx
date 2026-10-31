import { useId, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { Button } from '../Button'

export interface ActionsMenuItem {
  id: string
  label: string
  icon?: ReactNode
  // An item either runs onClick or navigates to `to`.
  onClick?: () => void
  to?: string
  disabled?: boolean
  // Why the item is disabled; shown as a tooltip and read by assistive technology.
  reason?: string
}

export interface ActionsMenuProps {
  items: ActionsMenuItem[]
  // The trigger's label on desktop and its accessible name on a phone.
  label?: string
  disabled?: boolean
  testId?: string
}

// docs/specs/126-league-page-actions-and-edit-mode.md: the page-level "Actions" menu of a record page's top row. A compact
// secondary button with a caret on desktop, a 44 px bordered three-dots icon button on a phone, and a MUI Menu with 44 px
// items. Focus returns to the trigger when the menu closes (MUI Menu), so a dialog opened from an item can return there too.
export function ActionsMenu({ items, label = 'Actions', disabled = false, testId = 'actions-menu' }: ActionsMenuProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()
  // An item's action runs once the menu has finished closing, so focus is back on the trigger first and a dialog the item opens
  // returns focus there.
  const pending = useRef<(() => void) | null>(null)
  const open = Boolean(anchor)
  const close = () => setAnchor(null)
  const openMenu = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)
  const triggerProps = { 'aria-haspopup': 'menu' as const, 'aria-expanded': open, 'aria-controls': open ? menuId : undefined }

  return (
    <>
      {phone ? (
        <IconButton
          aria-label={label}
          data-testid={testId}
          disabled={disabled}
          onClick={openMenu}
          sx={{ width: 44, height: 44, flex: 'none', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
          {...triggerProps}
        >
          <MoreVertIcon />
        </IconButton>
      ) : (
        <Button size="compact" variant="secondary" data-testid={testId} disabled={disabled} endIcon={<ArrowDropDownIcon />} onClick={openMenu} {...triggerProps}>
          {label}
        </Button>
      )}
      <Menu id={menuId} anchorEl={anchor} open={open} onClose={close}
        TransitionProps={{
          onExited: () => {
            const action = pending.current
            pending.current = null
            action?.()
          },
        }}
        MenuListProps={{ 'aria-label': label }}>
        {items.map((item) => {
          const blocked = Boolean(item.disabled)
          const reasonId = blocked && item.reason ? `${menuId}-${item.id}-reason` : undefined
          const link = item.to && !blocked ? { component: RouterLink, to: item.to } : {}
          const row = (
            <MenuItem
              key={item.id}
              disabled={blocked}
              aria-describedby={reasonId}
              sx={{ minHeight: 44 }}
              {...link}
              onClick={() => {
                close()
                if (!item.to && item.onClick) pending.current = item.onClick
              }}
            >
              {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
              <ListItemText primary={item.label} />
              {reasonId && (
                <span id={reasonId} hidden>
                  {item.reason}
                </span>
              )}
            </MenuItem>
          )
          // A disabled MenuItem has pointer-events off, so the tooltip sits on a wrapper.
          return blocked && item.reason ? (
            <Tooltip key={item.id} title={item.reason} placement="left">
              <span>{row}</span>
            </Tooltip>
          ) : (
            row
          )
        })}
      </Menu>
    </>
  )
}
