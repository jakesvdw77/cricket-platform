import { useState } from 'react'
import { IconButton, Menu, MenuItem } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { RecordCard } from '../../../components/RecordCard'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { initialsFromName } from '../../../utils/initials'
import { fullName, placeLabel, statusLabel } from './accessGrantFormat'

export interface AccessGrantCardProps {
  grant: AccessGrant
  // false until a second role may be given (spec 150, Release 2): a one-option dialog is pointless
  showChangeRole: boolean
  onChangeRole: (grant: AccessGrant) => void
  onResend: (grant: AccessGrant) => void
  onRemove: (grant: AccessGrant) => void
  resending?: boolean
}

// docs/specs/150: one person at one place. ONE kebab, only for what the server would allow this caller; the viewer's own
// row says "Your access" instead of offering anything.
export function AccessGrantCard({ grant, showChangeRole, onChangeRole, onResend, onRemove, resending }: AccessGrantCardProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const name = fullName(grant)
  const items: { id: string; label: string; onClick: () => void }[] = []
  if (showChangeRole && grant.canChange) items.push({ id: 'change', label: 'Change Role', onClick: () => onChangeRole(grant) })
  if (grant.canResend) items.push({ id: 'resend', label: 'Resend Invitation', onClick: () => onResend(grant) })
  if (grant.canRemove) items.push({ id: 'remove', label: 'Remove Access', onClick: () => onRemove(grant) })

  return (
    <RecordCard
      title={name}
      avatar={{ fallback: initialsFromName(name), shape: 'circular' }}
      description={grant.email}
      badges={[
        { label: grant.roleName, tone: 'active' },
        { label: placeLabel(grant), tone: 'neutral' },
        { label: statusLabel(grant), tone: grant.status === 'INVITED' ? 'warning' : 'positive' },
      ]}
      fields={[
        ...(grant.addedByName ? [{ label: 'Added by', value: grant.addedByName }] : []),
        ...(grant.self ? [{ label: 'Note', value: 'Your access' }] : []),
      ]}
      headerActions={
        items.length === 0 ? undefined : (
          <>
            <IconButton
              size="small"
              aria-label={`${name}, more actions`}
              aria-haspopup="menu"
              aria-expanded={anchor ? true : undefined}
              disabled={resending}
              onClick={(event) => setAnchor(event.currentTarget)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} MenuListProps={{ 'aria-label': `${name}, actions` }}>
              {items.map((item) => (
                <MenuItem
                  key={item.id}
                  onClick={() => {
                    setAnchor(null)
                    item.onClick()
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )
      }
    />
  )
}
