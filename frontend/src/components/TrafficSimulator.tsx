import React, { useState } from 'react';
import {
  Zap,
  Play,
  RotateCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { SimulationBurstResponse } from '../types/api';

interface TrafficSimulatorProps {
  onSimulationComplete?: () => void;
}

export const TrafficSimulator: React.FC<TrafficSimulatorProps> = ({ onSimulationComplete }) => {
  const [user, setUser] = useState('demo-cliente-01');
  const [count, setCount] = useState(5);
  const [delayMs, setDelayMs] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SimulationBurstResponse | null>(null);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.runSimulationBurst({
        user: user.trim() || undefined,
        count,
        delayMs,
      });
      setResponse(data);
      if (onSimulationComplete) {
        onSimulationComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar la ráfaga de prueba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">Simulador de Tráfico Interactivo</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Genera ráfagas de prueba firmadas en backend para evaluar la ventana deslizante y la detección de anomalías en tiempo real.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          Firma Segura en Backend
        </span>
      </div>

      {/* Form Controls */}
      <form onSubmit={handleRunSimulation} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Identificador de Usuario
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              disabled={loading}
              placeholder="ej. cliente-vip-01"
              required
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 font-mono disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Transacciones
              </label>
              <span className="text-xs font-mono font-bold text-sky-400">
                {count} {count === 1 ? 'txn' : 'txns'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              disabled={loading}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Intervalo entre Txns (ms)
            </label>
            <input
              type="number"
              min="0"
              max="2000"
              step="50"
              value={delayMs}
              onChange={(e) => setDelayMs(parseInt(e.target.value, 10) || 0)}
              disabled={loading}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 font-mono disabled:opacity-50"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Disparando Ráfaga...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Disparar Ráfaga</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Results Section */}
      {response && (
        <div className="p-5 border-t border-slate-800/60 bg-slate-950/30 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resumen de Ejecución
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              Usuario: {response.summary.userId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Enviadas
              </span>
              <span className="text-lg font-bold font-mono text-white tabular-nums">
                {response.summary.sent}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Aceptadas
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {response.summary.accepted}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Anomalías
              </span>
              <span
                className={`text-lg font-bold font-mono tabular-nums ${
                  response.summary.anomalies > 0 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {response.summary.anomalies}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Latencia Media
              </span>
              <span className="text-lg font-bold font-mono text-white tabular-nums">
                {response.summary.avgLatencyMs} ms
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                Tiempo Total
              </span>
              <span className="text-lg font-bold font-mono text-white tabular-nums">
                {response.summary.totalDurationMs} ms
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Txn ID</th>
                  <th className="py-2.5 px-3">Latencia</th>
                  <th className="py-2.5 px-3">Conteo Ventana</th>
                  <th className="py-2.5 px-3">Umbral / Franja</th>
                  <th className="py-2.5 px-3 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {response.results.map((r) => (
                  <tr key={r.idTxn} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 px-3 text-slate-300">
                      {r.idTxn.substring(0, 18)}...
                    </td>
                    <td className="py-2 px-3 text-slate-400 tabular-nums">
                      {r.latencyMs} ms
                    </td>
                    <td className="py-2 px-3 text-slate-300 tabular-nums">
                      {r.anomaly.windowCount}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {r.anomaly.threshold} ({r.anomaly.timeBand || 'UTC'})
                    </td>
                    <td className="py-2 px-3 text-right">
                      {r.anomaly.detected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> ALERTA FRAUDE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
