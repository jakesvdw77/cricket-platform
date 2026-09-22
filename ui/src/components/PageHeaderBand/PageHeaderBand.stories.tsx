import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar, Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import { ThemeProvider, alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { PageHeaderBand } from './PageHeaderBand'
import { withClubBranding } from '../../theme'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally, same precedent as RecordFormScreen.stories.tsx/RecordDetailScreen.stories.tsx.
const meta: Meta<typeof PageHeaderBand> = {
  title: 'Components/PageHeaderBand',
  component: PageHeaderBand,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PageHeaderBand>

// Representative markup resembling RecordDetailScreen's own header content — a back link plus an
// avatar/title/badge/Edit row — to demonstrate the band's chrome the way it actually gets used.
const sampleHeaderContent = (
  <>
    <MuiButton
      variant="text"
      color="inherit"
      size="small"
      startIcon={<ArrowBackIcon fontSize="small" />}
      sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
    >
      Back to Matches
    </MuiButton>
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar
          variant="rounded"
          sx={{ width: 56, height: 56, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14), color: 'primary.dark' }}
        >
          M
        </Avatar>
        <Stack spacing={0.5}>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
            1st XI vs 2nd XI
          </Typography>
          <Chip size="small" label="Upcoming" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        </Stack>
      </Stack>
      <MuiButton variant="outlined" startIcon={<EditOutlinedIcon fontSize="small" />}>
        Edit
      </MuiButton>
    </Stack>
  </>
)

export const Default: Story = {
  args: {
    children: sampleHeaderContent,
  },
  render: (args) => (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'grey.100' }}>
      <PageHeaderBand {...args} />
    </Box>
  ),
}

// Demonstrates the one club-colour-dependent element in the whole component — the 3px top accent
// bar re-tints via withClubBranding(), everything else in the band stays flat white regardless.
export const WithClubBranding: Story = {
  args: {
    children: sampleHeaderContent,
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={withClubBranding('#e8d96a')}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: (args) => (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'grey.100' }}>
      <PageHeaderBand {...args} />
    </Box>
  ),
}
