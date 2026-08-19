import React, { useRef } from 'react';
import { X, Download, Printer, ExternalLink, ShieldCheck, FileText } from 'lucide-react';

export default function ReceiptPreviewModal({ receiptId, reference, pdfUrl, onClose }) {
  const iframeRef = useRef(null);

  // Normalize URL to always target the PDF endpoint
  let resolvedPdfUrl = pdfUrl || `/api/receipts/${receiptId}/pdf`;
  if (resolvedPdfUrl && !resolvedPdfUrl.endsWith('/pdf') && !resolvedPdfUrl.includes('/pdf?')) {
    resolvedPdfUrl = `${resolvedPdfUrl}/pdf`;
  }

  const token = localStorage.getItem('uk_ged_token');
  const authenticatedUrl = token 
    ? (resolvedPdfUrl.includes('?') ? `${resolvedPdfUrl}&token=${encodeURIComponent(token)}` : `${resolvedPdfUrl}?token=${encodeURIComponent(token)}`)
    : resolvedPdfUrl;

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (e) {
        // Fallback: Open in new tab and trigger print
        const win = window.open(authenticatedUrl, '_blank');
        if (win) win.print();
      }
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = authenticatedUrl;
    a.download = `Recu_Officiel_${(reference || 'document').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden text-xs">
        
        {/* Modal Top Bar */}
        <div className="bg-kindia-blue text-white px-6 py-4 flex items-center justify-between border-b border-kindia-lightBlue/30">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-kindia-gold text-slate-950 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-heading font-extrabold text-sm text-white">
                  Reçu Officiel d'Enregistrement UK-GED
                </h3>
                <span className="bg-kindia-gold text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Certifié
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                Réf : {reference}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4 text-kindia-gold" />
              <span>Imprimer</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embedded PDF Viewer Frame */}
        <div className="flex-1 bg-slate-100 p-2 relative">
          <iframe
            ref={iframeRef}
            src={`${authenticatedUrl}#toolbar=1&navpanes=0`}
            title="Reçu Officiel PDF"
            className="w-full h-full rounded-2xl border border-slate-300 bg-white shadow-inner"
          />
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span className="flex items-center space-x-1 font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Document numérique officiel généré avec QR Code actif</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
