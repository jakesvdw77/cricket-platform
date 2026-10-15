import type { Meta, StoryObj } from "@storybook/react-vite";
import { DerivedMarker } from "./DerivedMarker";

const meta: Meta<typeof DerivedMarker> = {
  title: "Components/DerivedMarker",
  component: DerivedMarker,
  args: {
    derived: false,
    dismissalsSay: 2,
    current: 5,
    subject: "wickets of A. Smith",
    onUse: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof DerivedMarker>;

export const Disagrees: Story = {};
export const Disabled: Story = { args: { disabled: true } };
