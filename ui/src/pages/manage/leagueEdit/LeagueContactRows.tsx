import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { RowActions } from '../../../components/RowActions'
import type { LeagueContact } from '../../../api/leagueContactApi'
import { LeagueEditPanel } from './LeagueEditPanel'
import { initialsFromName } from '../../../utils/initials'
import { badgeFor, fullName } from '../../../utils/leagueContact'
import { DESKTOP_ONLY, bodyRowSx, desktopOnly, headerRowSx } from './leagueEditRowStyles'

export interface LeagueContactRowsProps {
  leagueId: string
  contacts: LeagueContact[]
}

const NOT_ON_FILE = '-'

// Desktop: Name (avatar, name, badge), Role, Email, Phone, row actions. A phone keeps the name with the role under it, a
// chevron that opens the contact and the three-dot menu.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 20px 44px',
  sm: 'minmax(200px, 1.6fr) minmax(120px, 1fr) minmax(180px, 1.5fr) minmax(130px, 1fr) 80px',
}

function ContactRow({ leagueId, contact }: { leagueId: string; contact: LeagueContact }) {
  const name = fullName(contact)
  const badge = badgeFor(contact)
  const viewTo = `/manage/fixtures/leagues/${leagueId}/contacts/${contact.id}`
  const editTo = `${viewTo}/edit`

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
      <Box role="cell" aria-hidden sx={{ display: { xs: 'flex', sm: 'none' }, justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <RowActions
          label={name}
          actions={[
            { id: 'view', label: 'View', icon: <VisibilityOutlinedIcon fontSize="small" />, to: viewTo },
            { id: 'edit', label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
          ]}
        />
      </Box>
    </Box>
  )
}

// docs/specs/095-league-edit-gold-standard.md: the Contacts tab of Edit League. One bordered panel in the InfoCard heading
// look (32 px solid icon tile, uppercase heading with the count) with the one filled Add contact button in its header and
// flush zebra rows below. Presentational: the page passes the league's contacts.
export function LeagueContactRows({ leagueId, contacts }: LeagueContactRowsProps) {
  const navigate = useNavigate()

  return (
    <LeagueEditPanel
      icon={<PeopleOutlineIcon />}
      title={`Contacts · ${contacts.length}`}
      testId="league-contacts-panel"
      actions={
        <Button
          size="sm"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => navigate(`/manage/fixtures/leagues/${leagueId}/contacts/new`)}
          sx={{ flex: 'none' }}
        >
          Add contact
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
              <ContactRow key={contact.id} leagueId={leagueId} contact={contact} />
            ))}
          </Box>
        </Box>
      )}
    </LeagueEditPanel>
  )
}
