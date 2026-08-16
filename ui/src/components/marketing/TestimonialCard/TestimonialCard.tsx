import { Avatar, Box, Stack, Typography } from '@mui/material'
import { Card } from '../../Card'

export interface TestimonialCardProps {
  quote: string
  name: string
  role: string
  avatarUrl?: string
}

export function TestimonialCard({ quote, name, role, avatarUrl }: TestimonialCardProps) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Card>
      <Box sx={{ position: 'relative', pl: '18px', mb: 2 }}>
        <Typography
          component="span"
          aria-hidden
          sx={{
            position: 'absolute',
            left: -4,
            top: -6,
            fontSize: '2rem',
            lineHeight: 1,
            color: 'primary.main',
            fontFamily: 'Georgia, serif',
          }}
        >
          &ldquo;
        </Typography>
        <Typography variant="body2">{quote}</Typography>
      </Box>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar
          src={avatarUrl}
          sx={{
            width: 36,
            height: 36,
            fontSize: '0.8125rem',
            fontWeight: 600,
            ...(!avatarUrl && { bgcolor: 'primary.main', color: 'primary.contrastText' }),
          }}
        >
          {!avatarUrl && initials}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" component="div" sx={{ lineHeight: 1.3 }}>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.3 }}>
            {role}
          </Typography>
        </Box>
      </Stack>
    </Card>
  )
}
