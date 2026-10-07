---
name: ui
description: UI agent for DEVinho. Use for any change in app/public (index.html, app.js, dynamodb.js, style.css). Owns the design system.
---

# UI Agent

## Context
Vanilla HTML/CSS/JS in `app/public/`, served statically by Express. No framework, no build step.
`style.css` is the design system: tokens on `:root`, then components. `app.js` exposes shared helpers on `window.DEVinho` (`icon`, `esc`, `toast`, `copy`, `setNavStatus`); `dynamodb.js` consumes them.

## Rules
- Do not introduce frameworks or bundlers.
- Give every interactive element a unique, descriptive `id`.
- Keep a single `<h1>`, semantic HTML, and accessible labels (`aria-label` on icon-only buttons).
- Never inject server or user text with `innerHTML` without `esc()` (DB names, item values and log lines are untrusted).
- Credentials must not be placed in URLs from the UI; prefer POST bodies.

## Design system (always follow)
The look is minimal, flat and dense: a quiet tool, not a landing page. Every new screen or component must read as part of the existing ones.

### Colors
- Use only the tokens in `:root`. Never hardcode a new hex; if a new token is really needed, add it to `:root`.
- Surfaces: `--bg` (page, inputs, wells), `--surface` (main panel), `--raised` (buttons, popovers, hover rows). Borders: `--border`, `--border-strong`, `--border-hover`.
- Text: `--text`, `--text-2` (secondary), `--text-3` (faint).
- **Wine (`--wine-*`) is the only accent**: primary action, active nav item, focus ring, selected option. One primary (wine) button per screen.
- `--ok`, `--warn`, `--danger` only communicate state (connected, warning, error/destructive). Never decorative.
- No gradients, glows, glassmorphism (`backdrop-filter`) or coloured icon tiles. Flat surfaces with 1px borders.

### Typography and density
- Inter (`--font`) for UI, JetBrains Mono (`--mono`, class `.mono`) for database/table names, keys, URLs, logs, JSON and cell values.
- Base 13px; labels 12px; section titles 13px/600; page title 15px/600. Controls are 28–34px tall (`.btn-sm`, `.btn`, `.input`), `.btn-lg` only for the main action of a flow.
- Radii: `--r-sm` (controls), `--r-md` (boxes), `--r-lg` (main panel, modals).

### Icons and copy
- No emoji anywhere in the UI (markup, JS strings, toasts). Use inline stroke SVG with class `.i` (`.i-sm` for 14px); in JS use `DEVinho.icon(name)` and add new paths to its `ICONS` map.
- Copy is Brazilian Portuguese, short and direct, sentence case ("Clonar banco", not "Clonar Banco Selecionado"). The wine theme lives in the name, logo and colour, not in slogans.

### Components (reuse before creating)
- Buttons: `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-danger`, `.iconbtn` (`.bordered`, `.danger`), `.link`.
- Fields: `.field` with `<label>` or `.flabel`, `.input`, `.affix` (icon/button inside), `.hint`, `.check`, radio cards `.opts > .opt`, exclusive buttons `.segment` (`aria-pressed`), shortcut `.chip`.
- Database pickers use the searchable combo (`.combo`, `createDbPicker` in `app.js`): options show name and size; the hidden `<select>` stays the source of truth.
- Feedback: `.alert` (`.err`, `.warn`, `.info`) inline next to what failed, `DEVinho.toast(msg, 'ok' | 'err' | 'info')` for transient results, `.status` + `.dot` (`.ok`, `.warn`, `.err`, `.live`) for connection state, `.empty` for empty states (always say the next step).
- Lists and data: `.sec-h` + `.row`, `table.grid` (sticky header, sticky PK, mono cells), `.key` badges for PK/SK, `.count`.
- Overlays: `.scrim > .modal` for confirmations (destructive actions always confirm, red button), `.panel` for side editors that keep the list visible.

### Layout
- Shell is `.app` = `.sb` (sidebar) + `.main` (one `.top` header + one `.view` per module). A new module is a nav button with a status `.dot`, a title span in the `<h1>`, a `.top-group` and a `.view`.
- The active nav item is marked by a single wine bar (`.nav-ind`) that slides to the selected button (`moveNavIndicator` in `app.js`); do not add per-item markers or click effects.
- The sidebar collapses to an icon rail (`.sb.rail`, `Ctrl+B`); icons keep their position in both states, only labels fade. Below 1100px it is always a rail.
- Desktop first; below 900px columns stack and the page scrolls. No horizontal page scroll at any width.

### Motion and scrollbars
- Use the motion tokens (`--t-fast`, `--t-med`, `--ease`). Animate only `opacity`, `transform`, colours and, for the sidebar, `width`/`height`.
- Elements toggled with `.hidden` get an entry animation from the shared keyframes (`fade-in`, `rise-in`, `slide-in`, `pop-in`); do not add JS-driven animation.
- Keep it subtle (≤ 0.3s, ≤ 16px of travel). `prefers-reduced-motion` must keep disabling everything.
- Scrollbars are styled globally (thin, translucent thumb); do not restyle them per component.

## Key flows to preserve
- Source server selection and database picker (`/api/source/databases`), with the server form opening on connection error.
- Target server mode (local / same as source / custom) and target database mode (new / overwrite existing via `/api/target/databases`), with the overwrite warning.
- Clone via SSE (`/api/clone-stream`), with live log, result banner and connection URL.
- Clone list: copy URL, fast fork (`/api/clones/template`), delete with typed confirmation.
- DynamoDB: connect panel, table list, item grid (scan, filter, load more), side-panel item editor (Visual/JSON in sync), delete confirmation.

## Before finishing
- Check both modules at 1440px, ~1000px and ~420px, with the sidebar expanded and collapsed.
- Confirm there are no console errors and no emoji or hardcoded colours in the diff.
