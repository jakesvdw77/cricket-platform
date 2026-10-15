import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DerivedMarker } from "./DerivedMarker";

const props = {
  derived: false,
  dismissalsSay: 2,
  current: 5,
  subject: "wickets of A. Smith",
  onUse: () => undefined,
};

describe("DerivedMarker", () => {
  it('offers "Use N" when a typed figure disagrees with the dismissals, and hands the figure back on a tap', async () => {
    const onUse = vi.fn();
    render(<DerivedMarker {...props} onUse={onUse} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Use 2, wickets of A. Smith" }),
    );
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("shows nothing while the figure follows the dismissals, agrees with them, or they say nothing", () => {
    const { container, rerender } = render(
      <DerivedMarker {...props} derived />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<DerivedMarker {...props} current={2} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DerivedMarker {...props} dismissalsSay={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
