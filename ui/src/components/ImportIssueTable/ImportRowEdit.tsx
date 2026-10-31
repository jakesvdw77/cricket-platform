import { useRef, useState } from 'react'
import { Autocomplete, Box, Typography } from '@mui/material'
import type { ImportEditableColumn } from '../../api/importApi'
import { normaliseOptions } from '../../utils/importDecisions'
import type { ImportColumnOption, ImportColumnOptions } from '../../utils/importDecisions'
import { Button } from '../Button'
import { Input } from '../Input'
import { TimeField } from '../TimeField'
import { editKeyHandler } from './editKeyHandler'
import { playsItself, squash } from './sameSides'

// docs/specs/125-editable-import-rows.md: the inputs of an editable import row. Every value is stored as plain text. A TEXT column
// with consumer suggestions is a free-text type-ahead; a DATE or TIME column is the native picker while its value is empty or in the
// strict form (yyyy-mm-dd) and a plain text input otherwise, so a file value such as "13-Sept-26" is never lost or rewritten. A TIME
// column is the shared TimeField (typed HH:MM with stepper arrows, as on the Match form) while its value is empty or strict; a file
// value such as "8.00" stays editable text with a helper line until it is cleared or becomes a valid time.
// The accessible name carries the column and the row, the visible label only the column.
const PLACEHOLDERS: Record<ImportEditableColumn['kind'], string | undefined> = { TEXT: undefined, DATE: 'yyyy-mm-dd', TIME: 'hh:mm' }
const FALLBACK_HELP: Partial<Record<ImportEditableColumn['kind'], string>> = { DATE: 'Pick a date or type yyyy-mm-dd', TIME: 'Type a time as HH:mm' }

const inputHeightSx = { '& .MuiInputBase-root': { minHeight: { xs: 44, md: 40 } } } as const

function isStrictDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isStrictTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

interface RowEditInputProps {
  column: ImportEditableColumn
  value: string
  rowLabel: string
  onChange: (value: string) => void
  autoFocus?: boolean
  // Type-ahead suggestions for a TEXT column; typing a value that is not listed is still accepted.
  options?: ImportColumnOption[]
  // Told which option was chosen from the list (null when the text is typed or cleared afterwards).
  onPick?: (option: ImportColumnOption | null) => void
  helperText?: string
}

function TypeAheadInput({ column, value, rowLabel, onChange, autoFocus, options, onPick, helperText }: RowEditInputProps & { options: ImportColumnOption[] }) {
  // Enter on a highlighted suggestion picks it (the row must not save then); with no suggestion highlighted it saves the row.
  const highlighted = useRef(false)
  const open = useRef(false)
  // MUI shows the full list while the box holds a selected value, so a file value would defeat filtering. Until the user types the
  // full list is shown (to pick a different team); from the first keystroke the list narrows to the names containing the text.
  const [typed, setTyped] = useState(false)
  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      filterOptions={(all, state) => {
        const wanted = state.inputValue.trim().toLowerCase()
        return typed && wanted ? all.filter((option) => option.label.toLowerCase().includes(wanted)) : all
      }}
      inputValue={value}
      onChange={(_event, chosen, reason) => {
        if (reason === 'selectOption' && chosen !== null && typeof chosen !== 'string') onPick?.(chosen)
      }}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input' || reason === 'clear') {
          onPick?.(null)
          setTyped(true)
        }
        onChange(next)
      }}
      onHighlightChange={(_event, option) => {
        highlighted.current = option !== null
      }}
      onOpen={() => {
        open.current = true
      }}
      onClose={() => {
        setTyped(false)
        open.current = false
        highlighted.current = false
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && open.current && highlighted.current) event.stopPropagation()
      }}
      sx={{ minWidth: 140, width: '100%', ...inputHeightSx }}
      renderInput={(params) => (
        <Input
          {...params}
          label={column.label}
          autoFocus={autoFocus}
          error={helperText !== undefined}
          helperText={helperText}
          inputProps={{ ...params.inputProps, 'aria-label': `${column.label}, row ${rowLabel}`, maxLength: 1000 }}
        />
      )}
    />
  )
}

// The Start time box. Which control shows is decided by the value the edit began with and by what is typed later: an empty or strict
// value gets the stepper, an unparseable file value stays text (never rewritten) until it is cleared or becomes a valid time.
function TimeEditInput({ column, value, rowLabel, onChange, autoFocus }: RowEditInputProps) {
  const [textMode, setTextMode] = useState(() => value !== '' && !isStrictTime(value))
  if (textMode && (value === '' || isStrictTime(value))) setTextMode(false)
  if (textMode) {
    return (
      <Input
        label={column.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        placeholder={PLACEHOLDERS.TIME}
        helperText={FALLBACK_HELP.TIME}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': `${column.label}, row ${rowLabel}`, maxLength: 1000 }}
        sx={{ minWidth: 100, ...inputHeightSx }}
      />
    )
  }
  return <TimeField label={column.label} ariaLabel={`${column.label}, row ${rowLabel}`} value={value} onChange={onChange} autoFocus={autoFocus} sx={{ minWidth: 100, ...inputHeightSx }} />
}

export function RowEditInput({ column, value, rowLabel, onChange, autoFocus = false, options, onPick, helperText }: RowEditInputProps) {
  if (column.kind === 'TEXT' && options) {
    return <TypeAheadInput column={column} value={value} rowLabel={rowLabel} onChange={onChange} autoFocus={autoFocus} options={options} onPick={onPick} helperText={helperText} />
  }
  if (column.kind === 'TIME') return <TimeEditInput column={column} value={value} rowLabel={rowLabel} onChange={onChange} autoFocus={autoFocus} />
  const picker = column.kind === 'DATE'
  const native = picker && (value === '' || isStrictDate(value))
  return (
    <Input
      label={column.label}
      type={native ? 'date' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoFocus={autoFocus}
      placeholder={native ? undefined : PLACEHOLDERS[column.kind]}
      helperText={picker && !native ? FALLBACK_HELP[column.kind] : undefined}
      InputLabelProps={picker ? { shrink: true } : undefined}
      inputProps={{ 'aria-label': `${column.label}, row ${rowLabel}`, maxLength: 1000 }}
      sx={{ minWidth: column.kind === 'TEXT' ? 140 : 100, ...inputHeightSx }}
    />
  )
}

export function EditActions({ onSave, onCancel, onReset, disabled }: { onSave: () => void; onCancel: () => void; onReset?: () => void; disabled: boolean }) {
  const sx = { minHeight: { xs: 44, md: 32 }, width: { xs: '100%', md: 'auto' } }
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 0.5, justifyContent: 'flex-end', mt: { xs: 1, md: 0 } }}>
      <Button size="compact" disabled={disabled} onClick={onSave} sx={sx}>Save</Button>
      <Button size="compact" variant="secondary" onClick={onCancel} sx={sx}>Cancel</Button>
      {onReset && <Button size="compact" variant="ghost" disabled={disabled} onClick={onReset} sx={sx}>Reset to file values</Button>}
    </Box>
  )
}

// How a consumer groups the inputs of an editable row: `primary` keys sit in one wrapping row in that order, `secondary` keys
// (for example notes) stay hidden behind a compact button until pressed or until they already hold a value. Keys the layout does
// not name are appended to the primary row. Omitted, every declared column is one group in the declared order.
export interface ImportEditLayout {
  primary: string[]
  secondary?: string[]
  addSecondaryLabel?: string
  removeSecondaryLabel?: string
  // Two keys that may not hold the same value (home and away: a team cannot play itself). Each one's suggestions leave out the other's
  // current value, and the same typed value on both shows a helper under the second.
  differentPair?: [string, string]
}

const SAME_SIDES_HELP = 'A team cannot play itself'
export interface RowEditFieldsProps {
  columns: ImportEditableColumn[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  rowLabel: string
  columnOptions?: ImportColumnOptions
  layout?: ImportEditLayout
  autoFocusFirst?: boolean
  // A type-ahead option was chosen (or the choice was undone) in this column.
  onPick?: (key: string, option: ImportColumnOption | null) => void
  // The options chosen from the lists so far, by key (identity of the other side).
  picked?: Record<string, ImportColumnOption>
}

// Normalised once per render of a field; a column without suggestions gets none.
const normalisedFor = (options: ImportColumnOptions | undefined, key: string) => (options?.[key] && normaliseOptions(options[key]).length > 0 ? normaliseOptions(options[key]) : undefined)

const fieldFlex = (column: ImportEditableColumn) => ({ flex: { xs: '1 1 100%', md: column.kind === 'TEXT' ? '1 1 160px' : '0 0 150px' }, minWidth: 0 })

// The inputs of one row in the consumer's order: phone stacked, desktop one wrapping row, then the optional second row.
export function RowEditFields({ columns, values, onChange, rowLabel, columnOptions, layout, autoFocusFirst = false, onPick, picked }: RowEditFieldsProps) {
  const byKey = new Map(columns.map((column) => [column.key, column]))
  const secondaryKeys = (layout?.secondary ?? []).filter((key) => byKey.has(key))
  const named = new Set([...(layout?.primary ?? []), ...secondaryKeys])
  const primaryKeys = [...(layout?.primary ?? []).filter((key) => byKey.has(key)), ...columns.map((column) => column.key).filter((key) => !named.has(key))]
  const hasSecondaryValue = secondaryKeys.some((key) => (values[key] ?? '') !== '')
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const showSecondary = secondaryKeys.length > 0 && (secondaryOpen || hasSecondaryValue)
  const input = (key: string, focus: boolean) => {
    const column = byKey.get(key) as ImportEditableColumn
    const pair = layout?.differentPair
    const other = pair && pair.includes(key) ? (pair[0] === key ? pair[1] : pair[0]) : null
    let options = normalisedFor(columnOptions, key)
    if (options && other) {
      const otherName = squash(values[other])
      const otherPick = picked?.[other]
      options = options.filter((option) => squash(option.label) !== otherName && !(option.kind && option.id && otherPick?.kind === option.kind && otherPick.id === option.id && squash(values[other]) === squash(otherPick.label)))
    }
    const helperText = pair && pair[1] === key && playsItself(values, layout) ? SAME_SIDES_HELP : undefined
    return <RowEditInput column={column} value={values[key] ?? ''} rowLabel={rowLabel} helperText={helperText} options={options} onPick={(option) => onPick?.(key, option)} onChange={(next) => onChange(key, next)} autoFocus={focus} />
  }
  const buttonSx = { minHeight: { xs: 44, md: 32 }, alignSelf: 'flex-start' }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: { md: 'wrap' }, gap: 1, alignItems: { md: 'flex-start' } }}>
        {primaryKeys.map((key, index) => (
          <Box key={key} sx={fieldFlex(byKey.get(key) as ImportEditableColumn)}>{input(key, autoFocusFirst && index === 0)}</Box>
        ))}
      </Box>
      {secondaryKeys.length > 0 && !showSecondary && (
        <Button size="compact" variant="ghost" onClick={() => setSecondaryOpen(true)} sx={buttonSx}>{layout?.addSecondaryLabel ?? 'Add note'}</Button>
      )}
      {showSecondary && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {secondaryKeys.map((key) => <Box key={key}>{input(key, secondaryOpen && !hasSecondaryValue)}</Box>)}
          <Button
            size="compact"
            variant="ghost"
            onClick={() => {
              for (const key of secondaryKeys) onChange(key, '')
              setSecondaryOpen(false)
            }}
            sx={buttonSx}
          >
            {layout?.removeSecondaryLabel ?? 'Remove note'}
          </Button>
        </Box>
      )}
    </Box>
  )
}

export interface NewRowFormProps {
  columns: ImportEditableColumn[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSave: () => void
  onCancel: () => void
  disabled: boolean
  columnOptions?: ImportColumnOptions
  layout?: ImportEditLayout
  onPick?: (key: string, option: ImportColumnOption | null) => void
  picked?: Record<string, ImportColumnOption>
}

// The row being added: its own block above or below the rows, stacked on a phone.
export function NewRowForm({ columns, values, onChange, onSave, onCancel, disabled, columnOptions, layout, onPick, picked }: NewRowFormProps) {
  return (
    <Box data-testid="import-new-row" onKeyDown={editKeyHandler(() => { if (!playsItself(values, layout)) onSave() }, onCancel)} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'primary.main', borderRadius: 1, p: 1.25 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>New row</Typography>
      <RowEditFields columns={columns} values={values} onChange={onChange} rowLabel="new" columnOptions={columnOptions} layout={layout} autoFocusFirst onPick={onPick} picked={picked} />
      <EditActions onSave={onSave} onCancel={onCancel} disabled={disabled || playsItself(values, layout)} />
    </Box>
  )
}
