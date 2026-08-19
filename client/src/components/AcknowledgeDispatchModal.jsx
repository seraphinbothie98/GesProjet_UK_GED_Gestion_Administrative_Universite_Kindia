import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, CheckCircle, AlertCircle, FileText, Download, Eye, 
  CheckSquare, ArrowLeft, RefreshCw, Loader2, ShieldCheck, Clock 
} from 'lucide-react';
import AttachmentPreviewModal from './AttachmentPreviewModal';

export default function AcknowledgeDispatchModal({ item, onClose, onSuccess }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (item?.document_id) {
      loadDocument();
    }
  }, [item]);

  const loadDocument = async () => {
    setLoading(true);
    setError('');
    try {
      // Mark as viewed on server first to record consultation
      try {
        await api.viewDispatchRecipient(item.id);
      } catch (viewErr) {
        console.warn('View dispatch recipient log error:', viewErr);
      }

      const data = await api.getDocumentDetail(item.document_id);
      setDoc(data.document || data);
    } catch (err) {
      console.error('Failed to load original document for dispatch acknowledgment:', err);
      setError(err.message || 'Le document original est introuvable ou inaccessible.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await api.acknowledgeDispatch(item.id);
      if (onSuccess) onSuccess(res.message || 'Prise de connaissance confirmée et certifiée avec succès.');
      onClose();
    } catch (err) {
      console.error('Acknowledge error:', err);
      alert(err.message || 'Erreur lors de la prise de connaissance.');
    } finally {
      setConfirming(false);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-kindia-blue to-slate-900 text-white p-5 flex justify-between items-center flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-kindia-gold text-slate-950 font-extrabold flex items-center justify-center text-lg shadow">
              ✍️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold text-kindia-gold bg-kindia-gold/10 border border-kindia-gold/30 px-2 py-0.5 rounded">
                  {item.dispatch_reference}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Prise de Connaissance
                </span>
              </div>
              <h2 className="font-heading font-extrabold text-sm text-white mt-0.5">
                Prise de Connaissance du Document Diffusé
              </h2>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-kindia-blue animate-spin" />
              <p className="text-xs text-slate-600 font-bold">Chargement du document...</p>
              <p className="text-[11px] text-slate-400">Récupération du document original [{item.document_reference}]</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Impossible de charger ce document.</h3>
              <p className="text-xs text-slate-600">
                Référence : <strong className="font-mono text-kindia-blue">{item.document_reference}</strong>
              </p>
              <p className="text-xs text-red-600 font-medium">{error}</p>
              <div className="pt-2 flex justify-center space-x-3">
                <button
                  onClick={loadDocument}
                  className="px-4 py-2 bg-kindia-blue hover:bg-kindia-lightBlue text-white font-bold rounded-xl shadow transition flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>RÉESSAYER</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
                >
                  RETOUR
                </button>
              </div>
            </div>
          ) : doc ? (
            <div className="space-y-4">
              
              {/* DOCUMENT DETAILS CARD */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-kindia-gold uppercase tracking-wider block">
                      Courrier / Document Original
                    </span>
                    <h3 className="font-heading font-extrabold text-sm text-kindia-blue mt-0.5">
                      [{doc.reference}] {doc.title}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                    {doc.document_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Expéditeur Initial :</span>
                    <span className="font-semibold text-slate-700">{doc.sender_name || 'N/A'} {doc.sender_organization ? `(${doc.sender_organization})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Service Émetteur Diffusion :</span>
                    <span className="font-semibold text-slate-700">{item.sender_service_name || 'Secrétariat Central'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date d'enregistrement :</span>
                    <span className="text-slate-700">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>

                {doc.description && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-600 text-xs">
                    <span className="font-bold text-slate-700 block mb-1">Description / Contenu :</span>
                    <p className="whitespace-pre-line leading-relaxed">{doc.description}</p>
                  </div>
                )}

                {item.dispatch_message && (
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 text-blue-950 text-xs italic">
                    <span className="font-bold not-italic block mb-0.5 text-blue-900">Message de diffusion :</span>
                    « {item.dispatch_message} »
                  </div>
                )}
              </div>

              {/* ATTACHMENTS & PREVIEW SECTION */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                <h4 className="font-heading font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center">
                  <FileText className="w-4 h-4 text-kindia-blue mr-1.5" />
                  Pièces Jointes & Scans du Document ({doc.attachments?.length || 0})
                </h4>

                {(!doc.attachments || doc.attachments.length === 0) ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 text-xs">
                    Aucun fichier joint à ce document. Les informations administratives ci-dessus font foi.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {doc.attachments.map((att) => (
                      <div key={att.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="w-5 h-5 text-kindia-blue shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-slate-800 truncate block">{att.file_name}</span>
                            <span className="text-[10px] text-slate-400">{(att.file_size / 1024).toFixed(1)} Ko</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(att)}
                            className="px-3 py-1.5 bg-kindia-blue text-white hover:bg-kindia-lightBlue rounded-lg font-bold text-[11px] transition flex items-center space-x-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5 text-kindia-gold" />
                            <span>PRÉVISUALISER</span>
                          </button>

                          <a
                            href={att.file_path ? `/uploads/${encodeURIComponent(att.file_path.split(/[/\\]/).pop())}` : `/api/documents/attachments/${att.id}/view`}
                            download={att.file_name}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-[11px] text-slate-700 transition flex items-center space-x-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Télécharger</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CONFIRMATION WARNING BANNER */}
              <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 text-amber-950 space-y-1">
                <div className="flex items-center space-x-2 font-heading font-extrabold text-xs text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Attestation d'émargement et de lecture</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  Vous êtes sur le point de confirmer la prise de connaissance de ce document.
                </p>
                <p className="text-[11px] text-amber-800">
                  Cette action certifie formellement que votre service a pris acte de la note/décision administrative. La date, l'heure et votre identité seront inscrites au journal officiel d'émargement.
                </p>
              </div>

            </div>
          ) : null}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 px-6 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition text-xs"
          >
            ANNULER
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || confirming || !doc}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg transition flex items-center space-x-2 text-xs disabled:opacity-50"
          >
            <CheckSquare className="w-4 h-4 text-emerald-200" />
            <span>{confirming ? 'Validation en cours...' : 'CONFIRMER LA PRISE DE CONNAISSANCE'}</span>
          </button>
        </div>

      </div>

      {/* Attachment Preview sub-modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
