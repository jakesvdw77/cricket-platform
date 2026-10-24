import { useEffect, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
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
  getPlayingAreasSummary,
  listPlayingAreaFilterOptions,
  listPlayingAreas,
  playingAreasKey,
  playingAreasSummaryKey,
} from '../../../api/playingAreaApi'
import type { FieldCategory, PlayingAreasSummaryFilters } from '../../../api/playingAreaApi'
import { useFieldHomeLink } from '../../../hooks/useFieldHomeLink'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { cardGridSx } from '../../../utils/cardGrid'
import { countryName } from '../../../utils/countries'
import { FIELD_CATEGORIES, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'

const SEARCH_DEBOUNCE_MS = 300
const UNVERIFIED_LABEL = 'Unverified fields'

// A select's options always include the current value, so a saved filter that the reachable list no longer holds still shows.
function withCurrent(values: string[] | undefined, current: string, label: (value: string) => string = (value) => value) {
  const all = new Set(values ?? [])
  if (current) all.add(current)
  return Array.from(all)
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// docs/specs/099-fields-directory.md (1): the Fields directory, on the Matches list's shape - the plain header with the one
// primary action (Add field), three counters from /summary (Our fields, In the directory, Unverified as a quick filter),
// a FilterBar with Type, Country, Province, City and name search, a content line with the Name sort link, the Show only our
// fields switch and the Cards | List switch, then the cards or the list, paged by the backend (never sliced here). Type,
// Country, Province, City and Show only our fields are saved per club; the search and the quick filter are per visit.
export default function FieldsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const [descending, setDescending] = useState(false)
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)
  const [view, setView] = useListViewPreference('fieldList:view')
  // `ownOnly` is true, false or null (never chosen). Null resolves to on once the first summary reports that the club has
  // fields of its own, and to off otherwise; that answer is held (`autoOwnOnly`) so later filter changes never flip it.
  const [filters, setFilters] = usePersistedListFilters(`fieldList:filters:${clubId}`, {
    category: '' as FieldCategory | '',
    country: '',
    province: '',
    city: '',
    ownOnly: null as boolean | null,
  })
  const [autoOwnOnly, setAutoOwnOnly] = useState<boolean | null>(null)
  const homeLink = useFieldHomeLink(clubId)

  const { category, country, province, city } = filters

  // The counters follow the list's filters (Type, Country, Province, City, search); the quick filter and the switch do
  // not narrow them. A failed request hides the row; the list still works.
  const summaryFilters: PlayingAreasSummaryFilters = {
    q: debouncedSearch || undefined,
    category: category || undefined,
    country: country || undefined,
    province: province || undefined,
    city: city || undefined,
  }
  const summaryQuery = useQuery({
    queryKey: playingAreasSummaryKey(clubId ?? '', summaryFilters),
    queryFn: () => getPlayingAreasSummary(clubId as string, summaryFilters),
    enabled: Boolean(clubId),
    retry: false,
    placeholderData: keepPreviousData,
  })
  const summary = summaryQuery.data

  useEffect(() => {
    if (autoOwnOnly === null && (summary || summaryQuery.isError)) {
      setAutoOwnOnly(Boolean(summary && summary.ourFields > 0))
    }
  }, [autoOwnOnly, summary, summaryQuery.isError])

  const ownOnly = filters.ownOnly ?? autoOwnOnly

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, descending, unverifiedOnly, category, country, province, city, ownOnly])

  const { data, isLoading, isError } = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'list', page, debouncedSearch, descending, unverifiedOnly, category, country, province, city, ownOnly],
    queryFn: () =>
      listPlayingAreas(clubId as string, {
        page,
        ...(descending ? { sort: 'name,desc' } : {}),
        q: debouncedSearch || undefined,
        category: category || undefined,
        country: country || undefined,
        province: province || undefined,
        city: city || undefined,
        verification: unverifiedOnly ? 'UNVERIFIED' : undefined,
        mine: ownOnly ? true : undefined,
      }),
    // wait until "Show only our fields" has its answer, so the list never flickers from all to ours
    enabled: Boolean(clubId) && ownOnly !== null,
    placeholderData: keepPreviousData,
  })

  const optionsQuery = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'filter-options', category, country, province, city, debouncedSearch],
    queryFn: () =>
      listPlayingAreaFilterOptions(clubId as string, {
        category: category || undefined,
        country: country || undefined,
        province: province || undefined,
        city: city || undefined,
        q: debouncedSearch || undefined,
      }),
    enabled: Boolean(clubId),
    retry: false,
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading || ownOnly === null) {
    return null
  }

  if (isError || !data) {
    return <EmptyState title="Couldn't load fields" description="Something went wrong loading the fields directory. Please try again." />
  }

  const hasFields = data.content.length > 0
  const isSearching = debouncedSearch.length > 0
  const counters: PageCounterItem[] = summary
    ? [
        { id: 'own', value: summary.ourFields, label: 'Our fields' },
        { id: 'directory', value: summary.inDirectory, label: 'In the directory', shortLabel: 'In directory' },
        {
          id: 'unverified',
          value: summary.unverified,
          label: UNVERIFIED_LABEL,
          shortLabel: 'Unverified',
          tone: summary.unverified > 0 ? 'warning' : 'default',
          kind: 'filter',
          active: unverifiedOnly,
          hint: 'Tap to filter',
          onSelect: () => setUnverifiedOnly((current) => !current),
        },
      ]
    : []
  const showCounters = !summaryQuery.isError && (summaryQuery.isPending || Boolean(summary))

  const ownSwitch = <CompactSwitch checked={ownOnly} onChange={(checked) => setFilters({ ownOnly: checked })} label="Show only our fields" />
  const sortLink = <SortLink label={descending ? 'Z to A' : 'A to Z'} onToggle={() => setDescending((current) => !current)} />

  const options = optionsQuery.data
  const extraSelects = [
    {
      key: 'category',
      label: 'Type',
      allLabel: 'All types',
      options: FIELD_CATEGORIES.map((value) => ({ value, label: FIELD_CATEGORY_LABEL[value] })),
      value: category,
      onChange: (value: string) => setFilters({ category: value as FieldCategory | '' }),
    },
    {
      key: 'country',
      label: 'Country',
      allLabel: 'All countries',
      options: withCurrent(options?.countries, country, countryName),
      value: country,
      onChange: (value: string) => setFilters({ country: value, province: '', city: '' }),
    },
    {
      key: 'province',
      label: 'Province',
      allLabel: 'All provinces',
      options: withCurrent(options?.provinces, province),
      value: province,
      onChange: (value: string) => setFilters({ province: value, city: '' }),
    },
    {
      key: 'city',
      label: 'City',
      allLabel: 'All cities',
      options: withCurrent(options?.cities, city),
      value: city,
      onChange: (value: string) => setFilters({ city: value }),
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Fields"
        action={
          <Button size="compact" startIcon={<AddIcon fontSize="small" />} onClick={() => navigate('/manage/fixtures/fields/new')}>
            Add field
          </Button>
        }
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <FilterBar
        density="compact"
        extraSelects={extraSelects}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by field name or city"
        extraChips={unverifiedOnly ? [{ key: 'unverified', label: UNVERIFIED_LABEL, onRemove: () => setUnverifiedOnly(false) }] : []}
        viewControls={
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            {unverifiedOnly && (
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}>
                <Typography variant="body2" color="text.secondary">
                  Quick filter: <b>{UNVERIFIED_LABEL}</b>
                </Typography>
                <Link component="button" type="button" underline="hover" onClick={() => setUnverifiedOnly(false)} sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  Clear
                </Link>
              </Box>
            )}
            {ownSwitch}
            {sortLink}
          </>
        }
        onClearAll={() => {
          setFilters({ category: '', country: '', province: '', city: '' })
          setUnverifiedOnly(false)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${data.totalElements} ${data.totalElements === 1 ? 'field' : 'fields'}${unverifiedOnly ? ` · ${UNVERIFIED_LABEL}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {ownSwitch}
          </>
        }
      />

      {hasFields && view === 'list' && (
        <FieldTable
          fields={data.content}
          viewTo={(field) => `/manage/fixtures/fields/${field.id}`}
          onToggleHome={homeLink.toggleHome}
          homePendingId={homeLink.pendingId}
        />
      )}

      {hasFields && view === 'cards' && (
        <Box sx={cardGridSx}>
          {data.content.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              clubId={clubId}
              viewTo={`/manage/fixtures/fields/${field.id}`}
              editTo={`/manage/fixtures/fields/${field.id}/edit`}
              onToggleHome={homeLink.toggleHome}
              homePending={homeLink.pendingId === field.id}
            />
          ))}
        </Box>
      )}

      {!hasFields && isSearching && (
        <EmptyState title="No matching fields" description={`No fields match "${debouncedSearch}". Try a different search.`} />
      )}

      {!hasFields && !isSearching && unverifiedOnly && (
        <EmptyState title="Nothing to check" description="No fields are waiting to be verified with the current filters." />
      )}

      {!hasFields && !isSearching && !unverifiedOnly && ownOnly && (
        <EmptyState
          title="No fields of your own yet"
          description={'Add the first field you play on, or turn off "Show only our fields" to browse every club\'s fields.'}
        />
      )}

      {!hasFields && !isSearching && !unverifiedOnly && !ownOnly && (
        <EmptyState title="No fields found" description="Nothing in the directory matches these filters. Try clearing a filter, or add a new field." />
      )}

      {hasFields && <PageNav page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}

      {homeLink.dialog}
    </Box>
  )
}
