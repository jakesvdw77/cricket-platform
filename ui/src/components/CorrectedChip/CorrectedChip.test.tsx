import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CorrectedChip } from "./CorrectedChip";

describe("CorrectedChip", () => {
  it("shows the calculated figure as visible text and hands the figure back on a tap", async () => {
    const onReset = vi.fn();
    render(
      <CorrectedChip calculatedText="187" label="Runs" onReset={onReset} />,
    );
    expect(screen.getByText("calc 187")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Reset Runs to calculated" }),
    );
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("cannot be tapped while disabled", () => {
    render(
      <CorrectedChip
        calculatedText="187"
        label="Runs"
        onReset={() => undefined}
        disabled
      />,
    );
    expect(
      screen.getByRole("button", { name: "Reset Runs to calculated" }),
    ).toBeDisabled();
  });
});
