import { useMemo } from 'react'
import { Chip, Stack, Typography } from '@mui/material'
import { EmptyState } from '../EmptyState'
import { squadDisplayName } from '../../utils/squadDisplayName'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchSidePlayer, PlayingRole } from '../../api/matchSideApi'

const ROLE_LABEL: Record<PlayingRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
}

export interface PlayingXiSummaryProps {
  // Same squad/xi shape PlayingXiBuilder already takes (docs/specs/029-league-management.md) —
  // reused for its data shape only, per docs/specs/036-view-first-record-detail-screens.md's
  // Non-goals ("not rebuilding PlayingXiBuilder as read-only"). This is a genuinely new,
  // read-only-only component: no add/remove/reorder control anywhere.
  squad: SquadMember[]
  xi: MatchSidePlayer[]
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
}

// docs/specs/036-view-first-record-detail-screens.md's genuinely new, read-only component: an
// ordered list of a Match side's currently-selected Playing XI — batting order, name, captain/
// wicketkeeper/twelfth-man badges, and a role chip — reusing TeamSquadMember's display fields and
// PlayingXiBuilder's badge/chip visual language, with no add/remove/reorder controls.
export function PlayingXiSummary({
  squad,
  xi,
  captainPlayerId,
  wicketKeeperPlayerId,
  twelfthManPlayerId,
}: PlayingXiSummaryProps) {
  const squadById = useMemo(() => {
    const map = new Map<string, SquadMember>()
    squad.forEach((member) => map.set(member.playerProfileId, member))
    return map
  }, [squad])

  const orderedXi = useMemo(() => [...xi].sort((a, b) => a.battingOrder - b.battingOrder), [xi])
  const twelfthMan = twelfthManPlayerId ? squadById.get(twelfthManPlayerId) : undefined

  if (orderedXi.length === 0 && !twelfthMan) {
    return (
      <EmptyState
        title="No XI selected yet"
        description="This side's playing XI hasn't been selected yet — build it from this match's Edit form."
      />
    )
  }

  return (
    <Stack spacing={1.5}>
      {orderedXi.map((entry) => {
        const member = squadById.get(entry.playerProfileId)
        const name = member ? squadDisplayName(member) : entry.playerProfileId
        const isCaptain = captainPlayerId === entry.playerProfileId
        const isKeeper = wicketKeeperPlayerId === entry.playerProfileId

        return (
          <Stack
            key={entry.playerProfileId}
            direction="row"
            flexWrap="wrap"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Typography variant="body2" fontWeight={600} sx={{ width: 24, flex: 'none' }}>
              {entry.battingOrder}
            </Typography>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: '1 1 160px', minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {name}
              </Typography>
              {isCaptain && <Chip label="C" size="small" color="primary" />}
              {isKeeper && <Chip label="WK" size="small" variant="outlined" />}
            </Stack>

            <Chip label={ROLE_LABEL[entry.role]} size="small" variant="outlined" sx={{ flex: 'none' }} />
          </Stack>
        )
      })}

      {twelfthMan && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }}
        >
          <Chip label="12th" size="small" sx={{ flex: 'none' }} />
          <Typography variant="body2" fontWeight={600} noWrap>
            {squadDisplayName(twelfthMan)}
          </Typography>
        </Stack>
      )}
    </Stack>
  )
}
