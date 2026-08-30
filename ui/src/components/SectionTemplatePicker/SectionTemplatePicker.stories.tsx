import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionTemplatePicker } from './SectionTemplatePicker'
import type { SectionTemplate } from './SectionTemplatePicker'

const SAMPLE_TEMPLATES: SectionTemplate[] = [
  {
    id: 'traditional',
    title: 'Traditional club',
    description: "Men's and women's open sides, boys' and girls' junior age-groups, and a vets section.",
    roots: [
      {
        name: 'Open Sides',
        children: [
          { name: 'Men', children: [{ name: '1st XI' }, { name: '2nd XI' }] },
          { name: 'Women', children: [{ name: '1st XI' }] },
        ],
      },
      {
        name: 'Juniors',
        children: [
          { name: 'Boys', children: [{ name: 'U11' }, { name: 'U13' }, { name: 'U15' }] },
          { name: 'Girls', children: [{ name: 'U13' }, { name: 'U15' }] },
        ],
      },
      { name: 'Vets', children: [{ name: 'Over 40' }, { name: 'Over 50' }] },
    ],
  },
  {
    id: 'simple',
    title: 'Simple club',
    description: 'One open-age set of teams and one junior age-ladder — no gender split.',
    roots: [
      { name: 'Open Sides', children: [{ name: '1st XI' }, { name: '2nd XI' }, { name: '3rd XI' }] },
      { name: 'Juniors', children: [{ name: 'U11' }, { name: 'U13' }, { name: 'U15' }, { name: 'U17' }] },
    ],
  },
  {
    id: 'adults-only',
    title: 'Adults only',
    description: "No junior section — just open-age and veterans' cricket.",
    roots: [
      { name: 'Open Sides', children: [{ name: '1st XI' }, { name: '2nd XI' }] },
      { name: 'Vets', children: [{ name: 'Over 40' }, { name: 'Over 50' }] },
    ],
  },
  {
    id: 'school',
    title: 'School',
    description: 'First and Second XI, plus an age-graded Colts ladder — the shape most schools use.',
    roots: [
      { name: 'First XI' },
      { name: 'Second XI' },
      { name: 'Colts', children: [{ name: 'U14' }, { name: 'U15' }, { name: 'U16' }, { name: 'U19' }] },
    ],
  },
]

const meta: Meta<typeof SectionTemplatePicker> = {
  title: 'Components/SectionTemplatePicker',
  component: SectionTemplatePicker,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SectionTemplatePicker>

export const Default: Story = {
  args: {
    templates: SAMPLE_TEMPLATES,
    onChoose: () => undefined,
    onStartBlank: () => undefined,
  },
}

export const BuildingATemplate: Story = {
  args: {
    templates: SAMPLE_TEMPLATES,
    onChoose: () => undefined,
    onStartBlank: () => undefined,
    pendingTemplateId: 'traditional',
  },
}

// docs/standards/design-system.md's Storybook rule — a viewport story at 375/768/1280.
export const MobileViewport: Story = {
  args: {
    templates: SAMPLE_TEMPLATES,
    onChoose: () => undefined,
    onStartBlank: () => undefined,
  },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: {
    templates: SAMPLE_TEMPLATES,
    onChoose: () => undefined,
    onStartBlank: () => undefined,
  },
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: {
    templates: SAMPLE_TEMPLATES,
    onChoose: () => undefined,
    onStartBlank: () => undefined,
  },
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
