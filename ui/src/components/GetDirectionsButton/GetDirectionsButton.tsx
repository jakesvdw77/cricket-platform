import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Link as MuiLink, ListItemIcon, MenuItem, MenuList, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import NavigationOutlinedIcon from '@mui/icons-material/NavigationOutlined'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'
import type { ManageMenuItem } from '../ManageMenu'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl, isIosDevice, isTouchDevice, openInNewTab, wazeDirectionsUrl } from '../../utils/directions'
import type { DirectionsTarget } from '../../utils/fieldLocation'

export const DIRECTIONS_APPROXIMATE = 'Approximate: only the town is known, so the pin may be some way from the ground.'
export const DIRECTIONS_ACCESS = 'Goes to the entrance or parking point.'

export interface GetDirectionsButtonProps {
  // Where to go; null (or omitted) renders nothing, so a field with no position shows no control.
  target: DirectionsTarget | null | undefined
  // 'button' (default): the compact outlined text button. 'link': an inline text link for a card line.
  variant?: 'button' | 'link'
  label?: string
  testId?: string
}

function DirectionsSheet({ target, open, onClose }: { target: DirectionsTarget; open: boolean; onClose: () => void }) {
  const clipboard = useCopyToClipboard()
  const ios = isIosDevice()
  const links: { id: string; label: string; href: string; icon: ReactNode }[] = [
    { id: 'google', label: 'Google Maps', href: googleMapsDirectionsUrl(target.point), icon: <MapOutlinedIcon fontSize="small" /> },
    ...(ios ? [{ id: 'apple', label: 'Apple Maps', href: appleMapsDirectionsUrl(target.point), icon: <MapOutlinedIcon fontSize="small" /> }] : []),
    { id: 'waze', label: 'Waze', href: wazeDirectionsUrl(target.point), icon: <NavigationOutlinedIcon fontSize="small" /> },
  ]
  const note = [target.viaAccess ? DIRECTIONS_ACCESS : null, target.viaAccess ? target.accessNote : null, target.approximate ? DIRECTIONS_APPROXIMATE : null].filter(Boolean)
  return (
    <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel="Get Directions" title="Get Directions" closeLabel="Close">
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
        {target.name}
      </Typography>
      {note.map((line) => (
        <Typography key={line} variant="caption" color="text.secondary" component="p" sx={{ m: 0, mb: 0.5 }}>
          {line}
        </Typography>
      ))}
      <MenuList aria-label="Map apps" sx={{ pb: 0 }}>
        {links.map((link) => (
          <MenuItem key={link.id} component="a" href={link.href} target="_blank" rel="noopener noreferrer" onClick={onClose} data-testid={`directions-${link.id}`} sx={{ minHeight: 44, gap: 1.5, borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>{link.icon}</ListItemIcon>
            {link.label}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            void clipboard.copy(target.addressText, 'address')
          }}
          data-testid="directions-copy"
          sx={{ minHeight: 44, gap: 1.5, borderRadius: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
            <ContentCopyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Copy Address
        </MenuItem>
      </MenuList>
      <Typography variant="caption" role="status" color="text.secondary" sx={{ display: 'block', minHeight: 18, px: 1 }}>
        {clipboard.copiedKey === 'address' ? 'Address copied' : clipboard.failed ? 'Could not copy the address' : ''}
      </Typography>
    </BottomSheet>
  )
}

// docs/specs/133 (Get Directions): `start` opens Google Maps in a new tab on a desktop and the map-app sheet on a touch device;
// `sheet` is the element to render next to the control. Used by the button, the Manage Field and Manage Match menu items and
// the Player Hub row, so the logic exists once.
export function useGetDirections(target: DirectionsTarget | null | undefined): { start: () => void; sheet: ReactNode } {
  const [open, setOpen] = useState(false)
  const start = () => {
    if (!target) return
    if (isTouchDevice()) setOpen(true)
    else openInNewTab(googleMapsDirectionsUrl(target.point))
  }
  const sheet = target ? <DirectionsSheet target={target} open={open} onClose={() => setOpen(false)} /> : null
  return { start, sheet }
}

// The Get Directions item of a Manage menu (hidden, not disabled, when nothing resolves).
export function directionsMenuItems(target: DirectionsTarget | null | undefined, start: () => void): ManageMenuItem[] {
  if (!target) return []
  return [
    {
      id: 'directions',
      title: 'Get Directions',
      description: target.viaAccess ? DIRECTIONS_ACCESS : target.approximate ? 'Approximate: only the town is known.' : 'Open your maps app with the way to the field.',
      icon: <DirectionsOutlinedIcon fontSize="small" />,
      onClick: start,
    },
  ]
}

// docs/specs/133: the Get Directions control for a card line or row. Text only (icons under 32 px stay inside menus).
export function GetDirectionsButton({ target, variant = 'button', label = 'Get Directions', testId = 'get-directions' }: GetDirectionsButtonProps) {
  const { start, sheet } = useGetDirections(target)
  if (!target) return null
  const suffix = target.approximate ? ' (approximate)' : ''
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {variant === 'link' ? (
        <MuiLink component="button" type="button" underline="hover" onClick={start} data-testid={testId} sx={{ fontWeight: 600, fontSize: '0.875rem', textAlign: 'left' }}>
          {label}
          {suffix}
        </MuiLink>
      ) : (
        <Button size="compact" variant="secondary" onClick={start} data-testid={testId}>
          {label}
          {suffix}
        </Button>
      )}
      {sheet}
    </Box>
  )
}
