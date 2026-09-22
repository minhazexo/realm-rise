# `src/styles.css` — Stylesheet Reference

This document describes the main UI stylesheet for **Rise of the Realm** in detail. It is intended as a practical map of what the file contains, how it is organized, and how its rules connect to the React source files and game UI layers.

The file is the single global stylesheet for the client UI shell. It is not scoped per component file; instead it defines shared tokens, primitives, and themed sections that the app shell and panels consume.

---

## 1. What this file is responsible for

`sources/styles.css` covers:

- global resets and base HTML/body behavior
- CSS custom properties (design tokens) used across the UI
- layout primitives for the app root, canvas layer, and panel layer
- the HUD, hotbar, and footer chrome
- toast notifications
- the settings panel and its controls
- buttons and their variants
- the main menu cinematic treatment
- save-slot and difficulty selection styling
- motion/animation keyframes
- browser-specific styling for scrollbars and range inputs

In short: this file owns all **persistent UI chrome** that sits on top of the Phaser canvas. It does not own game rendering styles; those live with the engine/client canvas layer.

---

## 2. High-level structure of the file

The stylesheet is organized in a loose but consistent order:

1. **Design tokens** — `:root` custom properties
2. **Global reset and base layer** — `*`, `html/body`, `#root`, `.app-root`
3. **Canvas + panel layer setup** — `.game-canvas`, `.panel-layer`
4. **Scaling wrapper** — `.ui-scale-wrapper`, `.panel`
5. **HUD** — `.hud-root`, `.hud-top`, `.hud-bottom`, vitals, meters, pills
6. **Hotbar and footer** — `.hotbar`, `.hotbar-btn`, `.hud-footer`, pill variants
7. **Toasts** — `.toasts`, `.toast`, variants, typography
8. **Settings** — panel, header, groups, rows, toggles, ON/OFF button, slider, pills, test-flag, keybindings
9. **Generic buttons** — `.btn`, `.btn-gold`, `.btn-small`, `.btn-ghost`, `.btn-menu`
10. **Menu and save/load UI** — `.menu-root`, `.menu-title-*`, `.menu-difficulty`, `.save-slot`
11. **Animations** — `@keyframes`
12. **Vendor/edge-case rules** — webkit scrollbars, range input styling, focus-visible overrides

This order matters because global tokens come first, primitives next, and screen/feature styles after that. That keeps the cascade readable and reduces the chance that a feature rule accidentally overrides a token or primitive in surprising ways.

---

## 3. Design tokens

The `:root` block defines the shared color and effect vocabulary. Everything themed in the UI is derived from these values.

### 3.1 Color tokens

- `--ink` — deep near-black used for text contrast accents
- `--parch` — main light text tone
- `--parch-dim` — secondary/muted text
- `--gold` — core gold accent
- `--gold-bright` — bright gold for headings and highlights
- `--gold-dim` — darker gold for borders, gradients, and subtler accents
- `--blood` — danger/warning red
- `--night` — main background base
- `--night-mid` — slightly lighter night tone for depth
- `--steel` — cool blue-gray accent
- `--copper` — warm copper accent
- `--emerald` — green accent, often used for positive states
- `--twilight` — purple-ish accent
- `--parch-border` — dark parchment border tone

### 3.2 Glass and effect tokens

- `--glass` — primary translucent dark glass surface
- `--glass-strong` — denser glass for panels and elevated surfaces
- `--glow-gold` — a predefined gold glow shadow value

These tokens are used heavily for glassmorphism: translucent backgrounds, blur, inset borders, and layered shadows.

### 3.3 How tokens are used

The token system is the reason the UI stays coherent across HUD, settings, menu, and toasts. For example:

- Panel surfaces tend to use `--glass` or `--glass-strong`
- Accents use gold variants
- Text uses `--parch` or `--parch-dim`
- Danger states use `--blood`
- Many borders are low-opacity gold or dark tones to keep the “dark fantasy but readable” feel

Because these values are centralized, a theme change should mostly happen in `:root`, not across many component rules.

---

## 4. Global reset and base layer

The file starts with a reset-like foundation:

- `*` removes default margin/padding, sets `box-sizing: border-box`, and disables tap highlight color
- `html, body` sets overflow hidden, the default font family, dark background, base text color, font smoothing, and touch behavior
- `#root` is sized to full viewport with hidden overflow
- `.app-root` is the main app container: full size, relative positioning, hidden overflow

This establishes the game UI as a full-screen layer stack rather than a scrolling document. That matches the intended architecture: the Phaser canvas takes the base layer, and React UI panels overlay it.

---

## 5. Canvas and panel layer architecture

### 5.1 `.game-canvas`

This is the base canvas container. It is absolutely positioned, covers the full inset, and sits at `z-index: 0`. It also disables touch actions so the underlying canvas can handle its own input model.

### 5.2 `.panel-layer`

This is the React UI overlay container:

- absolutely positioned over the full viewport
- `pointer-events: none` by default
- direct children get `pointer-events: auto`

That pattern lets the canvas remain interactive by default while still allowing specific UI elements to receive pointer events when needed.

### 5.3 Why this matters

This layering is the backbone of the whole UI system. HUD, toasts, panels, overlays, and menu components all render inside this overlay structure. The stylesheet therefore has to be careful about z-index, pointer interaction, and positioning so panels do not interfere with raw gameplay input unless intended.

---

## 6. Scaling wrapper and panel transform

The file includes a scaling setup for UI scaling:

- `.ui-scale-wrapper` centers content and prepares for transform-based scaling
- `.panel` sets `transform-origin: top left`

This keeps the panel transform predictable when UI scale changes. The relevant runtime behavior is driven by settings values such as UI scale and text scale, but the CSS here provides the structural hooks for that.

This is especially important for panels that can be larger than the visible area on smaller screens or when scaling is high.

---

## 7. HUD

The HUD section defines the in-world status chrome that stays visible during gameplay.

### 7.1 Root HUD layout

- `.hud-root` is full-screen, pointer-events none, `z-index: 3`, flex column, spaced top-to-bottom
- `.hud-top` is the primary row and uses strong horizontal padding to leave room for side chrome

### 7.2 Vitals and stat rows

Vitals are built from small stat cards:

- `.stat-row` is a fixed-size rounded bar with translucent dark background and inset shadow
- `.stat-row > span` overlays the label/value
- `.stat-fill` provides the colored fill that animates width

Each stat type has its own gradient:

- HP
- stamina
- food
- water

This gives a consistent “status bar” language without needing separate component markup patterns for each resource.

### 7.3 Level pill and XP bar

- `.level-pill` is a gold pill used for level display
- `.xp-bar` and `.xp-fill` implement a small XP progress track with smooth width transition

### 7.4 Resource pill and ambience text

- `.resource-pill` is a glass-style pill with gold text
- `.ambience` is small muted text for atmospheric info

### 7.5 Bottom HUD

- `.hud-bottom` is the lower chrome row
- The hotbar sits within the bottom area and is styled separately

---

## 8. Hotbar and footer

### 8.1 `.hotbar`

The hotbar uses:

- glass background
- rounded corners
- subtle gold border
- blur
- soft shadow

This makes it feel like a physical UI plate sitting above the game world.

### 8.2 `.hotbar-btn`

Each slot button is a small square with:

- translucent dark background
- gold-tinted border
- center-aligned content
- smooth transition
- active state with gold gradient, bright border, and glow
- hover lift on inactive buttons

This is the main interactive “ability/item slot” visual language.

### 8.3 Key badge

`.hb-key` places a tiny key hint inside a slot button, usually bottom-right.

### 8.4 Footer pills

The footer uses small glass pills for things like:

- difficulty
- stage
- reputation

Each has its own accent color for quick scanning.

---

## 9. Toasts

Toasts are the notification system for transient messages.

### 9.1 Container

`.toasts` is bottom-right, flex column, spaced, with high z-index and pointer-events none on the container.

### 9.2 Toast card

Each `.toast`:

- has a minimum width
- uses a strong glass background
- has a thin border plus a colored left border
- uses blur
- has a soft shadow
- animates in with `toastIn`

### 9.3 Kind variants

The stylesheet defines many bootstrap-like kinds using left border color:

- info
- warn
- quest
- story
- stage
- discover
- achieve
- skill
- danger

This is a clean way to encode message category visually without adding extra markup for each case.

### 9.4 Typography

- `.toast-title` is bold Cinzel-style header text
- `.toast-msg` is smaller muted secondary text
- `.toast-icon` is for optional leading icons

---

## 10. Settings panel

This is the most elaborate section in the file. It defines a self-contained “settings app” look.

### 10.1 Panel frame

`.settings-panel` is the outer card:

- fixed width with a `min()` cap for small screens
- constrained max height
- scrollable vertically
- padded
- rounded
- strong glass background
- layered border and shadow
- heavy blur with saturation boost

It also has custom scrollbar styling so the interior matches the theme rather than using native platform scrollbars.

### 10.2 Header

`.settings-header` is a flex row with:

- title on the left
- action buttons on the right
- bottom divider
- gold-bright heading text with subtle glow

This gives the panel an app-like title bar.

### 10.3 Groups

Settings are organized into groups:

- `.setting-group` provides spacing
- `.setting-group-head` creates a small accent underline
- group headings use uppercase Cinzel-style text and gold-bright color
- `.setting-hint` gives secondary explanatory text

This produces a clear hierarchy: panel → group → rows.

### 10.4 Rows

Each setting row is a subtle card-like block:

- flex row
- label column + control column
- rounded
- translucent background
- soft border
- hover highlight and border intensification

This makes individual settings easy to scan and interact with.

### 10.5 Label and hint text

- `.setting-label` is the main row title
- `.setting-row-hint` is muted helper text
- `.setting-row-text` stacks label and hint vertically
- `.setting-row-control` holds the interactive control

### 10.6 Toggle switch

The toggle is checkbox-backed but visually custom:

- track is a fixed-size rounded bar
- knob is a circle that moves between off/on positions
- on state uses gold gradient, brighter border, and glow
- a small highlight dot appears when on
- the hidden checkbox keeps it accessible as a form control while the visual layer provides the modern switch look

### 10.7 ON/OFF button

For special flags such as god mode, the stylesheet provides a button-based switch:

- `.setting-onoff` is the wrapper
- `.setting-onoff-track` is the pill track
- `.setting-onoff-knob` is the sliding indicator
- on state uses gold gradient track
- `.danger` variant uses blood-red theming
- label uses Cinzel-style uppercase text

This is used when the control should be a real button rather than a checkbox-style toggle.

### 10.8 Slider

Sliders are heavily themed:

- custom appearance reset
- translucent track
- gold gradient fill driven by a CSS variable
- custom thumb with radial gradient, border, and layered shadow
- hover scaling and glow
- active/grabbing state
- a small readout badge for the current value

The readout badge is positioned above the track end so live values are always visible.

### 10.9 Pill segmented control

Pills implement a compact segmented choice control:

- flex row with small gaps
- each pill is a small rounded button-like element
- hover lifts and brightens
- focus-visible outline uses gold
- active pill uses gold gradient background, stronger border, bright text, and soft glow

This is used for short option sets where a dropdown would feel heavier than necessary.

### 10.10 Test-only flag box

`.setting-test-flag` is a warning box:

- translucent red-tinted background
- red border
- stronger left border accent
- bold heading
- muted description text

It visually separates experimental/balance-affecting options from normal settings.

### 10.11 Keybindings grid

Keybinding UI uses a dedicated block:

- title row with reset button
- two-column grid of binding entries
- each entry has a label and a capture button
- capture button has hover, focus, and capturing states
- `<kbd>`-style display for key names

This gives key rebinding a clean list-like appearance rather than forcing it into generic rows.

---

## 11. Button system

Buttons are the shared action primitive across the UI.

### 11.1 `.btn`

The base button is:

- glass surface
- gold-tinted border
- rounded
- Cinzel-style font
- smooth transition
- blur
- layered shadow with inset highlight
- a sweeping shimmer pseudo-element on hover
- lift on hover
- press scaling on active
- disabled dimming

This is the “primary UI action” look.

### 11.2 `.btn-gold`

Gold buttons use a rich gradient:

- bright gold to deeper gold
- ink-colored text
- stronger glow and inset highlight
- hover brightens and enlarges the glow

These are used for prominent actions.

### 11.3 `.btn-small`

A compact size variant for inline actions inside panels and headers.

### 11.4 `.btn-ghost`

Ghost buttons are transparent with a visible border and uppercase lettering. They suit secondary actions such as resets or auxiliary controls.

### 11.5 `.btn-menu`

A menu-specific button style with a minimum width and wider letter spacing, used for the cinematic menu entries.

---

## 12. Menu and cinematic UI

The menu section is designed to feel cinematic rather than merely functional.

### 12.1 `.menu-root`

Full-screen menu overlay:

- high z-index
- centered flex column
- pointer-events none at the container level
- radial gradient backdrop for depth

### 12.2 Title block

- `.menu-title-wrap` centers and animates the title in
- `.menu-title` is large, bold, gold-gradient text with clipping and glow
- `.menu-subtitle` is smaller uppercase muted text

### 12.3 Menu panel and entry animation

- `.menu-panel` is the button column
- `.btn-menu` entries animate in with staggered delays

This gives the menu a staged entrance instead of a static pop-in.

### 12.4 Difficulty selector

`.menu-difficulty` contains a label and a styled select:

- strong glass background
- gold border
- blur
- focus state uses gold border

### 12.5 Save slot

`.save-slot` is a listable save-row style:

- fixed width
- glass surface
- gold border
- hover brightens and shifts right slightly

It is used for save/load entries and similar list items.

---

## 13. Animations

The file defines three core keyframes:

- `toastIn` — slide-in for toast notifications
- `titleIn` — title entrance
- `titleGlow` — slow alternating title glow
- `btnIn` — staggered menu button entrance

These are used sparingly to keep motion deliberate rather than constant.

---

## 14. Vendor and edge-case rules

The file includes browser-specific styling where needed:

- custom scrollbar colors and shapes for the settings panel
- webkit range input reset and thumb styling
- `:focus-visible` overrides for clearer keyboard focus in controls
- range fill technique using `background-size` driven by a CSS variable

These are the parts that keep controls looking consistent instead of falling back to native OS styling.

---

## 15. How this stylesheet connects to source files

The styles here are global, but they are used by specific React and app-shell components. The main connection points are:

### 15.1 `App.tsx`

`App.tsx` renders the outer shell and decides which top-level UI trees appear. It uses classes such as:

- `.app-root`
- `.game-canvas`
- `.panel-layer`
- `.ui-scale-wrapper`

So `App.tsx` depends on the global layout and layering rules in this stylesheet.

### 15.2 Panel system / `Panels.tsx`

`Panels.tsx` renders the in-game panels like inventory, crafting, skills, build, kingdom, map, journal, character, trade, pause, and save/load.

While each panel has its own markup, it relies on this stylesheet for:

- panel-layer overlay behavior
- button primitives
- pill and glass surface styling patterns
- toast presentation
- general dark-fantasy UI tone

So even if a panel defines its own specialized classes, it still sits on top of the shared styling system in `styles.css`.

### 15.3 `SettingsPanel.tsx`

This component is the biggest consumer of the settings section. It uses:

- `.settings-panel`
- `.settings-header`
- `.setting-group`
- `.setting-group-head`
- `.setting-hint`
- `.setting-row`
- `.setting-label`
- `.setting-row-hint`
- `.setting-row-control`
- `.setting-toggle` and related switch classes
- `.setting-onoff` and its track/knob/label classes
- `.setting-slider` and its readout
- `.setting-pills` and `.setting-pill`
- `.setting-test-flag`
- `.settings-keybinds` and its grid classes
- `.btn`, `.btn-small`, `.btn-ghost`
- `.settings-mute` / `.settings-back` overrides

So the settings section of the stylesheet is effectively the design system for this component.

### 15.4 HUD components

The HUD tree uses:

- `.hud-root`
- `.hud-top`
- `.hud-bottom`
- `.stat-row` and stat fills
- `.level-pill`
- `.xp-bar` / `.xp-fill`
- `.resource-pill`
- `.hotbar` / `.hotbar-btn`
- `.hb-key`
- `.hud-footer`
- pill variants for difficulty/stage/reputation

This means the HUD is mostly styled through shared chrome rules rather than independent per-panel styling.

### 15.5 Toasts component

The toasts UI depends on:

- `.toasts`
- `.toast`
- all `.toast-*` kind variants
- `.toast-title`, `.toast-msg`, `.toast-icon`

So notification look and category colors are fully managed here.

### 15.6 Menu and overlay components

Menu-screen components use:

- `.menu-root`
- `.menu-title-wrap`, `.menu-title`, `.menu-subtitle`
- `.menu-panel`
- `.btn-menu`
- `.menu-difficulty` and its select
- `.save-slot`

These styles give the main menu, save/load list, and difficulty picker their cinematic look.

### 15.7 Canvas and app-root layer

The game canvas container and overlay system depend on the base layout rules. That includes:

- full-viewport sizing
- absolute positioning
- pointer-event layering
- z-index separation

These rules make it possible for React UI to float above the game canvas without disturbing input handling incorrectly.

---

## 16. Naming and reuse patterns

A few patterns show up repeatedly:

- **noun + role**: `.stat-row`, `.setting-row`, `.settings-header`
- **component + variant**: `.btn-gold`, `.btn-ghost`, `.btn-small`, `.btn-menu`
- **category qualifiers**: `.toast-danger`, `.toast-quest`, `.toast-achieve`
- **state classes**: `.on`, `.active`, `.hover`, `.capturing`, `.focus-visible`
- **layout primitives**: `.panel-layer`, `.ui-scale-wrapper`, `.hud-root`

The system leans on small semantic classes more than long unique component names. That keeps the stylesheet compact and reusable, but it also means the meaning of a class depends on context.

---

## 17. Strengths of the current setup

- Tokens are centralized, which makes theming consistent
- Glassmorphism is applied in a controlled way across panels, hotbar, toasts, and menu
- Controls are custom-styled but still preserve basic interaction affordances
- The panel-layer pointer model is clean
- Settings has a professional, app-like hierarchy
- Button system is unified across menu, panels, and settings

---

## 18. Likely friction points to watch

Even though the stylesheet is solid, a few areas can become harder to maintain over time:

- Global class names can collide if new components reuse generic-sounding names
- Large sections like settings may keep growing until the file becomes harder to scan
- Some repeated patterns could be collapsed into clearer primitives if the component count grows
- Motion is currently modest, but if more animations are added, keyframes and timing should stay coordinated
- Scrollbar/range input styling is browser-focused and may need extra care for broader compatibility

These are not problems right now, just maintenance risks to keep in mind.

---

## 19. Where to extend this stylesheet

If the UI grows, the most natural extensions are:

- new panel-specific class families that still follow the existing glass/gold language
- additional toast kinds if new notification categories appear
- extra button variants only if the existing ones stop covering the UI needs
- better separation of per-panel blocks if settings and other sections become large
- a clearer tokens-only section if the design language expands beyond the current color set

---

## 20. Quick map of the major class families

- **Layout**: `.app-root`, `.game-canvas`, `.panel-layer`, `.ui-scale-wrapper`, `.panel`, `.hud-root`, `.hud-top`, `.hud-bottom`
- **HUD**: `.stat-row`, `.stat-fill`, `.level-pill`, `.xp-bar`, `.xp-fill`, `.resource-pill`, `.ambience`, `.hotbar`, `.hotbar-btn`, `.hb-key`, `.hud-footer`
- **Toasts**: `.toasts`, `.toast`, `.toast-*`, `.toast-title`, `.toast-msg`, `.toast-icon`
- **Settings**: `.settings-panel`, `.settings-header`, `.settings-title`, `.setting-group`, `.setting-group-head`, `.setting-hint`, `.setting-row`, `.setting-label`, `.setting-row-hint`, `.setting-row-control`, `.setting-toggle*`, `.setting-onoff*`, `.setting-slider*`, `.setting-pills`, `.setting-pill`, `.setting-test-flag`, `.settings-keybinds*`, `.settings-mute`, `.settings-back`
- **Buttons**: `.btn`, `.btn-gold`, `.btn-small`, `.btn-ghost`, `.btn-menu`
- **Menu/save**: `.menu-root`, `.menu-title-wrap`, `.menu-title`, `.menu-subtitle`, `.menu-panel`, `.menu-difficulty`, `.save-slot`
- **Animation**: `toastIn`, `titleIn`, `titleGlow`, `btnIn`
- **Vendor**: webkit scrollbar, range input, focus-visible

---

## 21. Summary

`sources/styles.css` is the visual backbone of the UI layer. It defines the tokens, the overlay/layout model, the shared controls, the toast system, the settings panel language, the button system, and the cinematic menu treatment. Most React UI components in the app shell and panels draw their look from this file, either directly through shared classes or indirectly through the design patterns it establishes.

The file is strongest when treated as a small design system: tokens up front, primitives next, feature sections after that, and vendor rules at the end. If the project keeps growing, that structure will still work as long as new UI continues to reuse the same glass/gold/dark-fantasy vocabulary instead of drifting into many unrelated styling styles.
