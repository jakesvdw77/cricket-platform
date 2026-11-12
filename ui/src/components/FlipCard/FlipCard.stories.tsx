import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY } from '../../brandTokens'
import { FlipCard, useFaceTabIndex } from './FlipCard'

// docs/specs/147 section 4: the shared flip card on the dark console ground. Tap or press Enter / Space to flip; both faces stay readable.
const faceSx = {
  p: 2.5,
  borderRadius: '22px',
  border: `1px solid ${alpha(BRAND.cream, 0.14)}`,
  bgcolor: BRAND.green900,
  color: BRAND.cream,
  display: 'grid',
  gap: 1,
  alignContent: 'start',
  minHeight: 160,
} as const

function DrillLink({ children }: { children: string }) {
  const tabIndex = useFaceTabIndex()
  return (
    <a href="#drill" tabIndex={tabIndex} style={{ color: BRAND.gold }}>
      {children}
    </a>
  )
}

const Front = ({ long = false }: { long?: boolean }) => (
  <Box sx={faceSx}>
    <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 56, lineHeight: 0.9, fontWeight: 700 }}>412</Typography>
    <Typography>{long ? 'Runs in 9 innings. A long line of text to prove the card grows with its content rather than clipping at a fixed height, even at two hundred percent text zoom.' : 'Runs in 9 innings'}</Typography>
    <DrillLink>See the innings</DrillLink>
  </Box>
)
const Back = () => (
  <Box sx={faceSx}>
    <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 22 }}>The story behind it</Typography>
    <Typography>Last 5 average 61.4, up from 48.0 earlier.</Typography>
    <DrillLink>Open the table</DrillLink>
  </Box>
)

const meta: Meta<typeof FlipCard> = {
  title: 'Components/FlipCard',
  component: FlipCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, padding: 16, background: BRAND.ink }}>
        <Story />
      </div>
    ),
  ],
  args: { label: 'Season in a card', front: <Front />, back: <Back /> },
}
export default meta

type Story = StoryObj<typeof FlipCard>

export const FrontShowing: Story = {}
export const BackShowing: Story = { args: { defaultFlipped: true } }
export const LongContent: Story = { args: { front: <Front long /> } }
// Under prefers-reduced-motion: reduce the card cross-fades in 150 ms instead of rotating; switch the OS setting to see it.
export const ReducedMotionNote: Story = { args: { label: 'Reduced motion check' } }
