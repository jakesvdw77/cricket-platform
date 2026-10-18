import { useContext } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Typography } from "@mui/material";
import { ShareFooterContext } from "./ShareFooterContext";

export interface ShareFormatScreenProps {
  // The format's heading ("WhatsApp").
  title: string;
  // The control strip: templates, include switches.
  controls: ReactNode;
  // The live preview (usually inside a SharePreviewStage).
  preview: ReactNode;
  // The buttons that deliver it. Inside ShareResultDialog they are rendered into the dialog's fixed footer (always visible,
  // the content above scrolls); on their own (Storybook, tests) they render under the controls.
  actions: ReactNode;
}

// docs/specs/114-share-result.md (Format screen anatomy): controls on the left (above the preview on a phone), preview on
// the right. The actions go to the footer slot ShareResultDialog provides through ShareFooterContext, a real DialogActions
// bar outside the scrolling content, so Share is reachable without scrolling on every screen size.
export function ShareFormatScreen({
  title,
  controls,
  preview,
  actions,
}: ShareFormatScreenProps) {
  const footer = useContext(ShareFooterContext);
  const inline = footer === undefined;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "minmax(280px, 360px) minmax(0, 1fr)",
        },
        gridTemplateAreas: inline
          ? {
              xs: '"controls" "preview" "actions"',
              md: '"controls preview" "actions preview"',
            }
          : { xs: '"controls" "preview"', md: '"controls preview"' },
        gridTemplateRows: inline ? { md: "auto 1fr" } : undefined,
        alignItems: "start",
      }}
    >
      <Box sx={{ gridArea: "controls", minWidth: 0 }}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        {controls}
      </Box>
      <Box sx={{ gridArea: "preview", minWidth: 0 }}>{preview}</Box>
      {inline && <Box sx={{ gridArea: "actions", minWidth: 0 }}>{actions}</Box>}
      {footer && createPortal(actions, footer)}
    </Box>
  );
}
