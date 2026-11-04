import { useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/Button'
import { useAfterSave } from '../../hooks/useReturnTo'
import { SquadPollBranch } from './availability/SquadPollBranch'
import { GroupPollBranch } from './availability/GroupPollBranch'
import { PollTypeTiles } from './availability/PollTypeTiles'
import type { PollKind } from './availability/PollTypeTiles'

// docs/specs/064-unified-availability-polls.md, revamped by docs/specs/136: the screen behind Add Poll. The Add Poll chooser dialog
// normally sends the manager straight to a branch (?type=squad|group); opened without a type, the same two tiles show here and a
// click chooses (no radio, no Continue). ?sectionId=/?matchId= pre-fill the Group branch (the hub's Section filter, MatchFormPage's
// and the old /manage/section-availability redirect's shortcuts). Back, Cancel and Create return to where the manager came from
// (returnTo, docs/specs/127), otherwise to Availability.
export default function NewPollPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const afterSave = useAfterSave('/manage/availability')
  const [searchParams] = useSearchParams()

  const typeParam = searchParams.get('type')
  const initialKind: PollKind | null = typeParam === 'squad' || typeParam === 'group' ? typeParam : null
  const [kind, setKind] = useState<PollKind | null>(initialKind)

  const done = () => afterSave()

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const title = kind === 'squad' ? 'New Squad Poll' : kind === 'group' ? 'New Group Poll' : 'New Poll'

  return (
    <RecordFormScreen
      title={title}
      backTo="/manage/availability"
      backLabel="Back to Availability"
      compact
      headerAction={
        kind ? (
          <Button size="compact" variant="secondary" onClick={() => setKind(null)}>
            Change Poll Type
          </Button>
        ) : undefined
      }
      actions={
        kind ? undefined : (
          <Button size="compact" variant="secondary" onClick={done}>
            Cancel
          </Button>
        )
      }
    >
      {!kind && (
        <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            What kind of poll?
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <PollTypeTiles onChoose={setKind} />
          </Box>
        </Stack>
      )}

      {kind === 'squad' && <SquadPollBranch clubId={clubId} onCreated={done} />}

      {kind === 'group' && (
        <GroupPollBranch
          clubId={clubId}
          initialSectionId={searchParams.get('sectionId')}
          matchId={searchParams.get('matchId')}
          onCreated={done}
        />
      )}
    </RecordFormScreen>
  )
}
