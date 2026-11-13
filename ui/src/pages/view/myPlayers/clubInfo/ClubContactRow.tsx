import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import CallOutlinedIcon from '@mui/icons-material/CallOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import type { MyClubContact } from '../../../../api/meClubInfoApi'
import { useCopyToClipboard } from '../../../../hooks/useCopyToClipboard'
import { HUB, hubFramedIconSx } from '../hubStyle'
import { emailHref, phoneHref } from './clubInfoFormat'

// docs/specs/148 (Contacts): one phone book row. Read only; a value is only drawn when the page says its column is shown, and a
// shared column with no value on file reads "Not shared". Copy copies exactly one value.
export interface ClubContactRowProps {
  contact: MyClubContact
  phoneShown: boolean
  emailShown: boolean
}

function Value({ kind, value, copiedKey, onCopy }: { kind: 'phone' | 'email'; value: string | null; copiedKey: string | null; onCopy: (text: string, key: string) => void }) {
  if (!value) return <Typography sx={{ color: HUB.muted, fontSize: 14 }}>Not shared</Typography>
  const href = kind === 'phone' ? phoneHref(value) : emailHref(value)
  const noun = kind === 'phone' ? 'number' : 'address'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography sx={{ color: HUB.cream, fontSize: 15, minWidth: 0, flex: '1 1 auto', overflowWrap: 'anywhere' }}>{value}</Typography>
      {href && (
        <Tooltip title={kind === 'phone' ? 'Call' : 'Email'}>
          <IconButton component="a" href={href} aria-label={kind === 'phone' ? 'Call' : 'Email'} sx={hubFramedIconSx}>
            {kind === 'phone' ? <CallOutlinedIcon /> : <MailOutlineIcon />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={copiedKey === kind ? 'Copied' : 'Copy'}>
        <IconButton aria-label={`Copy ${noun}`} onClick={() => onCopy(value, kind)} sx={hubFramedIconSx}>
          <ContentCopyOutlinedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export function ClubContactRow({ contact, phoneShown, emailShown }: ClubContactRowProps) {
  const { copy, copiedKey, failed } = useCopyToClipboard()
  const columns = ['minmax(0, 1.2fr)', ...(phoneShown ? ['minmax(0, 1fr)'] : []), ...(emailShown ? ['minmax(0, 1.4fr)'] : [])].join(' ')
  const status = failed ? 'Could not copy. Please copy it by hand.' : copiedKey === 'phone' ? 'Number copied' : copiedKey === 'email' ? 'Address copied' : ''
  return (
    <Box
      component="li"
      data-testid="club-contact-row"
      sx={{
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: columns },
        alignItems: 'center',
        columnGap: 2,
        rowGap: 1,
        py: 1.25,
        borderBottom: `1px solid ${HUB.lineSoft}`,
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1 }}>
          <Typography component="span" sx={{ color: HUB.cream, fontWeight: 700, fontSize: 16, overflowWrap: 'anywhere' }}>
            {contact.firstName} {contact.lastName}
          </Typography>
          {contact.primary && (
            <Typography component="span" sx={{ bgcolor: HUB.gold, color: HUB.ink, borderRadius: '4px', px: 0.75, fontSize: 12, fontWeight: 700, fontFamily: HUB.display, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Main Contact
            </Typography>
          )}
        </Box>
        {contact.role && <Typography sx={{ color: HUB.muted, fontSize: 14 }}>{contact.role}</Typography>}
      </Box>
      {phoneShown && <Value kind="phone" value={contact.phone} copiedKey={copiedKey} onCopy={copy} />}
      {emailShown && <Value kind="email" value={contact.email} copiedKey={copiedKey} onCopy={copy} />}
      <Box aria-live="polite" role="status" sx={{ gridColumn: '1 / -1', color: HUB.muted, fontSize: 13, ...(status ? {} : { display: 'none' }) }}>
        {status}
      </Box>
    </Box>
  )
}
