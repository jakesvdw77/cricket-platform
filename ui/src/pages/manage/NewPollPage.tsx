import { useState } from 'react'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/Button'
import { SquadPollBranch } from './availability/SquadPollBranch'
import { GroupPollBranch } from './availability/GroupPollBranch'

type PollKind = 'squad' | 'group'

const CHOICES: { kind: PollKind; title: string; description: string; bullets: string[] }[] = [
  {
    kind: 'squad',
    title: 'Squad poll',
    description: "Ask one team's roster about one match.",
    bullets: [
      'Pick a team, then its matches',
      'Each match gets its own link',
      'Squad is picked from the season roster',
    ],
  },
  {
    kind: 'group',
    title: 'Group poll',
    description: 'Ask a whole section about several fixtures at once.',
    bullets: [
      'Pick a section, tick fixtures from any of its teams',
      'One link covers all of them',
      'Squad is picked from the people who said yes',
    ],
  },
]

function ChoiceCard({
  choice,
  selected,
  onSelect,
}: {
  choice: (typeof CHOICES)[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      sx={{
        display: 'block',
        textAlign: 'left',
        p: 2,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: (theme) => (selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper'),
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {selected ? (
          <RadioButtonCheckedIcon color="primary" fontSize="small" sx={{ mt: 0.25 }} />
        ) : (
          <RadioButtonUncheckedIcon fontSize="small" sx={{ mt: 0.25, color: 'text.secondary' }} />
        )}
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {choice.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {choice.description}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
            {choice.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </Box>
        </Stack>
      </Stack>
    </ButtonBase>
  )
}

// docs/specs/064-unified-availability-polls.md: the screen behind the dashboard's New poll button.
// Step 1 asks which kind of poll (Squad or Group), step 2 is that kind's own form
// (SquadPollBranch / GroupPollBranch, in ./availability/). ?type=squad|group skips step 1 and
// ?sectionId=/?matchId= pre-fill the Group branch - MatchFormPage's and the old
// /manage/section-availability redirect's shortcuts. Either branch returns to the dashboard on
// success.
export default function NewPollPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const typeParam = searchParams.get('type')
  const initialKind: PollKind | null = typeParam === 'squad' || typeParam === 'group' ? typeParam : null

  // `choice` is the highlighted card on step 1; `kind` is set once Continue is pressed (or by
  // ?type=), switching the page to that branch's form.
  const [choice, setChoice] = useState<PollKind | null>(initialKind)
  const [kind, setKind] = useState<PollKind | null>(initialKind)

  const done = () => navigate('/manage/availability')

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const title = kind === 'squad' ? 'New squad poll' : kind === 'group' ? 'New group poll' : 'New poll'

  return (
    <RecordFormScreen
      title={title}
      backTo="/manage/availability"
      backLabel="Back to Availability Polls"
      actions={
        kind ? (
          <Button variant="ghost" onClick={() => setKind(null)}>
            Change poll type
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={done}>
              Cancel
            </Button>
            <Button disabled={!choice} onClick={() => setKind(choice)}>
              Continue
            </Button>
          </>
        )
      }
    >
      {!kind && (
        <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            What kind of poll?
          </Typography>
          <Box
            role="radiogroup"
            aria-label="Poll type"
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
          >
            {CHOICES.map((candidate) => (
              <ChoiceCard
                key={candidate.kind}
                choice={candidate}
                selected={choice === candidate.kind}
                onSelect={() => setChoice(candidate.kind)}
              />
            ))}
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
