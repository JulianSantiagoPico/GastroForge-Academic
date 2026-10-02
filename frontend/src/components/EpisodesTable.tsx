import React from 'react';
import { AnomalyEpisodeListItem } from '../types/api';

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

export const EpisodesTable: React.FC<EpisodesTableProps> = ({
  episodes,
  total,
  currentPage,
  pageSize,
  selectedStatus,
  onStatusChange,
  onPageChange,
  onSelectEpisode,
  isLoading,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="badge badge-danger">Abierto</span>;
      case 'CLOSED':
        return <span className="badge badge-secondary">Cerrado</span>;
      case 'REVIEWED':
        return <span className="badge badge-success">Revisado</span>;
      case 'DISMISSED':
        return <span className="badge badge-info">Descartado</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="card table-card">
      <div className="table-header">
        <div>
          <h3>Listado de Episodios de Anomalía</h3>
          <p className="table-subtitle">
            Mostrando {episodes.length} de {total} episodios registrados
          </p>
        </div>

        {/* Filtro por estado */}
        <div className="filter-group">
          <label htmlFor="status-select">Filtrar por estado:</label>
          <select
            id="status-select"
            className="select-input"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="OPEN">Abiertos</option>
            <option value="CLOSED">Cerrados</option>
            <option value="REVIEWED">Revisados</option>
            <option value="DISMISSED">Descartados</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="episodes-table">
          <thead>
            <tr>
              <th>ID Episodio</th>
              <th>Usuario</th>
              <th>Regla</th>
              <th>Estado</th>
              <th>Transacciones</th>
              <th>Fecha Apertura (UTC)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  Cargando episodios...
                </td>
              </tr>
            ) : episodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 empty-hint">
                  No hay episodios que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              episodes.map((ep) => (
                <tr key={ep.id} className="table-row">
                  <td className="font-mono text-xs">{ep.id.substring(0, 8)}...</td>
                  <td><strong>{ep.userId}</strong></td>
                  <td><code className="rule-badge">{ep.rule}</code></td>
                  <td>{getStatusBadge(ep.status)}</td>
                  <td>
                    <span className="badge badge-count">
                      {ep.transactionCount} txns
                    </span>
                  </td>
                  <td>{new Date(Number(ep.openedAt)).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => onSelectEpisode(ep.id)}
                    >
                      Ver Timeline →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="table-pagination">
        <span>
          Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
        </span>
        <div className="pagination-buttons">
          <button
            className="btn btn-sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ← Anterior
          </button>
          <button
            className="btn btn-sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
};
