import React, { useState, useEffect, useCallback } from 'react';
import {
  AnalyticsOverview,
  AnalyticsTimeseries,
  EpisodeTimeline,
  AnomalyEpisodeListItem,
  TimeseriesBucket,
} from './types/api';
import { api } from './services/api';
import { MetricCards } from './components/MetricCards';
import { TimeseriesChart } from './components/TimeseriesChart';
import { EpisodesTable } from './components/EpisodesTable';
import { TimelineDrawer } from './components/TimelineDrawer';
import { TrafficSimulator } from './components/TrafficSimulator';
import { LoadingSkeleton, ErrorMessage } from './components/States';
import './App.css';

export const App: React.FC = () => {
  // Period presets: 1 (24h), 7 (7 days), 30 (30 days)
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [bucket, setBucket] = useState<TimeseriesBucket>('hour');

  // Overview & Timeseries
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseries | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Episodes List
  const [episodes, setEpisodes] = useState<AnomalyEpisodeListItem[]>([]);
  const [episodesTotal, setEpisodesTotal] = useState<number>(0);
  const [episodesPage, setEpisodesPage] = useState<number>(1);
  const [episodesStatus, setEpisodesStatus] = useState<string>('ALL');
  const [isEpisodesLoading, setIsEpisodesLoading] = useState<boolean>(false);

  // Timeline Drawer
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [episodeTimeline, setEpisodeTimeline] = useState<EpisodeTimeline | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  // Load Overview & Timeseries
  const loadMetrics = useCallback(async () => {
    setIsMetricsLoading(true);
    setMetricsError(null);
    try {
      const to = Date.now();
      const from = to - rangeDays * 24 * 3600 * 1000;

      const [overviewData, timeseriesData] = await Promise.all([
        api.getOverview(from, to),
        api.getTimeseries(bucket, from, to),
      ]);

      setOverview(overviewData);
      setTimeseries(timeseriesData);
    } catch (err: any) {
      setMetricsError(err.message || 'Error al cargar los datos analíticos');
    } finally {
      setIsMetricsLoading(false);
    }
  }, [rangeDays, bucket]);

  // Load Episodes Table
  const loadEpisodes = useCallback(async () => {
    setIsEpisodesLoading(true);
    try {
      const resp = await api.getAnomalies(episodesStatus, episodesPage, 10);
      setEpisodes(resp.data || []);
      setEpisodesTotal(resp.total || 0);
    } catch (err: any) {
      console.error('Error cargando episodios:', err.message);
    } finally {
      setIsEpisodesLoading(false);
    }
  }, [episodesStatus, episodesPage]);

  // Initial & range trigger
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  // Handle Episode Selection for Timeline
  const handleSelectEpisode = async (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setIsTimelineLoading(true);
    try {
      const timelineData = await api.getEpisodeTimeline(episodeId);
      setEpisodeTimeline(timelineData);
    } catch (err: any) {
      console.error('Error cargando línea de tiempo:', err.message);
      setEpisodeTimeline(null);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleCloseTimeline = () => {
    setSelectedEpisodeId(null);
    setEpisodeTimeline(null);
  };

  return (
    <div className="dashboard-layout">
      {/* Barra superior de navegación */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-logo">🛡️</div>
          <div>
            <h1>GastroForge Appresso</h1>
            <p className="brand-tagline">Fraud Detection & Anomaly Operations Dashboard</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Selector de Rango Temporal */}
          <div className="range-presets">
            <button
              className={`btn-preset ${rangeDays === 1 ? 'active' : ''}`}
              onClick={() => {
                setRangeDays(1);
                setBucket('hour');
              }}
            >
              24h
            </button>
            <button
              className={`btn-preset ${rangeDays === 7 ? 'active' : ''}`}
              onClick={() => setRangeDays(7)}
            >
              7 días
            </button>
            <button
              className={`btn-preset ${rangeDays === 30 ? 'active' : ''}`}
              onClick={() => {
                setRangeDays(30);
                setBucket('day');
              }}
            >
              30 días
            </button>
          </div>

          <button
            className="btn btn-primary btn-refresh"
            onClick={() => {
              loadMetrics();
              loadEpisodes();
            }}
            disabled={isMetricsLoading}
          >
            {isMetricsLoading ? 'Actualizando...' : '↻ Actualizar'}
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="dashboard-main">
        {isMetricsLoading && !overview ? (
          <LoadingSkeleton message="Cargando panel de control y métricas..." />
        ) : metricsError ? (
          <ErrorMessage message={metricsError} onRetry={loadMetrics} />
        ) : overview && timeseries ? (
          <>
            {/* 1. Tarjetas de métricas agregadas */}
            <section className="section-overview">
              <MetricCards overview={overview} />
            </section>

            {/* 2. Gráfico de evolución temporal */}
            <section className="section-chart">
              <TimeseriesChart
                timeseries={timeseries}
                bucket={bucket}
                onBucketChange={(newBucket) => setBucket(newBucket)}
              />
            </section>

            {/* 3. Listado de episodios filtrable y paginado */}
            <section className="section-episodes">
              <EpisodesTable
                episodes={episodes}
                total={episodesTotal}
                currentPage={episodesPage}
                pageSize={10}
                selectedStatus={episodesStatus}
                onStatusChange={(status) => {
                  setEpisodesStatus(status);
                  setEpisodesPage(1);
                }}
                onPageChange={(page) => setEpisodesPage(page)}
                onSelectEpisode={handleSelectEpisode}
                isLoading={isEpisodesLoading}
              />
            </section>

            {/* 4. Simulador interactivo de conexiones y ráfagas */}
            <section className="section-simulator">
              <TrafficSimulator
                onSimulationComplete={() => {
                  loadMetrics();
                  loadEpisodes();
                }}
              />
            </section>
          </>
        ) : null}
      </main>

      {/* Modal / Slide-over de la línea de tiempo */}
      <TimelineDrawer
        isOpen={!!selectedEpisodeId}
        timeline={episodeTimeline}
        onClose={handleCloseTimeline}
        isLoading={isTimelineLoading}
      />
    </div>
  );
};
