import React from 'react';
import { ChevronLeft, ChevronRight, Eye, ShieldAlert, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { AnomalyEpisodeListItem } from '../types/api';
import { formatUtcDateTime } from '../utils/date';

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
    case 'CLOSED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3" /> Resuelto
        </span>
      );
    case 'REVIEWED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <CheckCircle className="w-3 h-3" /> Revisado
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
            <option value="REVIEWED">Revisado</option>
            <option value="CLOSED">Cerrado</option>
            <option value="DISMISSED">Descartado</option>
          </select>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto relative min-h-[160px]">
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
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-5 h-5 text-slate-600" />
                    <span>No hay episodios que coincidan con el filtro seleccionado.</span>
                  </div>
                </td>
              </tr>
            ) : (
              episodes.map((ep) => (
                <tr
                  key={ep.id}
                  className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                  onClick={() => onSelectEpisode(ep.id)}
                >
                  <td className="py-3 px-4 font-mono text-sky-400 group-hover:underline" title={ep.id}>
                    {ep.id.substring(0, 8)}...
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300" title={ep.userId}>
                    {ep.userId.substring(0, 10)}...
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-medium">
                    {ep.rule || 'Ventana deslizante'}
                  </td>
                  <td className="py-3 px-4">{statusBadge(ep.status)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {ep.transactionCount}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono tabular-nums">
                    {formatUtcDateTime(ep.openedAt)}
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
