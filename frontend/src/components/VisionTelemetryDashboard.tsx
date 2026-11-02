import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Footprints,
  Layers,
  MapPin,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  Utensils,
} from 'lucide-react';
import {
  DispatchPriorityItem,
  DispatchRouteResponse,
  SalonStatusResponse,
  TableTelemetry,
} from '../types/api';
import { api } from '../services/api';
import { LoadingSkeleton, ErrorMessage } from './States';

export const VisionTelemetryDashboard: React.FC = () => {
  const [salonData, setSalonData] = useState<SalonStatusResponse | null>(null);
  const [priorityQueue, setPriorityQueue] = useState<DispatchPriorityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Selected table for route inspection
  const [selectedRoute, setSelectedRoute] = useState<DispatchRouteResponse | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);

  const fetchTelemetry = useCallback(async (showFullLoading = false) => {
    if (showFullLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [salonStatus, priorityRes] = await Promise.all([
        api.getSalonTelemetry(),
        api.getServicePriority(),
      ]);
      setSalonData(salonStatus);
      setPriorityQueue(priorityRes.prioritizedTasks || []);
    } catch (err: any) {
      console.error('Error cargando telemetría de visión:', err);
      setError(err.message || 'No se pudo conectar con el servicio de telemetría.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry(true);
  }, [fetchTelemetry]);

  // Polling cada 3 segundos si autoRefresh está activo
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry]);

  const handleInspectRoute = async (tableId: string) => {
    setIsRouteLoading(true);
    try {
      const route = await api.getDispatchRoute(tableId);
      setSelectedRoute(route);
    } catch (err: any) {
      console.error('Error al calcular ruta:', err);
    } finally {
      setIsRouteLoading(false);
    }
  };

  if (isLoading && !salonData) {
    return <LoadingSkeleton message="Conectando con el motor de visión y telemetría de salón..." />;
  }

  if (error && !salonData) {
    return <ErrorMessage message={error} onRetry={() => fetchTelemetry(true)} />;
  }

  const { salonSummary, kpis, tables = [], activeAlerts = [] } = salonData || ({} as any);

  const getStateBadge = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'libre':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Libre
          </span>
        );
      case 'ocupada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Utensils className="w-3 h-3" /> Ocupada
          </span>
        );
      case 'por_recoger':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Layers className="w-3 h-3" /> Por Recoger
          </span>
        );
      case 'limpiando':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-3 h-3" /> Limpiando
          </span>
        );
      case 'ausencia_temporal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Footprints className="w-3 h-3" /> Ausencia Temporal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {state || 'Desconocido'}
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'CRITICA':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            CRÍTICA
          </span>
        );
      case 'ALTA':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ALTA
          </span>
        );
      case 'MEDIA':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            MEDIA
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
            BAJA
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Header & Live Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              Telemetría de Visión por Computadora (YOLOv8)
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              EN VIVO
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Motor: {salonData?.system || 'Ultralytics'} | Sincronizado:{' '}
            {salonData?.lastSyncTimestamp
              ? new Date(salonData.lastSyncTimestamp).toLocaleTimeString()
              : 'N/A'}{' '}
            (t = {salonData?.currentTimeSeconds ?? 0}s)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0"
            />
            Auto-sondeo (3s)
          </label>

          <button
            type="button"
            onClick={() => fetchTelemetry(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Operational Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200">
          <div className="flex items-center gap-2 font-semibold text-xs tracking-wider uppercase text-rose-400 mb-1">
            <ShieldAlert className="w-4 h-4" /> Alertas Operativas Detectadas en Salón
          </div>
          <ul className="text-xs space-y-1 mt-2">
            {activeAlerts.map((alert: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Salon Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Mesas</p>
          <p className="text-2xl font-bold text-white mt-1">{salonSummary?.total_tables ?? 0}</p>
        </div>
        <div className="bg-slate-900 border border-emerald-900/30 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Libres</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{salonSummary?.free_tables ?? 0}</p>
        </div>
        <div className="bg-slate-900 border border-amber-900/30 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Ocupadas</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{salonSummary?.occupied_tables ?? 0}</p>
        </div>
        <div className="bg-slate-900 border border-orange-900/30 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-orange-400 uppercase tracking-wider">Por Recoger</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{salonSummary?.pending_clean_tables ?? 0}</p>
        </div>
        <div className="bg-slate-900 border border-cyan-900/30 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Limpiando</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{salonSummary?.cleaning_tables ?? 0}</p>
        </div>
        <div className="bg-slate-900 border border-indigo-900/30 rounded-xl p-3.5">
          <p className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider">Ocupación</p>
          <p className="text-2xl font-bold text-white mt-1">
            {salonSummary?.occupancy_rate_percent ?? 0}%
          </p>
        </div>
      </div>

      {/* 2. KPIs & Latencias Operativas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>TPA (1er Plato)</span>
            <Utensils className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">
            {kpis?.avg_first_service_latency_seconds != null
              ? `${kpis.avg_first_service_latency_seconds}s`
              : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Latencia mesa sentada a plato servido</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>TRM (Rotación)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">
            {kpis?.avg_turnover_latency_seconds != null
              ? `${kpis.avg_turnover_latency_seconds}s`
              : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Latencia desocupación a limpieza</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Incidentes de Higiene</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p
            className={`text-xl font-bold mt-2 ${
              (kpis?.hygiene_incidents_count || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {kpis?.hygiene_incidents_count ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Comensales en mesa con vajilla sucia</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Diagnóstico</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xs font-bold text-slate-200 mt-2 truncate">
            {kpis?.operational_diagnosis || 'OPERACIÓN_NORMAL'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Cola en espera: {kpis?.waiting_queue_count ?? 0} personas
          </p>
        </div>
      </div>

      {/* 3. Live Tables Grid & Dijkstra Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Table Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              Estado Individual de Mesas Monitoreadas
            </h3>
            <span className="text-xs text-slate-400">Total: {tables.length} mesas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {tables.map((table: TableTelemetry) => (
              <div
                key={table.table_id}
                className={`bg-slate-900 border rounded-xl p-4 transition-all duration-200 flex flex-col justify-between ${
                  table.has_hygiene_incident
                    ? 'border-rose-500/50 shadow-lg shadow-rose-950/20'
                    : table.state === 'por_recoger'
                    ? 'border-orange-500/40'
                    : table.is_occupied
                    ? 'border-amber-500/30'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {table.table_id}
                    </h4>
                    {getStateBadge(table.state)}
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-400 mt-3">
                    <div className="flex justify-between">
                      <span>Permanencia:</span>
                      <span className="font-semibold text-slate-200">
                        {table.occupied_duration_formatted} ({table.occupied_duration_seconds}s)
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Primer Plato:</span>
                      <span
                        className={`font-semibold ${
                          table.first_dish_served ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {table.first_dish_served ? 'Servido' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Higiene:</span>
                      <span
                        className={`font-semibold ${
                          table.has_hygiene_incident ? 'text-rose-400 font-bold' : 'text-emerald-400'
                        }`}
                      >
                        {table.has_hygiene_incident ? 'INCIDENTE ACTIVO' : 'Óptima'}
                      </span>
                    </div>

                    {table.current_session_id && (
                      <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                        <span>Sesión:</span>
                        <span className="font-mono">{table.current_session_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                  <button
                    type="button"
                    disabled={isRouteLoading}
                    onClick={() => handleInspectRoute(table.table_id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors disabled:opacity-50"
                  >
                    <Route className="w-3.5 h-3.5" />
                    <span>Ruta Dijkstra</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (1 col): MinHeap Service Priority Queue & Active Route Drawer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Cola de Prioridad MinHeap (O(log n))
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {priorityQueue.length} tareas
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-400">
              Jerarquización automática de atención física desde cocina mediante Binary MinHeap:
            </p>

            {priorityQueue.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No hay tareas operativas pendientes. Salón en reposo.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {priorityQueue.map((task: DispatchPriorityItem, index: number) => (
                  <div
                    key={`${task.tableId}-${index}`}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">
                          #{index + 1} {task.tableId}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (nodo: {task.mappedNode})
                        </span>
                      </div>
                      {getUrgencyBadge(task.urgencyLevel)}
                    </div>

                    <p className="text-xs text-slate-300 mt-1.5">{task.reason}</p>

                    <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-mono text-indigo-300">
                        <Footprints className="w-3 h-3" />
                        {task.routeFromKitchen?.path?.join(' → ') || 'Ruta'}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {task.routeFromKitchen?.transitSeconds != null
                          ? `${task.routeFromKitchen.transitSeconds}s`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal / Panel de Inspección de Ruta Dijkstra */}
          {selectedRoute && (
            <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-xl p-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <Route className="w-4 h-4" /> Ruta Óptima (Dijkstra)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRoute(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-1 mt-2">
                <p>
                  <strong className="text-white">Destino:</strong> {selectedRoute.tableId} (Nodo{' '}
                  <span className="font-mono text-indigo-300">{selectedRoute.mappedNode}</span>)
                </p>
                <p>
                  <strong className="text-white">Tiempo Estimado:</strong>{' '}
                  <span className="text-emerald-400 font-semibold">
                    {selectedRoute.transitSeconds} segundos
                  </span>
                </p>
                <div className="mt-2 p-2 bg-slate-950/80 rounded border border-slate-800 font-mono text-[11px] text-indigo-300">
                  {selectedRoute.path.join(' ➔ ')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
