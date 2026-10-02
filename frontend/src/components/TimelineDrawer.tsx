import React, { useEffect } from 'react';
import {
  X,
  Clock,
  ShieldAlert,
  CreditCard,
  RefreshCw,
  Lock,
  Info,
} from 'lucide-react';
import { EpisodeTimeline, TimelineEvent } from '../types/api';
import { formatCurrency } from './MetricCards';

interface TimelineDrawerProps {
  timeline: EpisodeTimeline | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export const TimelineDrawer: React.FC<TimelineDrawerProps> = React.memo(({
  timeline,
  isOpen,
  onClose,
  isLoading = false,
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

  const renderEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'EPISODE_OPENED':
        return (
          <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        );
      case 'TRANSACTION_FLAGGED':
        return (
          <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        );
      case 'EPISODE_UPDATED':
        return (
          <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <RefreshCw className="w-3.5 h-3.5" />
          </div>
        );
      case 'EPISODE_CLOSED':
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Info className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  let parsedNotes: any = null;
  if (timeline?.episode.notes) {
    try {
      parsedNotes = JSON.parse(timeline.episode.notes);
    } catch {
      // notes is raw string
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800/80 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out translate-x-0">
          {/* Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-semibold text-white">Línea de Tiempo del Episodio</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {timeline ? `ID: ${timeline.episode.id.substring(0, 12)}...` : 'Cargando...'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Consultando eventos del episodio...</span>
              </div>
            ) : !timeline ? (
              <div className="text-center text-slate-500 py-12 text-sm">
                No se pudo cargar la información del episodio.
              </div>
            ) : (
              <>
                {/* Resumen del episodio */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Usuario:</span>
                    <strong className="font-mono text-slate-200">{timeline.episode.userId}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Regla activada:</span>
                    <span className="font-medium text-rose-400 font-mono text-[11px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                      {timeline.episode.rule}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Estado:</span>
                    <span className="font-semibold text-xs text-slate-300">
                      {timeline.episode.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Transacciones:</span>
                    <span className="font-mono tabular-nums text-white font-semibold">
                      {timeline.episode.transactionCount} eventos
                    </span>
                  </div>

                  {parsedNotes && (
                    <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1.5">
                      <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">
                        Auditoría de Ventana:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedNotes.timeBand && (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px]">
                            Franja: {parsedNotes.timeBand}
                          </span>
                        )}
                        {parsedNotes.threshold && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">
                            Umbral: {parsedNotes.threshold}
                          </span>
                        )}
                        {parsedNotes.source && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                            Fuente: {parsedNotes.source}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Secuencia cronológica de eventos */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                    Cronología de Eventos
                  </h4>

                  <div className="relative pl-4 space-y-5 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                    {timeline.events.map((ev, index) => (
                      <div key={index} className="relative flex items-start gap-3">
                        <div className="relative z-10 flex-shrink-0">
                          {renderEventIcon(ev.type)}
                        </div>

                        <div className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                            <span>
                              {new Date(ev.timestamp).toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px]">
                              {new Date(ev.timestamp).toISOString().split('T')[0]}
                            </span>
                          </div>

                          {ev.type === 'EPISODE_OPENED' && (
                            <div>
                              <strong className="text-rose-400">Apertura de Episodio</strong>
                              {ev.description && (
                                <p className="text-slate-400 mt-0.5 text-[11px]">{ev.description}</p>
                              )}
                            </div>
                          )}

                          {ev.type === 'TRANSACTION_FLAGGED' && (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-300 font-mono text-[11px]">
                                  Txn: <strong className="text-sky-400">{ev.idTxn?.substring(0, 10)}...</strong>
                                </span>
                                {ev.value !== undefined && (
                                  <strong className="text-sky-400 font-mono tabular-nums">
                                    {formatCurrency(ev.value)}
                                  </strong>
                                )}
                              </div>
                              {ev.paymentMethod && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Método: {ev.paymentMethod}
                                </p>
                              )}
                            </div>
                          )}

                          {ev.type === 'EPISODE_UPDATED' && (
                            <div>
                              <strong className="text-amber-400">Episodio Actualizado</strong>
                              {ev.description && (
                                <p className="text-slate-400 mt-0.5 text-[11px]">{ev.description}</p>
                              )}
                            </div>
                          )}

                          {ev.type === 'EPISODE_CLOSED' && (
                            <div>
                              <strong className="text-emerald-400">Episodio Cerrado</strong>
                              {ev.description && (
                                <p className="text-slate-400 mt-0.5 text-[11px]">{ev.description}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
