import { useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Box, InputAdornment, Popover } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Input } from '../Input'
import { SectionTree } from '../SectionTree'
import type { Section } from '../../api/sectionApi'
import { breadcrumbFor } from '../../utils/sectionBreadcrumb'

export interface SectionTreeSelectProps {
  label: string
  sections: Section[]
  value: string | null
  onChange: (sectionId: string) => void
  error?: boolean
  helperText?: string
}

// A Select-shaped trigger field that opens a real SectionTree (not a flat list) in a Popover —
// TeamForm's own Section field, replacing a flat alphabetical Select (real user feedback: two
// different sections sharing a leaf name, e.g. "U13" under both Boys and Girls, were genuinely
// indistinguishable in a flat dropdown). The closed field itself shows the full breadcrumb path
// once a value is picked (reusing sectionBreadcrumb.ts), so the same ambiguity doesn't resurface
// once the picker closes.
export function SectionTreeSelect({ label, sections, value, onChange, error, helperText }: SectionTreeSelectProps) {
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
