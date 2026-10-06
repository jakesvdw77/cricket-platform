import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, ThemeProvider, Typography } from '@mui/material'
import { withClubBranding } from '../../theme'
import { BrandIcon } from './BrandIcon'
import { BRAND_ICON_NAMES } from './brandIcons'

const meta: Meta<typeof BrandIcon> = {
  title: 'Components/BrandIcon',
  component: BrandIcon,
}
export default meta

type Story = StoryObj<typeof BrandIcon>

export const Default: Story = { args: { name: 'nav/teams', size: 40 } }

export const NoSurface: Story = { args: { name: 'nav/teams', size: 40, surface: 'none' } }

export const Active: Story = { args: { name: 'nav/teams', size: 40, active: true } }

export const ClubColours: Story = {
  render: () => (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {['#0f5132', '#e0b53a', '#0b2a5b'].map((colour) => (
        <ThemeProvider key={colour} theme={withClubBranding(colour)}>
          <Box sx={{ display: 'flex', gap: 1, p: 1, bgcolor: 'background.paper' }}>
            <BrandIcon name="nav/teams" />
            <BrandIcon name="roles/captain" size={28} padding={3} />
            <BrandIcon name="nav/squads" active />
          </Box>
        </ThemeProvider>
      ))}
    </Box>
  ),
}

const groups = Array.from(new Set(BRAND_ICON_NAMES.map((name) => name.split('/')[0])))

export const AllIcons: Story = {
  render: () => (
    <Box>
      {groups.map((group) => (
        <Box key={group} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {group}
          </Typography>
          {BRAND_ICON_NAMES.filter((name) => name.startsWith(`${group}/`)).map((name) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <BrandIcon name={name} size={24} />
              <BrandIcon name={name} size={32} />
              <BrandIcon name={name} size={48} />
              <Typography variant="body2">{name}</Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  ),
}
