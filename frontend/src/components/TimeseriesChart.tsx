import React, { useState } from 'react';
import { AnalyticsTimeseries, TimeseriesBucket, TimeseriesPoint } from '../types/api';
import { formatCurrency, formatNumber } from './MetricCards';

interface TimeseriesChartProps {
  timeseries: AnalyticsTimeseries;
  bucket: TimeseriesBucket;
  onBucketChange: (bucket: TimeseriesBucket) => void;
}

export const TimeseriesChart: React.FC<TimeseriesChartProps> = ({
  timeseries,
  bucket,
  onBucketChange,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeseriesPoint | null>(null);

  const points = timeseries.data;
  if (!points || points.length === 0) {
    return (
      <div className="card chart-card">
        <div className="chart-header">
          <h3>Evolución Temporal de Actividad y Anomalías</h3>
        </div>
        <p className="empty-hint">No hay datos en la serie temporal para el intervalo actual.</p>
      </div>
    );
  }

  // Dimensiones del gráfico SVG
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxTxns = Math.max(...points.map((p) => p.transactionCount), 1);
  const maxAnomalies = Math.max(...points.map((p) => p.anomalyCount), 1);

  const barWidth = Math.max(4, Math.min(24, chartWidth / points.length - 4));

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <h3>Evolución Temporal de Actividad y Detecciones</h3>
          <p className="chart-subtitle">
            Transacciones procesadas vs transacciones marcadas por la ventana deslizante
          </p>
        </div>

        <div className="bucket-toggle">
          <button
            className={`btn-toggle ${bucket === 'hour' ? 'active' : ''}`}
            onClick={() => onBucketChange('hour')}
          >
            Por Hora
          </button>
          <button
            className={`btn-toggle ${bucket === 'day' ? 'active' : ''}`}
            onClick={() => onBucketChange('day')}
          >
            Por Día
          </button>
        </div>
      </div>

      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="timeseries-svg">
          {/* Ejes y líneas de cuadrícula */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            className="axis-line"
          />

          {/* Grid horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartHeight * (1 - pct);
            const val = Math.round(maxTxns * pct);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  className="grid-line"
                />
                <text x={padding.left - 8} y={y + 4} className="axis-label" textAnchor="end">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Barras de datos */}
          {points.map((p, idx) => {
            const x =
              padding.left +
              (idx * chartWidth) / (points.length > 1 ? points.length - 1 : 1) -
              barWidth / 2;
            const barHeight = (p.transactionCount / maxTxns) * chartHeight;
            const y = padding.top + chartHeight - barHeight;

            const anomalyBarHeight = (p.anomalyCount / maxAnomalies) * (chartHeight * 0.7);
            const anomalyY = padding.top + chartHeight - anomalyBarHeight;

            const isHovered = hoveredPoint?.timestamp === p.timestamp;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="chart-bar-group"
              >
                {/* Barra total de transacciones */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  className={`bar-total ${isHovered ? 'bar-hovered' : ''}`}
                  rx="3"
                />

                {/* Barra roja de anomalías si hubo detecciones */}
                {p.anomalyCount > 0 && (
                  <rect
                    x={x + 2}
                    y={anomalyY}
                    width={Math.max(2, barWidth - 4)}
                    height={anomalyBarHeight}
                    className="bar-anomaly"
                    rx="2"
                  />
                )}

                {/* Etiquetas eje X cada cierto intervalo */}
                {(idx === 0 ||
                  idx === points.length - 1 ||
                  idx === Math.floor(points.length / 2)) && (
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + chartHeight + 20}
                    textAnchor="middle"
                    className="axis-label"
                  >
                    {new Date(p.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip dinámico */}
        {hoveredPoint && (
          <div className="chart-tooltip">
            <strong>{new Date(hoveredPoint.timestamp).toLocaleString()}</strong>
            <div>Total transacciones: <strong>{formatNumber(hoveredPoint.transactionCount)}</strong></div>
            <div>Monto procesado: <strong>{formatCurrency(hoveredPoint.totalValue)}</strong></div>
            {hoveredPoint.anomalyCount > 0 ? (
              <div className="text-danger">
                ⚠️ Anomalías: <strong>{hoveredPoint.anomalyCount}</strong> (
                {formatCurrency(hoveredPoint.flaggedValue)})
              </div>
            ) : (
              <div className="text-success">✓ Sin anomalías en este periodo</div>
            )}
          </div>
        )}
      </div>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-color legend-total" /> Transacciones Totales
        </span>
        <span className="legend-item">
          <span className="legend-color legend-anomaly" /> Transacciones Sospechosas / Flagged
        </span>
      </div>
    </div>
  );
};
