import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Eye, FileText, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, ArrowLeft, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';

export default function AttachmentPreviewModal({ attachment, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState('');
  const docxContainerRef = useRef(null);

  if (!attachment) return null;

  // Retrieve token for secure API streaming if needed
  const token = localStorage.getItem('uk_ged_token') || '';

  // Get clean filename and extension
  const fileName = attachment.file_name || attachment.name || 'Document';
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = attachment.mime_type || '';

  const isPdf = fileExt === 'pdf' || mimeType.includes('pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt) || mimeType.includes('image');
  const isDocx = fileExt === 'docx' || mimeType.includes('wordprocessingml');

  // Compute clean file URL targeting the raw static file or secure stream
  let fileUrl = '';
  if (attachment.id && typeof attachment.id === 'number') {
    fileUrl = `/api/documents/attachments/${attachment.id}/view?token=${encodeURIComponent(token)}`;
  } else if (attachment.file_path) {
    const rawPath = attachment.file_path;
    if (rawPath.startsWith('blob:') || rawPath.startsWith('data:') || rawPath.startsWith('http')) {
      fileUrl = rawPath;
    } else {
      // Extract only the file basename
      const basename = rawPath.split(/[/\\]/).pop();
      fileUrl = `/uploads/${encodeURIComponent(basename)}`;
    }
  } else if (attachment.url) {
    fileUrl = attachment.url;
  }

  useEffect(() => {
    if (isDocx && fileUrl) {
      loadDocxPreview();
    }
  }, [isDocx, fileUrl]);

  const loadDocxPreview = async () => {
    setDocxLoading(true);
    setDocxError('');
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(fileUrl, { headers });
      if (!res.ok) throw new Error('Impossible de charger le fichier DOCX.');
      const blob = await res.blob();
      if (docxContainerRef.current) {
        docxContainerRef.current.innerHTML = '';
        await renderAsync(blob, docxContainerRef.current, null, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true
        });
      }
    } catch (err) {
      console.error('DOCX render error:', err);
      setDocxError('Impossible de générer l’aperçu visuel du document Word (.docx). Vous pouvez le télécharger directement.');
    } finally {
      setDocxLoading(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between overflow-hidden">
      
      {/* Top Navigation Bar */}
      <div className="bg-slate-900 text-white p-3 px-4 sm:px-6 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-md">
        <div className="flex items-center space-x-3 truncate">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Fermer</span>
          </button>

          <div className="flex items-center space-x-2 truncate">
            {isPdf ? (
              <FileText className="w-5 h-5 text-red-400 shrink-0" />
            ) : isImage ? (
              <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-kindia-gold shrink-0" />
            )}
            <div className="truncate">
              <span className="text-[10px] text-kindia-gold font-bold uppercase tracking-wider block">Aperçu Officiel</span>
              <h3 className="font-heading font-bold text-xs sm:text-sm truncate text-white max-w-[200px] sm:max-w-md">{fileName}</h3>
            </div>
          </div>
        </div>

        {/* Viewport Control Bar */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {!isDocx && (
            <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs">
              <button 
                onClick={handleZoomOut} 
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                title="Dézoomer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-1.5 text-[11px] font-bold text-slate-200 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button 
                onClick={handleZoomIn} 
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                title="Zoomer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRotate} 
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition border-l border-slate-700 ml-1"
                title="Pivoter (90°)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button 
                  onClick={handleReset} 
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-amber-400 transition"
                  title="Réinitialiser l'affichage"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <a
            href={fileUrl}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="bg-kindia-blue hover:bg-kindia-lightBlue text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 shadow shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Télécharger</span>
          </a>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Document Viewport Area */}
      <div className="flex-1 bg-slate-900/50 p-2 sm:p-4 overflow-auto flex items-center justify-center relative">
        {isPdf ? (
          <div 
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`, 
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out' 
            }}
            className="w-full h-full max-w-5xl flex items-center justify-center"
          >
            <iframe
              src={fileUrl}
              title={fileName}
              className="w-full h-[82vh] rounded-2xl shadow-2xl border border-slate-700 bg-white"
            />
          </div>
        ) : isImage ? (
          <div className="overflow-auto max-h-full max-w-full flex items-center justify-center p-4">
            <img
              src={fileUrl}
              alt={fileName}
              style={{ 
                transform: `scale(${zoom}) rotate(${rotation}deg)`, 
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out' 
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-700 bg-white"
            />
          </div>
        ) : isDocx ? (
          <div className="w-full h-full max-w-4xl bg-white rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[82vh] border border-slate-700">
            {docxLoading && (
              <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-kindia-blue animate-spin" />
                <p className="text-xs text-slate-600 font-bold">Chargement et rendu du document Word (.docx)...</p>
              </div>
            )}
            {docxError && (
              <div className="p-8 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <h4 className="font-bold text-sm text-slate-800">{fileName}</h4>
                <p className="text-xs text-slate-500">{docxError}</p>
                <a
                  href={fileUrl}
                  download={fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 bg-kindia-blue text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-kindia-lightBlue transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le fichier Word</span>
                </a>
              </div>
            )}
            <div ref={docxContainerRef} className="docx-preview-content" />
          </div>
        ) : (
          <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl text-center max-w-md space-y-4 border border-slate-800">
            <FileText className="w-16 h-16 text-kindia-gold mx-auto" />
            <h4 className="font-bold text-sm text-white">{fileName}</h4>
            <p className="text-xs text-slate-400">
              Format de fichier `.{fileExt}`. Cliquez sur le bouton ci-dessous pour ouvrir ou télécharger le document.
            </p>
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-2 bg-kindia-blue text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:bg-kindia-lightBlue transition"
            >
              <Download className="w-4 h-4" />
              <span>Ouvrir / Télécharger le fichier</span>
            </a>
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="bg-slate-900 p-2.5 px-6 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 shrink-0 font-mono">
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1"></span>
          <span>Prévisualisation sécurisée UK-GED</span>
        </span>
        {attachment.file_size && (
          <span className="text-slate-300 font-semibold">
            {(attachment.file_size / 1024).toFixed(1)} Ko
          </span>
        )}
      </div>

    </div>
  );
}
