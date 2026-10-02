import React from 'react';
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

export const MetricCards: React.FC<MetricCardsProps> = ({ overview }) => {
  const { transactions, episodes, fraud } = overview;

  return (
    <div className="metrics-grid">
      {/* 1. Transacciones Totales */}
      <div className="card metric-card">
        <div className="card-header">
          <span className="card-title">Transacciones Totales</span>
          <span className="badge badge-info">Volumen</span>
        </div>
        <div className="metric-value">{formatNumber(transactions.total)}</div>
        <div className="metric-subtext">
          Promedio diario: <strong>{formatNumber(transactions.perDayAverage)}</strong> / día
        </div>
        <div className="metric-footer">
          <span>Sem: {formatNumber(transactions.perWeekAverage)}</span>
          <span>•</span>
          <span>Mes: {formatNumber(transactions.perMonthAverage)}</span>
        </div>
      </div>

      {/* 2. Valor Procesado */}
      <div className="card metric-card">
        <div className="card-header">
          <span className="card-title">Valor Procesado</span>
          <span className="badge badge-primary">Monto</span>
        </div>
        <div className="metric-value">{formatCurrency(transactions.totalValue)}</div>
        <div className="metric-subtext">
          Ticket promedio: <strong>{formatCurrency(transactions.averageValue)}</strong>
        </div>
        <div className="metric-footer">
          <span>Moneda base: COP</span>
        </div>
      </div>

      {/* 3. Tasa de Sospecha / Fraude */}
      <div className="card metric-card alert-border">
        <div className="card-header">
          <span className="card-title">Tasa Sospechosa</span>
          <span className="badge badge-danger">{fraud.suspiciousPercentage}%</span>
        </div>
        <div className="metric-value text-danger">
          {formatNumber(fraud.flaggedTransactions)} txns
        </div>
        <div className="metric-subtext">
          Transacciones involucradas en ventanas de anomalía
        </div>
        <div className="metric-footer">
          <span>Valor sospechoso: <strong>{formatCurrency(fraud.suspiciousTotalValue)}</strong></span>
        </div>
      </div>

      {/* 4. Episodios por Estado */}
      <div className="card metric-card">
        <div className="card-header">
          <span className="card-title">Episodios de Anomalía</span>
          <span className="badge badge-warning">{episodes.total} total</span>
        </div>
        <div className="episodes-breakdown">
          <div className="status-pill status-open">
            <span className="dot" /> {episodes.open} Abiertos
          </div>
          <div className="status-pill status-closed">
            <span className="dot" /> {episodes.closed} Cerrados
          </div>
          <div className="status-pill status-reviewed">
            <span className="dot" /> {episodes.reviewed} Revisados
          </div>
        </div>
        <div className="metric-footer">
          <span>Descartados: {episodes.dismissed}</span>
        </div>
      </div>

      {/* 5. Usuarios Afectados & Recurrentes */}
      <div className="card metric-card">
        <div className="card-header">
          <span className="card-title">Usuarios Afectados</span>
          <span className="badge badge-secondary">Clientes</span>
        </div>
        <div className="metric-value">{formatNumber(fraud.affectedUsers)}</div>
        <div className="metric-subtext">
          Clientes con al menos 1 detección activa
        </div>
        <div className="metric-footer">
          <span className="text-warning">
            Usuarios recurrentes: <strong>{fraud.recurrentUsers}</strong>
          </span>
        </div>
      </div>

      {/* 6. Impacto Promedio por Usuario */}
      <div className="card metric-card">
        <div className="card-header">
          <span className="card-title">Impacto por Usuario</span>
          <span className="badge badge-secondary">Riesgo</span>
        </div>
        <div className="metric-value">
          {formatCurrency(fraud.averageSuspiciousValuePerUser)}
        </div>
        <div className="metric-subtext">
          Promedio de fondos retenidos o sospechosos por cliente
        </div>
        <div className="metric-footer">
          <span>Ventana deslizante activa</span>
        </div>
      </div>
    </div>
  );
};
