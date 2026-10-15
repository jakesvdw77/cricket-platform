import { ButtonBase, Tooltip } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

// docs/specs/101-match-results-our-side-scorecard.md: shown right under a figure the manager edited away from what the
// scorecard (or the scores) calculate. The visible "calc N" carries the state on touch; the tooltip is the extra for hover: a compact one-line "calc 187" text button with a reset icon that hands the figure back.
export function CorrectedChip({
  calculatedText,
  onReset,
  disabled,
  label,
}: {
  calculatedText: string;
  onReset: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Tooltip
      title={`Edited. Calculated: ${calculatedText}. Tap to reset.`}
      describeChild
    >
      <ButtonBase
        disabled={disabled}
        onClick={onReset}
        aria-label={`Reset ${label} to calculated`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.25,
          minHeight: { xs: 44, sm: 18 },
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "warning.dark",
          whiteSpace: "nowrap",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
        }}
      >
        <RestartAltIcon sx={{ fontSize: 13 }} />
        calc {calculatedText}
      </ButtonBase>
    </Tooltip>
  );
}
