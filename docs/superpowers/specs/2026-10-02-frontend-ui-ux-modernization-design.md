# Frontend UI/UX Modernization & Rendering Optimization Design

- **Status:** Approved
- **Date:** 2026-10-02
- **Topic:** Frontend UI/UX Modernization, Design System Integration, and Re-render Optimization
- **Target Application:** `frontend` (React 18 + Vite + TypeScript)

---

## 1. Problem Statement & Motivation

The GastroForge Appresso frontend is an operations dashboard for fraud detection and sliding-window anomaly analysis. While functionally complete, the current user interface presents several usability and aesthetic deficiencies:

1. **Unbalanced Metric Grid:** The 6 aggregated metric cards are styled using `repeat(auto-fit, minmax(260px, 1fr))`, causing wide viewports to show 5 cards in row 1 and a single isolated card ("Impacto por Usuario") in row 2.
2. **Cumulative Layout Shifts (CLS):** 
   - Clicking "Actualizar" replaces button text with "Actualizando...", shifting header elements.
   - When the timeseries dataset is empty (`points.length === 0`), the header subtitle and bucket buttons ("Por Hora" / "Por Día") unmount, causing the container height to collapse abruptly.
3. **Cascading Re-renders & Flickering:** 
   - Switching date ranges (24h, 7 days, 30 days) triggers full re-renders of unmemoized components.
   - Initial loading skeletons abruptly swap and unmount existing data during background updates.
4. **Design Inconsistency:**
   - Raw CSS in `App.css` lacks formal design tokens.
   - Interface uses emojis (`🛡️`, `↻`) instead of clean vector iconography.
   - High-contrast numbers without tabular spacing cause visual trembling on data updates.

---

## 2. Goals & Non-Goals

### Goals
- **Professional Aesthetics:** Implement a modern *Fintech Dark Ops* visual system using Tailwind CSS and Lucide React icons.
- **Symmetric Layout:** Ensure a balanced 3x2 grid layout (or responsive 1/2/3-column steps) for metric cards with zero orphaned cards.
- **Zero Layout Shift (Zero CLS):** Keep button dimensions and chart containers strictly sized with persistent controls even in empty states.
- **Optimized Rendering:** Wrap key dashboard components in `React.memo` and implement non-destructive background re-fetching so current data remains visible while loading.
- **Hardware-Accelerated Transitions:** Confine animations to `transform` and `opacity` for smooth 60fps drawer slide-overs and micro-interactions.

### Non-Goals
- Changing backend API contracts or DTO structures.
- Introducing heavy UI framework libraries (e.g., Material UI or Chakra) beyond utility-first Tailwind CSS and Lucide icons.
- Altering the mathematical calculations or business rules for anomaly detection.

---

## 3. Architecture & Design Specifications

### 3.1 Design System & Visual Tokens (Tailwind CSS)

- **Color Palette (Fintech Dark Ops):**
  - **Background Base:** `bg-slate-950` with page wrapper in `bg-slate-950 text-slate-100`.
  - **Panels & Cards:** `bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl shadow-lg shadow-black/20`.
  - **Primary & Operational Accents:**
    - `sky-400` / `sky-500`: General activity, transaction volumes, primary action buttons.
    - `rose-500` / `rose-400`: Anomaly alerts, critical risk rates, suspicious windows.
    - `emerald-400` / `emerald-500`: Healthy state indicators, resolved episodes, stable thresholds.
    - `amber-400`: In-review episodes and warning markers.
- **Typography:**
  - Standard sans-serif for interface copy.
  - `font-mono tabular-nums` applied to all monetary figures (`COP`) and numeric metrics to prevent visual jumps during data refresh.
- **Iconography (`lucide-react`):**
  - Replace `🛡️` with `ShieldCheck` / `ShieldAlert`.
  - Replace `↻` with `RefreshCw`.
  - Add `Activity`, `TrendingUp`, `Users`, `DollarSign`, `Calendar`, `ChevronRight`, `AlertCircle`, and `X` across cards, tables, and drawers.

### 3.2 Layout & Grid Symmetry

- **Metric Cards Grid:**
  - Container classes: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
  - Exactly 6 cards arranged in 2 balanced rows of 3 on desktop, 3 rows of 2 on tablets, and 6 rows of 1 on mobile.
- **Main Container:**
  - `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6`.

### 3.3 Zero CLS & Anti-Flicker Strategy

1. **Header Action Controls:**
   - "Actualizar" button uses a fixed width or constant label text `"Actualizar"`.
   - When updating (`isMetricsLoading === true`), the `RefreshCw` icon adds `animate-spin`, while keeping text stable.
2. **Timeseries Chart Consistency:**
   - The card header, title ("Evolución Temporal de Actividad y Detecciones"), subtitle, and bucket toggles ("Por Hora" / "Por Día") render permanently.
   - The chart area maintains a fixed min-height (`min-h-[260px]`).
   - If `timeseries.data` is empty, an elegant empty state illustration with subtle grid pattern is displayed inside that fixed viewport without altering parent bounds.
3. **Background Updates vs Cold Starts:**
   - Full skeleton loading (`LoadingSkeleton`) is displayed only on initial cold boot when `overview === null`.
   - On subsequent updates (changing range preset or clicking "Actualizar"), existing data stays visible. A discreet top progress indicator or spinning refresh icon communicates activity without blanking the screen.

### 3.4 Component Optimization & Memoization

Each main dashboard section is isolated to prevent cascading render thrashing:
- `MetricCards`: Memoized with `React.memo`. Re-renders only when `overview` reference changes.
- `TimeseriesChart`: Memoized with `React.memo`. Re-renders only when `timeseries` or `bucket` changes.
- `EpisodesTable`: Memoized with `React.memo`. Re-renders only when `episodes`, `total`, `currentPage`, `selectedStatus`, or `isLoading` changes.
- `TimelineDrawer`: Hardware-accelerated slide-over using Tailwind transitions (`translate-x-0` vs `translate-x-full`) with a `bg-slate-950/70 backdrop-blur-sm` overlay.

---

## 4. Dependencies & Build Configuration

- **New Dependencies:**
  - `lucide-react`: Lightweight, tree-shakeable icons.
- **New Dev Dependencies:**
  - `tailwindcss`: Utility CSS framework.
  - `postcss`: CSS post-processing.
  - `autoprefixer`: Vendor prefix management.
- **Configuration Files:**
  - `frontend/tailwind.config.js`: Configured to scan `./index.html` and `./src/**/*.{ts,tsx}`.
  - `frontend/postcss.config.js`: PostCSS pipeline configuration.
  - `frontend/src/index.css`: Replaces monolithic `App.css` with `@tailwind base; @tailwind components; @tailwind utilities;` and minimal custom utility classes.

---

## 5. Verification & Testing Strategy

1. **Unit Tests (Vitest):**
   - Ensure existing `api.spec.ts` passes (`npm test`).
   - Add unit tests for currency/number formatting and component render stability if applicable.
2. **Type Safety:**
   - Execute `npx tsc --noEmit` from `frontend` to verify strict TypeScript adherence with no broken props.
3. **Production Build:**
   - Run `npm run build` in `frontend` to ensure tree-shaking, CSS bundling, and zero asset resolution warnings.
4. **Visual & Interaction Verification:**
   - Verify 3x2 card grid symmetry at multiple viewport resolutions (mobile, tablet, desktop).
   - Verify zero layout shift when clicking "Actualizar".
   - Verify smooth 60fps drawer slide-over and overlay backdrop blur.
