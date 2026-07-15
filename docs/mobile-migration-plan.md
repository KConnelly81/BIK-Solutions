# Mobile Migration Plan

**Purpose:** Assess the current BIK Variation Generator architecture against mobile app requirements and map the fastest path to Android and iOS deployment.
**Date:** 2026-07-15
**Status:** Planning only — no migration has begun
**Owner:** BIK Solutions Pty Ltd

---

## Executive Summary

The current codebase has a strong separation between business logic and UI. Approximately 60% of the existing code can be reused in a mobile app with no changes. The fastest realistic path to Android and iOS is **React Native** using a **shared JavaScript business logic library** extracted from the existing toolkit modules. Total estimated effort: 6–10 weeks for a feature-equivalent mobile app once the shared library is extracted.

---

## Current Architecture Assessment

### Components That Are Already Reusable

These modules contain zero DOM, zero browser, and zero framework code. They are plain JavaScript and can run in React Native, Node, or any JS environment without modification.

| Module | What It Does | Reusable As-Is |
|---|---|---|
| `js/toolkit/calculator.js` | GST calculation, currency formatting, date helpers | Yes — pure functions |
| `js/toolkit/analytics.js` | Event stub with `ANALYTICS_INTEGRATION_POINT` | Yes — already abstracted |
| `js/toolkit/ai-writer.js` | AI text rewriting via Anthropic API | Yes — `fetch` works in React Native |
| `js/tools/variation-notice/config.js` | Field schema + document template | Partial — `generateDocument()` produces HTML, needs adaptation for PDF output on mobile |

These should be extracted to a shared package (`@bik/core`) as the first step.

### Components That Should Be Refactored for Reuse

These have strong business logic but are coupled to DOM or browser APIs.

| Module | Issue | Refactor Path |
|---|---|---|
| `js/toolkit/engine.js` | `FormEngine` — tightly coupled to `document.createElement`, `localStorage`, DOM events | Extract validation, state, and autosave logic into framework-agnostic classes. Render layer becomes a React Native component tree. |
| `js/toolkit/renderer.js` | `DocumentRenderer` — calls `innerHTML`, `contenteditable` | Replace with a React Native `<ScrollView>` tree or WebView for rendering the document preview. |
| `js/toolkit/exporter.js` | `ExportManager` — uses `window.print()` and `document.execCommand` | Both are browser-only. Replace `print()` with `react-native-pdf` or `expo-print`. Replace clipboard with `@react-native-clipboard/clipboard`. |

### Website-Specific Code to Keep Separate

Do not carry this into the mobile codebase — it has no relevance on mobile and would only create confusion.

- `css/styles.css` — entire main site stylesheet
- `css/toolkit-app.css` — web app shell layout
- `variation-generator.html` — static HTML entry point
- `ai-documents.html`, `toolkit.html`, and all other marketing pages
- `js/main.js` — nav toggle, scroll animations
- Mobile tab switching logic in `index.js` (replaced by native navigation)
- The `hidden-mobile` CSS class pattern (replaced by native screens)
- Print CSS (`@media print`) — no equivalent on mobile
- `window.print()`, `document.title` manipulation, `window.location`

### Shared Business Logic — What Becomes `@bik/core`

The following logic is the canonical single source of truth and must not be duplicated:

```
@bik/core (npm package or monorepo package)
  src/
    calculator.js        — GST, currency, dates (copy verbatim)
    analytics.js         — event stubs (copy verbatim)
    ai-writer.js         — AIWriter class (copy verbatim)
    schema/
      variation-notice.js  — SCHEMA array (copy verbatim, remove defaultValue() functions
                             that call localStorage — replace with explicit defaults)
    validation.js        — isValid(), completionPct(), validateField() (extracted from engine.js)
    state.js             — form state management, profile persistence (extracted from engine.js)
    document-generator.js — generateDocument() adapted to return structured data, not HTML
```

The website continues importing from its own `js/toolkit/` copies. The mobile app imports from `@bik/core`. When one changes, a publish bumps the version and both platforms pull the update.

### Dependencies That Would Make Mobile Deployment Difficult

| Dependency | Risk | Resolution |
|---|---|---|
| `localStorage` | Not available in React Native | Replace with `@react-native-async-storage/async-storage` — same key/value API, async instead of sync. Abstracted via a `Storage` adapter in `@bik/core`. |
| `window.print()` | Not available in React Native | Replace with `expo-print` or `react-native-pdf-lib` for PDF generation. A4 layout is reproduced as a React Native document component, not CSS. |
| `document.execCommand('copy')` | Not available in React Native | Replace with `@react-native-clipboard/clipboard`. |
| `contenteditable` (edit mode) | Not available in React Native | Replace with a native `<TextInput multiline>` overlay on the document preview. |
| `fetch` with Anthropic API | Works in React Native | No change needed. Same `AIWriter._callAPI()` code runs. |
| `innerHTML` in DocumentRenderer | Not available in React Native | Replace with a React Native component tree that maps form state to rendered JSX. |
| ES6 modules (`import`/`export`) | Works in React Native via Metro bundler | No change needed. |
| CSS custom properties | Not available in React Native | Re-express as a JavaScript theme object: `{ charcoal: '#252320', coral: '#D85A30', ... }`. One-time conversion. |

---

## Migration Architecture

### Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| Mobile framework | React Native (with Expo) | Code sharing with potential future web React version; large ecosystem; Expo handles native builds without Xcode/Android Studio locally |
| Navigation | React Navigation (stack + bottom tabs) | Industry standard; handles form/preview/settings flow |
| Storage | `@react-native-async-storage/async-storage` | Drop-in localStorage equivalent |
| PDF export | `expo-print` + `expo-sharing` | Renders HTML to PDF and triggers native share sheet |
| Clipboard | `@react-native-clipboard/clipboard` | Direct equivalent of `copyText()` |
| AI calls | Existing `AIWriter` class (no change) | `fetch` works in React Native |
| Forms | Custom React Native components (mirrors FormEngine output) | No FormEngine DOM coupling; same SCHEMA drives both |
| State | React `useState` + `useReducer` or Zustand | Replaces the stateful `FormEngine` class |

### Monorepo Structure (Fastest Path)

```
bik-solutions/          ← existing repo (web)
bik-mobile/             ← new repo (React Native)
bik-core/               ← new package (shared logic)
  package.json
  src/
    calculator.js
    analytics.js
    ai-writer.js
    schema/variation-notice.js
    validation.js
    document-generator.js
    storage-adapter.js  ← abstract interface over localStorage / AsyncStorage
    theme.js            ← JS token object replacing CSS custom properties
```

Or as a monorepo (`pnpm workspaces` or `nx`):
```
packages/
  @bik/core/
  @bik/web/            ← existing site
  @bik/mobile/         ← React Native app
```

---

## Fastest Path to Android + iOS

### Phase 1 — Extract shared library (1–2 weeks)

1. Create `@bik/core` package.
2. Copy `calculator.js`, `analytics.js`, `ai-writer.js` verbatim.
3. Extract schema from `config.js` (strip `defaultValue` functions that call `localStorage`).
4. Extract validation + state logic from `engine.js` into framework-agnostic functions.
5. Create `StorageAdapter` interface with two implementations: `localStorage` (web) and `AsyncStorage` (mobile).
6. The web toolkit imports from `@bik/core` — verify the website still works.

### Phase 2 — Build React Native app shell (1–2 weeks)

1. Initialise Expo project (`npx create-expo-app bik-mobile`).
2. Set up navigation: Home screen → Variation Generator screen (Form tab, Preview tab).
3. Build the form renderer as React Native components, driven by the SCHEMA from `@bik/core`.
4. Implement `StorageAdapter` for AsyncStorage (autosave, builder profile, variation counter).

### Phase 3 — Document generation + export (2–3 weeks)

1. Adapt `generateDocument()` to produce a React Native JSX tree (or an HTML string consumed by `expo-print`).
2. The simplest approach: render the existing HTML template inside `expo-print` — reuse `generateDocument()` as-is, call `Print.printAsync({ html })` to produce a PDF and trigger the share sheet.
3. Implement clipboard copy via `@react-native-clipboard/clipboard`.
4. Wire up `AIWriter` — no changes needed.

### Phase 4 — Polish + submission (2–3 weeks)

1. App icon, splash screen, store metadata.
2. Expo EAS Build for Android (AAB) and iOS (IPA).
3. Submit to Google Play and Apple App Store.

### Minimum Viable Mobile Feature Set (Variation Generator)

- Builder profile (name, ABN, phone, email — persisted in AsyncStorage)
- 25-field form with validation and progress indicator
- Live GST calculator
- AI Professional Writer (both modes)
- Native PDF export via share sheet
- Autosave with draft restore

---

## Code Reuse Summary

| Code | Web | Mobile | Notes |
|---|---|---|---|
| `calculator.js` | Yes | Yes | Zero changes |
| `analytics.js` | Yes | Yes | Zero changes |
| `ai-writer.js` | Yes | Yes | Zero changes |
| SCHEMA definition | Yes | Yes | Strip DOM-dependent defaultValues |
| `generateDocument()` HTML template | Yes | Reused via expo-print | HTML → PDF on mobile |
| Form validation logic | Yes (in engine.js) | Yes | Extract to `@bik/core` |
| Form state management | Yes (in engine.js) | Reimplemented | React useState replaces the class |
| Form rendering | Yes (DOM/engine.js) | Reimplemented | React Native components |
| Document preview | Yes (renderer.js) | Reimplemented | WebView or RN component tree |
| Clipboard export | Yes (exporter.js) | Different library | Same interface |
| PDF export | Browser print dialog | expo-print | Different mechanism, same UX |
| CSS styles | Yes | No | Re-expressed as JS theme tokens |
| Nav/header/tabs | HTML + CSS | React Navigation | Platform-native equivalent |

**Estimated reuse: ~60% of business logic, 0% of UI code.**

---

## What to Avoid

- **Do not embed a WebView for the full app UI.** Hybrid WebView apps are possible but perform poorly, have inconsistent native feel, and lose access to native APIs. Use React Native components for UI; WebView only for the document preview/print step if HTML reuse outweighs the trade-offs.
- **Do not duplicate the SCHEMA.** Maintain one definition in `@bik/core`. Both platforms import it.
- **Do not duplicate calculator or AI logic.** Any duplication will diverge. Single source of truth.
- **Do not start with an Xcode or Android Studio setup.** Expo handles builds in the cloud (EAS Build). Start with `npx create-expo-app` and build locally until a native module forces you onto bare workflow.

---

## Related Documents

- [technical-architecture.md](technical-architecture.md) — current Phase 1/2/3 architecture
- [decisions/README.md](decisions/README.md) — ADRs 001–007
- [specifications/document-intelligence-engine.md](specifications/document-intelligence-engine.md) — SPEC-001 engine reference
