import type { Meta, StoryObj } from '@storybook/react-vite'
import { GuessChip } from './GuessChip'

const meta: Meta<typeof GuessChip> = {
  title: 'Components/GuessChip',
  component: GuessChip,
  args: {
    importedName: 'Hari K',
    level: 'NORMALISED',
    matchedName: 'Hari Konduru',
    reason: 'by the start of the surname',
    onConfirm: () => undefined,
    onChange: () => undefined,
  },
}
export default meta

type Story = StoryObj<typeof GuessChip>

// A rule-based guess: tap the chip for the popover with Confirm and Change.
export const Guess: Story = {}

// A reserved level (a later tier); drawn like a guess.
export const Suggested: Story = { args: { level: 'AI_SUGGESTED' } }

// No name matched: a Guest chip, and tapping it goes straight to the picker.
export const Unresolved: Story = { args: { level: 'UNRESOLVED', importedName: 'Dihandre V', matchedName: null } }

export const Disabled: Story = { args: { disabled: true } }
