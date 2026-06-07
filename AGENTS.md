# Agent Harness: State Transitions, UI Behavior, and Design Patterns

This repository uses calculator-style interactive UIs. Follow these rules when editing chips, toggles, and button behavior. Extract all patterns from reference calculators; do not freestyle.

## Global Design Rules (All Calculators)

### CSS Variable System

All calculators use identical theme variables:

```css
:root {
  --page-bg: #f7f7f2;
  --panel-bg: #ffffff;
  --field-bg: #ffffff;
  --text: #1f2520;
  --muted: #5c645d; /* labels, secondary text */
  --disabled: #888a88; /* disabled input/chip text */
  --border: #d9ddd4;
  --accent: #1d6b43; /* interactive elements */
  --accent-soft: #eef6ef; /* info backgrounds */
}

:root[data-theme="dark"] {
  --page-bg: #111713;
  --panel-bg: #1a241d;
  --field-bg: #131b15;
  --text: #e5efe6;
  --muted: #b2beb4;
  --disabled: #7a827b;
  --border: #3a4d40;
  --accent: #81d39d;
  --accent-soft: #23362a;
}
```

### Top-Actions Button Pattern (STRICT ORDER)

Every calculator must have this exact structure:

1. `<a class="action-btn" href="index.html">Back to index</a>`
2. `<button id="toggle-theme-btn" class="action-btn" aria-pressed="false">Theme: Auto</button>`
3. `<button id="toggle-license-btn" class="action-btn" aria-expanded="false">Show license</button>`

All use `.action-btn` class with outlined panel styling.

### Button Classes Inventory

**1. `.action-btn` - Outlined panel style (used for ALL action-oriented buttons)**

- Applied to: Back link, Theme toggle, License/Attribution toggle, Copy, Reset, Reload, Add/Remove, Show/Hide toggles, Export buttons
- Styling:
  ```css
  .action-btn {
    border: 1px solid var(--border);
    background: var(--panel-bg);
    color: var(--text);
    padding: 0.45rem 0.75rem;
    cursor: pointer;
  }
  .action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  a.action-btn {
    text-decoration: none;
    display: inline-block;
  }
  ```
- Reference: ohms-law-calculator.html, voltage-divider-calculator.html, battery-runtime-calculator.html

**2. `.chip` - Format/toggle selection buttons**

- Applied to: Format selectors (discord-timestamps), type family selectors (protobuf)
- Styling: Rounded borders, toggleable appearance
- Must have exclusive `.selected` and `:disabled` states
- Excluded from generic button selectors: `button:not(.action-btn):not(.chip)`

**3. Generic buttons (data entry/calculation controls)**

- Selector: `button:not(.action-btn):not(.chip)`
- Use only if calculator has standard solid-accent-fill buttons (not all calculators do)
- Styling: Solid accent background, white text, brightness filters on hover/active
- ONLY use if already established pattern in that calculator

### Link Styling (Non-Action-Btn Links)

```css
a:not(.action-btn) {
  color: var(--accent);
  text-decoration: none;
}
a:not(.action-btn):hover {
  text-decoration: underline;
}
```

- Action-btn links NEVER underline on hover (use button styling instead)

### Input/Select Styling (All Calculators)

```css
input,
select {
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--border);
  background: var(--field-bg);
  color: var(--text);
  font: inherit;
}
input:focus,
select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}
textarea {
  font-family: "Courier New", monospace; /* for import/export fields */
}
```

### Two-Column Field Layout

See `calculator-template.html` — the "Input Controls" section contains live examples of all three `.two-col-fields` patterns (basic, hint-text wrapping, align-items:start).

### WCAG 2.1 AA Compliance

- Disabled text uses `--disabled` color variable, not opacity
- Contrast ratios: minimum 4.5:1 for text, 3:1 for UI components
- Selected chips must maintain readability in both light/dark themes
- Disabled chips: use `--disabled` color with 0.65 opacity max

### Aria Attributes

- Theme button: `aria-pressed="false"` (always, even in dark mode)
- Toggle buttons (License/Attribution/Show/Hide): `aria-expanded="false"` initially, toggle to `"true"` when shown
- Add/Remove buttons: `aria-label="Add [item]"` / `aria-label="Remove [item]"`

### Mobile Responsive Pattern

```css
main {
  width: min(100%, 96rem);
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
}

@media (max-width: 768px) {
  .cards,
  .calculator-grid {
    grid-template-columns: 1fr; /* single column */
  }
  /* Stack buttons if needed */
}
```

### License Attribution for Imported Calculators

- Every calculator that imports logic/formulas from another page must include a license block
- License block uses `.attribution-block` with `[hidden]` attribute controlled by toggle button
- Attribution toggle is always the third top-action button: `id="toggle-license-btn"`
- Include references to tools, LLMs, or frameworks used in HTML comments at top of file
- Example: `<!-- Agentic tools: spell-check, theme system, attribution system -->`
- Example: `<!-- LLMs: GPT-5.4, Claude Sonnet, Claude Haiku 4.5 (via GitHub Copilot Chat agent) -->`

### Monospace Font for Import/Export Fields

- All `<textarea>` fields used for importing/exporting data must use monospace font
- Apply `font-family: 'Courier New', monospace;` or inherit from global monospace stack
- Used in: export panels, paste parsers, table builders, format converters
- Ensures data alignment is preserved and copy-paste accuracy is obvious
- Example: voltage-divider's export textarea, battery-runtime's curve editor table view

### No Local Environment Data in Published Files

- Never include local filesystem paths, usernames, or machine-specific details in any `.html`, `.md`, or other published file
- Example: use `python script.py` not `/home/user/project/.venv/bin/python script.py`
- Applies to: example commands, documentation, comments, reference pages, and any content that will be committed or served
- If a local path appears in tool output (e.g. a test run), strip it before pasting into a published file

### Gitignore Compiled and Generated Artifacts

- Every repository that contains scripts or tooling must have a `.gitignore` at the root
- Never commit compiled or generated artifacts: `__pycache__/`, `*.pyc`, `*.pyo`, `node_modules/`, `dist/`, `build/`, `.venv/`
- If a `.gitignore` is missing and compiled artifacts are already tracked, untrack them with `git rm -r --cached <path>` and add the rule before committing
- Check `git status` / `git ls-files` after adding new script files to confirm no build artifacts are staged

### Keep Calculators to Single HTML Files When Possible

- Each calculator should be one `.html` file (no external HTML partials)
- JavaScript logic may be in `<script>` tags or referenced `.js` files (unit-conversion.js pattern acceptable)
- CSS should be in `<style>` tags (no external stylesheets per calculator)
- Goal: Standalone, portable files that can be moved or hosted independently
- Exception: Unit conversion tooling uses shared `unit-conversion-formulas.js` and `unit-conversion-custom-units.js`
- Do NOT create calculator-specific CSS or JS files unless shared across multiple pages

---

## Discord Timestamps Specific Guidance

### 1) Transition System Requirements

- Represent chip logic as explicit states, not scattered conditionals.
- Each state must define:
  - selected chip set
  - disabled chip set
  - output format mapping
- Every state must have at least one valid exit path.
- Never disable chips that are intended as exits.

### 2) Discord Timestamp Chip Rules

- Allowed state names:
  - empty
  - date-short
  - date-long
  - time-short
  - time-long
  - date-time
  - date-time-day
  - relative
- Required escape paths:
  - relative -> date-short via Date click
  - relative -> time-short via Time click
  - relative -> empty via Relative click
  - date-short -> empty via Date click
  - time-short -> empty via Time click
- Constraint rules:
  - Day selectable only with Date + Time
  - Date + Time forces format f/F and disables Short/Long

### 3) Click Handling Pattern

- On click:
  1. Block only if chip is currently disabled.
  2. Handle explicit deselect toggles first.
  3. Apply canonical target via a transition helper.
  4. Recompute disabled states from current state.
  5. Recompute output and preview.
- Avoid mutating individual chips in multiple branches when a state transition can express intent.

### 4) Styling Safety Rules

- Keep chip styles isolated from generic button styles.
- Keep selected chip contrast readable in both themes.
- Keep selected chip colors stable on hover.
- Disabled chips must remain legible; use `--disabled` color variable.

### 5) Regression Checklist Before Finalizing

- Relative can switch to Date and Time in one click.
- Relative toggles off to empty.
- Date-only and Time-only can toggle off to empty.
- Date + Time disables Short/Long and supports optional Day.
- No action button style regressions.
- Light and dark themes remain readable.
