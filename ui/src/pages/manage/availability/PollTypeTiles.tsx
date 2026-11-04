import { ChoiceTile } from '../../../components/ChoiceTile'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'

export type PollKind = 'squad' | 'group'

// docs/specs/136: the two kinds of poll as large tiles. Clicking one chooses it (no radio, no Continue). Used by the Add Poll dialog and
// by the New Poll page when it is opened without a type.
export function PollTypeTiles({ onChoose }: { onChoose: (kind: PollKind) => void }) {
  return (
    <>
      <ChoiceTile
        icon={<GroupsOutlinedIcon color="primary" />}
        label="Squad Poll"
        description="Ask one team's squad about one or more of its matches. Each match gets its own link."
        onClick={() => onChoose('squad')}
      />
      <ChoiceTile
        icon={<ViewListOutlinedIcon color="primary" />}
        label="Group Poll"
        description="Ask a whole section about several fixtures. One link covers them all."
        onClick={() => onChoose('group')}
      />
    </>
  )
}
