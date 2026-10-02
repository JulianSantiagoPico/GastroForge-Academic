# Frontend UI/UX Modernization & Rendering Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the GastroForge Appresso dashboard UI/UX with Tailwind CSS and Lucide React, fixing layout shifts, unbalanced metric grids, and cascading re-render flickers.

**Architecture:** Replace raw `App.css` with a utility-first Tailwind CSS design system (*Fintech Dark Ops* palette) and Lucide React iconography. Eliminate Cumulative Layout Shifts (CLS) by locking button and chart viewport dimensions across loading and empty states, and isolate render trees using `React.memo` and stable callbacks.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, PostCSS, Autoprefixer, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-frontend-ui-ux-modernization-design.md`

## Global Constraints

- Must preserve existing API contracts in `frontend/src/services/api.ts` and types in `frontend/src/types/api.ts`.
- Must not introduce UI component mega-libraries (MUI, Chakra, AntD); use utility-first Tailwind CSS and Lucide React.
- Must eliminate Cumulative Layout Shift (CLS) on refresh and range preset switches.
- Must use `font-mono tabular-nums` for all numeric amounts and currency values (`formatCurrency`, `formatNumber`).
- Metric cards must form a balanced 3x2 grid layout on desktop viewports with zero orphaned cards.
- All dashboard child components must be memoized with `React.memo`.
- Must pass `npm test` and `npm run build` cleanly.

## Review Focus

1. **Empty timeseries dataset:** When `timeseries.data` is empty, chart controls and subtitles must remain rendered and visible within a fixed-height container instead of unmounting.
2. **Refresh button state change:** While `isMetricsLoading` is true, the button width and label must remain unchanged without pushing adjacent header elements.
3. **Card grid alignment at high resolutions:** On displays > 1280px, exactly 6 cards must occupy 2 balanced rows of 3 columns rather than 5 items in row 1 and 1 in row 2.
4. **Subsequent background data refresh:** Changing range presets (24h/7d/30d) with loaded data present must not flash full-screen skeletons or unmount existing data.
5. **Timeline slide-over performance:** Opening and closing `TimelineDrawer` must trigger CSS transform transitions without stuttering or DOM layout reflows.

---

### Task 1: Setup Tailwind CSS, PostCSS, Autoprefixer, and Lucide React

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/index.css`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: None (build tooling and CSS baseline)
- Produces: Tailwind utility classes, custom slate/fintech theme, and `lucide-react` icons available across all components.

- [ ] **Step 1: Install Tailwind CSS, PostCSS, Autoprefixer, and Lucide React**

Run in `frontend`:
```bash
npm install lucide-react
npm install -D tailwindcss@^3.4.17 postcss autoprefixer
```

- [ ] **Step 2: Create Tailwind configuration**

Create `frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#070d19',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Create PostCSS configuration**

Create `frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Create base stylesheet and import in main.tsx**

Create `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-950 text-slate-100 antialiased selection:bg-sky-500/30 selection:text-sky-200;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
}
```

Update `frontend/src/main.tsx` to import `./index.css`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Verify build with Tailwind setup**

Run in `frontend`:
```bash
npm run build
```
Expected: Build succeeds without CSS processing errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.js frontend/postcss.config.js frontend/src/index.css frontend/src/main.tsx
git commit -m "chore(frontend): configure tailwindcss postcss and lucide-react"
```

---

### Task 2: Redesign and Memoize `MetricCards.tsx`

**Files:**
- Modify: `frontend/src/components/MetricCards.tsx`
- Create: `frontend/src/components/MetricCards.spec.ts`

**Interfaces:**
- Consumes: `AnalyticsOverview` from `frontend/src/types/api.ts`
- Produces: Memoized `MetricCards: React.FC<{ overview: AnalyticsOverview }>` with balanced 3x2 grid and `lucide-react` icons.

- [ ] **Step 1: Write unit tests for formatters and metric calculations**

Create `frontend/src/components/MetricCards.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from './MetricCards';

describe('MetricCards formatters', () => {
  it('formats Colombian Peso currency accurately with no fractions', () => {
    const formatted = formatCurrency(1500000);
    expect(formatted).toContain('1.500.000');
    expect(formatted).toContain('$');
  });

  it('formats integers with locale number formatting', () => {
    expect(formatNumber(12500)).toBe('12.500');
    expect(formatNumber(0)).toBe('0');
  });
});
```

- [ ] **Step 2: Run unit test to verify formatters**

Run in `frontend`:
```bash
npx vitest run src/components/MetricCards.spec.ts
```
Expected: PASS.

- [ ] **Step 3: Implement Tailwind redesign and React.memo in `MetricCards.tsx`**

Replace `frontend/src/components/MetricCards.tsx` with:
```tsx
import React from 'react';
import {
  Activity,
  DollarSign,
  AlertTriangle,
  FolderOpen,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { AnalyticsOverview } from '../types/api';

interface MetricCardsProps {
  overview: AnalyticsOverview;
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('es-CO').format(num);
};

export const MetricCards: React.FC<MetricCardsProps> = React.memo(({ overview }) => {
  const { transactions, episodes, fraud } = overview;
  const isSuspicious = fraud.suspiciousRate > 0 || episodes.openEpisodes > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. Transacciones Totales */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors hover:border-slate-700/80">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Transacciones Totales
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Activity className="w-3 h-3" />
              Volumen
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
            {formatNumber(transactions.total)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Promedio diario:{' '}
            <strong className="text-slate-200 font-mono tabular-nums">
              {formatNumber(transactions.perDayAverage)}
            </strong>{' '}
            / día
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>Sem: {formatNumber(transactions.perWeekAverage)}</span>
          <span>•</span>
          <span>Mes: {formatNumber(transactions.perMonthAverage)}</span>
        </div>
      </div>

      {/* 2. Valor Procesado */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors hover:border-slate-700/80">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Valor Procesado
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-3 h-3" />
              Monto
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
            {formatCurrency(transactions.totalValue)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ticket promedio:{' '}
            <strong className="text-slate-200 font-mono tabular-nums">
              {formatCurrency(transactions.averageValue)}
            </strong>
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>Moneda base: COP</span>
        </div>
      </div>

      {/* 3. Tasa Sospechosa */}
      <div
        className={`bg-slate-900/60 border rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors ${
          isSuspicious
            ? 'border-rose-500/40 bg-gradient-to-b from-rose-500/5 to-slate-900/60'
            : 'border-slate-800/80 hover:border-slate-700/80'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tasa Sospechosa
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border font-mono tabular-nums ${
                isSuspicious
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              {fraud.suspiciousRate.toFixed(1)}%
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-rose-400 font-mono tabular-nums">
            {formatNumber(fraud.suspiciousTransactions)}{' '}
            <span className="text-lg font-normal text-slate-400">txns</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Transacciones involucradas en ventanas anómalas
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>
            Valor sospechoso:{' '}
            <strong className="text-rose-400 font-mono tabular-nums">
              {formatCurrency(fraud.suspiciousValue)}
            </strong>
          </span>
        </div>
      </div>

      {/* 4. Episodios de Anomalía */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors hover:border-slate-700/80">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Episodios de Anomalía
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono tabular-nums">
              <FolderOpen className="w-3 h-3" />
              {episodes.totalEpisodes} total
            </span>
          </div>
          <div className="flex items-baseline gap-4 font-mono tabular-nums">
            <div className="text-xs text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
              Abiertos: <strong className="text-white text-base">{episodes.openEpisodes}</strong>
            </div>
            <div className="text-xs text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-1.5" />
              Cerrados: <strong className="text-white text-base">{episodes.closedEpisodes}</strong>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            Revisados: <strong className="text-white font-mono tabular-nums">{episodes.reviewedEpisodes}</strong>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>Descartados: {episodes.dismissedEpisodes}</span>
        </div>
      </div>

      {/* 5. Usuarios Afectados */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors hover:border-slate-700/80">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Usuarios Afectados
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Users className="w-3 h-3" />
              Clientes
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
            {formatNumber(fraud.affectedUsers)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Clientes con al menos 1 detección activa
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>Usuarios recurrentes: <strong className="text-amber-400 font-mono tabular-nums">{fraud.recurringUsers}</strong></span>
        </div>
      </div>

      {/* 6. Impacto por Usuario */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between backdrop-blur-sm transition-colors hover:border-slate-700/80">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Impacto por Usuario
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-3 h-3" />
              Riesgo
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
            {formatCurrency(fraud.averageExposurePerUser)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Promedio de fondos retenidos o sospechosos por cliente
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>Ventana deslizante activa</span>
        </div>
      </div>
    </div>
  );
});

MetricCards.displayName = 'MetricCards';
```

- [ ] **Step 4: Run tests and verify compile**

Run in `frontend`:
```bash
npx vitest run src/components/MetricCards.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MetricCards.tsx frontend/src/components/MetricCards.spec.ts
git commit -m "feat(frontend): modernize MetricCards with balanced 3x2 grid and memoization"
```

---

### Task 3: Redesign and Memoize `TimeseriesChart.tsx` (Zero CLS)

**Files:**
- Modify: `frontend/src/components/TimeseriesChart.tsx`

**Interfaces:**
- Consumes: `AnalyticsTimeseries`, `TimeseriesBucket` from `frontend/src/types/api.ts`
- Produces: Memoized `TimeseriesChart` with permanent header, bucket toggles, and fixed-height empty state (Zero CLS).

- [ ] **Step 1: Implement Tailwind redesign with Zero-CLS container**

Update `frontend/src/components/TimeseriesChart.tsx`:
```tsx
import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AnalyticsTimeseries, TimeseriesBucket, TimeseriesPoint } from '../types/api';
import { formatCurrency, formatNumber } from './MetricCards';

interface TimeseriesChartProps {
  timeseries: AnalyticsTimeseries;
  bucket: TimeseriesBucket;
  onBucketChange: (bucket: TimeseriesBucket) => void;
}

export const TimeseriesChart: React.FC<TimeseriesChartProps> = React.memo(({
  timeseries,
  bucket,
  onBucketChange,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeseriesPoint | null>(null);

  const points = timeseries.data || [];
  const hasData = points.length > 0;

  // Chart dimensions
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxTxns = Math.max(...points.map((p) => p.transactionCount), 1);
  const maxAnomalies = Math.max(...points.map((p) => p.anomalyCount), 1);
  const barWidth = Math.max(4, Math.min(24, chartWidth / Math.max(points.length, 1) - 4));

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 backdrop-blur-sm flex flex-col gap-4">
      {/* Header is ALWAYS rendered, preventing layout shifts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">
              Evolución Temporal de Actividad y Detecciones
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Transacciones procesadas vs transacciones marcadas por la ventana deslizante
          </p>
        </div>

        {/* Bucket switch controls are always mounted */}
        <div className="inline-flex p-1 bg-slate-950/80 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              bucket === 'hour'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => onBucketChange('hour')}
          >
            Por Hora
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              bucket === 'day'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => onBucketChange('day')}
          >
            Por Día
          </button>
        </div>
      </div>

      {/* Chart container with fixed height */}
      <div className="relative min-h-[240px] flex items-center justify-center">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
            <BarChart3 className="w-8 h-8 stroke-1 text-slate-600" />
            <p className="text-sm font-medium">No hay datos en la serie temporal para el intervalo actual.</p>
            <p className="text-xs text-slate-600">Probá ampliando el rango a 7 o 30 días.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto max-h-[260px] overflow-visible"
            >
              {/* Ejes de guía horizontales */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + chartHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#334155"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {formatNumber(Math.round(maxTxns * ratio))}
                    </text>
                  </g>
                );
              })}

              {/* Barras de Transacciones Totales */}
              {points.map((p, idx) => {
                const x = padding.left + (idx + 0.5) * (chartWidth / points.length) - barWidth / 2;
                const barH = (p.transactionCount / maxTxns) * chartHeight;
                const y = padding.top + chartHeight - barH;

                return (
                  <rect
                    key={p.timestamp}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill="#38bdf8"
                    opacity={hoveredPoint?.timestamp === p.timestamp ? 1 : 0.65}
                    rx="2"
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* Línea de Anomalías */}
              {points.length > 1 && (
                <path
                  d={points.reduce((acc, p, idx) => {
                    const x = padding.left + (idx + 0.5) * (chartWidth / points.length);
                    const y = padding.top + chartHeight - (p.anomalyCount / maxAnomalies) * chartHeight;
                    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
              )}

              {/* Puntos de Anomalías */}
              {points.map((p, idx) => {
                if (p.anomalyCount === 0) return null;
                const cx = padding.left + (idx + 0.5) * (chartWidth / points.length);
                const cy = padding.top + chartHeight - (p.anomalyCount / maxAnomalies) * chartHeight;

                return (
                  <circle
                    key={`dot-${p.timestamp}`}
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint?.timestamp === p.timestamp ? 5 : 3.5}
                    fill="#f43f5e"
                    stroke="#0f172a"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>

            {/* Tooltip flotante */}
            {hoveredPoint && (
              <div className="absolute top-2 right-2 bg-slate-950/90 border border-slate-700 rounded-lg p-2.5 shadow-xl text-xs backdrop-blur-md font-mono pointer-events-none">
                <div className="text-slate-400 font-semibold mb-1">
                  {new Date(hoveredPoint.timestamp).toLocaleString('es-CO')}
                </div>
                <div className="text-sky-400">
                  Transacciones: <strong>{formatNumber(hoveredPoint.transactionCount)}</strong>
                </div>
                <div className="text-rose-400">
                  Anomalías: <strong>{formatNumber(hoveredPoint.anomalyCount)}</strong>
                </div>
                <div className="text-slate-300">
                  Monto: <strong>{formatCurrency(hoveredPoint.totalAmount)}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

TimeseriesChart.displayName = 'TimeseriesChart';
```

- [ ] **Step 2: Verify component compiles with type check**

Run in `frontend`:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TimeseriesChart.tsx
git commit -m "feat(frontend): eliminate chart layout shift and add Lucide header controls"
```

---

### Task 4: Redesign and Memoize `EpisodesTable.tsx`

**Files:**
- Modify: `frontend/src/components/EpisodesTable.tsx`

**Interfaces:**
- Consumes: `AnomalyEpisodeListItem` from `frontend/src/types/api.ts`
- Produces: Memoized `EpisodesTable` with styled filter pills, tabular numbers, clean status badges, and sticky table header.

- [ ] **Step 1: Implement Tailwind redesign in `EpisodesTable.tsx`**

Replace `frontend/src/components/EpisodesTable.tsx` with:
```tsx
import React from 'react';
import { ChevronLeft, ChevronRight, Eye, ShieldAlert, CheckCircle, Clock, XCircle } from 'lucide-react';
import { AnomalyEpisodeListItem } from '../types/api';

interface EpisodesTableProps {
  episodes: AnomalyEpisodeListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  onPageChange: (page: number) => void;
  onSelectEpisode: (episodeId: string) => void;
  isLoading?: boolean;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3 h-3" /> Abierto
        </span>
      );
    case 'IN_REVIEW':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" /> En Revisión
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3" /> Resuelto
        </span>
      );
    case 'DISMISSED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <XCircle className="w-3 h-3" /> Descartado
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
};

export const EpisodesTable: React.FC<EpisodesTableProps> = React.memo(({
  episodes,
  total,
  currentPage,
  pageSize,
  selectedStatus,
  onStatusChange,
  onPageChange,
  onSelectEpisode,
  isLoading = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-lg shadow-black/20 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Table header & filters */}
      <div className="p-5 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Listado de Episodios de Anomalía</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
            Mostrando {episodes.length} de {total} episodios registrados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-select" className="text-xs text-slate-400">
            Filtrar por estado:
          </label>
          <select
            id="status-select"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">Todos los estados</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_REVIEW">En Revisión</option>
            <option value="RESOLVED">Resuelto</option>
            <option value="DISMISSED">Descartado</option>
          </select>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <span className="text-xs text-sky-400 font-mono animate-pulse">Actualizando lista...</span>
          </div>
        )}

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">ID Episodio</th>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Regla</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Transacciones</th>
              <th className="py-3 px-4">Fecha Apertura (UTC)</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No hay episodios que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              episodes.map((ep) => (
                <tr
                  key={ep.id}
                  className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                  onClick={() => onSelectEpisode(ep.id)}
                >
                  <td className="py-3 px-4 font-mono text-sky-400 group-hover:underline">
                    {ep.id.substring(0, 8)}...
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {ep.userId.substring(0, 10)}...
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-medium">
                    {ep.ruleTriggered || 'Ventana deslizante'}
                  </td>
                  <td className="py-3 px-4">{statusBadge(ep.status)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {ep.transactionCount}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono tabular-nums">
                    {new Date(ep.openedAt).toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEpisode(ep.id);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver Detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="p-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 bg-slate-950/20">
        <span className="font-mono tabular-nums">
          Página {currentPage} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

EpisodesTable.displayName = 'EpisodesTable';
```

- [ ] **Step 2: Verify type check passes**

Run in `frontend`:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EpisodesTable.tsx
git commit -m "feat(frontend): redesign EpisodesTable with Tailwind and Lucide icons"
```

---

### Task 5: Redesign and Memoize `TimelineDrawer.tsx`

**Files:**
- Modify: `frontend/src/components/TimelineDrawer.tsx`

**Interfaces:**
- Consumes: `EpisodeTimeline` from `frontend/src/types/api.ts`
- Produces: Memoized `TimelineDrawer` with GPU-accelerated Tailwind transitions and backdrop blur.

- [ ] **Step 1: Implement Tailwind slide-over in `TimelineDrawer.tsx`**

Replace `frontend/src/components/TimelineDrawer.tsx` with:
```tsx
import React, { useEffect } from 'react';
import { X, Clock, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { EpisodeTimeline } from '../types/api';
import { formatCurrency, formatNumber } from './MetricCards';

interface TimelineDrawerProps {
  isOpen: boolean;
  timeline: EpisodeTimeline | null;
  onClose: () => void;
  isLoading: boolean;
}

export const TimelineDrawer: React.FC<TimelineDrawerProps> = React.memo(({
  isOpen,
  timeline,
  onClose,
  isLoading,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out translate-x-0">
          {/* Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-semibold text-white">Línea de Tiempo del Episodio</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {timeline ? `ID: ${timeline.episodeId.substring(0, 12)}...` : 'Cargando...'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Cargando eventos de la ventana...</span>
              </div>
            ) : !timeline ? (
              <div className="text-center text-slate-500 py-12 text-sm">
                No se encontró información del episodio.
              </div>
            ) : (
              <>
                {/* Resumen superior */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Usuario:</span>
                    <span className="font-mono text-slate-200">{timeline.userId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Regla disparada:</span>
                    <span className="font-medium text-rose-400">{timeline.ruleTriggered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total transacciones:</span>
                    <span className="font-mono tabular-nums text-white font-semibold">
                      {timeline.events.length}
                    </span>
                  </div>
                </div>

                {/* Eventos cronológicos */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                    Secuencia de Transacciones
                  </h4>
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {timeline.events.map((evt, idx) => {
                      const isAnomaly = evt.isAnomaly;
                      return (
                        <div key={evt.id || idx} className="relative group">
                          {/* Dot */}
                          <div
                            className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-slate-900 flex items-center justify-center ${
                              isAnomaly
                                ? 'border-rose-500 text-rose-400'
                                : 'border-slate-600 text-slate-400'
                            }`}
                          >
                            {isAnomaly ? (
                              <AlertTriangle className="w-2 h-2" />
                            ) : (
                              <ShieldCheck className="w-2 h-2" />
                            )}
                          </div>

                          <div
                            className={`p-3 rounded-lg border text-xs transition-colors ${
                              isAnomaly
                                ? 'bg-rose-500/5 border-rose-500/30'
                                : 'bg-slate-950/40 border-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-slate-400 font-mono tabular-nums text-[11px] mb-1">
                              <span>{new Date(evt.timestamp).toLocaleTimeString('es-CO')}</span>
                              <span className="text-slate-500">#{idx + 1}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-white font-mono tabular-nums">
                                {formatCurrency(evt.amount)}
                              </span>
                              {isAnomaly && (
                                <span className="text-[10px] uppercase font-bold text-rose-400 px-1.5 py-0.5 bg-rose-500/10 rounded">
                                  Anómala
                                </span>
                              )}
                            </div>
                            {evt.metadata && (
                              <p className="text-[11px] text-slate-500 mt-1 truncate">
                                {JSON.stringify(evt.metadata)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineDrawer.displayName = 'TimelineDrawer';
```

- [ ] **Step 2: Verify type check passes**

Run in `frontend`:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TimelineDrawer.tsx
git commit -m "feat(frontend): redesign TimelineDrawer with Tailwind slide-over and smooth backdrop"
```

---

### Task 6: Modernize `App.tsx` and `States.tsx` (Zero-Shift Header & Integration)

**Files:**
- Modify: `frontend/src/components/States.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: All components from Tasks 2-5
- Produces: Integrated, flicker-free dashboard with stable header, subtle progress indicator, and zero layout shift.

- [ ] **Step 1: Modernize `States.tsx` with Tailwind**

Replace `frontend/src/components/States.tsx` with:
```tsx
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadingSkeletonProps {
  message?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  message = 'Cargando datos analíticos...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] p-8 gap-4 text-slate-400">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-slate-800 border-t-sky-400 rounded-full animate-spin" />
      </div>
      <p className="text-xs font-mono tracking-wide text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-center max-w-lg mx-auto my-8 space-y-3">
      <div className="inline-flex p-2 rounded-full bg-rose-500/20 text-rose-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-white">Error al cargar información</h4>
      <p className="text-xs text-rose-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Update `App.tsx` with stable header, fixed button width, and subtle background refresh**

Replace `frontend/src/App.tsx` with:
```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import {
  AnalyticsOverview,
  AnalyticsTimeseries,
  EpisodeTimeline,
  AnomalyEpisodeListItem,
  TimeseriesBucket,
} from './types/api';
import { api } from './services/api';
import { MetricCards } from './components/MetricCards';
import { TimeseriesChart } from './components/TimeseriesChart';
import { EpisodesTable } from './components/EpisodesTable';
import { TimelineDrawer } from './components/TimelineDrawer';
import { LoadingSkeleton, ErrorMessage } from './components/States';

export const App: React.FC = () => {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [bucket, setBucket] = useState<TimeseriesBucket>('day');

  // Overview & Timeseries
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseries | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Episodes List
  const [episodes, setEpisodes] = useState<AnomalyEpisodeListItem[]>([]);
  const [episodesTotal, setEpisodesTotal] = useState<number>(0);
  const [episodesPage, setEpisodesPage] = useState<number>(1);
  const [episodesStatus, setEpisodesStatus] = useState<string>('ALL');
  const [isEpisodesLoading, setIsEpisodesLoading] = useState<boolean>(false);

  // Timeline Drawer
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [episodeTimeline, setEpisodeTimeline] = useState<EpisodeTimeline | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  // Load Overview & Timeseries
  const loadMetrics = useCallback(async () => {
    setIsMetricsLoading(true);
    setMetricsError(null);
    try {
      const to = Date.now();
      const from = to - rangeDays * 24 * 3600 * 1000;

      const [overviewData, timeseriesData] = await Promise.all([
        api.getOverview(from, to),
        api.getTimeseries(bucket, from, to),
      ]);

      setOverview(overviewData);
      setTimeseries(timeseriesData);
    } catch (err: any) {
      setMetricsError(err.message || 'Error al cargar los datos analíticos');
    } finally {
      setIsMetricsLoading(false);
    }
  }, [rangeDays, bucket]);

  // Load Episodes Table
  const loadEpisodes = useCallback(async () => {
    setIsEpisodesLoading(true);
    try {
      const resp = await api.getAnomalies(episodesStatus, episodesPage, 10);
      setEpisodes(resp.data || []);
      setEpisodesTotal(resp.total || 0);
    } catch (err: any) {
      console.error('Error cargando episodios:', err.message);
    } finally {
      setIsEpisodesLoading(false);
    }
  }, [episodesStatus, episodesPage]);

  // Initial & range trigger
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  // Timeline Drawer Handlers
  const handleSelectEpisode = useCallback(async (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setIsTimelineLoading(true);
    try {
      const timelineData = await api.getEpisodeTimeline(episodeId);
      setEpisodeTimeline(timelineData);
    } catch (err: any) {
      console.error('Error cargando línea de tiempo:', err.message);
      setEpisodeTimeline(null);
    } finally {
      setIsTimelineLoading(false);
    }
  }, []);

  const handleCloseTimeline = useCallback(() => {
    setSelectedEpisodeId(null);
    setEpisodeTimeline(null);
  }, []);

  const handleRangeChange = useCallback((days: number, newBucket?: TimeseriesBucket) => {
    setRangeDays(days);
    if (newBucket) {
      setBucket(newBucket);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                GastroForge Appresso
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Operaciones
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Fraud Detection & Anomaly Operations Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Range Presets */}
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 1
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(1, 'hour')}
              >
                24h
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 7
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(7)}
              >
                7 días
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 30
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(30, 'day')}
              >
                30 días
              </button>
            </div>

            {/* Zero-CLS Refresh Button */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-w-[104px] rounded-lg text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-sm"
              onClick={() => {
                loadMetrics();
                loadEpisodes();
              }}
              disabled={isMetricsLoading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isMetricsLoading ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isMetricsLoading && !overview ? (
          <LoadingSkeleton message="Cargando panel de control y métricas..." />
        ) : metricsError ? (
          <ErrorMessage message={metricsError} onRetry={loadMetrics} />
        ) : overview && timeseries ? (
          <>
            {/* 1. Tarjetas métricas 3x2 */}
            <section>
              <MetricCards overview={overview} />
            </section>

            {/* 2. Gráfico temporal */}
            <section>
              <TimeseriesChart
                timeseries={timeseries}
                bucket={bucket}
                onBucketChange={(newBucket) => setBucket(newBucket)}
              />
            </section>

            {/* 3. Listado de episodios */}
            <section>
              <EpisodesTable
                episodes={episodes}
                total={episodesTotal}
                currentPage={episodesPage}
                pageSize={10}
                selectedStatus={episodesStatus}
                onStatusChange={(status) => {
                  setEpisodesStatus(status);
                  setEpisodesPage(1);
                }}
                onPageChange={(page) => setEpisodesPage(page)}
                onSelectEpisode={handleSelectEpisode}
                isLoading={isEpisodesLoading}
              />
            </section>
          </>
        ) : null}
      </main>

      {/* Slide-over Timeline Drawer */}
      <TimelineDrawer
        isOpen={!!selectedEpisodeId}
        timeline={episodeTimeline}
        onClose={handleCloseTimeline}
        isLoading={isTimelineLoading}
      />
    </div>
  );
};
```

- [ ] **Step 3: Run unit tests and production build**

Run in `frontend`:
```bash
npm test
npm run build
```
Expected: All tests pass and Vite builds cleanly into `dist/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/States.tsx frontend/src/App.tsx
git commit -m "feat(frontend): integrate zero-cls refresh, tailwind layout and memoization"
```
