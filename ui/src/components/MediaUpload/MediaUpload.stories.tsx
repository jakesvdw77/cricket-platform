import type { Meta, StoryObj } from '@storybook/react-vite'
import { MediaUpload } from './MediaUpload'

const meta: Meta<typeof MediaUpload> = {
  title: 'Components/MediaUpload',
  component: MediaUpload,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof MediaUpload>

export const LogoEmpty: Story = {
  args: {
    label: 'Logo',
    value: null,
    onUploaded: () => undefined,
    variant: 'logo',
  },
}

export const LogoPopulated: Story = {
  args: {
    label: 'Logo',
    value: '/media/riverside-logo.png',
    onUploaded: () => undefined,
    variant: 'logo',
  },
}

export const BannerEmpty: Story = {
  args: {
    label: 'Banner',
    value: null,
    onUploaded: () => undefined,
    variant: 'banner',
  },
}

export const BannerPopulated: Story = {
  args: {
    label: 'Banner',
    value: '/media/riverside-banner.png',
    onUploaded: () => undefined,
    variant: 'banner',
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280.
export const MobileViewport: Story = {
  args: BannerPopulated.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: BannerPopulated.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: BannerPopulated.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
