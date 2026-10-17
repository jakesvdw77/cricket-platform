import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareFooterContext } from "./ShareFooterContext";
import { ShareFormatScreen } from "./ShareFormatScreen";

describe("ShareFormatScreen", () => {
  it("shows the title, the controls, the preview and the actions", () => {
    render(
      <ShareFormatScreen
        title="WhatsApp"
        controls={<p>Controls here</p>}
        preview={<p>Preview here</p>}
        actions={<button type="button">Copy text</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "WhatsApp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Controls here")).toBeInTheDocument();
    expect(screen.getByText("Preview here")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy text" }),
    ).toBeInTheDocument();
  });

  it("renders the actions into the dialog footer when one is provided, and not in the screen", () => {
    function Host() {
      const [footer, setFooter] = useState<HTMLElement | null>(null);
      return (
        <ShareFooterContext.Provider value={footer}>
          <div data-testid="body">
            <ShareFormatScreen
              title="PDF"
              controls={<p>c</p>}
              preview={<p>p</p>}
              actions={<button type="button">Print</button>}
            />
          </div>
          <footer ref={setFooter} data-testid="footer" />
        </ShareFooterContext.Provider>
      );
    }
    render(<Host />);

    expect(
      within(screen.getByTestId("footer")).getByRole("button", {
        name: "Print",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("body")).queryByRole("button", {
        name: "Print",
      }),
    ).not.toBeInTheDocument();
  });
});
