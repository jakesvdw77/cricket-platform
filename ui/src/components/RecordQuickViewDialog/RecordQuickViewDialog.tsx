import type { ReactNode } from 'react'
import {
  Avatar,
  Box,
  Button as MuiButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../Button'

export interface RecordQuickViewDialogField {
  icon: ReactNode
  label: string
  value: ReactNode
}

export interface RecordQuickViewDialogAvatar {
  imageUrl?: string | null
  fallback: ReactNode
  shape: 'circular' | 'rounded'
}

export interface RecordQuickViewDialogProps {
  open: boolean
  onClose: () => void
  avatar: RecordQuickViewDialogAvatar
  title: string
  subtitle?: string
  fields: RecordQuickViewDialogField[]
  editTo: string
  editLabel?: string
}

// docs/specs/056-club-profile-overview.md's first, deliberately generic shared dialog — a small
// "quick look at a record" popup, structurally mirroring TeamSheetCommunicationDialog.tsx's own
// real Dialog/DialogTitle/DialogContent/DialogActions boilerplate (fullWidth maxWidth="xs"), not
// its content. Every existing *Dialog component in this codebase builds MUI's primitives directly
// (no shared wrapper existed before this one) — this is the first, meant to be reused by any
// future "small record, quick look" need rather than a seventh one-off. Fields render as plain
// icon+label+value rows, visually consistent with RecordDetailScreen's own DetailFieldRow, but
// this component stays free of RecordDetailScreen's DetailFieldGrid machinery (a full section
// layout) since it's always a small, fixed-width dialog. The caller supplies the avatar/title/
// subtitle/fields itself — this component has no knowledge of ClubContact/Sponsor (or any other
// record) shape.
export function RecordQuickViewDialog({
  open,
  onClose,
  avatar,
  title,
  subtitle,
  fields,
  editTo,
  editLabel = 'Edit',
}: RecordQuickViewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            src={avatar.imageUrl ?? undefined}
            variant={avatar.shape === 'rounded' ? 'rounded' : 'circular'}
            sx={{
              width: 48,
              height: 48,
              flex: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
              color: 'primary.dark',
            }}
          >
            {avatar.fallback}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {fields.map((field, index) => (
            <Stack key={index} direction="row" spacing={1.25} alignItems="flex-start">
              <Box
                sx={{
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  pt: 0.25,
                  flex: 'none',
                  '& svg': { fontSize: 19 },
                }}
              >
                {field.icon}
              </Box>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {field.label}
                </Typography>
                <Typography variant="body2" fontWeight={600} component="div">
                  {field.value}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <MuiButton component={RouterLink} to={editTo} variant="contained">
          {editLabel}
        </MuiButton>
      </DialogActions>
    </Dialog>
  )
}
