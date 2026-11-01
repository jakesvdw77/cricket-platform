import { useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import { getPlayingArea, playingAreasKey } from '../../../api/playingAreaApi'
import { useFieldHomeLink } from '../../../hooks/useFieldHomeLink'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { FieldInfoCards } from './FieldInfoCards'
import { FieldKeyFigures } from './FieldKeyFigures'
import { FieldNotice } from './FieldNotice'
import { FieldPageHeader } from './FieldPageHeader'
import { fieldMenuItems, MANAGER_FIELDS_PATH } from './fieldMenuItems'
import { useFieldDirections } from './useFieldDirections'

// docs/specs/099-fields-directory.md (4) and docs/specs/134: a field's page on the Season and Match pages' shape. Top row: Back alone.
// Title row: the field's tile, name and verification badge, then ONE filled Manage Field menu (Edit Field first, disabled with its
// reason when this club cannot edit the field; Get Directions when a point resolves; Add To / Remove From Our Fields; Open In Maps). Then the persistent unverified
// notice, static compact figures and flat info cards (Address, Details, Verification). Every link that leaves the page carries it
// as the origin.
export default function FieldDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { fieldId } = useParams<{ fieldId?: string }>()
  const location = useLocation()
  const homeLink = useFieldHomeLink(clubId)

  const { data: field, isPending, isError } = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'detail', fieldId],
    queryFn: () => getPlayingArea(clubId as string, fieldId as string),
    enabled: Boolean(clubId) && Boolean(fieldId),
  })

  const directions = useFieldDirections(field)

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isPending) {
    return null
  }

  if (isError || !field) {
    return <EmptyState title="Couldn't load this field" description="Something went wrong loading this field. Please try again." />
  }

  // docs/specs/127: the origin of every leaving link is this page, labelled with the field's name.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), field.name.slice(0, 60))
  const menuItems = fieldMenuItems({
    field,
    admin: false,
    clubId,
    placement: 'page',
    leaveTo,
    onToggleHome: homeLink.toggleHome,
    homePending: homeLink.pendingId === field.id,
    directions: directions.items,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <FieldPageHeader field={field} listPath={MANAGER_FIELDS_PATH} menuItems={menuItems} />

      <FieldNotice field={field} />

      <FieldKeyFigures field={field} />

      <FieldInfoCards field={field} />

      {homeLink.dialog}
      {directions.sheet}
    </Box>
  )
}
