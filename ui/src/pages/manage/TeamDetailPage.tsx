import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, MenuItem, Typography } from '@mui/material'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { RecordCard } from '../../components/RecordCard'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { listTeamsForClub } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import type { Section } from '../../api/sectionApi'
import { listTeamContacts } from '../../api/teamContactApi'
import { listTeamSponsors } from '../../api/teamSponsorApi'
import { listSquad } from '../../api/teamSquadApi'
import { listSeasons } from '../../api/seasonApi'
import { sponsorRecordFields } from '../../utils/sponsorRecordFields'
import { playerRecordFields } from '../../utils/playerRecordFields'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'
import { initialsFromName } from '../../utils/initials'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { badgeFor } from './TeamDirectory'

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// TeamFormPage.tsx — same data-fetch shape as TeamDirectory.tsx (listTeamsForClub + find-by-id;
// route always carries sectionId per docs/specs/035-section-scoped-access.md), same badgeFor
// mapping (imported from TeamDirectory.tsx, not duplicated). TeamFormPage's Details/Contacts/
// Sponsors/Squad tabs collapse into 4 stacked sections, every cross-linked list rendered as
// read-only RecordCards with viewTo into that record's own view page — the link/unlink/add-to-squad
// editing UI stays exactly where it is today, on TeamFormPage's own tabs.
//
// Deviation from docs/plans/036's own Details-section description, flagged in the build report:
// the plan names "ground, captain/manager/coach/email/phone" as Details fields, but Team
// (teamApi.ts) carries none of those — only id/clubId/sectionId/name/logoUrl/active. Rather than
// inventing new fields (a real backend change, explicitly out of scope), Details only ever shows
// what the Team record actually has: its section breadcrumb, plus the one "N players" stat pill
// the plan calls for (free — Squad's own already-fetched listSquad(...).length).
export default function TeamDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId, teamId } = useParams<{ sectionId?: string; teamId?: string }>()
  const [selectedSquadSeasonId, setSelectedSquadSeasonId] = useState('')

  const {
    data: team,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
    select: (teams) => teams.find((candidate) => candidate.id === teamId),
  })

  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sectionsQuery.data ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sectionsQuery.data])

  const breadcrumbSection = sectionId ? sectionsById.get(sectionId) : undefined
  const sectionBreadcrumb = breadcrumbSection
    ? [...breadcrumbFor(breadcrumbSection, sectionsById), breadcrumbSection.name].join(' › ')
    : '—'

  const teamContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'contacts'],
    queryFn: () => listTeamContacts(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId),
  })

  const teamSponsorsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections', sectionId, 'teams', teamId, 'sponsors'],
    queryFn: () => listTeamSponsors(clubId as string, sectionId as string, teamId as string),
    enabled: Boolean(clubId) && Boolean(sectionId) && Boolean(teamId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && Boolean(teamId),
  })

  useEffect(() => {
    if (!selectedSquadSeasonId && seasonsQuery.data && seasonsQuery.data.length > 0) {
      const defaultId = pickDefaultSeasonId(seasonsQuery.data)
      if (defaultId) {
        setSelectedSquadSeasonId(defaultId)
      }
    }
  }, [seasonsQuery.data, selectedSquadSeasonId])

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', selectedSquadSeasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, teamId as string, selectedSquadSeasonId),
    enabled: Boolean(clubId) && Boolean(teamId) && Boolean(selectedSquadSeasonId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!sectionId) {
    return <EmptyState title="Not found" description="No section was specified." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !team) {
    return (
      <EmptyState
        title="Couldn't load this team"
        description="Something went wrong loading this team. Please try again."
      />
    )
  }

  const squadCount = squadQuery.data?.length ?? 0

  return (
    <RecordDetailScreen
      title={team.name}
      backTo={`/manage/sections/${sectionId}/teams`}
      backLabel="Back to Teams"
      avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
      badge={badgeFor(team)}
      editTo={`/manage/sections/${sectionId}/teams/${team.id}/edit`}
      sections={[
        {
          heading: 'Details',
          note: <Chip size="small" variant="outlined" label={`${squadCount} players`} />,
          content: (
            <DetailFieldGrid>
              <DetailFieldRow icon={<AccountTreeOutlinedIcon />} label="Section" value={sectionBreadcrumb} />
            </DetailFieldGrid>
          ),
        },
        {
          heading: 'Contacts',
          content:
            (teamContactsQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No contacts linked to this team yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                {(teamContactsQuery.data ?? []).map((teamContact) => {
                  const contact = teamContact.contact
                  const contactName = `${contact.contact.firstName} ${contact.contact.lastName}`
                  return (
                    <RecordCard
                      key={teamContact.id}
                      title={contactName}
                      avatar={{ imageUrl: contact.photoUrl, fallback: initialsFromName(contactName), shape: 'circular' }}
                      fields={[{ label: 'Team role', value: teamContact.role }]}
                      viewTo={`/manage/club-contacts/${contact.id}`}
                      editTo={`/manage/club-contacts/${contact.id}/edit`}
                    />
                  )
                })}
              </Box>
            ),
        },
        {
          heading: 'Sponsors',
          content:
            (teamSponsorsQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No sponsors linked to this team yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                {(teamSponsorsQuery.data ?? []).map((sponsor) => (
                  <RecordCard
                    key={sponsor.id}
                    title={sponsor.name}
                    avatar={{ imageUrl: sponsor.logoUrl, fallback: initialsFromName(sponsor.name), shape: 'rounded' }}
                    fields={sponsorRecordFields(sponsor)}
                    viewTo={`/manage/sponsors/${sponsor.id}`}
                    editTo={`/manage/sponsors/${sponsor.id}/edit`}
                  />
                ))}
              </Box>
            ),
        },
        {
          heading: 'Squad',
          note:
            (seasonsQuery.data ?? []).length > 0 ? (
              <Input
                select
                label="Season"
                value={selectedSquadSeasonId}
                onChange={(event) => setSelectedSquadSeasonId(event.target.value)}
                sx={{ maxWidth: 280 }}
              >
                {(seasonsQuery.data ?? []).map((season) => (
                  <MenuItem key={season.id} value={season.id}>
                    {season.label}
                  </MenuItem>
                ))}
              </Input>
            ) : undefined,
          content:
            (seasonsQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No seasons yet — a squad is always built for a specific season.
              </Typography>
            ) : (squadQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No players in this team's squad for this season yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                {(squadQuery.data ?? []).map((member) => {
                  const playerName = `${member.firstName} ${member.lastName}`
                  return (
                    <RecordCard
                      key={member.id}
                      title={playerName}
                      avatar={{ imageUrl: member.photoUrl, fallback: initialsFromName(playerName), shape: 'circular' }}
                      fields={playerRecordFields(member)}
                      viewTo={`/manage/players/${member.playerProfileId}`}
                      editTo={`/manage/players/${member.playerProfileId}/edit`}
                    />
                  )
                })}
              </Box>
            ),
        },
      ]}
    />
  )
}
