import React from 'react';

export const LoadingSkeleton: React.FC<{ message?: string }> = ({
  message = 'Cargando métricas de fraude...',
}) => (
  <div className="state-card loading-state">
    <div className="spinner" />
    <p>{message}</p>
  </div>
);

export const ErrorMessage: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <div className="state-card error-state">
    <div className="error-icon">⚠️</div>
    <h3>No se pudo cargar la información</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="btn btn-primary" onClick={onRetry}>
        Reintentar consulta
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
}> = ({
  title = 'Sin actividad en el rango seleccionado',
  description = 'No se registraron transacciones ni anomalías para los filtros actuales.',
}) => (
  <div className="state-card empty-state">
    <div className="empty-icon">📊</div>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);
