import { useNavigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import { Avatar, Box, Chip, IconButton, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Button } from '../../../components/Button'
import { BOWLING_TYPE_OPTIONS } from '../../../components/PlayerForm/PlayerForm'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { HUB, hubGoldButton, hubOutlineButton, hubPageHeading } from './hubStyle'
import type { MyPlayerAgent } from '../../../api/myPlayersApi'
import { blackAlpha, GOLD_DISC_GRADIENT } from '../../../brandTokens'

// docs/specs/119 3C and 121: the Profile section of the player hub is a sub menu of five pages: Player Card, Contact, Cricket,
// Medical and Agents. Fields with no value are hidden and a page with none says "Nothing added yet". Each page but Agents has
// its own filled Edit button (top right of the heading row) opening /profile/<page>/edit, the dark edit form restricted to
// that page's fields (nothing opens over the console). Agents lists every agent, the primary first; only the primary agent
// sees the masked emails.
const STANCE: Record<string, string> = { RIGHT_HANDED: 'Right-handed', LEFT_HANDED: 'Left-handed' }
const ARM: Record<string, string> = { RIGHT_ARM: 'Right-arm', LEFT_ARM: 'Left-arm' }
type FieldValue = string | number | null | undefined
const has = (value: FieldValue) => value !== null && value !== undefined && value !== ''

function dobText(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (age ${age})`
}

export type ProfilePage = 'contact' | 'cricket' | 'agents'
const TITLE: Record<ProfilePage, string> = { contact: 'Contact', cricket: 'Cricket', agents: 'Agents' }

function Facts({ fields }: { fields: Array<[string, FieldValue]> }) {
  const shown = fields.filter(([, value]) => has(value))
  if (shown.length === 0) return null
  return (
    <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      {shown.map(([label, value]) => (
        <Box key={label} sx={{ border: 1, borderColor: HUB.lineSoft, bgcolor: blackAlpha(0.28), borderRadius: '4px', px: 1.5, py: 1.25, minWidth: 0 }}>
          <Typography component="small" sx={{ display: 'block', color: HUB.muted, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography fontSize={17} fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// The medical aid fields as one group (shown under Contact; a Medical page could reuse it).
const medicalFacts = (player: MyPlayer): Array<[string, FieldValue]> => [['Provider', player.medicalAidProvider], ['Member number', player.medicalAidMemberNumber]]

function Empty() {
  return (
    <Box data-testid="profile-empty" sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, bgcolor: blackAlpha(0.22), color: HUB.muted }}>
      <Box component="b" sx={{ color: HUB.cream, display: 'block' }}>
        Nothing added yet
      </Box>
    </Box>
  )
}

function JerseyTile({ number }: { number: number }) {
  return (
    <Box data-testid="jersey-tile" sx={{ textAlign: 'center', fontFamily: HUB.display, fontWeight: 700, border: `1px solid ${HUB.line}`, borderRadius: '4px', px: 2.25, pt: 0.75, pb: 0.5, bgcolor: blackAlpha(0.25) }}>
      <Box component="small" sx={{ display: 'block', fontSize: 12, letterSpacing: '.14em', color: HUB.muted, fontWeight: 500 }}>
        JERSEY
      </Box>
      <Box component="span" sx={{ fontSize: 46, lineHeight: 1, color: HUB.gold }}>
        {number}
      </Box>
    </Box>
  )
}

function AgentRow({ agent }: { agent: MyPlayerAgent }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 44 }}>
      <Typography fontWeight={600} fontSize={17}>
        {agent.name}
      </Typography>
      {agent.maskedEmail && (
        <Typography fontSize={14} sx={{ color: HUB.muted }}>
          {agent.maskedEmail}
        </Typography>
      )}
      {agent.you && <Chip size="small" variant="outlined" label="You" sx={{ color: HUB.cream, borderColor: HUB.cream, height: 22 }} />}
      {agent.main && <Chip size="small" label="Primary agent" sx={{ bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700, height: 22 }} />}
      {agent.status === 'INVITED' && <Chip size="small" variant="outlined" label="Pending invitation" sx={{ color: HUB.sand, borderColor: HUB.sand, borderStyle: 'dashed', height: 22 }} />}
    </Box>
  )
}

// The player card at the top of every Profile page (docs/specs/121): avatar, name, club and group, the jersey tile, then date
// of birth with age, club, sections and teams. Its one control is the pencil that opens the photo and date of birth edit view.
// Any linked person may change the photo, so the pencil is always offered (date of birth follows canEditDateOfBirth in the form).
function ProfileCard({ player, onEdit }: { player: MyPlayer; onEdit: () => void }) {
  const initials = `${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`.toUpperCase()
  return (
    <Box data-testid="profile-card" sx={{ display: 'grid', gap: 1.75 }}>
      <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar
          src={player.photoUrl ?? undefined}
          alt=""
          sx={{ width: { xs: 72, md: 112 }, height: { xs: 72, md: 112 }, border: `3px solid ${HUB.cream}`, fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 28, md: 44 }, letterSpacing: '.04em', color: HUB.ink, background: GOLD_DISC_GRADIENT }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
          <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 26, md: 'clamp(26px, 3vw, 36px)' }, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
            {player.firstName} {player.lastName}
          </Typography>
          <Typography fontSize={15} sx={{ color: HUB.muted, mt: 0.75 }}>
            {[player.clubName, player.groupLabel].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Box sx={{ ml: { md: 'auto' }, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          {player.jerseyNumber !== null && <JerseyTile number={player.jerseyNumber} />}
          <IconButton
            aria-label="Edit photo and date of birth"
            onClick={onEdit}
            sx={{ width: 44, height: 44, border: `1px solid ${HUB.gold}`, borderRadius: '4px', color: HUB.gold, '&:hover': { bgcolor: alpha(HUB.gold, 0.12) }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <Facts fields={[['Date of birth', dobText(player.dateOfBirth)], ['Club', player.clubName], ['Sections', player.sectionNames.join(', ')], ['Teams', player.teamNames.join(', ')]]} />
    </Box>
  )
}

export function HubProfile({ player, page }: { player: MyPlayer; page: ProfilePage }) {
  const navigate = useNavigate()
  const base = `/account/players/${player.key}/profile`
  const bowlingType = BOWLING_TYPE_OPTIONS.find((option) => option.value === player.bowlingType)?.label ?? null
  const bowling = [player.bowlingArm ? ARM[player.bowlingArm] : null, bowlingType].filter(Boolean).join(', ')
  const batting = player.battingStance ? STANCE[player.battingStance] : null
  const alt = [player.altContactName, player.altContactPhone].filter(Boolean).join(', ')
  // Contact and Cricket always have an Edit; Agents only for someone who may manage agents.
  const editable = page !== 'agents' || player.canManageAgents

  const heading = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Typography component="h2" sx={hubPageHeading}>
        {TITLE[page]}
      </Typography>
      {editable && (
        <Button size="compact" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`${base}/${page}/edit`)} sx={hubGoldButton}>
          Edit
        </Button>
      )}
    </Box>
  )

  let body
  if (page === 'agents') {
    // Primary first, then the other active agents, invitations last (the server sends this order; this keeps it for any list).
    const rank = (agent: MyPlayerAgent) => (agent.main ? 0 : agent.status === 'INVITED' ? 2 : 1)
    const agents = [...player.agents].sort((a, b) => rank(a) - rank(b))
    const agentLine = player.agentCount === 1 ? '1 agent manages this player.' : `${player.agentCount} agents manage this player.`
    body = (
      <>
        <Box sx={{ display: 'grid', gap: 0.5 }} data-testid="my-player-agents">
          {agents.length > 0 ? (
            agents.map((agent, index) => (
              <AgentRow key={agent.linkId ?? `${agent.name}-${index}`} agent={agent} />
            ))
          ) : (
            <Typography fontSize={15} sx={{ color: HUB.muted }}>
              {player.agentCount > 0 ? agentLine : 'No agents manage this player.'}
            </Typography>
          )}
        </Box>
        {!player.canManageAgents && !player.self && player.myLinkId && (
          <Box>
            <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => navigate(`${base}/agents/leave`)}>
              Leave
            </Button>
          </Box>
        )}
      </>
    )
  } else {
    const fields: Array<[string, FieldValue]> =
      page === 'contact' ? [['Phone', player.phone], ['Email', player.email], ['Alternative contact', alt]] : [['Batting', batting], ['Bowling', bowling], ['Wicketkeeper', player.isWicketKeeper ? 'Yes' : null]]
    const medical = page === 'contact' ? medicalFacts(player) : []
    const anyField = fields.some(([, value]) => has(value))
    const anyMedical = medical.some(([, value]) => has(value))
    body = (
      <>
        {anyField && <Facts fields={fields} />}
        {anyMedical && (
          <Box sx={{ display: 'grid', gap: 1 }} data-testid="medical-group">
            <Typography component="h3" sx={{ ...hubPageHeading, fontSize: 16, color: HUB.muted }}>
              Medical aid
            </Typography>
            <Facts fields={medical} />
          </Box>
        )}
        {!anyField && !anyMedical && <Empty />}
      </>
    )
  }

  return (
    <Box data-testid="hub-profile" sx={{ display: 'grid', gap: 1.75 }}>
      <ProfileCard player={player} onEdit={() => navigate(`${base}/${page}/edit-card`)} />
      {heading}
      {body}
    </Box>
  )
}
