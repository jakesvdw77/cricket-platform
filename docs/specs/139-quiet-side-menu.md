# 139: Quiet side menu

**Status:** built and reviewed by the owner in the running app, 2026-11-04. The owner found the 36% icon tile behind each menu icon irritating after living with it and asked for a quieter menu; a second opinion (pasted by the owner) was folded in. Frontend only.
**Depends on:** `079`, `120` (the chrome), `078` (brand icons).

## Problem & Goals
Fifteen identical tiles made every item look like its own button, the active row (olive tint with a cream ring) read like a focus ring or an error, and the large bold caps made the menu as loud as the page. Make navigation quieter than content without losing the icons or the clear "you are here".

## Non-goals
No change to the menu's items, routes, badges or the phone bottom bar and Menu sheet (they keep their tiles). No new icon set: a two-tone variant of the nav icons was considered and not built because the ghost tile solved the dark-artwork problem.

## UI Requirements
- **Icons:** 28 px straight on the dark green, on a faint cream ghost tile (6%, no ring), because dark-green parts of the artwork (Leaderboards, Players, Fields) vanish with no tile at all. `ghost={false}` draws them bare.
- **Rows:** 44 px, 14 px display-face labels, cream at 75% when inactive; hover lifts the label to full cream, tints the row and brightens the tile to 14%.
- **Active:** a lighter green row (`chrome.activeRow`), a 3 px gold bar on its left, gold bold text, `aria-current="page"` (never colour alone).
- **Collapse:** from `lg` a control at the top switches between the full menu and the 64 px icon rail (tooltip and `aria-label` per item, badges as dots). Open by default; remembered per browser in `localStorage` (`shell:sideMenuCollapsed`) with a safe fallback when storage is unavailable. From `md` to `lg` the menu is a rail without the control.
- **Tokens:** `CHROME.activeRow`, `inactiveText`, `ghostTile` in `brandTokens.ts` (the one place raw colour lives), typed in `ChromePalette`.
- `look="classic"` keeps the `120` look (tile with cream ring, gold tint) for comparison and rollback.

## Test Plan
`SideMenu.test.tsx` (classic and quiet looks, ghost on and off, active row, collapse control and its state), `useSideMenuCollapsed.test.ts` (default open, remembered, storage unavailable), stories for each look and side by side. Not run: Playwright.

## Acceptance Criteria
1. The side menu shows icons on a faint tile with no ring, 44 px rows and quieter labels; the active row has a gold bar and gold text.
2. Hover changes the row, the label and the tile.
3. A user can collapse and expand the menu from `lg`; it starts open and remembers the choice.
4. Menu items, routes and badges behave as before.
