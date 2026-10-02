import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadingSkeletonProps {
  message?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  message = 'Cargando datos analíticos...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] p-8 gap-4 text-slate-400">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-slate-800 border-t-sky-400 rounded-full animate-spin" />
      </div>
      <p className="text-xs font-mono tracking-wide text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-center max-w-lg mx-auto my-8 space-y-3">
      <div className="inline-flex p-2 rounded-full bg-rose-500/20 text-rose-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-white">Error al cargar información</h4>
      <p className="text-xs text-rose-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
};
