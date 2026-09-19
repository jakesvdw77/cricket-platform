import { useMemo } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Chip, Stack, Typography } from '@mui/material'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import WcOutlinedIcon from '@mui/icons-material/WcOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { listPlayers, listPlayerSections } from '../../api/playerApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import type { Gender, BattingStance, BowlingArm, BowlingType } from '../../api/playerApi'
import { initialsFromName } from '../../utils/initials'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { badgeFor, fullName } from './PlayerList'

const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
}

const BATTING_STANCE_LABEL: Record<BattingStance, string> = {
  RIGHT_HANDED: 'Right-handed',
  LEFT_HANDED: 'Left-handed',
}

const BOWLING_ARM_LABEL: Record<BowlingArm, string> = {
  RIGHT_ARM: 'Right-arm',
  LEFT_ARM: 'Left-arm',
}

const BOWLING_TYPE_LABEL: Record<BowlingType, string> = {
  FAST: 'Fast',
  FAST_MEDIUM: 'Fast-medium',
  MEDIUM_FAST: 'Medium-fast',
  MEDIUM: 'Medium',
  OFF_BREAK: 'Off break',
  LEG_BREAK: 'Leg break',
  ORTHODOX_SPIN: 'Orthodox spin',
  WRIST_SPIN: 'Wrist spin / Chinaman',
  GOOGLY: 'Googly',
}

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// PlayerFormPage.tsx — same data-fetch shape (list + find-by-id, no single-player GET exists),
// same badgeFor/fullName mapping (imported from PlayerList.tsx, not duplicated). PlayerFormPage's
// 4-tab bar (Basic Info | Contact Info | Cricket Info | Sections) collapses into 4 stacked
// sections; Sections stays a read-only Chip trail (not RecordCards), same as it already renders on
// the edit form's own Sections tab.
export default function PlayerDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { playerId } = useParams<{ playerId?: string }>()

  const {
    data: player,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'players'],
    queryFn: () => listPlayers(clubId as string),
    enabled: Boolean(clubId),
    select: (players) => players.find((candidate) => candidate.id === playerId),
  })

  const playerSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', playerId, 'sections'],
    queryFn: () => listPlayerSections(clubId as string, playerId as string),
    enabled: Boolean(clubId) && Boolean(playerId),
  })

  const clubSectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const clubSectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(clubSectionsQuery.data ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [clubSectionsQuery.data])

  function sectionPath(section: Section): string {
    return [...breadcrumbFor(section, clubSectionsById), section.name].join(' › ')
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !player) {
    return (
      <EmptyState
        title="Couldn't load this player"
        description="Something went wrong loading this player. Please try again."
      />
    )
  }

  const taggedSections = playerSectionsQuery.data ?? []

  return (
    <RecordDetailScreen
      title={fullName(player)}
      backTo="/manage/players"
      backLabel="Back to Players"
      avatar={{ imageUrl: player.photoUrl, fallback: initialsFromName(fullName(player)), shape: 'circular' }}
      badge={badgeFor(player)}
      editTo={`/manage/players/${player.id}/edit`}
      sections={[
        {
          heading: 'Basic Info',
          content: (
            <DetailFieldGrid>
              <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="Date of birth" value={player.dateOfBirth ?? '—'} />
              <DetailFieldRow icon={<WcOutlinedIcon />} label="Gender" value={player.gender ? GENDER_LABEL[player.gender] : '—'} />
              <DetailFieldRow
                icon={<BadgeOutlinedIcon />}
                label="Club membership number"
                value={player.clubMembershipNumber ?? '—'}
              />
              <DetailFieldRow icon={<TagOutlinedIcon />} label="Jersey number" value={player.jerseyNumber ?? '—'} />
            </DetailFieldGrid>
          ),
        },
        {
          heading: 'Contact Info',
          content: (
            <DetailFieldGrid>
              <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={player.phone ?? '—'} />
              <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={player.email ?? '—'} />
              <DetailFieldRow
                icon={<PersonOutlineOutlinedIcon />}
                label="Alternative contact name"
                value={player.altContactName ?? '—'}
              />
              <DetailFieldRow
                icon={<ContactPhoneOutlinedIcon />}
                label="Alternative contact phone"
                value={player.altContactPhone ?? '—'}
              />
            </DetailFieldGrid>
          ),
        },
        {
          heading: 'Cricket Info',
          content: (
            <DetailFieldGrid>
              <DetailFieldRow
                icon={<SportsCricketOutlinedIcon />}
                label="Batting stance"
                value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : '—'}
              />
              <DetailFieldRow
                icon={<SportsCricketOutlinedIcon />}
                label="Bowling arm"
                value={player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : '—'}
              />
              <DetailFieldRow
                icon={<SportsCricketOutlinedIcon />}
                label="Bowling type"
                value={player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : '—'}
              />
              <DetailFieldRow
                icon={<SportsCricketOutlinedIcon />}
                label="Wicketkeeper"
                value={player.isWicketKeeper ? 'Yes' : 'No'}
              />
            </DetailFieldGrid>
          ),
        },
        {
          heading: 'Sections',
          content:
            taggedSections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Not tagged to any sections yet.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {taggedSections.map((section) => (
                  <Chip key={section.id} label={sectionPath(section)} variant="outlined" />
                ))}
              </Stack>
            ),
        },
      ]}
    />
  )
}
