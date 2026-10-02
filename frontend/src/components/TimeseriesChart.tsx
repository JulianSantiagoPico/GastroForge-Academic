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

  const points = timeseries?.data || [];
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
          <div className="w-full overflow-x-auto relative">
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
              <div className="absolute top-2 right-2 bg-slate-950/95 border border-slate-700/80 rounded-lg p-3 shadow-xl text-xs backdrop-blur-md font-mono pointer-events-none z-10 space-y-1">
                <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1 mb-1">
                  {new Date(hoveredPoint.timestamp).toLocaleString('es-CO')}
                </div>
                <div className="text-sky-400">
                  Transacciones: <strong>{formatNumber(hoveredPoint.transactionCount)}</strong>
                </div>
                <div className="text-rose-400">
                  Anomalías: <strong>{formatNumber(hoveredPoint.anomalyCount)}</strong>
                </div>
                <div className="text-slate-300">
                  Monto: <strong>{formatCurrency(hoveredPoint.totalValue)}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-sky-400 inline-block" />
          <span>Transacciones Totales</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-1 bg-rose-500 rounded-full inline-block" />
          <span>Anomalías Detectadas</span>
        </div>
      </div>
    </div>
  );
});

TimeseriesChart.displayName = 'TimeseriesChart';
