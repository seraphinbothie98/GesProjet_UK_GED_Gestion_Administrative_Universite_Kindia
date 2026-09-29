import React, { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import { api } from '../services/api';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize, Minimize, 
  ChevronLeft, ChevronRight, FileText, AlertTriangle, RefreshCw, Loader2, Edit3, Printer, Sparkles 
} from 'lucide-react';

export default function TemplatePreviewModal({ template, version, onClose, onOpenEditor }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileBlob, setFileBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [odtHtml, setOdtHtml] = useState('');
  const [instSettings, setInstSettings] = useState(null);
  
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

  const isMissionOrder = 
    template?.code === 'ORDRE_001' || 
    template?.code?.includes('OM') || 
    template?.name?.toLowerCase().includes('mission') || 
    template?.document_type_code === 'MISSION_ORDER' ||
    template?.category === 'Missions';

  useEffect(() => {
    loadInstitutionAndPreview();
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [templateId, versionId]);

  const loadInstitutionAndPreview = async () => {
    setLoading(true);
    setError('');
    setOdtHtml('');

    try {
      // 1. Fetch institution settings for metadata
      const instData = await api.getInstitutionSettings().catch(() => null);
      if (instData) setInstSettings(instData);

      // 2. Fetch template file blob and render faithfully
      if (fileType === 'ODT') {
        const odtData = await api.getTemplateVersionODTPreview(templateId, versionId);
        setOdtHtml(odtData.html || '<p>Contenu du document ODT vide ou non disponible.</p>');
      } else {
        try {
          let blob = null;
          if (isMissionOrder && api.fetchMissionTemplateBlob && (!versionId || versionId === 'current')) {
            try {
              blob = await api.fetchMissionTemplateBlob(templateId);
            } catch (e) {
              blob = await api.fetchTemplateVersionBlob(templateId, versionId);
            }
          } else {
            blob = await api.fetchTemplateVersionBlob(templateId, versionId);
          }

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
      setError(err.message || 'Impossible de charger la prévisualisation.');
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

  const handlePrintDocument = () => {
    window.print();
  };

  return (
    <div 
      ref={modalContainerRef}
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col w-screen h-screen overflow-hidden text-slate-800"
    >
      {/* HEADER */}
      <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex justify-between items-center flex-shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-kindia-blue text-kindia-gold flex items-center justify-center font-bold text-sm shadow">
            👁️
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-sm text-white flex items-center space-x-2">
              <span>Prévisualisation Officielle — {templateName}</span>
              <span className="bg-kindia-gold text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold font-mono uppercase">
                Version v{versionNum}
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono border border-slate-700">
                {isMissionOrder ? 'A4 OFFICIEL' : fileType}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Rendu conforme aux normes administratives de l'Université de Kindia</p>
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

        {/* Primary Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrintDocument}
            className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition flex items-center space-x-1.5"
            title="Imprimer le document"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Imprimer</span>
          </button>

          {onOpenEditor && (
            <button
              onClick={() => {
                onClose();
                onOpenEditor(template, version);
              }}
              className="px-4 py-1.5 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-extrabold rounded-xl transition shadow flex items-center space-x-1.5 border border-kindia-gold/40"
              title="Ouvrir dans l'Éditeur"
            >
              <Edit3 className="w-4 h-4 text-kindia-gold" />
              <span>✍️ Personnaliser</span>
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
            title="Télécharger le fichier"
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
              <p className="text-xs text-slate-500 mt-1">Préparation du document officiel</p>
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
