import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
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
import { LoadingSkeleton, ErrorMessage } from './components/States';

export const App: React.FC = () => {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [bucket, setBucket] = useState<TimeseriesBucket>('day');

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

  // Timeline Drawer Handlers
  const handleSelectEpisode = useCallback(async (episodeId: string) => {
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
  }, []);

  const handleCloseTimeline = useCallback(() => {
    setSelectedEpisodeId(null);
    setEpisodeTimeline(null);
  }, []);

  const handleRangeChange = useCallback((days: number, newBucket?: TimeseriesBucket) => {
    setRangeDays(days);
    if (newBucket) {
      setBucket(newBucket);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                GastroForge Appresso
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Operaciones
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Fraud Detection & Anomaly Operations Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Range Presets */}
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 1
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(1, 'hour')}
              >
                24h
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 7
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(7)}
              >
                7 días
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === 30
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => handleRangeChange(30, 'day')}
              >
                30 días
              </button>
            </div>

            {/* Zero-CLS Refresh Button */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-w-[104px] rounded-lg text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-sm"
              onClick={() => {
                loadMetrics();
                loadEpisodes();
              }}
              disabled={isMetricsLoading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isMetricsLoading ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isMetricsLoading && !overview ? (
          <LoadingSkeleton message="Cargando panel de control y métricas..." />
        ) : metricsError ? (
          <ErrorMessage message={metricsError} onRetry={loadMetrics} />
        ) : overview && timeseries ? (
          <>
            {/* 1. Tarjetas métricas 3x2 */}
            <section>
              <MetricCards overview={overview} />
            </section>

            {/* 2. Gráfico temporal */}
            <section>
              <TimeseriesChart
                timeseries={timeseries}
                bucket={bucket}
                onBucketChange={(newBucket) => setBucket(newBucket)}
              />
            </section>

            {/* 3. Listado de episodios */}
            <section>
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
          </>
        ) : null}
      </main>

      {/* Slide-over Timeline Drawer */}
      <TimelineDrawer
        isOpen={!!selectedEpisodeId}
        timeline={episodeTimeline}
        onClose={handleCloseTimeline}
        isLoading={isTimelineLoading}
      />
    </div>
  );
};
