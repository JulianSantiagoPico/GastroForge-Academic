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
  const isSuspicious = fraud.suspiciousPercentage > 0 || episodes.open > 0;

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
              {fraud.suspiciousPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-rose-400 font-mono tabular-nums">
            {formatNumber(fraud.flaggedTransactions)}{' '}
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
              {formatCurrency(fraud.suspiciousTotalValue)}
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
              {episodes.total} total
            </span>
          </div>
          <div className="flex items-baseline gap-4 font-mono tabular-nums">
            <div className="text-xs text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
              Abiertos: <strong className="text-white text-base">{episodes.open}</strong>
            </div>
            <div className="text-xs text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-1.5" />
              Cerrados: <strong className="text-white text-base">{episodes.closed}</strong>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            Revisados: <strong className="text-white font-mono tabular-nums">{episodes.reviewed}</strong>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-slate-500">
          <span>Descartados: {episodes.dismissed}</span>
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
          <span>Usuarios recurrentes: <strong className="text-amber-400 font-mono tabular-nums">{fraud.recurrentUsers}</strong></span>
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
            {formatCurrency(fraud.averageSuspiciousValuePerUser)}
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
