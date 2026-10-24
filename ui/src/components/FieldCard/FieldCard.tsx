import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Avatar, Box, ButtonBase, Card as MuiCard, CardActions, CardContent, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import { cardTitleSx } from '../../theme'
import { DetailLine } from '../DetailLine'
import { FieldStatusMenu } from '../FieldStatusMenu'
import { initialsFromName } from '../../utils/initials'
import { countryName } from '../../utils/countries'
import { cityLine, FIELD_CATEGORY_LABEL } from '../../utils/fieldLabels'
import { FIELD_STATUS_ACTIONS, fieldEditState, fieldStatusBadge, fieldStatusOf, VERIFIED_FIELD_NO_ACTIONS } from '../../utils/fieldStatus'
import type { FieldStatusAction } from '../../utils/fieldStatus'
import { NOT_ON_FILE } from '../../utils/playerFormat'
import { zebraTint } from '../../utils/zebraTint'
import type { PlayingArea } from '../../api/playingAreaApi'

export interface FieldCardProps {
  field: PlayingArea
  viewTo: string
  editTo: string
  // The calling club (a manager's card): decides "Our field" and whether Edit is enabled.
  clubId?: string
  // A manager's card: Add to our fields / Remove. Its button is the first footer column.
  onToggleHome?: (field: PlayingArea) => void
  homePending?: boolean
  // The platform admin's card: when passed, the first footer column is the Status button and Edit is always enabled; the
  // body gains rows for who captured the field, the clubs using it and any possible duplicates.
  onStatusAction?: (action: FieldStatusAction) => void
}

const FIELD_LABEL_WIDTH = 68

// The whole card is one stretched link; a value that is a link itself sits above it.
const inlineLinkSx = { position: 'relative', fontWeight: 600 } as const

function DetailRow({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: ReactNode; muted?: boolean }) {
  return (
    <Box data-testid="field-detail-row" sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}>
      <DetailLine icon={icon} label={label} value={value} muted={muted} labelWidth={FIELD_LABEL_WIDTH} />
    </Box>
  )
}

const footerButtonSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.25,
  minWidth: 0,
  width: '100%',
  py: 1,
  px: 0.25,
  borderRadius: 1,
  color: 'primary.dark',
  '&:hover': { bgcolor: 'action.hover' },
  '&.Mui-focusVisible': { bgcolor: 'action.focus' },
  '&.Mui-disabled': { opacity: 0.4 },
} as const

const footerCaptionSx = { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' } as const

// docs/specs/099-fields-directory.md: the Field card on PlayerCard's layout and its one rule - every card has the same parts
// and the same height whatever the field's status. The rounded 56 px avatar with the name clamped to two lines; one badge
// row (the verification badge first, then the Type and "Our field" or a dashed "Not our field"); zebra rows that always
// render and show "-" when empty (Owner, City, Country, Matches, Map); and the same three footer columns whatever the
// status: a Link button (Add to our fields / Remove), Edit (filled primary, disabled with a reason in its tooltip when the
// club cannot edit, never hidden) and View. The platform admin's variant swaps the Link column for Status.
export function FieldCard({ field, viewTo, editTo, clubId, onToggleHome, homePending = false, onStatusAction }: FieldCardProps) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const admin = Boolean(onStatusAction)
  const status = fieldStatusOf(field)
  const badge = fieldStatusBadge(status)
  const edit = admin ? { editable: true, reason: null } : fieldEditState(field, clubId)
  const noStatusChanges = FIELD_STATUS_ACTIONS[status].length === 0
  const city = cityLine(field)
  const country = countryName(field.address.country)
  const linkedHome = Boolean(field.linkedHome)
  const similar = (field.possibleDuplicates ?? []).map((duplicate) => duplicate.name).join(', ')

  return (
    // height: '100%' + column flex, position: relative + hover halo - the same fixes PlayerCard applies, so a row of these
    // cards sits at one height with the footer pinned, and the whole card (the title's stretched link) is clickable.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
          <Avatar variant="rounded" sx={avatarSx(56)}>
            {initialsFromName(field.name)}
          </Avatar>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{
              ...cardTitleSx,
              flex: 1,
              minWidth: 0,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {/* Stretched-link title (docs/specs/059): the link stays position: static so its ::after resolves its
                containing block to the card above. */}
            <MuiLink
              component={RouterLink}
              to={viewTo}
              color="inherit"
              underline="none"
              sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
            >
              {field.name}
            </MuiLink>
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minHeight: 24 }}>
          <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="field-status-badge" />
          <Chip size="small" variant="outlined" label={FIELD_CATEGORY_LABEL[field.category]} />
          {!admin &&
            (linkedHome ? (
              <Chip
                size="small"
                variant="outlined"
                label="Our field"
                data-testid="field-ours-chip"
                sx={{ color: 'primary.dark', fontWeight: 600 }}
              />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label="Not our field"
                data-testid="field-ours-chip"
                sx={{ color: 'text.secondary', borderStyle: 'dashed', borderColor: 'text.disabled' }}
              />
            ))}
        </Stack>

        {/* The same rows on every card; the margin lets the zebra tint bleed to the card padding's edge. */}
        <Stack sx={{ mx: -1 }}>
          <DetailRow icon={<StorefrontOutlinedIcon fontSize="small" />} label="Owner" value={field.ownerName || NOT_ON_FILE} muted={!field.ownerName} />
          <DetailRow icon={<PlaceOutlinedIcon fontSize="small" />} label="City" value={city || NOT_ON_FILE} muted={!city} />
          <DetailRow icon={<LanguageOutlinedIcon fontSize="small" />} label="Country" value={country || NOT_ON_FILE} muted={!country} />
          {admin ? (
            <>
              <DetailRow
                icon={<PersonOutlineIcon fontSize="small" />}
                label="Captured"
                value={field.createdByClubName || NOT_ON_FILE}
                muted={!field.createdByClubName}
              />
              <DetailRow
                icon={<GroupsOutlinedIcon fontSize="small" />}
                label="Clubs"
                value={`${field.linkedClubCount ?? 0} ${(field.linkedClubCount ?? 0) === 1 ? 'club' : 'clubs'} · ${field.matchCount ?? 0} ${(field.matchCount ?? 0) === 1 ? 'match' : 'matches'}`}
              />
            </>
          ) : (
            <DetailRow icon={<EventOutlinedIcon fontSize="small" />} label="Matches" value={String(field.matchCount ?? 0)} />
          )}
          <DetailRow
            icon={<MapOutlinedIcon fontSize="small" />}
            label="Map"
            muted={!field.mapUrl}
            value={
              field.mapUrl ? (
                <MuiLink href={field.mapUrl} target="_blank" rel="noopener noreferrer" underline="hover" sx={inlineLinkSx}>
                  Open in maps
                </MuiLink>
              ) : (
                NOT_ON_FILE
              )
            }
          />
          {admin && (
            <DetailRow
              icon={<FlagOutlinedIcon fontSize="small" />}
              label="Similar"
              value={similar || NOT_ON_FILE}
              muted={!similar}
            />
          )}
        </Stack>
      </CardContent>

      {/* position: relative lifts the buttons above the title's stretched-link overlay (docs/specs/059). */}
      <CardActions
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 0.5,
          px: 1,
          pb: 1,
          pt: 0,
          position: 'relative',
          borderTop: 1,
          borderColor: 'divider',
          '& > :not(:first-of-type)': { ml: 0 },
        }}
      >
        {admin ? (
          <Box component="span" title={noStatusChanges ? VERIFIED_FIELD_NO_ACTIONS : 'Change status'} sx={{ display: 'flex' }}>
            <ButtonBase
              aria-haspopup="menu"
              aria-label="Change status"
              disabled={noStatusChanges}
              onClick={(event: MouseEvent<HTMLElement>) => setStatusAnchor(event.currentTarget)}
              sx={footerButtonSx}
            >
              <ManageAccountsOutlinedIcon fontSize="small" />
              <Box component="span" sx={footerCaptionSx}>
                Status
              </Box>
            </ButtonBase>
          </Box>
        ) : (
          <ButtonBase
            aria-label={linkedHome ? 'Remove from our fields' : 'Add to our fields'}
            title={linkedHome ? 'Remove from our fields' : 'Add to our fields'}
            disabled={homePending || !onToggleHome}
            onClick={() => onToggleHome?.(field)}
            sx={footerButtonSx}
          >
            {linkedHome ? <LinkOffIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
            <Box component="span" sx={footerCaptionSx}>
              {linkedHome ? 'Remove' : 'Add to our fields'}
            </Box>
          </ButtonBase>
        )}
        <Box component="span" title={edit.reason ?? undefined} sx={{ display: 'flex' }}>
          {edit.editable ? (
            <ButtonBase component={RouterLink} to={editTo} aria-label="Edit" sx={footerButtonSx}>
              <EditOutlinedIcon fontSize="small" />
              <Box component="span" sx={footerCaptionSx}>
                Edit
              </Box>
            </ButtonBase>
          ) : (
            <ButtonBase disabled aria-label="Edit" aria-disabled sx={footerButtonSx} data-testid="field-edit-disabled">
              <EditOutlinedIcon fontSize="small" />
              <Box component="span" sx={footerCaptionSx}>
                Edit
              </Box>
            </ButtonBase>
          )}
        </Box>
        <ButtonBase component={RouterLink} to={viewTo} aria-label="View" sx={footerButtonSx}>
          <VisibilityOutlinedIcon fontSize="small" />
          <Box component="span" sx={footerCaptionSx}>
            View
          </Box>
        </ButtonBase>
      </CardActions>

      {admin && (
        <FieldStatusMenu
          status={status}
          anchorEl={statusAnchor}
          onClose={() => setStatusAnchor(null)}
          onAction={(action) => onStatusAction?.(action)}
        />
      )}
    </MuiCard>
  )
}
