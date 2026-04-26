# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Не запускай команды сборщика и линтера самостоятельно** (`npm run dev`, `npm run build`, `npm run build-css`, `eslint` и т. п.). Сборку, dev-режим и линт пользователь запускает сам — просто вноси изменения в код. Команды выше приведены только как справка по проекту.

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

### Critical constraints

- **Do not use `<style>` blocks in Vue components used inside content scripts.** The CRXJS build pipeline injects these into `document.head`, which breaks content script isolation. Use Tailwind utility classes or inject styles via JS instead.
- **Tailwind CSS is compiled separately** (`build-css` script). New Tailwind utility classes won't hot-reload; run `npm run build-css` after adding new classes.
- **Update version in `package.json`** before publishing (CRXJS reads it for `manifest.json`).

### "Что нового" после обновления

При каждом обновлении расширения `src/background/index.js` автоматически открывает вкладку `whats-new.html`.

- **`src/whats-new/changelog.js`** — массив объектов `{ version, date, description, images[] }`. **При каждом релизе добавляй новый элемент в начало этого массива.**
- **`src/whats-new/WhatsNewApp.vue`** — страница с аккордеоном версий (PrimeVue Accordion).
- **`src/whats-new/main.js`** — точка входа Vue-приложения.
- **`whats-new.html`** — HTML-обёртка (в корне проекта, как `popup.html`).
- **`vite.config.js`** — `whats-new.html` добавлен в `rollupOptions.input`, чтобы CRXJS собирал его как отдельную страницу.
- Изображения для страницы храни в `public/assets/whats-new/` и указывай пути вида `/assets/whats-new/image.png` в `changelog.js`.

### MCP-серверы

- **b24-dev-mcp** — официальная документация Bitrix24 REST API. Используй инструменты `bitrix-search`, `bitrix-method-details`, `bitrix-event-details`, `bitrix-article-details` для поиска методов и событий API. Инструкция по подключению: https://apidocs.bitrix24.ru/sdk/mcp.html#claude-code-cli

### Shared utilities

- `src/js/BitrixApi.js` — Axios-based wrapper for Bitrix24 REST API calls using the session ID.
- `src/js/utils.js` — DOM helpers, string utilities, and observer utilities used across feature modules.
- `src/js/primeVueOptions.js` — PrimeVue theme/preset configuration shared by all Vue apps.
