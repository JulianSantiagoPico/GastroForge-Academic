import {
  AnalyticsOverview,
  AnalyticsTimeseries,
  EpisodeTimeline,
  AnomalyListResponse,
  TimeseriesBucket,
} from '../types/api';

/**
 * Base URL resolution for Appresso API.
 * Uses VITE_APPRESSO_API_URL if configured; otherwise defaults to '/api/v1'.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_APPRESSO_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return '/api/v1';
};

export class AppressoApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getApiBaseUrl();
  }

  private async request<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const origin =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'http://localhost:3000';
    const url = new URL(`${this.baseUrl}${endpoint}`, origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {
        // use default HTTP error
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async getOverview(from?: number | string, to?: number | string): Promise<AnalyticsOverview> {
    return await this.request<AnalyticsOverview>('/appresso/analytics/overview', {
      from,
      to,
    });
  }

  async getTimeseries(
    bucket: TimeseriesBucket = 'hour',
    from?: number | string,
    to?: number | string,
  ): Promise<AnalyticsTimeseries> {
    return await this.request<AnalyticsTimeseries>('/appresso/analytics/timeseries', {
      bucket,
      from,
      to,
    });
  }

  async getEpisodeTimeline(episodeId: string): Promise<EpisodeTimeline> {
    if (!episodeId) {
      throw new Error('El ID de episodio es requerido para consultar la línea de tiempo');
    }
    return await this.request<EpisodeTimeline>(
      `/appresso/analytics/anomalies/${encodeURIComponent(episodeId)}/timeline`,
    );
  }

  async getAnomalies(status?: string, page = 1, limit = 20): Promise<AnomalyListResponse> {
    return await this.request<AnomalyListResponse>('/appresso/anomalies', {
      status: status === 'ALL' ? undefined : status,
      page,
      limit,
    });
  }
}

export const api = new AppressoApiClient();
