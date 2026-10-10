import type { ReactNode } from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

export interface LeagueEditPanelProps {
  icon: ReactNode
  // "Contacts · 3": the heading, with its count.
  title: string
  // Quiet secondary text under the heading; on a phone it becomes an info icon with a tooltip carrying the same text.
  caption?: string
  // Header buttons, right-aligned (the panel's one filled button, plus any outlined ones).
  actions?: ReactNode
  testId?: string
  ariaLabel?: string
  children?: ReactNode
}

// docs/specs/095-league-edit-gold-standard.md: the bordered panel every tab of Edit League shares. The InfoCard heading look
// (32 px solid icon tile, uppercase heading with the count), header actions on the right, and a flush body below.
export function LeagueEditPanel({ icon, title, caption, actions, testId, ariaLabel, children }: LeagueEditPanelProps) {
  return (
    <Box
      component="section"
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, overflow: 'clip' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, p: { xs: 1.5, md: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="subtitle2"
                component="h2"
                sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem' }}
              >
                {title}
              </Typography>
              {caption && (
                <Tooltip title={caption} enterTouchDelay={0}>
                  <Box
                    component="span"
                    role="img"
                    aria-label={caption}
                    tabIndex={0}
                    data-testid="panel-caption-info"
                    sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'text.secondary' }}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </Box>
                </Tooltip>
              )}
            </Box>
            {caption && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {caption}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 'none' }}>{actions}</Box>}
      </Box>
      {children}
    </Box>
  )
}
