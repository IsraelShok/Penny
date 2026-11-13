# Budget Studio — 2026-11-06

Implemented locally in the active Claude worktree `apple-redesign-bf746f`, which serves port 3123. The repository root is a different checkout; it was not changed.

## Included

- Responsive budget overview with a configurable leading amount, daily allowance through month end, explained forecast and explicit overspending.
- Pearl, Midnight and Glass themes; four accent palettes; spacing and side-by-side/stacked layout controls.
- Category distribution in bars, ring or table form, without double counting parent rollups.
- Live design preview with explicit save/cancel/reset. Versioned, validated browser-local preferences. Optional chart and milestone panels.
- Three monthly milestones: budget setup, transaction categorization and a user-marked review. Review marks are browser-local and scoped by workspace and month, with an undo action. Existing journey page remains the destination for broader progress.
- Existing category drilldown, budget moves, monthly selection, budget suggestions, periodic expenses and privacy hooks retained.
- Hebrew/English UI copy, keyboard focus indicators, reduced motion/transparency support.

## Validation

- TypeScript: passed.
- Vitest: 67 files, 365 tests passed, including six new checks for invalid preferences, parent rollups, overspending, leap years and historical/future-month projections.
- Production build: passed. Existing warning in `src/app/api/data/wipe/route.ts` about dynamic filesystem tracing remains outside this change.
- Browser: desktop and 390px mobile inspected. Verified theme/accent/chart persistence after reload, preview cancellation, reset, widget hiding, table rows, review completion/undo and previous-month calculations. Mobile document had no horizontal overflow.

## Scope of this first iteration

Theme, accent, menu density and motion now apply across the application, including portalled menus and dialogs. Budget metric/chart/layout options remain budget-specific. Preferences are local to the browser rather than synced to an account. Layout choices are presets; arbitrary widget dragging/resizing, personal color pickers and saved multi-layout profiles are not included. Milestones are a small opt-out progress layer, not a full achievements engine.

## Global appearance follow-up

Added a root StudioProvider, shared header editor access, appearance-settings integration, system theme support and command-palette theme synchronization. Verified home, transactions, appearance settings and the mobile navigation drawer. Production build and 365 tests passed. Fixed an existing server/client viewport mismatch in useIsMobile; TypeScript passed and a fresh mobile reload plus drawer interaction produced no new console errors.


## Product improvements — 2026-11-07
Implemented personal desktop/mobile home layouts (drag, keyboard move, width/height choices, visibility, presets and named local layouts), custom contrast-adjusted accent colors, goal focus and editable progress, a 90-day scenario planner and forecast events, balance provenance and clearer budget/cash definitions, mobile bottom navigation, and atomic bulk categorization, optional merchant memory, splits and conflict-aware undo.

Transaction allocations preserve imported charges and feed category reporting through category_transactions. Migration 036 adds allocations and reversible edit history. Undo expires after 24 hours. Preferences are local to the browser; they do not sync across devices. Widget sizing offers predefined sizes, not arbitrary pixel dimensions.

Validation: 373 tests passed; production build passed with the existing dynamic filesystem tracing warning in the wipe route. Browser verified desktop layout preset persistence, scenario arithmetic, timeline and matching next-bill totals. Final mobile and split-dialog interactive QA remains outstanding. Mutating transaction tests use an in-memory database, not user transactions.
