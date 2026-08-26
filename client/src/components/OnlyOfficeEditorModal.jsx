import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { X, Eye, Edit3, ShieldAlert, Download, RefreshCw, AlertCircle, CheckCircle2, Lock, FileText } from 'lucide-react';

export default function OnlyOfficeEditorModal({ isOpen, onClose, documentId, onSaveSuccess }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionConfig, setSessionConfig] = useState(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const editorRef = useRef(null);
  const readyTimeoutRef = useRef(null);
  const containerIdRef = useRef(`onlyoffice_doc_editor_${documentId || 'doc'}_${Date.now()}`);
  const containerId = containerIdRef.current;

  useEffect(() => {
    if (isOpen && documentId) {
      loadOnlyOfficeSession();
    }
    return () => {
      destroyEditor();
    };
  }, [isOpen, documentId]);

  const loadOnlyOfficeSession = async () => {
    setLoading(true);
    setError('');
    setIsDegraded(false);

    try {
      const data = await api.getOnlyOfficeConfig(documentId);
      setSessionConfig(data);

      // Load Document Server API Script
      const scriptUrl = `${data.docServerUrl}/web-apps/apps/api/documents/api.js`;
      await loadScript(scriptUrl);

      // Initialize Editor instance
      initializeEditor(data.config);
    } catch (err) {
      console.error('ONLYOFFICE initialization error:', err);
      setError(err.message || 'Impossible d’initialiser la session ONLYOFFICE.');
      setIsDegraded(true);
      setLoading(false);
    }
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (window.DocsAPI && window.DocsAPI.DocEditor) {
        return resolve();
      }

      const scriptTimer = setTimeout(() => {
        reject(new Error('Délai de connexion dépassé lors du chargement de DocsAPI ONLYOFFICE.'));
      }, 7000);

      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.onload = () => {
          clearTimeout(scriptTimer);
          resolve();
        };
        existingScript.onerror = () => {
          clearTimeout(scriptTimer);
          reject(new Error('Serveur ONLYOFFICE inaccessible (Erreur de chargement du script DocsAPI)'));
        };
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        clearTimeout(scriptTimer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(scriptTimer);
        reject(new Error('Serveur ONLYOFFICE inaccessible (Vérifiez la connexion ou le service Docker)'));
      };
      document.body.appendChild(script);
    });
  };

  const initializeEditor = (config) => {
    try {
      destroyEditor();

      if (!window.DocsAPI || !window.DocsAPI.DocEditor) {
        throw new Error('L’API DocsAPI ONLYOFFICE n’est pas disponible.');
      }

      // 8-second watchdog timer
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = setTimeout(() => {
        console.warn('ONLYOFFICE onAppReady timed out after 8s');
        setLoading(false);
        setIsDegraded(true);
        setError('Impossible de connecter l’éditeur ONLYOFFICE Document Server. Vérifiez la connexion ou le conteneur Docker.');
      }, 8000);

      // Append events
      const editorConfig = {
        ...config,
        events: {
          onAppReady: () => {
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            setLoading(false);
            setIsDegraded(false);
          },
          onDocumentStateChange: (event) => {
            // When document is modified in editor
          },
          onSave: () => {
            if (onSaveSuccess) onSaveSuccess();
          },
          onError: (event) => {
            console.error('ONLYOFFICE Editor error event:', event);
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            setLoading(false);
            setIsDegraded(true);
            setError(event?.data?.errorDescription || 'Erreur signalée par l’éditeur ONLYOFFICE.');
          }
        }
      };

      editorRef.current = new window.DocsAPI.DocEditor(containerId, editorConfig);
    } catch (e) {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      console.error('Failed to instantiate DocsAPI.DocEditor:', e);
      setIsDegraded(true);
      setLoading(false);
      setError(e.message || 'Erreur lors du rendu du composant éditeur.');
    }
  };

  const destroyEditor = () => {
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
    if (editorRef.current && editorRef.current.destroyEditor) {
      try {
        editorRef.current.destroyEditor();
      } catch (e) {}
      editorRef.current = null;
    }
    // Unlock document on close
    if (documentId) {
      api.unlockOnlyOfficeDocument(documentId).catch(() => {});
    }
  };

  if (!isOpen) return null;

  const isEditMode = sessionConfig?.mode === 'edit';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full h-[95vh] flex flex-col overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="h-14 bg-gradient-to-r from-kindia-blue via-slate-900 to-slate-950 text-white px-4 sm:px-6 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <FileText className="w-4 h-4 text-kindia-gold" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs sm:text-sm text-white truncate">
                  {sessionConfig?.config?.document?.title || 'Éditeur de Documents Administratifs'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 flex items-center space-x-1 ${
                  isEditMode ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                }`}>
                  {isEditMode ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{isEditMode ? 'Édition Interactive' : 'Lecture Seule'}</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                UK-GED • ONLYOFFICE Document Server Intégré • Université de Kindia
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                destroyEditor();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-red-600/80 text-white transition"
              title="Fermer l'éditeur"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lock warning if downgraded to view */}
        {sessionConfig?.lockInfo?.locked && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center space-x-2 shrink-0">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Document en cours d'édition par :</strong> {sessionConfig.lockInfo.lockedBy}. Ouvert en mode consultation pour éviter les conflits de version.
            </span>
          </div>
        )}

        {/* Reason banner if view mode */}
        {!isEditMode && sessionConfig?.reason && !sessionConfig?.lockInfo?.locked && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-1.5 text-[11px] text-blue-900 flex items-center space-x-2 shrink-0">
            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{sessionConfig.reason}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 relative bg-slate-100 overflow-hidden flex items-center justify-center">
          
          {loading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin w-10 h-10 border-4 border-kindia-blue border-t-transparent rounded-full" />
              <div className="text-center">
                <span className="font-bold text-xs text-slate-800 block">Chargement du document dans ONLYOFFICE...</span>
                <span className="text-[11px] text-slate-500">Initialisation de la session sécurisée</span>
              </div>
            </div>
          )}

          {/* Graceful Degradation / Error Fallback */}
          {isDegraded ? (
            <div className="max-w-md p-6 bg-white rounded-2xl shadow-xl border border-slate-200 text-center space-y-4 m-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Éditeur ONLYOFFICE Temporairement Indisponible
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  L'éditeur en ligne est momentanément inaccessible. <strong>Vos documents et archives sont totalement intacts et protégés.</strong>
                </p>
                {error && (
                  <span className="text-[10px] font-mono text-red-600 bg-red-50 p-1.5 rounded block mt-2">
                    {error}
                  </span>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={loadOnlyOfficeSession}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    destroyEditor();
                    onClose();
                  }}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold rounded-xl transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <div id={containerId} className="w-full h-full" />
          )}

        </div>

        {/* Footer info */}
        <div className="h-9 bg-slate-50 border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>Plateforme UK-GED • Versionnage automatique sans écrasement</span>
          <span className="font-medium">Chaque enregistrement génère une nouvelle version officielle</span>
        </div>

      </div>
    </div>
  );
}
