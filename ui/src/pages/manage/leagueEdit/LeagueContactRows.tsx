import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { ManageMenu } from '../../../components/ManageMenu'
import type { LeagueContact } from '../../../api/leagueContactApi'
import { LeagueEditPanel } from './LeagueEditPanel'
import { initialsFromName } from '../../../utils/initials'
import { withReturnTo } from '../../../utils/returnTo'
import { badgeFor, fullName } from '../../../utils/leagueContact'
import { DESKTOP_ONLY, bodyRowSx, desktopOnly, headerRowSx } from './leagueEditRowStyles'

export interface LeagueContactRowsProps {
  leagueId: string
  contacts: LeagueContact[]
  // The season chosen on the edit page; kept in the origin so Back returns to the Contacts tab on the same season.
  seasonId?: string
}

// docs/specs/127: the Contacts tab of this league (tab and season) is the origin of every link that leaves it.
function contactsOrigin(leagueId: string, seasonId?: string): string {
  const params = new URLSearchParams({ tab: 'contacts' })
  if (seasonId) params.set('seasonId', seasonId)
  return `/manage/fixtures/leagues/${leagueId}/edit?${params.toString()}`
}

const ORIGIN_LABEL = 'League contacts'

const NOT_ON_FILE = '-'

// Desktop: Name (avatar, name, badge), Role, Email, Phone, row actions. A phone keeps the name with the role under it, a
// three-dot menu (no chevron: the whole row is the link).
const COLUMNS = {
  xs: 'minmax(0, 1fr) 44px',
  sm: 'minmax(200px, 1.6fr) minmax(120px, 1fr) minmax(180px, 1.5fr) minmax(130px, 1fr) 44px',
}

function ContactRow({ leagueId, contact, seasonId }: { leagueId: string; contact: LeagueContact; seasonId?: string }) {
  const name = fullName(contact)
  const badge = badgeFor(contact)
  const origin = contactsOrigin(leagueId, seasonId)
  const baseTo = `/manage/fixtures/leagues/${leagueId}/contacts/${contact.id}`
  const viewTo = withReturnTo(baseTo, origin, ORIGIN_LABEL)
  const editTo = withReturnTo(`${baseTo}/edit`, origin, ORIGIN_LABEL)

  return (
    <Box
      role="row"
      data-testid="league-contact-row"
      sx={bodyRowSx(COLUMNS)}
    >
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar sx={avatarSx(28, '0.75rem')}>{initialsFromName(name)}</Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: '100%' }}>
            <Typography variant="body2" fontWeight={600} noWrap component="div">
              {/* Stretched link over the whole row: the row is position: relative. */}
              <MuiLink component={RouterLink} to={viewTo} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
                {name}
              </MuiLink>
            </Typography>
            {badge && (
              <Chip size="small" label={badge.label} data-testid="league-contact-badge" sx={{ ...badgeSx(badge.tone), height: 20, fontSize: '0.6875rem' }} />
            )}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            data-testid="league-contact-phone-role"
            sx={{ display: { xs: 'block', sm: 'none' }, maxWidth: '100%' }}
          >
            {contact.role || NOT_ON_FILE}
          </Typography>
        </Box>
      </Box>
      <Typography role="cell" variant="body2" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-contact-role">
        {contact.role || NOT_ON_FILE}
      </Typography>
      <Typography role="cell" variant="body2" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-contact-email">
        {contact.contact.email || NOT_ON_FILE}
      </Typography>
      <Typography role="cell" variant="body2" noWrap sx={desktopOnly} {...DESKTOP_ONLY} data-testid="league-contact-phone">
        {contact.contact.phone || NOT_ON_FILE}
      </Typography>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        {/* page-anatomy section 6: ONE actions kebab per row, never per-row icon buttons. */}
        <ManageMenu
          trigger="kebab"
          dense
          label={`Actions for ${name}`}
          testId={`league-contact-actions-${contact.id}`}
          groups={[
            {
              id: 'actions',
              heading: 'Actions',
              items: [
                { id: 'view', title: 'View Contact', icon: <VisibilityOutlinedIcon fontSize="small" />, to: viewTo },
                { id: 'edit', title: 'Edit Contact', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
              ],
            },
          ]}
        />
      </Box>
    </Box>
  )
}

// docs/specs/095-league-edit-gold-standard.md: the Contacts tab of Edit League. One bordered panel in the InfoCard heading
// look (32 px solid icon tile, uppercase heading with the count) with the one filled Add contact button in its header and
// flush zebra rows below. Presentational: the page passes the league's contacts.
export function LeagueContactRows({ leagueId, contacts, seasonId }: LeagueContactRowsProps) {
  const navigate = useNavigate()

  return (
    <LeagueEditPanel
      icon={<PeopleOutlineIcon />}
      title={`Contacts · ${contacts.length}`}
      testId="league-contacts-panel"
      actions={
        <Button
          size="compact"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => navigate(withReturnTo(`/manage/fixtures/leagues/${leagueId}/contacts/new`, contactsOrigin(leagueId, seasonId), ORIGIN_LABEL))}
          sx={{ flex: 'none' }}
        >
          Add Contact
        </Button>
      }
    >
      {contacts.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          No contacts yet for this league.
        </Typography>
      ) : (
        <Box role="table" aria-label="League contacts">
          <Box
            role="row"
            sx={headerRowSx(COLUMNS)}
          >
            <Box role="columnheader">Contact</Box>
            <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Role</Box>
            <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Email</Box>
            <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Phone</Box>
            <Box role="columnheader" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }} aria-label="Actions" />
          </Box>
          <Box role="rowgroup">
            {contacts.map((contact) => (
              <ContactRow key={contact.id} leagueId={leagueId} contact={contact} seasonId={seasonId} />
            ))}
          </Box>
        </Box>
      )}
    </LeagueEditPanel>
  )
}
