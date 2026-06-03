# CLAUDE.md

## Project

Chrome extension (Manifest v3) for enhancing Bitrix24 Plan (plan.pixelplus.ru). Built with Vue 3, PrimeVue, Tailwind CSS, and Vite via the CRXJS plugin. Made for an internal team (~7-10 people) and broader company use (~180 employees).

### API approach

Bitrix24 has no public API for the features used here. All API calls were reverse-engineered from browser DevTools network requests and are replicated via axios. This works because the user's valid session cookie is included automatically — requests are made on behalf of the currently authenticated user. `src/js/BitrixApi.js` encapsulates these calls; the session ID (`BX_SESSION_ID`) is grabbed from `window` in the main world and passed through to `isolated.js`.

### Code reuse

Before implementing new functionality, check whether the codebase already solves the same problem. Prefer reusing existing utilities, components, and API methods over writing new ones from scratch:

- **Utilities** (`src/js/utils.js`) — URL parsers, task helpers, color utilities, DOM helpers, text utilities. Check here before writing custom logic.
- **Shared UI** (`src/js/ui/`) — `FormField.vue`, `DateRangePicker.vue`. Use them for form layouts and date inputs instead of rolling your own.
- **`BitrixApi` methods** — batch helpers, user/stage/group fetchers. Add a new method to `BitrixApi` rather than inlining raw `axios` calls in feature code.
- **Patterns from reference features** — `scrum-points` and `scrum-summary` establish conventions for Vue widgets (mounting, settings storage, toast groups, DataTable patterns). Follow them when building similar features.
- **`lodash-es`** — available as a dependency. Use it for utility functions (debounce, throttle, groupBy, etc.) instead of reimplementing them manually. Import individual functions: `import {debounce} from 'lodash-es'`.

### API request optimization

Always minimize the number of round-trips and the payload size when calling the Bitrix24 REST API:

- **Batch requests:** Use `/rest/batch.json` to combine multiple independent API calls into a single HTTP request. `BitrixApi` already exposes batch helpers (`getTasksByIdsBatch`, `getStagesBatch`, `getImUsersBatch`, etc.) — prefer them over individual calls in a loop.
- **Selective fields (`select[]`):** Always pass a `select[]` array with only the fields you actually need. Never fetch a full resource when you only need a subset. For example, requesting `['ID', 'TITLE', 'RESPONSIBLE_ID']` instead of the full task object avoids transferring dozens of unused fields per record.
- **Incremental loading:** When a feature can display data page by page (e.g. paginated tables), fetch only the data needed for the current view. Cache already-loaded records and skip re-fetching them on subsequent pages.

## Commands

```bash
npm run dev      # Dev mode (rebuilds CSS + starts Vite dev server on port 5174)
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

### Comments

- **Shared utilities** (`src/js/utils.js`, `src/js/BitrixApi.js`, `src/js/patterns.js`, shared UI components): document every exported function and component with JSDoc — `@param`, `@returns`, and a one-line description.
- **Vue templates and HTML**: no comments. Structural intent should be clear from element names and component composition.
- **Feature business logic** (`src/js/actions/**`): short inline comments are welcome when they explain a non-obvious constraint, a workaround, or a domain rule — one line max. Skip comments that just restate what the code does.

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

**No inline `style` attributes.** Style with Tailwind utility classes, preferring `tailwindcss-primeui` theme tokens (`text-primary`, `bg-surface-100`, …) over raw palette classes (`text-amber-500`). Inline `style` is a last resort — only for genuinely dynamic values that can't be a static class (e.g. a color string coming from data: `:style="{ backgroundColor: column.color }"`). Never use inline `style` for static styling that a utility class can express. Remember new utility classes need `npm run build-css`.

### Critical constraints

- **Do not use `<style>` blocks in Vue components used inside content scripts.** The CRXJS build pipeline injects these into `document.head`, which breaks content script isolation. Use Tailwind utility classes or `src/css/content-styles.css` instead. `<style>` blocks work fine in popup and whats-new components.
- **Global CSS:** `src/css/content-styles.css` — for content scripts; `src/css/app.css` — for the popup and whats-new pages. Avoid `insertCSS` from `utils.js` for static styles — it's for dynamic/runtime cases only. For PrimeVue overrides that PT can't reach (e.g. pseudo-elements), add a class via `:pt="{ root: { class: '...' } }"` and target it in a `<style>` block (popup/whats-new) or in `content-styles.css` (content scripts).
- **Tailwind CSS is compiled separately** (`build-css` script). New Tailwind utility classes won't hot-reload; run `npm run build-css` after adding new classes.
- **Update version in `package.json`** before publishing (CRXJS reads it for `manifest.json`).
- **Toast isolation (content scripts only): set `group` on `<Toast>` and in every `toast.add()` call.** PrimeVue's `ToastEventBus` is a module-level singleton shared by every Vue app mounted into the same document. On the Bitrix page multiple feature widgets each mount their own Vue app into one document, so without a `group` every `<Toast>` renders every notification. Each content-script app uses its own kebab-case feature name as the group (e.g. `group="quick-task"` on the component, `group: 'quick-task'` in `toast.add({...})`). Not all content-script apps have this applied yet — add it when touching an app's toast calls. **The popup and whats-new pages are each a single Vue app in their own document, so the group is unnecessary there** — a plain `<Toast />` with groupless `toast.add({...})` is fine.

### What's new page

On every extension update `src/background/index.js` automatically opens the `whats-new.html` tab.

- **`src/whats-new/changelog.js`** — array of `{ version, date, items[], images[] }` objects, where each item is `{ type: 'new'|'fix'|'upd', text, optionKey? }`. **Prepend a new entry for every release.**
- Store images in `public/assets/whats-new/<version>/` and import them via `import.meta.glob` — see existing entries as an example.

### Setup quiz (feature onboarding)

A short wizard that asks the user a few questions and offers matching features to enable. Opens automatically for new users after install and is reachable from the popup (`whats-new.html?setup=1`).

- **`src/whats-new/components/setup-steps.js`** — the quiz config: questions and the feature keys each answer unlocks. `step.features` are offered to everyone who answers the question; `option.features` only when that option is selected.
- **Wire every new feature into the quiz.** After registering a feature in `src/js/options.js`, add its `key` to the most relevant question or answer option in `setup-steps.js` — otherwise the quiz never surfaces it. Nothing enforces this, same as prepending a changelog entry. If a feature genuinely doesn't belong in onboarding (niche/advanced), mark it `excludeFromSetup: true` in `options.js` instead — that's the only accepted reason for it to be absent from `setup-steps.js`.

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
- **primevue-mcp** ([@primevue/mcp](https://primevue.org/mcp/)) — official PrimeVue component docs. Use it to look up component props, events, slots, methods, theming tokens and Pass Through (`pt`) options when building or adjusting Vue widgets. Useful tools: `search_components`, `get_component`, `get_component_props`, `get_component_slots`, `get_component_pt`, `get_usage_example`.

### Shared utilities

- `src/js/BitrixApi.js` — Axios-based wrapper for Bitrix24 REST API calls using the session ID.
- `src/js/primeVueOptions.js` — PrimeVue theme/preset configuration shared by all Vue apps.
- `src/js/patterns.js` — Single source of truth for all business-logic regular expressions (tagall phrases, notification type patterns, system notification filters). Edit regexes here, not inline in feature files.

#### `src/js/utils.js`

URL parsers:
- `getTaskUrl(groupId, taskId)` — builds a Bitrix24 task view URL string.
- `getTaskIdFromUrl(url)` — extracts `taskId` from a task view URL; returns `{ taskId }` or `null`.
- `getGroupIdFromUrl(url)` — extracts group ID from a task list URL; returns the ID string or `null`.
- `getUserIdFromUrl(url)` — extracts user ID from a user profile URL; returns the ID string or `null`.

Task helpers:
- `getCommitMessage(title, taskId)` — appends `taskId` to a task title in commit message format (`title | taskId`), replacing an existing trailing `| …` block if present.
- `isHotfixTask(taskName)` — returns `true` if the task name starts with `"hotfix"`.
- `getTaskPointsFromName(taskName)` — extracts story points from a task name (number after `|`, `I`, `/`, or `\`); returns `0` if not found.
- `simplifyColumnName(columnName)` — abbreviates a column name to initials (first letter of each word, uppercased); falls back to first 3 characters for single-word names.

DOM / CSS:
- `insertCSS(css, id?)` — appends a `<style>` tag to `document.head`. When `id` is provided, deduplicates — won't insert if a tag with that id already exists.

Colors:
- `stringToPastelColor(str)` — deterministic pastel hex color derived from a string; used for avatar initials and group chips.
- `validateHexColor(color)` — returns `true` for valid 3- or 6-digit hex color strings.
- `colors` — plain object of PrimeVue color palettes (stone, neutral, zinc, gray, slate, rose, pink, fuchsia, purple, violet, indigo, blue, sky, cyan, teal, yellow, amber, orange, red, lime, green, emerald).
- `getColors(palettes, weight?)` — returns a hex value (string) or array of hex values from `colors` at the given weight (default `'500'`).

Observers / text:
- `rehydrateOnChanges(callBack, target?, options?)` — throttled `MutationObserver` + `window focus` listener that calls `callBack` whenever the DOM changes. Accepts `filterMutation` to narrow which mutations trigger. Returns a cleanup function.
- `isUserMentioned(text, firstName, lastName)` — returns `true` if `text` contains the user's name (either `"First Last"` or `"Last First"` order) or the word `TAGALL`.
- `pluralize(n, titles)` — Russian noun declension: picks the correct form from `[form1, form2, form5]` based on `n`.
- `minifyPrompt(str)` — trims trailing whitespace from each line and collapses 3+ consecutive newlines to 2; used to clean up AI prompts before sending.

### Shared UI components (`src/js/ui/`)

- **`FormField.vue`** — form field wrapper: renders a `<label>` (or `<div>` when no `id` is passed), a tooltip icon (`pi-question-circle`) when `tip` is provided, and a slot for the control.
- **`DateRangePicker.vue`** — date range selector. Text input with mask `DD.MM.YY – DD.MM.YY` + Popover with presets (current/previous period by weeks and months) and a 2-month inline calendar. Supports `minDate`, `maxDate`, and `eventDates` (dots on dates). `v-model` — `[Date, Date]` array.
