# CLAUDE.md

## Project

Chrome extension (Manifest v3) for enhancing Bitrix24 Plan (plan.pixelplus.ru). Built with Vue 3, PrimeVue, Tailwind CSS, and Vite via the CRXJS plugin. Made for an internal team (~7-10 people) and broader company use (~180 employees).

### API approach

Bitrix24 has no public API for the features used here. All API calls were reverse-engineered from browser DevTools network requests and are replicated via axios. This works because the user's valid session cookie is included automatically — requests are made on behalf of the currently authenticated user. `src/js/BitrixApi.js` encapsulates these calls; the session ID (`BX_SESSION_ID`) is grabbed from `window` in the main world and passed through to `isolated.js`.

## Commands

```bash
npm run dev      # Dev mode (rebuilds CSS + starts Vite dev server on port 5173)
npm run build    # Production build → build/
npm run build-css  # Rebuild Tailwind CSS only (needed when adding new utility classes)
```

There are no test commands — no test framework is configured.

Linting: ESLint with flat config (`eslint.config.js`). Rules: semicolons required, single quotes, trailing commas in multiline, sorted imports.

**Do not run build or lint commands yourself** (`npm run dev`, `npm run build`, `npm run build-css`, `eslint`, etc.). The user runs these manually — just make code changes. The commands above are listed for reference only.

## Architecture

### Extension flow

1. `src/manifest.js` defines the extension manifest (Manifest v3).
2. `src/content-scripts/main.js` runs in the **main world** to extract `BX_SESSION_ID` from the page and posts it via `window.postMessage`.
3. `src/content-scripts/isolated.js` runs in the **isolated world** — the core orchestrator. It receives the session ID, loads the user's stored options from `chrome.storage.local`, then dynamically imports and executes only the enabled feature modules.
4. `src/background/index.js` is the service worker for lifecycle events.
5. `src/popup/` is the extension options UI (Vue app).

### Feature module system

Each feature lives in `src/js/actions/<feature-name>/`. The central registry is `src/js/options.js`, which declares all features with their metadata and default values. `isolated.js` uses this registry to build an option-to-action map and then calls `action(sessionId, options)` for each enabled feature.

Simple features do direct DOM manipulation; complex ones (e.g., `scrum-points`, `scrum-summary`) mount full Vue 3 apps into injected DOM nodes.

### Vue file conventions

In `.vue` files, `<script setup>` always comes before `<template>`.

### Naming conventions

**Do not abbreviate variable, parameter, or function names.** Use full descriptive names:
- `element` not `el`
- `extension` not `ext`
- `response` not `res`
- `description` not `desc`
- `comment` not `c`, `index` not `i`, `file` not `f`, `attachment` not `obj`
- `imagesFolder` not `imgFolder`, `imagesLine` not `imgLine`

### Tailwind CSS and tailwindcss-primeui

The project uses **Tailwind CSS v4** and the **`tailwindcss-primeui`** plugin. The plugin exposes PrimeVue theme CSS variables as Tailwind utility classes:

- Colors: `bg-primary`, `text-primary-contrast`, `bg-surface-100`, `text-surface-500`, etc.
- All PrimeVue theme tokens are available as Tailwind classes.

Prefer these classes over arbitrary hex values where PrimeVue theme integration is needed.

### Critical constraints

- **Do not use `<style>` blocks in Vue components used inside content scripts.** The CRXJS build pipeline injects these into `document.head`, which breaks content script isolation. Use Tailwind utility classes or inject styles via JS instead.
- **Tailwind CSS is compiled separately** (`build-css` script). New Tailwind utility classes won't hot-reload; run `npm run build-css` after adding new classes.
- **Update version in `package.json`** before publishing (CRXJS reads it for `manifest.json`).
- **Toast isolation: always set `group` on `<Toast>` and in every `toast.add()` call.** PrimeVue's `ToastEventBus` is a module-level singleton — all Vue apps on the page share it. Without a `group`, every `<Toast>` component renders every notification. Each app uses its own kebab-case feature name as the group (e.g. `group="quick-task"` on the component, `group: 'quick-task'` in `toast.add({...})`). Not all apps have this applied yet — add it when touching an app's toast calls.

### What's new page

On every extension update `src/background/index.js` automatically opens the `whats-new.html` tab.

- **`src/whats-new/changelog.js`** — array of `{ version, date, items[], images[] }` objects, where each item is `{ type: 'new'|'fix'|'upd', text, optionKey? }`. **Prepend a new entry for every release.**
- Store images in `public/assets/whats-new/<version>/` and import them via `import.meta.glob` — see existing entries as an example.

### Reference Vue widget: `scrum-summary`

When building a new Vue widget feature, follow `src/js/actions/scrum-summary/`. Structure:

```
scrum-summary/
  index.js              # Entry point: finds anchor element, creates container, mounts Vue app
  ScrumSummaryApp.vue   # Thin shell: trigger button (native Bitrix CSS classes), Dialog, <Toast group="...">
  buildSystemPrompt.js  # AI prompt builder (separate file)
  variables.js          # Shared constants and helpers
  components/
    ScrumSummary.vue    # Main component: all data fetching, settings, AI logic
    SettingsForm.vue    # Settings form, persists to chrome.storage.local
    SummaryChart.vue    # Chart sub-component
    SummaryTable.vue    # Table sub-component
```

**Key patterns:**

- `index.js` registers PrimeVue, ToastService, directives (`v-tooltip`, `v-ripple`) and mounts `*App.vue`.
- `*App.vue` — trigger button + `<Dialog>` + `<Toast group="feature-name">` only. No business logic.
- Settings stored per-group: key `<feature>-settings-<groupId>` in `chrome.storage.local`.
- AI context stored per-group: key `<feature>-ai-context-<groupId>`.
- API key read from global `options.pixelToolsApiKey` (shared across all AI features).
- `onMounted` → `loadSettings()` → `fetchData()`. After saving settings — `loadSettings()` + re-fetch if needed.
- `SettingsForm` shown inline (`v-else`) when widget is not yet configured; otherwise inside a `<Dialog>`.
- AI modals: context input (Textarea with char limit + counter), prompt preview (`pre` + length), API key input (`Password`).
- AI streaming progress: `aiProgress` (0–100) → button label `AI analysis (42%)`.
- AI result rendered via `marked()` into `v-html` with class `pts-ai-result`.

### MCP servers

- **b24-dev-mcp** — official Bitrix24 REST API docs. Use `bitrix-search`, `bitrix-method-details`, `bitrix-event-details`, `bitrix-article-details` to look up API methods and events.

### Shared utilities

- `src/js/BitrixApi.js` — Axios-based wrapper for Bitrix24 REST API calls using the session ID.
- `src/js/utils.js` — DOM helpers, string utilities, and observer utilities used across feature modules.
- `src/js/primeVueOptions.js` — PrimeVue theme/preset configuration shared by all Vue apps.

### Shared UI components (`src/js/ui/`)

- **`FormField.vue`** — form field wrapper: renders a `<label>` (or `<div>` when no `id` is passed), a tooltip icon (`pi-question-circle`) when `tip` is provided, and a slot for the control.
- **`DateRangePicker.vue`** — date range selector. Text input with mask `DD.MM.YY – DD.MM.YY` + Popover with presets (current/previous period by weeks and months) and a 2-month inline calendar. Supports `minDate`, `maxDate`, and `eventDates` (dots on dates). `v-model` — `[Date, Date]` array.
