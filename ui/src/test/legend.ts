// docs/specs/082: SlotSummary draws each legend item as a word plus a separate bold count, so its text is
// split across elements. This matcher finds an item by its full text, e.g. getByText(legend('Available 2')).
export const legend = (text: string) => (_content: string, element: Element | null) =>
  element?.getAttribute('data-legend') === text
