import { useContext } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Typography } from "@mui/material";
import { ShareFooterContext } from "./ShareFooterContext";
import { ShareFillContext } from "./ShareFillContext";

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
  const fill = useContext(ShareFillContext) && !inline;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: fill
          ? {
              xs: "minmax(0, 1fr)",
              sm: "minmax(220px, 320px) minmax(0, 1fr)",
              md: "minmax(280px, 360px) minmax(0, 1fr)",
            }
          : {
              xs: "minmax(0, 1fr)",
              md: "minmax(280px, 360px) minmax(0, 1fr)",
            },
        gridTemplateAreas: inline
          ? {
              xs: '"controls" "preview" "actions"',
              md: '"controls preview" "actions preview"',
            }
          : fill
            ? { xs: '"controls" "preview"', sm: '"controls preview"' }
            : { xs: '"controls" "preview"', md: '"controls preview"' },
        gridTemplateRows: inline
          ? { md: "auto 1fr" }
          : fill
            ? { sm: "minmax(0, 1fr)" }
            : undefined,
        alignItems: fill ? { xs: "start", sm: "stretch" } : "start",
        // Filling: the grid takes the height the dialog gives it and never grows past it.
        ...(fill ? { flex: { sm: 1 }, minHeight: { sm: 0 }, minWidth: 0 } : {}),
      }}
    >
      <Box
        sx={{
          gridArea: "controls",
          minWidth: 0,
          ...(fill ? { minHeight: { sm: 0 }, overflowY: { sm: "auto" }, overflowX: "hidden" } : {}),
        }}
      >
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        {controls}
      </Box>
      <Box
        sx={{
          gridArea: "preview",
          minWidth: 0,
          ...(fill ? { minHeight: { sm: 0 }, display: { sm: "flex" }, flexDirection: "column" } : {}),
        }}
      >
        {preview}
      </Box>
      {inline && <Box sx={{ gridArea: "actions", minWidth: 0 }}>{actions}</Box>}
      {footer && createPortal(actions, footer)}
    </Box>
  );
}
