import React, { useState } from 'react';
import { CheckCircle2, Eye, Download, Printer, Copy, QrCode, Check, X, ShieldCheck, ExternalLink } from 'lucide-react';
import ReceiptPreviewModal from './ReceiptPreviewModal';
import QRCodeModal from './QRCodeModal';

export default function ReceiptSuccessModal({ 
  documentType = 'INCOMING_MAIL', 
  reference, 
  receipt, 
  isDirectArchive = false,
  officialTypeLabel = '',
  documentTitle = '',
  onClose 
}) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const isMission = documentType === 'MISSION_ORDER';
  const successTitle = isMission 
    ? 'Ordre de mission enregistré avec succès' 
    : 'Courrier entrant enregistré avec succès';

  const receiptId = receipt?.id || receipt?.receipt_id;
  const pdfUrl = receipt?.pdf_url || `/api/receipts/${receiptId}/pdf`;
  const qrCodeData = receipt?.qr_code_data || receipt?.qr_code_data_url;
  const verificationUrl = receipt?.verification_url || `${window.location.origin}/verify/${encodeURIComponent(reference)}`;
  const dateStr = receipt?.created_at 
    ? new Date(receipt.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleCopyRef = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = () => {
    if (!receiptId) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `Recu_${reference.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    setShowPreview(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-lg w-full overflow-hidden text-xs text-slate-800">
          
          {/* Top Success Banner */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-white/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="bg-emerald-800/60 text-emerald-100 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-1">
              ✓ Enregistrement Réussi
            </span>
            <h2 className="font-heading font-extrabold text-lg text-white">
              {successTitle}
            </h2>
            <p className="text-emerald-100 text-xs mt-1">
              {isDirectArchive 
                ? "Le document officiel a été archivé directement et le reçu officiel avec QR Code a été généré."
                : "Le reçu officiel avec QR Code infalsifiable a été généré automatiquement."
              }
            </p>
          </div>

          <div className="p-6 space-y-4">
            
            {/* Reference, Metadata & QR Code Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1.5 flex-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Référence Unique Officielle
                  </span>
                  <span className="font-mono font-extrabold text-base text-kindia-blue block">
                    {reference}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                  {receipt?.receipt_number && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">N° Reçu :</span>
                      <strong className="text-slate-700">{receipt.receipt_number}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date d'enregistrement :</span>
                    <span className="font-medium text-slate-700">{dateStr}</span>
                  </div>
                  {officialTypeLabel && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Type de document :</span>
                      <span className="font-bold text-slate-800 uppercase">{officialTypeLabel}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[10px]">Statut :</span>
                    {isDirectArchive ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] inline-block">
                        Document officiel archivé directement
                      </span>
                    ) : (
                      <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] inline-block">
                        En cours de traitement (Transmission SG)
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-1.5">
                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Certifié UK-GED • QR Code Actif</span>
                  </span>
                </div>
              </div>

              {/* QR Code Mini-Thumbnail */}
              {qrCodeData && (
                <div 
                  onClick={() => setShowQR(true)}
                  className="w-24 h-24 bg-white p-1.5 rounded-xl border border-slate-300 shadow-sm cursor-pointer hover:border-kindia-blue hover:scale-105 transition flex-shrink-0 group relative self-center"
                  title="Cliquer pour agrandir le QR Code"
                >
                  <img src={qrCodeData} alt="QR Code" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-kindia-blue/80 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[9px] font-bold text-center p-1">
                    Agrandir
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons (5 Mandatory Actions) */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Actions disponibles sur le reçu :
              </span>

              <div className="grid grid-cols-2 gap-2">
                {/* 1. Voir le reçu */}
                <button
                  onClick={() => setShowPreview(true)}
                  className="py-2.5 px-3 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 text-xs"
                >
                  <Eye className="w-4 h-4 text-kindia-gold" />
                  <span>Voir le reçu</span>
                </button>

                {/* 2. Télécharger le reçu PDF */}
                <button
                  onClick={handleDownloadPdf}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger PDF</span>
                </button>

                {/* 3. Imprimer le reçu */}
                <button
                  onClick={handlePrint}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 text-xs"
                >
                  <Printer className="w-4 h-4 text-kindia-gold" />
                  <span>Imprimer le reçu</span>
                </button>

                {/* 4. Copier la référence */}
                <button
                  onClick={handleCopyRef}
                  className={`py-2.5 px-3 font-bold rounded-xl border transition flex items-center justify-center space-x-2 text-xs ${
                    copied 
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800' 
                      : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  <span>{copied ? 'Copié !' : 'Copier la référence'}</span>
                </button>
              </div>

              {/* 5. Afficher le QR Code (Full Width) */}
              <button
                onClick={() => setShowQR(true)}
                className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold rounded-xl transition flex items-center justify-center space-x-2 text-xs"
              >
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>Afficher le QR Code de vérification</span>
              </button>
            </div>

            {/* Bottom Dismiss Button */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Sub-Modal: Preview & Print Receipt */}
      {showPreview && receiptId && (
        <ReceiptPreviewModal
          receiptId={receiptId}
          reference={reference}
          pdfUrl={pdfUrl}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Sub-Modal: Large QR Code */}
      {showQR && (
        <QRCodeModal
          reference={reference}
          qrCodeData={qrCodeData}
          verificationUrl={verificationUrl}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
}
