import { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ContentControlsLine, SortLink } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { FieldCard } from '../../../components/FieldCard'
import { FieldTable } from '../../../components/FieldTable'
import { FilterBar } from '../../../components/FilterBar'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { PageNav } from '../../../components/PageNav'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import {
  getPlatformPlayingAreasSummary,
  listPlatformPlayingAreas,
  PLATFORM_FIELDS_KEY,
  platformFieldsSummaryKey,
} from '../../../api/platformPlayingAreaApi'
import type { FieldCategory, FieldVerificationStatus } from '../../../api/playingAreaApi'
import { useFieldStatusActions } from '../../../hooks/useFieldStatusActions'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { cardGridSx } from '../../../utils/cardGrid'
import { countryOptions } from '../../../utils/countries'
import { FIELD_CATEGORIES, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'

const SEARCH_DEBOUNCE_MS = 300

const VERIFICATION_WORDS: Record<FieldVerificationStatus, string> = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
}

// docs/specs/099-fields-directory.md (9): the platform admin's moderation list, in the same list shape as the managers' Fields
// page - plain header, three counters (Unverified, Verified, Rejected; Unverified is the one it opens on), a FilterBar
// (Type, Country, search), a content line with the order and the Cards | List switch (`adminFieldList:view`), then the
// same FieldCard / FieldTable with extra rows for who captured it and the clubs using it, and one Status button per field.
// Oldest first by default. Paged by the backend.
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

  const sortLink = <SortLink label={newestFirst ? 'newest first' : 'oldest first'} onToggle={() => setNewestFirst((current) => !current)} />
  const hasFields = data.content.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Fields to verify" />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
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
        viewControls={
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            {sortLink}
          </>
        }
        onClearAll={() => {
          setCategory('')
          setCountry('')
        }}
      />

      <ContentControlsLine
        scope={`Showing ${data.totalElements} ${VERIFICATION_WORDS[verification]} ${data.totalElements === 1 ? 'field' : 'fields'}`}
        sortAction={sortLink}
        controls={<ListViewToggle value={view} onChange={setView} />}
      />

      {hasFields && view === 'list' && (
        <FieldTable
          fields={data.content}
          viewTo={(field) => `/admin/fields/${field.id}`}
          onStatusAction={(field, action) => statusActions.requestAction(field, action)}
        />
      )}

      {hasFields && view === 'cards' && (
        <Box sx={cardGridSx}>
          {data.content.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              viewTo={`/admin/fields/${field.id}`}
              editTo={`/admin/fields/${field.id}/edit`}
              onStatusAction={(action) => statusActions.requestAction(field, action)}
            />
          ))}
        </Box>
      )}

      {!hasFields && (
        <EmptyState
          title={debouncedSearch ? 'No matching fields' : 'Nothing here'}
          description={
            debouncedSearch
              ? `No ${VERIFICATION_WORDS[verification]} fields match "${debouncedSearch}".`
              : `There are no ${VERIFICATION_WORDS[verification]} fields with these filters.`
          }
        />
      )}

      {hasFields && <PageNav page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}

      {statusActions.dialog}
    </Box>
  )
}
