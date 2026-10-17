import { createContext } from "react";

// The dialog's footer element. undefined: no dialog around (Storybook, tests), so the actions render inline.
// null: the dialog has a footer that has not mounted yet, so the actions wait for it.
export const ShareFooterContext = createContext<HTMLElement | null | undefined>(
  undefined,
);
