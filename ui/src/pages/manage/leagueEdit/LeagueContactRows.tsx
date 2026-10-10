import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
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
import { initialsFromName } from '../../../utils/initials'
import { badgeFor, fullName } from '../../../utils/leagueContact'
import { zebraTint } from '../../../utils/zebraTint'

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

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  pl: 1.5,
  pr: { xs: 0.5, sm: 1.5 },
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function ContactRow({ leagueId, contact }: { leagueId: string; contact: LeagueContact }) {
  const name = fullName(contact)
  const badge = badgeFor(contact)
  const viewTo = `/manage/fixtures/leagues/${leagueId}/contacts/${contact.id}`
  const editTo = `${viewTo}/edit`

  return (
    <Box
      role="row"
      data-testid="league-contact-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 56, sm: 44 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
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
    <Box
      data-testid="league-contacts-panel"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, overflow: 'clip' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: { xs: 1.5, md: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
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
            <PeopleOutlineIcon />
          </Box>
          <Typography
            variant="subtitle2"
            component="h2"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem' }}
          >
            {`Contacts · ${contacts.length}`}
          </Typography>
        </Box>
        <Button
          size="sm"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => navigate(`/manage/fixtures/leagues/${leagueId}/contacts/new`)}
          sx={{ flex: 'none' }}
        >
          Add contact
        </Button>
      </Box>

      {contacts.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          No contacts yet for this league.
        </Typography>
      ) : (
        <Box role="table" aria-label="League contacts">
          <Box
            role="row"
            sx={{
              ...gridSx,
              height: { xs: 36, sm: 40 },
              bgcolor: 'background.paper',
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
              fontSize: { xs: '0.6875rem', sm: '0.75rem' },
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
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
    </Box>
  )
}
