import type { ReactNode } from 'react'
import { Avatar, Box, Breadcrumbs, Chip, IconButton, Skeleton, Typography, Button as MuiButton } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { Link as RouterLink } from 'react-router-dom'
import type { To } from 'react-router-dom'
import { Card } from '../Card'
import { Button } from '../Button'
import { KeyFigureTile } from '../KeyFigureTile'
import { badgeSx } from '../RecordCard'
import type { ClubContact } from '../../api/clubContactApi'
import type { Section, SectionSummary, SummaryLeagueRef } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'
import { ageRangeLabel, ageRangeWritten } from '../../utils/ageRange'
import { NOT_ON_FILE } from '../../utils/playerFormat'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'

export interface SectionInfoPanelProps {
  section: Section
  // The club's flat section list: the breadcrumb, the parent name and the sub-section chips come from it.
  sections: Section[]
  // The section's own figures from the sections summary; undefined while that request is loading.
  summary: SectionSummary | undefined
  // The season the leagues belong to, e.g. "2026/27".
  seasonLabel: string
  teams: Team[]
  contacts: ClubContact[]
  teamsLoading?: boolean
  contactsLoading?: boolean
  // True when the details (summary, teams or contacts) failed to load: one error line with Retry.
  error?: boolean
  onRetry?: () => void
  onClose: () => void
  // True when the panel sits inside a SidePanel that already shows the section name as its title and has its own close
  // button: the name heading and Close are left out, the breadcrumb, Active badge and the buttons stay.
  embedded?: boolean
  onSelectSection: (sectionId: string) => void
  // Routes are passed in so this component never imports a page.
  editTo: To
  manageTeamsTo: To
  teamTo: (team: Team) => To
  leagueTo: (league: SummaryLeagueRef) => To
}

const GENDER_LABEL: Record<NonNullable<Section['gender']>, string> = { MALE: 'Male', FEMALE: 'Female' }

const MUTED_CHIP_SX = {
  bgcolor: (theme: Theme) => alpha(theme.palette.text.secondary, 0.12),
  color: 'text.secondary',
  opacity: 0.7,
} as const

function Field({ label, value, placeholder = NOT_ON_FILE, wide = false }: { label: string; value: string | null | undefined; placeholder?: string; wide?: boolean }) {
  return (
    <Box data-testid="section-panel-field" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0, ...(wide && { gridColumn: '1 / -1' }) }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={value ? 'text.primary' : 'text.secondary'}
        sx={{ fontWeight: value ? 600 : 400, overflowWrap: 'anywhere' }}
      >
        {value || placeholder}
      </Typography>
    </Box>
  )
}

function StatRow({ stats }: { stats: { testId: string; label: string; value: string | number; note?: string | null; loading?: boolean }[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      {stats.map((stat) =>
        stat.loading ? (
          <Skeleton key={stat.testId} variant="rounded" height={52} data-testid="section-panel-skeleton" />
        ) : (
          <Box key={stat.testId} data-testid={stat.testId} sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.6875rem' }}>
              {stat.label}
            </Typography>
            <Typography component="b" data-testid={`${stat.testId}-value`} sx={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
              {stat.value}
            </Typography>
            {stat.note && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                {stat.note}
              </Typography>
            )}
          </Box>
        ),
      )}
    </Box>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function ChipRow({ children, loading }: { children: ReactNode; loading?: boolean }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 1 }} data-testid="section-panel-skeleton">
        <Skeleton variant="rounded" width={72} height={30} />
        <Skeleton variant="rounded" width={96} height={30} />
      </Box>
    )
  }
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{children}</Box>
}

const chipSx = { height: 32, fontWeight: 600 } as const

function subtreeNote(own: number, subtree: number) {
  return subtree !== own ? `${subtree} with sub-sections` : null
}

function figureCaption(label: string, own: number, subtree: number) {
  return subtree !== own ? `${label} (${subtree} with sub-sections)` : label
}

// docs/specs/094-club-structure-and-seasons.md "Read-only detail panel": everything about one section, no inputs.
// Editing happens on /manage/sections (the Edit link). The caller owns the data and the routes.
export function SectionInfoPanel({
  section,
  sections,
  summary,
  seasonLabel,
  teams,
  contacts,
  teamsLoading = false,
  contactsLoading = false,
  error = false,
  onRetry,
  onClose,
  embedded = false,
  onSelectSection,
  editTo,
  manageTeamsTo,
  teamTo,
  leagueTo,
}: SectionInfoPanelProps) {
  const byId = new Map(sections.map((candidate) => [candidate.id, candidate]))
  const ancestors = breadcrumbFor(section, byId)
  const parent = section.parentSectionId ? byId.get(section.parentSectionId) : undefined
  const children = sections.filter((candidate) => candidate.parentSectionId === section.id)
  const activeChildren = children.filter((child) => child.active).length
  const summaryLoading = summary === undefined && !error

  const Wrapper = embedded ? Box : Card
  const wrapperProps = embedded
    ? { sx: { display: 'flex', flexDirection: 'column', gap: 2.5 } }
    : { contentSx: { display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } } }

  return (
    <Wrapper data-testid="section-info-panel" {...(wrapperProps as object)}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            {ancestors.length > 0 && (
              <Breadcrumbs separator="›" aria-label="Section path" sx={{ fontSize: 13 }}>
                {ancestors.map((name, index) => (
                  <Typography key={`${name}-${index}`} variant="caption" color="text.secondary">
                    {name}
                  </Typography>
                ))}
                <Typography variant="caption" fontWeight={600}>
                  {section.name}
                </Typography>
              </Breadcrumbs>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              {!embedded && (
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {section.name}
                </Typography>
              )}
              <Chip
                size="small"
                label={section.active ? 'Active' : 'Inactive'}
                sx={badgeSx(section.active ? 'positive' : 'muted')}
              />
            </Box>
          </Box>
          {!embedded && (
            <IconButton aria-label="Close" onClick={onClose} sx={{ width: 40, height: 40, flex: 'none' }}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          {/* Raw MuiButton: the shared Button is not polymorphic, so component+to would fail tsc -b. */}
          <MuiButton component={RouterLink} to={editTo} variant="contained" color="primary" size="small">
            Edit
          </MuiButton>
          <MuiButton component={RouterLink} to={manageTeamsTo} variant="outlined" color="primary" size="small">
            Manage teams
          </MuiButton>
        </Box>
      </Box>

      {error && (
        <Box
          role="alert"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
        >
          <Typography variant="body2" color="error">
            We couldn&apos;t load this section&apos;s details.
          </Typography>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </Box>
      )}

      <Group title="Eligibility">
        <Box sx={{ display: 'grid', gridTemplateColumns: embedded ? 'repeat(2, minmax(0, 1fr))' : { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          <Field label="Age range" value={ageRangeLabel(section) === null ? null : ageRangeWritten(section)} placeholder={embedded ? 'Not set' : NOT_ON_FILE} />
          <Field label="Gender" value={section.gender ? GENDER_LABEL[section.gender] : 'Not specified'} />
          <Field label="Parent section" value={parent?.name} placeholder={embedded ? 'Not set' : NOT_ON_FILE} wide={embedded} />
        </Box>
      </Group>

      {embedded ? (
        <StatRow
          stats={[
            { testId: 'section-panel-subsections', label: 'Sub-sections', value: activeChildren },
            {
              testId: 'section-panel-teams',
              label: 'Teams',
              value: summary ? summary.teamCount : NOT_ON_FILE,
              note: summary ? subtreeNote(summary.teamCount, summary.subtreeTeamCount) : null,
              loading: summaryLoading,
            },
            {
              testId: 'section-panel-players',
              label: 'Players',
              value: summary ? summary.playerCount : NOT_ON_FILE,
              note: summary ? subtreeNote(summary.playerCount, summary.subtreePlayerCount) : null,
              loading: summaryLoading,
            },
          ]}
        />
      ) : (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        <KeyFigureTile
          testId="section-panel-subsections"
          icon={<AccountTreeOutlinedIcon fontSize="small" />}
          value={activeChildren}
          label="Sub-sections"
        />
        {summaryLoading ? (
          <>
            <Skeleton variant="rounded" height={60} data-testid="section-panel-skeleton" />
            <Skeleton variant="rounded" height={60} data-testid="section-panel-skeleton" />
          </>
        ) : (
          <>
            <KeyFigureTile
              testId="section-panel-teams"
              icon={<GroupsOutlinedIcon fontSize="small" />}
              value={summary ? summary.teamCount : NOT_ON_FILE}
              label={summary ? figureCaption('Teams', summary.teamCount, summary.subtreeTeamCount) : 'Teams'}
            />
            <KeyFigureTile
              testId="section-panel-players"
              icon={<PersonOutlineIcon fontSize="small" />}
              value={summary ? summary.playerCount : NOT_ON_FILE}
              label={summary ? figureCaption('Players', summary.playerCount, summary.subtreePlayerCount) : 'Players'}
            />
          </>
        )}
      </Box>
      )}

      <Group title="Sub-sections">
        <ChipRow>
          {children.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {embedded ? 'No sub-sections' : NOT_ON_FILE}
            </Typography>
          ) : (
            children.map((child) => (
              <Chip
                key={child.id}
                label={child.name}
                variant="outlined"
                onClick={() => onSelectSection(child.id)}
                sx={child.active ? chipSx : { ...chipSx, ...MUTED_CHIP_SX }}
              />
            ))
          )}
        </ChipRow>
      </Group>

      <Group title="Teams">
        <ChipRow loading={teamsLoading}>
          {teams.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No teams yet
            </Typography>
          ) : (
            teams.map((team) => (
              <Chip
                key={team.id}
                component={RouterLink}
                to={teamTo(team)}
                clickable
                label={team.name}
                variant="outlined"
                sx={team.active ? chipSx : { ...chipSx, ...MUTED_CHIP_SX }}
              />
            ))
          )}
        </ChipRow>
      </Group>

      <Group title={`Leagues in ${seasonLabel}`}>
        <ChipRow loading={summaryLoading}>
          {!summary || summary.leagues.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {summary ? 'Not entered in a league this season' : NOT_ON_FILE}
            </Typography>
          ) : (
            summary.leagues.map((league) => (
              <Chip
                key={league.id}
                component={RouterLink}
                to={leagueTo(league)}
                clickable
                label={league.name}
                variant="outlined"
                sx={chipSx}
              />
            ))
          )}
        </ChipRow>
      </Group>

      <Group title="Linked contacts">
        {contactsLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="section-panel-skeleton">
            <Skeleton variant="rounded" height={32} />
            <Skeleton variant="rounded" height={32} />
          </Box>
        ) : contacts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {embedded ? 'No linked contacts' : NOT_ON_FILE}
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {contacts.map((contact) => (
              <Box component="li" key={contact.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                    color: 'primary.dark',
                  }}
                >
                  {`${contact.contact.firstName[0] ?? ''}${contact.contact.lastName[0] ?? ''}`.toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {contact.contact.firstName} {contact.contact.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {contact.role}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Group>
    </Wrapper>
  )
}
