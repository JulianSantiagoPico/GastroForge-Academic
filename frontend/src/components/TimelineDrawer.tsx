import React from 'react';
import { EpisodeTimeline, TimelineEvent } from '../types/api';
import { formatCurrency } from './MetricCards';

interface TimelineDrawerProps {
  timeline: EpisodeTimeline | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export const TimelineDrawer: React.FC<TimelineDrawerProps> = ({
  timeline,
  isOpen,
  onClose,
  isLoading,
}) => {
  if (!isOpen) return null;

  const renderEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'EPISODE_OPENED':
        return <div className="event-icon icon-opened">🚨</div>;
      case 'TRANSACTION_FLAGGED':
        return <div className="event-icon icon-txn">💳</div>;
      case 'EPISODE_UPDATED':
        return <div className="event-icon icon-updated">🔄</div>;
      case 'EPISODE_CLOSED':
        return <div className="event-icon icon-closed">🔒</div>;
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
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>Línea de Tiempo del Episodio</h3>
            <p className="drawer-id font-mono">ID: {timeline?.episode.id}</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="drawer-loading">
            <div className="spinner" />
            <p>Consultando eventos del episodio...</p>
          </div>
        ) : !timeline ? (
          <div className="drawer-empty">
            <p>No se pudo cargar la información del episodio.</p>
          </div>
        ) : (
          <div className="drawer-body">
            {/* Resumen del episodio */}
            <div className="episode-meta-card">
              <div className="meta-row">
                <span className="meta-label">Usuario:</span>
                <strong>{timeline.episode.userId}</strong>
              </div>
              <div className="meta-row">
                <span className="meta-label">Regla activada:</span>
                <code>{timeline.episode.rule}</code>
              </div>
              <div className="meta-row">
                <span className="meta-label">Estado:</span>
                <span className={`badge badge-${timeline.episode.status.toLowerCase()}`}>
                  {timeline.episode.status}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Transacciones:</span>
                <span>{timeline.episode.transactionCount} eventos</span>
              </div>

              {parsedNotes && (
                <div className="meta-row audit-box">
                  <span className="meta-label">Auditoría:</span>
                  <div className="audit-tags">
                    {parsedNotes.timeBand && (
                      <span className="badge badge-info">Franja: {parsedNotes.timeBand}</span>
                    )}
                    {parsedNotes.threshold && (
                      <span className="badge badge-warning">Umbral: {parsedNotes.threshold}</span>
                    )}
                    {parsedNotes.source && (
                      <span className="badge badge-secondary">Fuente: {parsedNotes.source}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Secuencia cronológica de eventos */}
            <h4 className="events-heading">Cronología de Eventos</h4>
            <div className="timeline-list">
              {timeline.events.map((ev, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker">
                    {renderEventIcon(ev.type)}
                    {index < timeline.events.length - 1 && <div className="timeline-line" />}
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-time">
                      {new Date(ev.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      <span className="text-muted">
                        ({new Date(ev.timestamp).toISOString().split('T')[0]})
                      </span>
                    </div>

                    <div className="timeline-desc">
                      {ev.type === 'EPISODE_OPENED' && (
                        <div>
                          <strong>Apertura de Episodio</strong>
                          <p>{ev.description}</p>
                        </div>
                      )}

                      {ev.type === 'TRANSACTION_FLAGGED' && (
                        <div className="txn-flagged-card">
                          <div className="txn-header">
                            <span>Txn: <code className="font-mono">{ev.idTxn}</code></span>
                            <strong className="text-primary">
                              {ev.value !== undefined ? formatCurrency(ev.value) : ''}
                            </strong>
                          </div>
                          <div className="txn-sub">
                            <span>Método: {ev.paymentMethod}</span>
                            <span>•</span>
                            <span>Moneda: {ev.currency}</span>
                          </div>
                        </div>
                      )}

                      {ev.type === 'EPISODE_UPDATED' && (
                        <div>
                          <strong>Actualización</strong>
                          <p>{ev.description}</p>
                        </div>
                      )}

                      {ev.type === 'EPISODE_CLOSED' && (
                        <div>
                          <strong>Cierre de Episodio</strong>
                          <p>{ev.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
