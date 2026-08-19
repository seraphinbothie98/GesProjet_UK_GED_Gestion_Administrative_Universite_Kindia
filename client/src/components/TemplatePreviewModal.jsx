import React, { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import { api } from '../services/api';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize, Minimize, 
  ChevronLeft, ChevronRight, FileText, AlertTriangle, RefreshCw, Loader2, Edit3 
} from 'lucide-react';

export default function TemplatePreviewModal({ template, version, onClose, onOpenEditor }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileBlob, setFileBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [odtHtml, setOdtHtml] = useState('');
  
  // Viewer state
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const docxContainerRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Extract version info
  const templateId = template?.id || template?.code;
  const templateName = template?.name || 'Modèle Officiel';
  const versionNum = version?.version_number || version?.version || template?.version || 1;
  const versionId = version?.id || 'current';
  const fileType = (version?.file_type || template?.format || 'DOCX').toUpperCase();

  useEffect(() => {
    loadDocumentPreview();
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [templateId, versionId]);

  const loadDocumentPreview = async () => {
    console.log(`[PREVIEW] template_id = ${templateId}, version_id = ${versionId}, file = ${templateName}`);
    setLoading(true);
    setError('');
    setOdtHtml('');

    try {
      if (fileType === 'ODT') {
        const odtData = await api.getTemplateVersionODTPreview(templateId, versionId);
        setOdtHtml(odtData.html || '<p>Contenu du document ODT vide ou non disponible.</p>');
      } else {
        try {
          const blob = await api.fetchTemplateVersionBlob(templateId, versionId);
          setFileBlob(blob);
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);

          if (fileType === 'DOCX') {
            setTimeout(async () => {
              if (docxContainerRef.current) {
                docxContainerRef.current.innerHTML = '';
                await renderAsync(blob, docxContainerRef.current, null, {
                  inWrapper: true,
                  ignoreWidth: false,
                  ignoreHeight: false,
                  experimental: true
                });
              }
            }, 100);
          }
        } catch (blobErr) {
          // Fallback to customized HTML if physical file is not available or was customized online
          const htmlRes = await api.getTemplateVersionHTML(templateId, versionId);
          if (htmlRes && htmlRes.html) {
            setOdtHtml(htmlRes.html);
          } else {
            throw blobErr;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load template preview:', err);
      setError(err.message || 'Impossible de charger la prévisualisation. Le fichier est peut-être introuvable ou corrompu.');
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 50));
  const handleResetZoom = () => setZoom(100);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (modalContainerRef.current?.requestFullscreen) {
        modalContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleDownloadOriginal = async () => {
    try {
      await api.downloadTemplateVersionFile(templateId, versionId);
    } catch (err) {
      alert('Erreur lors du téléchargement : ' + err.message);
    }
  };

  return (
    <div 
      ref={modalContainerRef}
      className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-50 flex flex-col w-screen h-screen overflow-hidden text-slate-800"
    >
      {/* HEADER */}
      <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex justify-between items-center flex-shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-kindia-blue text-kindia-gold flex items-center justify-center font-bold text-sm shadow">
            👁️
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-sm text-white flex items-center space-x-2">
              <span>Prévisualisation — {templateName}</span>
              <span className="bg-kindia-gold text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold font-mono uppercase">
                Version v{versionNum}
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono border border-slate-700">
                {fileType}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Rendu réel du document officiel importé — Université de Kindia</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="bg-slate-800 text-white px-6 py-2 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3 flex-shrink-0 text-xs font-bold shadow-inner">
        {/* Zoom Controls */}
        <div className="flex items-center space-x-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
          <button 
            onClick={handleZoomOut} 
            disabled={zoom <= 50}
            className="p-1 hover:bg-slate-700 rounded transition disabled:opacity-40" 
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4 text-slate-300" />
          </button>
          
          <span className="font-mono text-kindia-gold text-[11px] px-2 min-w-[50px] text-center">
            {zoom}%
          </span>

          <button 
            onClick={handleZoomIn} 
            disabled={zoom >= 200}
            className="p-1 hover:bg-slate-700 rounded transition disabled:opacity-40" 
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4 text-slate-300" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button 
            onClick={handleResetZoom} 
            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition" 
            title="Réinitialiser le zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Multi-page Navigation */}
        <div className="flex items-center space-x-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700 text-[11px]">
          <button 
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage <= 1}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-slate-300">
            Page <strong className="text-white">{currentPage}</strong> sur {totalPages}
          </span>

          <button 
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Actions: Edit, Download, Fullscreen, Close */}
        <div className="flex items-center space-x-2">
          {onOpenEditor && (
            <button
              onClick={() => {
                onClose();
                onOpenEditor(template, version);
              }}
              className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl transition shadow flex items-center space-x-1.5 border border-kindia-gold/40"
              title="Ouvrir ce modèle exact dans l'Éditeur Word"
            >
              <Edit3 className="w-4 h-4 text-kindia-gold" />
              <span>✍️ Personnaliser ce modèle</span>
            </button>
          )}

          <button
            onClick={handleToggleFullscreen}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition flex items-center space-x-1.5"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Quitter' : 'Plein écran'}</span>
          </button>

          <button
            onClick={handleDownloadOriginal}
            className="px-4 py-1.5 bg-kindia-gold hover:bg-amber-400 text-slate-900 font-extrabold rounded-xl transition shadow flex items-center space-x-1.5"
            title="Télécharger le fichier original"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 bg-slate-950/70 overflow-auto p-4 md:p-8 flex justify-center items-start">
        {loading ? (
          <div className="my-auto flex flex-col items-center justify-center p-12 bg-white/90 rounded-3xl shadow-2xl space-y-4 max-w-md border border-slate-200 text-center">
            <Loader2 className="w-10 h-10 text-kindia-blue animate-spin" />
            <div>
              <h4 className="font-heading font-extrabold text-slate-800 text-base">Chargement de la prévisualisation…</h4>
              <p className="text-xs text-slate-500 mt-1">Préparation du document {fileType} de la version v{versionNum}</p>
            </div>
          </div>
        ) : error ? (
          <div className="my-auto flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-2xl space-y-4 max-w-lg border border-red-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-red-900 text-base">Impossible de prévisualiser le fichier</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{error}</p>
            </div>

            <div className="pt-3 flex flex-wrap gap-2 justify-center">
              <button
                onClick={loadDocumentPreview}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer</span>
              </button>

              <button
                onClick={handleDownloadOriginal}
                className="px-4 py-2 bg-kindia-blue text-white hover:bg-kindia-lightBlue rounded-xl text-xs font-bold flex items-center space-x-1 shadow"
              >
                <Download className="w-3.5 h-3.5 text-kindia-gold" />
                <span>Télécharger le fichier original</span>
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="transition-transform duration-200 origin-top flex justify-center w-full max-w-5xl"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            {/* PDF VIEWER */}
            {fileType === 'PDF' && blobUrl && (
              <div className="w-full h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <iframe
                  src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-full border-0"
                  title={`Prévisualisation PDF - ${templateName}`}
                />
              </div>
            )}

            {/* DOCX VIEWER */}
            {fileType === 'DOCX' && (
              <div className="w-full bg-white rounded-2xl shadow-2xl p-6 md:p-10 border border-slate-200 min-h-[82vh] text-left">
                <div 
                  ref={docxContainerRef} 
                  className="docx-preview-wrapper font-sans leading-relaxed text-slate-900" 
                />
              </div>
            )}

            {/* ODT / HTML / CUSTOMIZED VIEWER */}
            {(fileType === 'ODT' || odtHtml) && (
              <div className="w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12 border border-slate-200 min-h-[82vh] text-left">
                <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-center">
                  <span className="text-xs font-mono font-bold text-kindia-gold uppercase">
                    {fileType === 'ODT' ? 'DOCUMENT OPENOFFICE / LIBREOFFICE (ODT)' : 'DOCUMENT OFFICIEL PERSONNALISÉ'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">v{versionNum}</span>
                </div>
                <div 
                  className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: odtHtml }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
