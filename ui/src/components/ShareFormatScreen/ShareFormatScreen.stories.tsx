import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog, DialogActions, DialogContent } from "@mui/material";
import { useState } from "react";
import { Button } from "../Button";
import { SharePreviewStage } from "../SharePreviewStage";
import { ShareFooterContext } from "./ShareFooterContext";
import { ShareFormatScreen } from "./ShareFormatScreen";

const meta: Meta<typeof ShareFormatScreen> = {
  title: "Components/ShareFormatScreen",
  component: ShareFormatScreen,
  parameters: { layout: "padded" },
  args: {
    title: "WhatsApp",
    controls: <p>Template chips and include switches go here.</p>,
    preview: (
      <SharePreviewStage caption="Live preview">
        Riverside won by 5 wickets
      </SharePreviewStage>
    ),
    actions: <Button>Copy text</Button>,
  },
};
export default meta;

type Story = StoryObj<typeof ShareFormatScreen>;

export const Default: Story = {};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: "tablet" } },
};
export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: "desktop" } },
};

// As ShareResultDialog uses it: the actions sit in a fixed footer under a scrolling content area.
export const InDialogFooter: Story = {
  render: (args) => {
    const Host = () => {
      const [footer, setFooter] = useState<HTMLElement | null>(null);
      return (
        <Dialog open fullWidth maxWidth="lg">
          <DialogContent>
            <ShareFooterContext.Provider value={footer}>
              <ShareFormatScreen
                {...args}
                controls={
                  <div style={{ height: 900 }}>Long list of controls</div>
                }
              />
            </ShareFooterContext.Provider>
          </DialogContent>
          <DialogActions
            sx={{
              display: "block",
              px: 3,
              py: 1.5,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <div ref={setFooter} />
          </DialogActions>
        </Dialog>
      );
    };
    return <Host />;
  },
};
