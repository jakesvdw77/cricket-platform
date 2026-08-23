import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SocialLinksFields } from './SocialLinksFields'

const meta: Meta<typeof SocialLinksFields> = {
  title: 'Components/SocialLinksFields',
  component: SocialLinksFields,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 640 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SocialLinksFields>

export const Empty: Story = {
  args: {
    value: [],
    onChange: () => undefined,
  },
}

// A mix of known-platform and fully custom rows — the two cases SocialLinksFields' "Custom…"
// option exists to support, per docs/specs/022-club-social-media.md.
export const Filled: Story = {
  args: {
    value: [
      { platform: 'facebook', url: 'https://facebook.com/cricketlegend' },
      { platform: 'instagram', url: 'https://instagram.com/cricketlegend' },
      { platform: 'Discord', url: 'https://discord.gg/cricketlegend' },
    ],
    onChange: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280.
export const MobileViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
