import type { Meta, StoryObj } from "@storybook/react-vite";
import { CorrectedChip } from "./CorrectedChip";

const meta: Meta<typeof CorrectedChip> = {
  title: "Components/CorrectedChip",
  component: CorrectedChip,
  args: { calculatedText: "187", label: "Runs", onReset: () => undefined },
};
export default meta;

type Story = StoryObj<typeof CorrectedChip>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
