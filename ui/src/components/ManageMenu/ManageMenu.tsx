import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, IconButton, ListItemIcon, MenuItem, MenuList, Popover, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'

export interface ManageMenuItem {
  id: string
  title: string
  // One line saying what the option does; replaced by `reason` while the item is disabled. A dense menu shows no descriptions
  // (the reason still shows as the item's tooltip), so it is optional there.
  description?: string
  icon?: ReactNode
  // An item either runs onClick or navigates to `to`.
  onClick?: () => void
  to?: string
  disabled?: boolean
  reason?: string
}

export interface ManageMenuGroup {
  id: string
  heading: string
  items: ManageMenuItem[]
}

export interface ManageMenuProps {
  // The trigger's text, e.g. "Manage League". For `trigger="kebab"` it is the accessible name of the icon button and of the menu
  // ("Actions for TVL Division 1 T20"); the tooltip says just "Actions".
  label: string
  groups: ManageMenuGroup[]
  // The group listed first (the others keep their order); e.g. the group for the tab on screen.
  openFirstGroupId?: string
  testId?: string
  // 'button' (default): the text button with a caret. 'kebab': a borderless three-dot icon button for a table row or record card
  // (docs/standards/page-anatomy.md section 6); it never navigates the row it sits in (clicks and keys stop here).
  trigger?: 'button' | 'kebab'
  // One flat list, an icon and a label per item: no group headings, no descriptions, a narrow popover (44 px items on a phone).
  dense?: boolean
  // 'primary' (default): the filled button of a page title row. 'secondary': the white outlined button of a tab row.
  buttonVariant?: 'primary' | 'secondary'
  // The text button takes MANAGE_BUTTON_WIDTH from sm (full width on a phone), so two menus on one page share one width and right edge.
  fixedWidth?: boolean
}

// The one width of a "Manage X" button, set from the longest label ("Manage Playing Conditions"). The league page's title-row
// Manage League and its tab-row Manage button both use it (docs/standards/page-anatomy.md).
export const MANAGE_BUTTON_WIDTH = 220

const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation()

// A heading row inside the MenuList. `disabled` is read by MenuList (it skips the row when choosing what to focus); the other props
// MenuList injects are ignored.
function GroupHeading({ first, children }: { first: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <Typography
      component="li"
      role="presentation"
      variant="overline"
      sx={{ display: 'block', px: 1.5, pt: first ? 0.5 : 1.25, pb: 0.25, lineHeight: 1.8, fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', ...(!first && { borderTop: 1, borderColor: 'divider', mt: 0.75 }) }}
    >
      {children}
    </Typography>
  )
}

// A detail page's one filled "Manage X" button (docs/standards/page-anatomy.md): everything you can do to the record, in groups,
// each option with a one-line explanation. A popover (about 520 px, right aligned to the button) from sm; below sm the button is
// full width at 44 px and the options open in a bottom sheet with 44 px rows. Escape, outside click and arrow keys come with the
// Popover/MenuList; an item's action runs once the panel has finished closing, so focus is already back on the trigger and a dialog
// the item opens returns focus there.
export function ManageMenu({ label, groups, openFirstGroupId, testId = 'manage-menu', trigger = 'button', dense = false, buttonVariant = 'primary', fixedWidth = false }: ManageMenuProps) {
  const kebab = trigger === 'kebab'
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const panelId = useId()
  const pending = useRef<(() => void) | null>(null)
  const open = Boolean(anchor)
  const close = () => setAnchor(null)
  const runPending = () => {
    const action = pending.current
    pending.current = null
    action?.()
  }

  const ordered = openFirstGroupId
    ? [...groups.filter((group) => group.id === openFirstGroupId), ...groups.filter((group) => group.id !== openFirstGroupId)]
    : groups
  const visibleGroups = ordered.filter((group) => group.items.length > 0)

  const list = (
    <MenuList
      id={panelId}
      aria-label={label}
      autoFocusItem={open}
      sx={{ py: 0.5 }}
    >
      {visibleGroups.flatMap((group, index) => [
        ...(dense
          ? []
          : [
              <GroupHeading key={`${group.id}-heading`} first={index === 0} disabled>
                {group.heading}
              </GroupHeading>,
            ]),
        ...group.items.map((item) => {
          const blocked = Boolean(item.disabled)
          const link = item.to && !blocked ? { component: RouterLink, to: item.to } : {}
          return (
            <MenuItem
              key={`${group.id}-${item.id}`}
              data-testid={`manage-item-${item.id}`}
              disabled={blocked}
              {...link}
              sx={
                dense
                  ? { minHeight: { xs: 44, sm: 36 }, gap: 1.5, whiteSpace: 'normal', py: 0.5, borderRadius: 1, mx: 0.5 }
                  : { minHeight: 44, alignItems: 'flex-start', gap: 1.5, whiteSpace: 'normal', py: 1, borderRadius: 1, mx: 0.5 }
              }
              onClick={() => {
                close()
                if (!item.to && item.onClick) pending.current = item.onClick
              }}
            >
              {item.icon && <ListItemIcon sx={{ minWidth: 0, ...(!dense && { mt: 0.25 }), color: 'primary.main' }}>{item.icon}</ListItemIcon>}
              {dense ? (
                // No description in a dense menu; a disabled item still says why, in one small line (a phone has no hover to show it).
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} component="span" sx={{ display: 'block' }}>
                    {item.title}
                  </Typography>
                  {blocked && item.reason && (
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', lineHeight: 1.3 }}>
                      {item.reason}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} component="span" sx={{ display: 'block' }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', lineHeight: 1.35 }}>
                    {blocked && item.reason ? item.reason : item.description}
                  </Typography>
                </Box>
              )}
            </MenuItem>
          )
        }),
      ])}
    </MenuList>
  )

  const triggerNode = kebab ? (
    <Tooltip title="Actions">
      <IconButton
        data-testid={testId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        sx={{
          // position + z-index paint the button above a row's or card's stretched link.
          position: 'relative',
          zIndex: 1,
          flex: 'none',
          // 32 px from md; a real 44 px touch target below it.
          width: { xs: 44, md: 32 },
          height: { xs: 44, md: 32 },
          borderRadius: 1,
          color: 'text.secondary',
          '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main' },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : (
    <Button
      size="compact"
      variant={buttonVariant}
      data-testid={testId}
      endIcon={<ArrowDropDownIcon />}
      onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      sx={
        phone
          ? { width: '100%', minHeight: 44, justifyContent: 'center' }
          : fixedWidth
            ? { width: MANAGE_BUTTON_WIDTH, justifyContent: 'center' }
            : undefined
      }
    >
      {label}
    </Button>
  )

  const panel = phone ? (
    <BottomSheet open={open} onOpen={() => undefined} onClose={close} ariaLabel={label} title={label} closeLabel={`Close ${label}`} onExited={runPending}>
      {open && <Box sx={{ overflowY: 'auto' }}>{list}</Box>}
    </BottomSheet>
  ) : (
    <Popover
      open={open}
      anchorEl={anchor}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionProps={{ onExited: runPending }}
      slotProps={{
        paper: {
          sx: dense
            ? { minWidth: 220, maxWidth: 'calc(100vw - 32px)', maxHeight: 'min(640px, calc(100vh - 96px))', mt: 0.5, borderRadius: 2 }
            : { width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'min(640px, calc(100vh - 96px))', mt: 0.5, borderRadius: 2.5 },
        },
      }}
    >
      {list}
    </Popover>
  )

  if (kebab) {
    // The menu is portalled but React events still bubble to the row or card that holds it: a click or key here must never reach it.
    return (
      <Box component="span" sx={{ display: 'inline-flex' }} onClick={stop} onKeyDown={stop}>
        {triggerNode}
        {panel}
      </Box>
    )
  }
  return (
    <>
      {triggerNode}
      {panel}
    </>
  )
}
