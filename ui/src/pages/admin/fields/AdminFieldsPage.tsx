import { useEffect, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BrandIcon } from '../../../components/BrandIcon'
import { SortMenu } from '../../../components/ContentControlsLine'
import type { SortMenuOption } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { FieldCard } from '../../../components/FieldCard'
import { FieldTable } from '../../../components/FieldTable'
import { FilterBar } from '../../../components/FilterBar'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { PageNav } from '../../../components/PageNav'
import { ToolbarCard, ToolbarSortButton } from '../../../components/ToolbarCard'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import {
  getPlatformPlayingAreasSummary,
  listPlatformPlayingAreas,
  PLATFORM_FIELDS_KEY,
  platformFieldsSummaryKey,
} from '../../../api/platformPlayingAreaApi'
import type { FieldCategory, FieldVerificationStatus, PlayingArea } from '../../../api/playingAreaApi'
import { useFieldStatusActions } from '../../../hooks/useFieldStatusActions'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { countryOptions } from '../../../utils/countries'
import { FIELD_CATEGORIES, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { ADMIN_FIELDS_PATH } from '../../manage/fields/fieldMenuItems'
import { FieldRowMenu } from '../../manage/fields/FieldRowMenu'

const SEARCH_DEBOUNCE_MS = 300

type AdminSort = 'oldest' | 'newest'

const SORT_OPTIONS: (SortMenuOption & { value: AdminSort })[] = [
  { value: 'oldest', label: 'Oldest First', linkLabel: 'Oldest First' },
  { value: 'newest', label: 'Newest First', linkLabel: 'Newest First' },
]

const VERIFICATION_WORDS: Record<FieldVerificationStatus, string> = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
}

// docs/specs/099-fields-directory.md (9) and docs/specs/134: the platform admin's moderation list, in the same list shape as the
// managers' Fields page - plain header, three counters (Unverified, Verified, Rejected; Unverified is the one it opens on), ONE
// fused toolbar (Type, Country, search, then Sort and Cards | List last; no count text), then the same flat FieldCard / FieldTable
// with extra rows for who captured it and the clubs using it, and one kebab per field (Open Field, Edit Field, Open In Maps and
// Verify, Reject or Reopen). Oldest first by default. Paged by the backend. There is no Add Field here (the platform admin does
// not capture fields).
export default function AdminFieldsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const [verification, setVerification] = useState<FieldVerificationStatus>('UNVERIFIED')
  const [category, setCategory] = useState<FieldCategory | ''>('')
  const [country, setCountry] = useState('')
  const [newestFirst, setNewestFirst] = useState(false)
  const [view, setView] = useListViewPreference('adminFieldList:view')
  const statusActions = useFieldStatusActions()
  const location = useLocation()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  // docs/specs/127: every row, card and kebab destination returns to this list.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Fields')

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, verification, category, country, newestFirst])

  const { data, isLoading, isError } = useQuery({
    queryKey: [...PLATFORM_FIELDS_KEY, 'list', page, debouncedSearch, verification, category, country, newestFirst],
    queryFn: () =>
      listPlatformPlayingAreas({
        page,
        verification,
        q: debouncedSearch || undefined,
        category: category || undefined,
        country: country || undefined,
        ...(newestFirst ? { sort: 'createdAt,desc' } : {}),
      }),
    placeholderData: keepPreviousData,
  })

  const summaryQuery = useQuery({
    queryKey: platformFieldsSummaryKey,
    queryFn: getPlatformPlayingAreasSummary,
    retry: false,
    placeholderData: keepPreviousData,
  })

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return <EmptyState title="Couldn't load fields" description="Something went wrong loading the fields. Please try again." />
  }

  const summary = summaryQuery.data
  const counters: PageCounterItem[] = summary
    ? (['UNVERIFIED', 'VERIFIED', 'REJECTED'] as const).map((status) => {
        const value = status === 'UNVERIFIED' ? summary.unverified : status === 'VERIFIED' ? summary.verified : summary.rejected
        const label = status === 'UNVERIFIED' ? 'Unverified' : status === 'VERIFIED' ? 'Verified' : 'Rejected'
        return {
          id: status,
          value,
          label,
          tone: status === 'UNVERIFIED' && value > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: verification === status,
          hint: 'Tap to filter',
          onSelect: () => setVerification(status),
        } satisfies PageCounterItem
      })
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))

  const sort: AdminSort = newestFirst ? 'newest' : 'oldest'
  const changeSort = (value: string) => setNewestFirst(value === 'newest')
  const hasFields = data.content.length > 0
  const icon = <BrandIcon name="nav/ground-oval" size={48} />
  const emptyState = hasFields ? null : (
    <EmptyState
      icon={icon}
      title={debouncedSearch ? 'No matching fields' : 'Nothing here'}
      description={
        debouncedSearch
          ? `No ${VERIFICATION_WORDS[verification]} fields match "${debouncedSearch}".`
          : `There are no ${VERIFICATION_WORDS[verification]} fields with these filters.`
      }
    />
  )

  const bar = (
    <FilterBar
      density="compact"
      bare
      inCard
      viewControlsInline
      extraSelects={[
        {
          key: 'category',
          label: 'Type',
          allLabel: 'All types',
          options: FIELD_CATEGORIES.map((value) => ({ value, label: FIELD_CATEGORY_LABEL[value] })),
          value: category,
          onChange: (value) => setCategory(value as FieldCategory | ''),
        },
        {
          key: 'country',
          label: 'Country',
          allLabel: 'All countries',
          options: countryOptions().map((option) => ({ value: option.code, label: option.name })),
          value: country,
          onChange: setCountry,
        },
      ]}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by field name or city"
      // Desktop order (page-anatomy section 3): Sort, then the Cards | List toggle last. A phone sheet: toggle first.
      viewControls={
        phone ? (
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            <SortMenu value={sort} options={SORT_OPTIONS} onChange={changeSort} />
          </>
        ) : (
          <>
            <ToolbarSortButton value={sort} onChange={changeSort} options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearAll={() => {
        setCategory('')
        setCountry('')
      }}
    />
  )
  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'
  const rowMenu = (field: PlayingArea, testId: string) => (
    <FieldRowMenu field={field} admin onStatusAction={statusActions.requestAction} testId={testId} />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader title="Fields To Verify" />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
        {!fused && <ToolbarCard>{bar}</ToolbarCard>}

        {view === 'list' && (
          <FieldTable
            fields={data.content}
            viewTo={(field) => leaveTo(`${ADMIN_FIELDS_PATH}/${field.id}`)}
            rowActions={(field) => rowMenu(field, 'field-row-actions')}
            toolbar={bar}
            empty={emptyState}
          />
        )}

        {view === 'cards' ? emptyState : null}

        {view === 'cards' && hasFields && (
          <Box sx={dynamicCardGridSx}>
            {data.content.map((field) => (
              <FieldCard key={field.id} admin field={field} viewTo={leaveTo(`${ADMIN_FIELDS_PATH}/${field.id}`)} actions={rowMenu(field, 'field-card-actions')} />
            ))}
          </Box>
        )}

        {hasFields && <PageNav page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}
      </Box>

      {statusActions.dialog}
    </Box>
  )
}
