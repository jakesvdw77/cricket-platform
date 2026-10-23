import { useId } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { compactButtonSx } from '../Button'

export interface CollapsibleSectionProps {
  // the section heading (an h2): "Batting", "Overview"
  title: string
  // a short line beside the title; the section's aria-describedby
  description?: ReactNode
  open: boolean
  onToggle: () => void
  // the noun in the button: "Hide batting" / "Show batting"; defaults to the lowercased title
  label?: string
  // used in data-testid values: the section is `<testId>`, its button `<testId>-toggle`
  testId: string
  buttonVariant?: 'text' | 'outlined'
  // rendered only while open, so a collapsed section costs nothing (no chart chunk, no request)
  children?: ReactNode
}

// A titled section with a Hide / Show control: a header row (the title as a heading, a 44 px button with aria-expanded and aria-controls
// and an icon that follows the state), then the content, which is not rendered while collapsed. State is the caller's, so it can decide
// what to fetch. Presentational; every string comes from the caller.
export function CollapsibleSection({ title, description, open, onToggle, label, testId, buttonVariant = 'text', children }: CollapsibleSectionProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const contentId = `${id}-content`
  const noun = label ?? title.toLowerCase()
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography component="h2" id={titleId} sx={{ fontSize: '1rem', fontWeight: 700 }}>
            {title}
          </Typography>
          {description && (
            <Typography id={descriptionId} sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {description}
            </Typography>
          )}
        </Box>
        <MuiButton
          variant={buttonVariant}
          size="small"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          data-testid={`${testId}-toggle`}
          startIcon={open ? <ExpandLessIcon aria-hidden /> : <ExpandMoreIcon aria-hidden />}
          sx={{ ...compactButtonSx, flex: 'none' }}
        >
          {open ? `Hide ${noun}` : `Show ${noun}`}
        </MuiButton>
      </Box>
      <Box id={contentId} hidden={!open} sx={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 1 }}>
        {open && children}
      </Box>
    </Box>
  )
}
