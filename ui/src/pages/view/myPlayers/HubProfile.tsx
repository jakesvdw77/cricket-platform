import { useNavigate } from 'react-router-dom'
import { Box, Chip, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Button } from '../../../components/Button'
import { BOWLING_TYPE_OPTIONS } from '../../../components/PlayerForm/PlayerForm'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { HUB, hubGoldButton, hubHeading, hubOutlineButton } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/119 3C: the Profile section of the player hub. Fields with no value are hidden; a mostly empty profile gets a
// "Complete this profile" prompt. Edit goes to /profile/edit, which replaces this panel with the dark edit form (nothing opens over the console).
// The main agent sees other agents by name and masked email; other agents only a count.
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

function Facts({ title, fields }: { title: string; fields: Array<[string, FieldValue]> }) {
  const shown = fields.filter(([, value]) => has(value))
  if (shown.length === 0) return null
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Typography component="h3" sx={{ ...hubHeading, fontSize: 16, color: HUB.muted }}>
        {title}
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {shown.map(([label, value]) => (
          <Box key={label} sx={{ border: 1, borderColor: HUB.lineSoft, bgcolor: blackAlpha(.28), borderRadius: '4px', px: 1.5, py: 1.25, minWidth: 0 }}>
            <Typography component="small" sx={{ display: 'block', color: HUB.muted, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {label}
            </Typography>
            <Typography fontSize={17} fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function HubProfile({ player }: { player: MyPlayer }) {
  const navigate = useNavigate()
  const bowlingType = BOWLING_TYPE_OPTIONS.find((option) => option.value === player.bowlingType)?.label ?? null
  const bowling = [player.bowlingArm ? ARM[player.bowlingArm] : null, bowlingType].filter(Boolean).join(', ')
  const batting = player.battingStance ? STANCE[player.battingStance] : null
  const alt = [player.altContactName, player.altContactPhone].filter(Boolean).join(', ')
  const sections = player.sectionNames.join(', ')
  const teams = player.teamNames.join(', ')
  const values: FieldValue[] = [sections, teams, player.jerseyNumber, player.phone, player.email, alt, batting, bowling, player.medicalAidProvider, player.medicalAidMemberNumber]
  const mostlyEmpty = values.filter(has).length < values.length / 2
  const agentLine = player.agentCount === 1 ? '1 agent manages this player.' : `${player.agentCount} agents manage this player.`

  return (
    <Box data-testid="hub-profile" sx={{ display: 'grid', gap: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={hubHeading}>
          Profile
        </Typography>
        <Button size="compact" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/account/players/${player.key}/profile/edit`)} sx={hubGoldButton}>
          Edit profile
        </Button>
      </Box>
      {mostlyEmpty && (
        <Box data-testid="complete-profile" sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, bgcolor: blackAlpha(.22), color: HUB.muted }}>
          <Box component="b" sx={{ color: HUB.cream, display: 'block' }}>
            Complete this profile
          </Box>
          Add contact and cricket details with Edit profile.
        </Box>
      )}
      <Facts title="Personal" fields={[['Date of birth', dobText(player.dateOfBirth)]]} />
      <Facts title="Club" fields={[['Sections', sections], ['Teams', teams], ['Jersey number', player.jerseyNumber]]} />
      <Facts title="Contact" fields={[['Phone', player.phone], ['Email', player.email], ['Alternative contact', alt]]} />
      <Facts title="Cricket" fields={[['Batting', batting], ['Bowling', bowling], ['Wicketkeeper', player.isWicketKeeper ? 'Yes' : null]]} />
      <Facts title="Medical aid" fields={[['Provider', player.medicalAidProvider], ['Member number', player.medicalAidMemberNumber]]} />

      {(!player.self || player.canManageAgents) && (
        <Box sx={{ display: 'grid', gap: 0.75 }} data-testid="my-player-agents">
          <Typography component="h3" sx={{ ...hubHeading, fontSize: 16, color: HUB.muted }}>
            Agents
          </Typography>
          {player.main && player.agents.length > 0 ? (
            player.agents.map((agent) => (
              <Box key={agent.linkId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 36 }}>
                <Typography fontWeight={600} fontSize={15}>
                  {agent.name}
                </Typography>
                <Typography fontSize={13} sx={{ color: HUB.muted }}>
                  {agent.maskedEmail}
                </Typography>
                {agent.main && <Chip size="small" label="Main" sx={{ bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700, height: 20 }} />}
                {agent.status === 'INVITED' && (
                  <>
                    <Chip size="small" variant="outlined" label="Pending" sx={{ color: HUB.sand, borderColor: HUB.sand, borderStyle: 'dashed', height: 20 }} />
                    {player.canManageAgents && (
                      <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => navigate(`/account/players/${player.key}/profile/cancel-invite?link=${agent.linkId}`)}>
                        Cancel invitation
                      </Button>
                    )}
                  </>
                )}
              </Box>
            ))
          ) : (
            <Typography fontSize={14} sx={{ color: HUB.muted }}>
              {agentLine}
            </Typography>
          )}
        </Box>
      )}

      {player.canManageAgents && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => navigate(`/account/players/${player.key}/profile/hand-over`)}>
            Hand over
          </Button>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => navigate(`/account/players/${player.key}/profile/add-agent`)}>
            Add another agent
          </Button>
        </Box>
      )}
      {!player.canManageAgents && !player.self && player.myLinkId && (
        <Box>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => navigate(`/account/players/${player.key}/profile/leave`)}>
            Leave
          </Button>
        </Box>
      )}

    </Box>
  )
}
