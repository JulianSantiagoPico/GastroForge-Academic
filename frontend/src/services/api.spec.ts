import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppressoApiClient, getApiBaseUrl } from './api';
import { formatCurrency, formatNumber } from '../components/MetricCards';

describe('AppressoApiClient (W5 Frontend Adapter)', () => {
  let client: AppressoApiClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    client = new AppressoApiClient('http://localhost:3000/api/v1');
  });

  it('resuelve getApiBaseUrl correctamente', () => {
    const baseUrl = getApiBaseUrl();
    expect(baseUrl).toBeDefined();
    expect(typeof baseUrl).toBe('string');
  });

  it('obtiene overview agregando parámetros from y to en query string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: { total: 100 },
        episodes: { total: 5 },
      }),
    });

    const result = await client.getOverview(1000, 2000);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/v1/appresso/analytics/overview');
    expect(calledUrl).toContain('from=1000');
    expect(calledUrl).toContain('to=2000');
    expect(result.transactions.total).toBe(100);
  });

  it('obtiene serie temporal con bucket especificado', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        period: { bucket: 'day' },
        data: [],
      }),
    });

    const result = await client.getTimeseries('day', 1000, 5000);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/v1/appresso/analytics/timeseries');
    expect(calledUrl).toContain('bucket=day');
    expect(result.period.bucket).toBe('day');
  });

  it('obtiene la línea de tiempo de un episodio específico', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        episode: { id: 'ep-123' },
        events: [],
      }),
    });

    const result = await client.getEpisodeTimeline('ep-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/v1/appresso/analytics/anomalies/ep-123/timeline');
    expect(result.episode.id).toBe('ep-123');
  });

  it('lanza Error con mensaje descriptivo ante respuesta HTTP 4xx o 5xx', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => JSON.stringify({ message: 'Episodio no encontrado' }),
    });

    await expect(client.getEpisodeTimeline('missing-id')).rejects.toThrow(
      'Episodio no encontrado',
    );
  });

  it('ejecuta ráfaga simulada enviando payload JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: { sent: 3, accepted: 3, anomalies: 1 },
        results: [],
      }),
    });

    const result = await client.runSimulationBurst({ user: 'client-1', count: 3, delayMs: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    const options = mockFetch.mock.calls[0][1];
    expect(calledUrl).toContain('/api/v1/appresso/simulation/burst');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ user: 'client-1', count: 3, delayMs: 10 });
    expect(result.summary.sent).toBe(3);
  });
});

describe('Metric Formatters (W5)', () => {
  it('formatea montos monetarios en COP', () => {
    const formatted = formatCurrency(50000);
    expect(formatted).toContain('50.000');
  });

  it('formatea números con separador de miles', () => {
    const formatted = formatNumber(12500);
    expect(formatted).toContain('12.500');
  });
});
