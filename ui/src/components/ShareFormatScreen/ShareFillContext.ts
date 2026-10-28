import { createContext } from "react";

// True when the dialog around gives the format screen a fixed height (a desktop-sized ShareLeagueDialog): the screen then
// fills it, the controls scroll on their own and the preview stage fits the page to both width and height. Absent or false
// (ShareResultDialog, Storybook, a phone), the screen takes its natural height inside one scrolling content area.
export const ShareFillContext = createContext<boolean>(false);
