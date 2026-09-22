# `src/styles.css` — Source-to-Style Code Map

This document is the code-facing companion to `docs/STYLESHEET.md`. It focuses on one question: **which source files and UI sections depend on which parts of `src/styles.css`**, and how the styles are consumed in practice.

The goal is not to list every selector, but to make the dependency flow readable for maintenance, refactoring, and future component work.

---

## 1. How to read this map

`sources/styles.css` is a shared global stylesheet. Components do not import it per file; instead the app shell and panels rely on its classes. That means the important relationship is not “file imports style” but “component markup expects these class names and structures.”

So this document is organized by:

- source file / UI section
- the layer of `styles.css` it primarily uses
- the specific class families involved
- what the styles are actually doing for that component

---

## 2. Root layout: `App.tsx`

`App.tsx` owns the outermost UI shell. It does not render game panel details, but it sets up the layer structure everything else sits on.

### 2.1 What it relies on

- `.app-root`
- `.game-canvas`
- `.panel-layer`
- `.ui-scale-wrapper`

### 2.2 What these styles provide

- `.app-root` is the full-size container with hidden overflow
- `.game-canvas` is the base canvas layer, full inset, `z-index: 0`
- `.panel-layer` is the React overlay layer with `pointer-events: none` on the container and `pointer-events: auto` on children
- `.ui-scale-wrapper` is the centering/scaling wrapper used for panels

### 2.3 Why this matters

`App.tsx` does not own visual details like colors or button styling. It depends on `styles.css` for the **positioning model, z-index layering, and pointer-event model**. If those rules change, the entire UI overlay behavior can change even if no component markup changes.

So the app shell is the primary consumer of the layout/layer primitives at the top of the stylesheet.

---

## 3. Panel routing: `Panels.tsx`

`Panels.tsx` is the central panel hub. It decides which panel renders based on the current panel key and renders it inside the overlay layer.

### 3.1 What it relies on

- `.panel-layer`
- `.panel-wrap` structure and the close button pattern
- shared button classes for panel actions
- shared toast classes for system messages
- shared glass/gold UI tone used across panels

### 3.2 What these styles provide

- overlay placement for all in-game panels
- a common container context for panels to live in
- the baseline interaction model: panels are part of the React UI tree, not the Phaser canvas

### 3.3 Panel cases inside `Panels.tsx`

`Panels.tsx` itself does not fully style each panel. Instead it delegates to panel components that reuse the global stylesheet’s primitives:

- inventory panel
- crafting panel
- skills panel
- build panel
- kingdom panel
- map panel
- journal panel
- character panel
- trade panel
- pause panel
- save/load panel

Each of those panels may define its own specialized classes, but they still sit on top of the same shared UI language in `styles.css`, especially for:

- buttons
- glass surfaces
- pill styles
- generic layout tone
- toast presentation

### 3.4 Practical implication

If you are changing global control styling, `Panels.tsx` is not the only consumer, but it is the point where many panel flows converge. That makes it a good place to verify that a global style change does not break multiple unrelated panels at once.

---

## 4. Settings: `SettingsPanel.tsx`

`SettingsPanel.tsx` is the single largest and most direct consumer of the settings section in `styles.css`. Almost every part of that stylesheet section exists to serve this component.

### 4.1 Panel frame

Uses:

- `.settings-panel`
- `.settings-header`
- `.settings-title` (via the header’s `<h2>`)
- `.settings-mute`
- `.settings-back`

These classes give the panel its card frame, title bar, scrollable body, and placement of reset/mute/back actions.

### 4.2 Group structure

Uses:

- `.setting-group`
- `.setting-group-head`
- `.setting-hint`

These support the sectioned layout: Audio, Video & Quality, Accessibility, Gameplay, Controls.

### 4.3 Rows and labels

Uses:

- `.setting-row`
- `.setting-row-text`
- `.setting-label`
- `.setting-row-hint`
- `.setting-row-control`

This is how each setting line is built: label column plus control column.

### 4.4 Toggle switch

Uses:

- `.setting-toggle`
- `.setting-toggle-text`
- `.setting-toggle-switch`
- `.setting-toggle-knob`
- `.setting-toggle-switch.on`

This implements the checkbox-backed modern toggle used for things like Music enabled, SFX enabled, Screen shake, Reduced motion, etc.

### 4.5 ON/OFF button

Uses:

- `.setting-onoff`
- `.setting-onoff-track`
- `.setting-onoff-knob`
- `.setting-onoff-label`
- `.setting-onoff.on`
- `.setting-onoff.danger`
- `.setting-onoff.danger.on`

This is used for god-mode style flags where the control should be a real button instead of a checkbox-style toggle.

### 4.6 Slider

Uses:

- `.setting-slider`
- the range input styling inside it
- `.setting-slider-readout`

This covers volume, zoom, UI scale, text size, autosave interval, and similar numeric controls.

### 4.7 Pill segmented control

Uses:

- `.setting-pills`
- `.setting-pill`
- `.setting-pill.active`

This is used for short discrete option sets like graphics quality, particles, FPS cap, difficulty, movement scheme.

### 4.8 Test-only warning box

Uses:

- `.setting-test-flag`

This flags gameplay-debug options such as immortal mode.

### 4.9 Keybindings block

Uses:

- `.settings-keybinds`
- `.settings-keybinds-title`
- `.keybind-cap`
- `.keybind-cap.capturing`
- `.keybind-cap kbd`
- the grid/list structure inside `.settings-keybinds`

This gives key rebinding its own compact list look.

### 4.10 Button usage inside settings

`SettingsPanel.tsx` also uses generic buttons:

- `.btn`
- `.btn-small`
- `.btn-ghost`

Those connect settings behavior to the same button language used elsewhere in the UI.

### 4.11 Why this is the anchor section

If the settings section of `styles.css` were removed, `SettingsPanel.tsx` would lose most of its visual structure. Conversely, if you want to understand why a settings control looks the way it does, the fastest path is usually this component plus the corresponding stylesheet block.

---

## 5. HUD: HUD component tree

The HUD is not a single file in this map; it is a UI region that consumes the HUD-related rules in `styles.css`.

### 5.1 Container

Uses:

- `.hud-root`
- `.hud-top`
- `.hud-bottom`

These establish the HUD as a full-screen overlay strip with top and bottom chrome.

### 5.2 Vitals

Uses:

- `.stat-row`
- `.stat-row > span`
- `.stat-fill`
- `.hp .stat-fill`, `.stam .stat-fill`, `.food .stat-fill`, `.water .stat-fill`

This is the status-bar language for HP, stamina, food, water.

### 5.3 Level and XP

Uses:

- `.level-pill`
- `.xp-bar`
- `.xp-fill`

These provide level display and XP progress.

### 5.4 Resource pill and ambience text

Uses:

- `.resource-pill`
- `.ambience`

These support small informational UI bits in the HUD.

### 5.5 Hotbar

Uses:

- `.hotbar`
- `.hotbar-btn`
- `.hotbar-btn.on`
- `.hotbar-btn:hover:not(.on)`
- `.hb-key`

This is the active-ability/item slot bar.

### 5.6 Footer pills

Uses:

- `.hud-footer`
- `.diff-pill`
- `.stage-pill`
- `.rep-pill`

These provide small state pills for difficulty, stage, and reputation.

### 5.7 Implication

The HUD is mostly styled through shared chrome rules rather than independent component styles. That means HUD visuals change when the shared HUD section changes, not when each HUD subcomponent changes.

---

## 6. Toasts: Toasts component

The toasts component is a direct consumer of the toast section.

### 6.1 Container

Uses:

- `.toasts`

### 6.2 Card

Uses:

- `.toast`
- `.toast-info`, `.toast-warn`, `.toast-quest`, `.toast-story`, `.toast-stage`, `.toast-discover`, `.toast-achieve`, `.toast-skill`, `.toast-danger`
- `.toast-title`
- `.toast-msg`
- `.toast-icon`

### 6.3 What this means

Toast look, entrance animation, badge color by kind, and typography are all controlled here. New notification types should usually extend this class family rather than invent new unrelated toast styles.

---

## 7. Menu and save/load UI: menu + save components

Menu-screen components use the menu and save-slot styles.

### 7.1 Menu root

Uses:

- `.menu-root`

This is the full-screen cinematic menu overlay.

### 7.2 Title block

Uses:

- `.menu-title-wrap`
- `.menu-title`
- `.menu-subtitle`

This controls the main title presentation and entrance animation.

### 7.3 Menu buttons

Uses:

- `.menu-panel`
- `.btn-menu`

This controls the animated menu entry list.

### 7.4 Difficulty selector

Uses:

- `.menu-difficulty`
- `.menu-difficulty select`
- `.menu-difficulty select:focus`

This styles the difficulty dropdown.

### 7.5 Save slot

Uses:

- `.save-slot`
- `.save-slot:hover`

This styles save/load list entries and similar clickable rows.

### 7.6 Why this is separate from settings

Menu styles live in the same file but are structurally separate from the settings section. They are more cinematic and less “app-like.” That separation is useful: menu can evolve its entrance, title glow, and layout without dragging settings along.

---

## 8. Button primitives: shared across many files

Buttons are a cross-cutting style family.

### 8.1 Primary button

Uses:

- `.btn`
- `.btn::before`
- `.btn:hover::before`
- `.btn:hover`
- `.btn:active`
- `.btn:disabled`
- `.btn:disabled:hover`

### 8.2 Gold button

Uses:

- `.btn-gold`
- `.btn-gold:hover`

### 8.3 Small button

Uses:

- `.btn-small`

### 8.4 Ghost button

Uses:

- `.btn-ghost`
- `.btn-ghost:hover`
- `.btn-ghost:active`

### 8.5 Where these are used

These classes are consumed by:

- `SettingsPanel.tsx`
- `Panels.tsx` and its panel children
- menu components
- save/load UI
- likely other inline action buttons across the UI layer

The point is that button styling is not owned by one component. It is a shared primitive that makes actions look consistent across settings, panels, and menu.

---

## 9. Overlay and canvas model: app shell + panel layer

This is the most architectural part of the stylesheet.

### 9.1 Classes involved

- `.app-root`
- `.game-canvas`
- `.panel-layer`
- `.panel-layer > *`
- `.ui-scale-wrapper`
- `.panel`

### 9.2 What they do together

- `.app-root` is the outer app container
- `.game-canvas` holds the Phaser canvas
- `.panel-layer` holds React UI overlays
- `.panel-layer > *` re-enables pointer events on overlay children
- `.ui-scale-wrapper` prepares scaled/centered panel rendering
- `.panel` sets transform origin for predictable scaling

### 9.3 Source-file dependency

This model is consumed primarily by:

- `App.tsx` for the shell
- panel system components for overlay rendering
- any component that must float above the game canvas

If you change z-index, pointer-events, or positioning here, you are changing the entire UI overlay contract, not just a visual detail.

---

## 10. Vendor/control-styling dependencies

Some parts of the stylesheet exist mainly to make browser controls match the theme.

### 10.1 Scrollbars

Uses custom scrollbar styling on `.settings-panel`.

This affects settings scrolling behavior visually.

### 10.2 Range inputs

Uses webkit range-input reset and thumb styling inside `.setting-slider`.

This affects slider appearance in settings.

### 10.3 Focus-visible

Uses `:focus-visible` rules on interactive controls.

This affects keyboard accessibility styling for toggles, pills, keybind caps, sliders, and similar controls.

---

## 11. Class-family dependency summary

### 11.1 Layout and layer classes

Main consumers:

- `App.tsx`
- panel overlay system
- any top-level UI tree rendered inside `.panel-layer`

Key classes:

- `.app-root`
- `.game-canvas`
- `.panel-layer`
- `.ui-scale-wrapper`
- `.panel`
- `.hud-root`
- `.hud-top`
- `.hud-bottom`

### 11.2 HUD classes

Main consumers:

- HUD components

Key classes:

- `.stat-row`, `.stat-fill`
- `.level-pill`
- `.xp-bar`, `.xp-fill`
- `.resource-pill`
- `.hotbar`, `.hotbar-btn`, `.hb-key`
- `.hud-footer`, `.diff-pill`, `.stage-pill`, `.rep-pill`

### 11.3 Toast classes

Main consumer:

- Toasts component

Key classes:

- `.toasts`
- `.toast`, `.toast-*`
- `.toast-title`, `.toast-msg`, `.toast-icon`

### 11.4 Settings classes

Main consumer:

- `SettingsPanel.tsx`

Key classes:

- `.settings-panel`, `.settings-header`, `.settings-title`
- `.setting-group`, `.setting-group-head`, `.setting-hint`
- `.setting-row`, `.setting-label`, `.setting-row-hint`, `.setting-row-control`
- `.setting-toggle*`, `.setting-onoff*`, `.setting-slider*`
- `.setting-pills`, `.setting-pill`
- `.setting-test-flag`
- `.settings-keybinds*`
- `.settings-mute`, `.settings-back`

### 11.5 Button classes

Main consumers:

- many components across settings, panels, menu, save UI

Key classes:

- `.btn`, `.btn-gold`, `.btn-small`, `.btn-ghost`, `.btn-menu`

### 11.6 Menu/save classes

Main consumers:

- menu components
- save/load UI

Key classes:

- `.menu-root`
- `.menu-title-wrap`, `.menu-title`, `.menu-subtitle`
- `.menu-panel`, `.btn-menu`
- `.menu-difficulty`, `.save-slot`

---

## 12. How changes propagate

Because the stylesheet is shared, a change rarely affects only one file. Typical propagation is:

- **token change** → affects everything using that token
- **primitive change** → affects multiple components using that control type
- **section change** → affects the main consumers of that section
- **layout/layer change** → can affect the whole overlay model

So the safest way to reason about a change is by class family, not by file. For example:

- changing `.btn` affects many consumers
- changing `.setting-slider` mainly affects `SettingsPanel.tsx`
- changing `.panel-layer` affects the whole overlay system

---

## 13. Maintenance map

If you are looking for where to work next, use this shortcut:

- **UI chrome or z-index issues** → look at `.app-root`, `.game-canvas`, `.panel-layer`
- **HUD issues** → look at `.hud-root`, `.stat-row`, `.hotbar`, `.hud-footer`
- **notification issues** → look at `.toasts` and `.toast-*`
- **settings look and controls** → look at `SettingsPanel.tsx` plus the settings block
- **action button consistency** → look at `.btn` and its variants
- **menu feel** → look at `.menu-root`, `.menu-title-*`, `.btn-menu`

That makes the file easier to navigate without reading it top to bottom every time.

---

## 14. Quick reference: file/section → main style dependencies

- `App.tsx` → `.app-root`, `.game-canvas`, `.panel-layer`, `.ui-scale-wrapper`
- panel system / `Panels.tsx` → `.panel-layer`, shared button/glass/toast primitives
- `SettingsPanel.tsx` → settings block in full; also `.btn`, `.btn-small`, `.btn-ghost`
- HUD → `.hud-root`, `.stat-row`, `.hotbar`, `.hud-footer`, pill variants
- Toasts → `.toasts`, `.toast`, `.toast-*`
- Menu / save UI → `.menu-root`, `.menu-title-*`, `.btn-menu`, `.menu-difficulty`, `.save-slot`
- shared actions across the UI → `.btn`, `.btn-gold`, `.btn-ghost`, `.btn-small`

---

## 15. Summary

`sources/styles.css` is not just a list of styles; it is a shared UI surface that several parts of the codebase depend on in different ways. The app shell depends on it for layering and layout. The HUD depends on it for chrome. Toasts depend on it for notification presentation. Settings depends on it for nearly all of its visual structure. Buttons and menu/save styles are shared across multiple components.

For maintenance, the useful view is the class family: layout/layer, HUD, toast, settings, button, and menu/save. That is usually a better map than thinking in terms of individual component files alone.
