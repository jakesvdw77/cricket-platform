import { Box } from '@mui/material'
import { LeagueContactRows } from './LeagueContactRows'
import type { LeagueContact } from '../../../api/leagueContactApi'

export interface LeagueEditContactsTabProps {
  leagueId: string
  contacts: LeagueContact[]
}

// docs/specs/054-league-contacts.md and docs/specs/095: the Contacts tab of Edit League, the league's own named contacts.
export function LeagueEditContactsTab({ leagueId, contacts }: LeagueEditContactsTabProps) {
  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      <LeagueContactRows leagueId={leagueId} contacts={contacts} />
    </Box>
  )
}
