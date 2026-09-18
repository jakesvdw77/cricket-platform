import { useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Box, InputAdornment, Popover } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ClearIcon from '@mui/icons-material/Clear'
import { Button } from '../Button'
import { Input } from '../Input'
import { SectionTree } from '../SectionTree'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'

export interface SectionTreeSelectProps {
  label: string
  sections: Section[]
  value: string | null
  // Widened to accept null — a real, intentional value once allowClear is set (the "All sections"
  // affordance below), not just "nothing selected yet". docs/specs/035-section-scoped-access.md.
  onChange: (sectionId: string | null) => void
  error?: boolean
  helperText?: string
  // docs/specs/035-section-scoped-access.md: renders an "All sections" row above the tree in the
  // Popover, letting a filter-mode consumer clear back to no selection. Defaults to false/omitted
  // so TeamForm's existing required-section picker (the one other real consumer today) is
  // unaffected — it never passes this prop.
  allowClear?: boolean
  // Shown as the trigger's display value when value is null and allowClear is true. Defaults to
  // "All sections".
  allLabel?: string
}

// A Select-shaped trigger field that opens a real SectionTree (not a flat list) in a Popover —
// TeamForm's own Section field, replacing a flat alphabetical Select (real user feedback: two
// different sections sharing a leaf name, e.g. "U13" under both Boys and Girls, were genuinely
// indistinguishable in a flat dropdown). The closed field itself shows the full breadcrumb path
// once a value is picked (reusing sectionBreadcrumb.ts), so the same ambiguity doesn't resurface
// once the picker closes.
export function SectionTreeSelect({
  label,
  sections,
  value,
  onChange,
  error,
  helperText,
  allowClear = false,
  allLabel = 'All sections',
}: SectionTreeSelectProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    sections.forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  const selectedSection = value ? sectionsById.get(value) : undefined
  const displayValue = selectedSection
    ? [...breadcrumbFor(selectedSection, sectionsById), selectedSection.name].join(' › ')
    : allowClear
      ? allLabel
      : ''

  const handleOpen = (event: MouseEvent<HTMLDivElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setAnchorEl(event.currentTarget)
    }
  }

  return (
    <>
      <Input
        label={label}
        value={displayValue}
        error={error}
        helperText={helperText}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <ArrowDropDownIcon color="action" />
            </InputAdornment>
          ),
          sx: { cursor: 'pointer' },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1, minWidth: 280, maxWidth: 400, maxHeight: 400, overflowY: 'auto' }}>
          {allowClear && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              startIcon={<ClearIcon fontSize="small" />}
              sx={{ justifyContent: 'flex-start', mb: 1, fontWeight: value === null ? 700 : 400 }}
              onClick={() => {
                onChange(null)
                handleClose()
              }}
            >
              {allLabel}
            </Button>
          )}
          <SectionTree
            sections={sections}
            selectedId={value}
            onSelect={(sectionId) => {
              onChange(sectionId)
              handleClose()
            }}
          />
        </Box>
      </Popover>
    </>
  )
}
