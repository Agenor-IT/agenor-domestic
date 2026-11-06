import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#070D1B] p-4 text-white">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0B1329] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="text-lg font-bold">Ocurrió un error inesperado</h2>
            </div>
            <p className="mt-3 text-xs text-[#94A3B8]">
              {this.state.error?.message || 'Error de renderizado.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 flex items-center justify-center gap-2 w-full rounded-xl bg-[#0088FF] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar la aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
