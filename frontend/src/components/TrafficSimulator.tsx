import React, { useState } from 'react';
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
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Simulador de Tráfico Interactivo</h3>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-secondary, #666)', fontSize: '0.875rem' }}>
            Prueba la conexión al backend y observa el comportamiento de la ventana deslizante bajo ráfagas controladas.
          </p>
        </div>
        <span className="badge badge-info" style={{ padding: '0.35rem 0.65rem' }}>Firma Segura en Backend</span>
      </div>

      <form onSubmit={handleRunSimulation} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
            Identificador de Usuario:
          </label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={loading}
            className="input"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            placeholder="ej. cliente-vip-01"
            required
          />
        </div>

        <div style={{ flex: '0 1 120px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
            Transacciones: {count}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            disabled={loading}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ flex: '0 1 140px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
            Intervalo (ms):
          </label>
          <input
            type="number"
            min="0"
            max="2000"
            step="50"
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value, 10) || 0)}
            disabled={loading}
            className="input"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{
            padding: '0.55rem 1.25rem',
            background: loading ? '#888' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Disparando Ráfaga...' : 'Disparar Ráfaga'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {response && (
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Enviadas</span>
              <strong style={{ fontSize: '1.1rem' }}>{response.summary.sent}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Aceptadas</span>
              <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>{response.summary.accepted}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Anomalías</span>
              <strong style={{ fontSize: '1.1rem', color: response.summary.anomalies > 0 ? '#dc2626' : '#64748b' }}>
                {response.summary.anomalies}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Latencia Media</span>
              <strong style={{ fontSize: '1.1rem' }}>{response.summary.avgLatencyMs} ms</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Tiempo Total</span>
              <strong style={{ fontSize: '1.1rem' }}>{response.summary.totalDurationMs} ms</strong>
            </div>
          </div>

          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.5rem' }}>Txn ID</th>
                <th style={{ padding: '0.5rem' }}>Latencia</th>
                <th style={{ padding: '0.5rem' }}>Conteo Ventana</th>
                <th style={{ padding: '0.5rem' }}>Umbral / Franja</th>
                <th style={{ padding: '0.5rem' }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {response.results.map((r) => (
                <tr key={r.idTxn} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{r.idTxn.substring(0, 24)}...</td>
                  <td style={{ padding: '0.5rem' }}>{r.latencyMs} ms</td>
                  <td style={{ padding: '0.5rem' }}>{r.anomaly.windowCount}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {r.anomaly.threshold} ({r.anomaly.timeBand || 'UTC'})
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {r.anomaly.detected ? (
                      <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                        ALERTA FRAUDE
                      </span>
                    ) : (
                      <span style={{ background: '#f0fdf4', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        NORMAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
