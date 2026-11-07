import { Box, ButtonBase, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { HUB } from './myPlayers/hubStyle'
import { blackAlpha } from '../../brandTokens'

// The person-level Account page (owner, 2026-11-06): one click on Account in the page corner opens this, in the console, instead of a drop-down.
// Each option is explained, then opens its own page. Invitations and Link Requests carry their pending counts.
interface AccountOption {
  id: string
  title: string
  help: string
  to: string
  count?: number
}

function OptionCard({ option }: { option: AccountOption }) {
  const navigate = useNavigate()
  return (
    <ButtonBase
      onClick={() => navigate(option.to)}
      sx={{
        width: '100%',
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 0.5,
        p: 2.5,
        textAlign: 'left',
        bgcolor: blackAlpha(0.3),
        border: 1,
        borderColor: HUB.line,
        borderRadius: '4px',
        color: HUB.cream,
        '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.1) },
        '&.Mui-focusVisible': { borderColor: HUB.gold, outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '.04em', textTransform: 'uppercase' }}>{option.title}</Typography>
        {Boolean(option.count) && <Chip size="small" label={`${option.count} pending`} sx={{ bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700, height: 22 }} />}
      </Box>
      <Typography fontSize={15} sx={{ color: HUB.muted }}>
        {option.help}
      </Typography>
    </ButtonBase>
  )
}

export default function MyAccountPage() {
  const navigate = useNavigate()
  const invitations = useMyInvitations().data?.length ?? 0
  const linkRequests = (useMyLinkRequests().data ?? []).filter((request) => request.status === 'PENDING').length
  const options: AccountOption[] = [
    { id: 'invitations', title: 'Invitations', help: 'A club has invited you to link a player. Accept or decline here.', to: '/account/invitations', count: invitations },
    { id: 'requests', title: 'Link Requests', help: 'The requests you sent to link a player, and where each one stands.', to: '/welcome?view=requests', count: linkRequests },
    { id: 'find', title: 'Link More Players', help: 'Find another player you manage, such as a child, and ask the club to link them.', to: '/welcome' },
    { id: 'preferences', title: 'Preferences', help: 'Choose how Cricket Legend looks and behaves on this device, such as the scoreboard ticker.', to: '/account/preferences' },
  ]
  return (
    <HubFrame
      title="Account"
      panel="clear"
      glass={0.4}
      maxWidth={1320}
      testId="my-account-page"
      footer={<HubFooterButton onClick={() => navigate('/account')}>Back to players</HubFooterButton>}
    >
      <Box role="list" aria-label="Account" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        {options.map((option) => (
          <Box key={option.id} role="listitem" sx={{ display: 'flex' }}>
            <OptionCard option={option} />
          </Box>
        ))}
      </Box>
    </HubFrame>
  )
}
