import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { PlayerAgentActions } from '../../../components/PlayerAgentActions'
import { usePlayerLinks } from '../../../api/playerAccountsApi'

export interface PlayerAccountSectionProps {
  clubId: string
  playerId: string
  playerName?: string
}

// docs/specs/119 Part 3, shortcut (b): the read-only Account card of the Player page with the shared PlayerAgentActions (invite, make main, remove).
// Shows the main agent (name and masked email) or "No main agent", and how many other agents the player has. A failed
// read (for example a section the manager cannot see) hides the card rather than showing a wrong "No main agent".
export function PlayerAccountSection({ clubId, playerId, playerName = 'this player' }: PlayerAccountSectionProps) {
  const links = usePlayerLinks(clubId, playerId)
  if (links.isError) return null
  const main = links.data?.find((link) => link.main)
  const others = links.data ? links.data.filter((link) => !link.main).length : null
  return (
    <InfoCard
      testId="player-account-section"
      title="Account"
      icon={<ManageAccountsOutlinedIcon />}
      fields={[
        { label: 'Main agent', value: links.data ? (main ? `${main.agentName} (${main.maskedEmail})` : 'No main agent') : null },
        { label: 'Other agents', value: others === null ? null : String(others) },
      ]}
    >
      <PlayerAgentActions clubId={clubId} playerId={playerId} playerName={playerName} />
    </InfoCard>
  )
}
