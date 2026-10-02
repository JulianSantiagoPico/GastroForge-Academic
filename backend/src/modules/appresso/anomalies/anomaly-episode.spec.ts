import {
  AnomalyEpisodeManager,
  AnomalyEpisode,
  EpisodeStatus,
} from './anomaly-episode';

describe('AnomalyEpisodeManager (A1.2a)', () => {
  const WINDOW_MS = 3000;
  let manager: AnomalyEpisodeManager;

  beforeEach(() => {
    manager = new AnomalyEpisodeManager({ windowMs: WINDOW_MS });
  });

  it('crea un nuevo episodio OPEN cuando se detecta una anomalía y no hay episodio abierto', () => {
    const episode = manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-3',
      timestamp: 10000,
      windowTxnIds: ['txn-1', 'txn-2', 'txn-3'],
    });

    expect(episode.id).toBeDefined();
    expect(episode.userId).toBe('user-1');
    expect(episode.rule).toBe('POSIBLE_FRAUDE');
    expect(episode.status).toBe(EpisodeStatus.OPEN);
    expect(episode.openedAt).toBe(10000);
    expect(episode.updatedAt).toBe(10000);
    expect(episode.closedAt).toBeUndefined();
    expect(episode.transactionIds).toEqual(['txn-1', 'txn-2', 'txn-3']);
  });

  it('actualiza el episodio OPEN existente agregando transacciones si la anomalía continúa', () => {
    manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-3',
      timestamp: 10000,
      windowTxnIds: ['txn-1', 'txn-2', 'txn-3'],
    });

    const updated = manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-4',
      timestamp: 11000,
      windowTxnIds: ['txn-2', 'txn-3', 'txn-4'],
    });

    expect(updated.status).toBe(EpisodeStatus.OPEN);
    expect(updated.openedAt).toBe(10000);
    expect(updated.updatedAt).toBe(11000);
    expect(updated.transactionIds).toContain('txn-4');
  });

  it('cierra episodios vencidos cuando now - lastEventTime > windowMs', () => {
    manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-3',
      timestamp: 10000,
      windowTxnIds: ['txn-1', 'txn-2', 'txn-3'],
    });

    // En t = 13001, pasaron > 3000 ms desde 10000 sin actividad
    manager.checkAndCloseExpired(13001);

    const episode = manager.getLatestEpisode('user-1', 'POSIBLE_FRAUDE');
    expect(episode?.status).toBe(EpisodeStatus.CLOSED);
    expect(episode?.closedAt).toBe(13001);
  });

  it('NUNCA reabre un episodio CLOSED; crea uno nuevo si el umbral vuelve a superarse', () => {
    const firstEpisode = manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-3',
      timestamp: 10000,
      windowTxnIds: ['txn-1', 'txn-2', 'txn-3'],
    });

    // Se cierra en 15000
    manager.checkAndCloseExpired(15000);
    const closed = manager.getLatestEpisode('user-1', 'POSIBLE_FRAUDE');
    expect(closed?.status).toBe(EpisodeStatus.CLOSED);

    // Mucho después (en 30000), una nueva ráfaga vuelve a superar el umbral
    const newEpisode = manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-10',
      timestamp: 30000,
      windowTxnIds: ['txn-8', 'txn-9', 'txn-10'],
    });

    expect(newEpisode.id).not.toBe(firstEpisode.id);
    expect(newEpisode.status).toBe(EpisodeStatus.OPEN);
    expect(newEpisode.openedAt).toBe(30000);

    // El primer episodio sigue CLOSED
    const old = manager.getEpisodeById(firstEpisode.id);
    expect(old?.status).toBe(EpisodeStatus.CLOSED);
  });

  it('permite transiciones a REVIEWED y DISMISSED', () => {
    const episode = manager.recordAnomaly({
      userId: 'user-1',
      rule: 'POSIBLE_FRAUDE',
      txnId: 'txn-3',
      timestamp: 10000,
      windowTxnIds: ['txn-1', 'txn-2', 'txn-3'],
    });

    manager.transitionStatus(episode.id, EpisodeStatus.REVIEWED, 'Analista Carlos');
    const reviewed = manager.getEpisodeById(episode.id);
    expect(reviewed?.status).toBe(EpisodeStatus.REVIEWED);
    expect(reviewed?.reviewedBy).toBe('Analista Carlos');

    manager.transitionStatus(episode.id, EpisodeStatus.DISMISSED, 'Falso positivo confirmado');
    const dismissed = manager.getEpisodeById(episode.id);
    expect(dismissed?.status).toBe(EpisodeStatus.DISMISSED);
  });
});
