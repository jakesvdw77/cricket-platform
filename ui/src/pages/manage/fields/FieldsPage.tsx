import { useEffect, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AddCard } from '../../../components/AddCard'
import { BrandIcon } from '../../../components/BrandIcon'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { SortMenu } from '../../../components/ContentControlsLine'
import type { SortMenuOption } from '../../../components/ContentControlsLine'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { FieldCard } from '../../../components/FieldCard'
import { FieldTable } from '../../../components/FieldTable'
import { FilterBar } from '../../../components/FilterBar'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { PageNav } from '../../../components/PageNav'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { ToolbarCard, ToolbarSortButton, ToolbarToggleChip } from '../../../components/ToolbarCard'
import {
  getPlayingAreasSummary,
  listPlayingAreaFilterOptions,
  listPlayingAreas,
  playingAreasKey,
  playingAreasSummaryKey,
} from '../../../api/playingAreaApi'
import type { FieldCategory, PlayingArea, PlayingAreasSummaryFilters } from '../../../api/playingAreaApi'
import { useFieldHomeLink } from '../../../hooks/useFieldHomeLink'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { countryName } from '../../../utils/countries'
import { FIELD_CATEGORIES, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { MANAGER_FIELDS_PATH } from './fieldMenuItems'
import { FieldRowMenu } from './FieldRowMenu'

const SEARCH_DEBOUNCE_MS = 300
const UNVERIFIED_LABEL = 'Unverified Fields'

type FieldSort = 'asc' | 'desc'

const SORT_OPTIONS: (SortMenuOption & { value: FieldSort })[] = [
  { value: 'asc', label: 'Name, A To Z', linkLabel: 'A To Z' },
  { value: 'desc', label: 'Name, Z To A', linkLabel: 'Z To A' },
]

// A select's options always include the current value, so a saved filter that the reachable list no longer holds still shows.
function withCurrent(values: string[] | undefined, current: string, label: (value: string) => string = (value) => value) {
  const all = new Set(values ?? [])
  if (current) all.add(current)
  return Array.from(all)
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// docs/specs/099-fields-directory.md (1) and docs/specs/134: the Fields directory on the Seasons and Matches pages' shape - the plain
// header with the one primary action (Add Field), three counters from /summary (Our Fields, In The Directory, Unverified as a
// quick filter), ONE fused toolbar (search, Type, Country, Province, City, then the Our Fields Only chip, Sort and Cards | List
// last; no count text), then the flat table or cards with one kebab each and a dashed Add Field card, paged by the backend
// (never sliced here). Type, Country, Province, City and Our Fields Only are saved per club; the search and the quick filter
// are per visit.
export default function FieldsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  // docs/specs/127: Add Field and every row, card and kebab destination return to this list.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Fields')
  const addFieldPath = leaveTo(`${MANAGER_FIELDS_PATH}/new`)
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

  // The counters follow the list's filters (Type, Country, Province, City, search); the quick filter and the chip do
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
    // wait until "Our Fields Only" has its answer, so the list never flickers from all to ours
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
  const sort: FieldSort = descending ? 'desc' : 'asc'
  const counters: PageCounterItem[] = summary
    ? [
        { id: 'own', value: summary.ourFields, label: 'Our Fields' },
        { id: 'directory', value: summary.inDirectory, label: 'In The Directory', shortLabel: 'In Directory' },
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

  const emptyState = (() => {
    if (hasFields) {
      return null
    }
    const icon = <BrandIcon name="nav/ground-oval" size={48} />
    if (isSearching) {
      return <EmptyState icon={icon} title="No matching fields" description={`No fields match "${debouncedSearch}". Try a different search.`} />
    }
    if (unverifiedOnly) {
      return <EmptyState icon={icon} title="Nothing to check" description="No fields are waiting to be verified with the current filters." />
    }
    if (ownOnly) {
      return (
        <EmptyState
          icon={icon}
          title="No fields of your own yet"
          description="Add the first field you play on, or turn off Our Fields Only to browse every club's fields."
          action={<EmptyStateLink onClick={() => navigate(addFieldPath)}>Create New Field</EmptyStateLink>}
        />
      )
    }
    return <EmptyState icon={icon} title="No fields found" description="Nothing in the directory matches these filters. Try clearing a filter, or add a new field." />
  })()

  const changeSort = (value: string) => setDescending(value === 'desc')

  const bar = (
    <FilterBar
      density="compact"
      bare
      inCard
      viewControlsInline
      extraSelects={extraSelects}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by field name or city"
      // Desktop order (page-anatomy section 3): the toggle chip, then Sort, then the Cards | List toggle last. A phone sheet: toggle first.
      secondaryControls={(placement) =>
        placement === 'row' ? (
          <ToolbarToggleChip pressed={ownOnly} onChange={(checked) => setFilters({ ownOnly: checked })} label="Our Fields Only" />
        ) : (
          <CompactSwitch checked={ownOnly} onChange={(checked) => setFilters({ ownOnly: checked })} label="Our Fields Only" />
        )
      }
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
        setFilters({ category: '', country: '', province: '', city: '' })
        setUnverifiedOnly(false)
      }}
    />
  )
  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'
  const rowMenu = (field: PlayingArea, testId: string) => (
    <FieldRowMenu field={field} clubId={clubId} onToggleHome={homeLink.toggleHome} homePending={homeLink.pendingId === field.id} testId={testId} />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title="Fields"
        action={
          <Button size="compact" onClick={() => navigate(addFieldPath)} sx={{ flex: 'none' }}>
            Create New Field
          </Button>
        }
      />

      {showCounters && <PageCounters density="compact" items={counters} loading={summaryQuery.isPending} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
        {!fused && <ToolbarCard>{bar}</ToolbarCard>}

        {view === 'list' && (
          <FieldTable
            fields={data.content}
            viewTo={(field) => leaveTo(`${MANAGER_FIELDS_PATH}/${field.id}`)}
            rowActions={(field) => rowMenu(field, 'field-row-actions')}
            toolbar={bar}
            empty={emptyState}
          />
        )}

        {view === 'cards' ? emptyState : null}

        {view === 'cards' && (
          <Box sx={dynamicCardGridSx}>
            {data.content.map((field) => (
              <FieldCard key={field.id} field={field} viewTo={leaveTo(`${MANAGER_FIELDS_PATH}/${field.id}`)} actions={rowMenu(field, 'field-card-actions')} />
            ))}
            {/* The grid ends with a dashed Add card (same route as the page's Add Field button); with no cards it is not shown (the empty message carries the quick-action button). */}
            {data.content.length > 0 && <AddCard label="Create New Field" to={addFieldPath} testId="add-field-card" />}
          </Box>
        )}

        {hasFields && <PageNav page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}
      </Box>

      {homeLink.dialog}
    </Box>
  )
}
