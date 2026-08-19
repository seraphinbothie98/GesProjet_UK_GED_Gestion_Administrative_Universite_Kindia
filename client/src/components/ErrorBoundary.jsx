import React from 'react';
import { AlertTriangle, RefreshCw, Eye, Download, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary captured a component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-red-200 p-8 max-w-lg w-full text-center space-y-5">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-heading font-extrabold text-slate-800 text-lg">
                L'éditeur n'a pas pu charger ce document
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Une erreur est survenue lors de l'initialisation du composant de personnalisation.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-3 bg-red-50 text-red-800 rounded-xl text-[11px] font-mono text-left border border-red-200 overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap gap-2 justify-center font-bold text-xs">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center space-x-1.5 transition"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Réessayer</span>
              </button>

              {this.props.onPreviewFallback && (
                <button
                  onClick={this.props.onPreviewFallback}
                  className="px-4 py-2.5 bg-kindia-blue text-white hover:bg-kindia-lightBlue rounded-xl flex items-center space-x-1.5 shadow transition"
                >
                  <Eye className="w-4 h-4 text-kindia-gold" />
                  <span>Prévisualiser</span>
                </button>
              )}

              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="px-4 py-2.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl flex items-center space-x-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
